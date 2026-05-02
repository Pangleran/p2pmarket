import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { transactionsTable, listingsTable, usersTable, walletTransactionsTable } from "@workspace/db/schema";
import { eq, or, inArray, and, gte, sql } from "drizzle-orm";
import { requireAuth, type AuthRequest } from "../middlewares/auth";
import { verifyTurnstile, getClientIpFromRequest } from "../lib/turnstile";
import { financialRateLimit } from "../middlewares/security";
import { notifyTransactionCreated, notifyDispute } from "../lib/activity-webhook";

const router: IRouter = Router();

const QUANTITY_CATEGORIES = new Set([
  "Cowoncy",
  "Ticket Patreon",
  "Ticket Custom Pet",
  "Ticket Custom",
]);

const ADMIN_DISCORD_ID = "970041350865170462";

/**
 * Sanitize avatarUrl — jika masih berisi URL Discord CDN (mengekspos Discord ID),
 * ganti dengan URL proxy internal yang aman.
 */
function safeAvatarUrl(user: typeof usersTable.$inferSelect): string | null {
  if (!user.avatarUrl) return null;
  if (user.avatarUrl.includes("cdn.discordapp.com")) {
    const apiBaseUrl = process.env.API_URL || `http://localhost:${process.env.PORT || 3001}`;
    return `${apiBaseUrl}/users/${user.id}/avatar`;
  }
  return user.avatarUrl;
}

const formatUser = (user: typeof usersTable.$inferSelect) => ({
  id: user.id,
  username: user.username,
  avatarUrl: safeAvatarUrl(user),
  rating: user.rating,
  totalTrades: user.totalTrades,
  isAdmin: user.discordId === ADMIN_DISCORD_ID,
  joinedAt: user.joinedAt,
});

const formatListing = (listing: typeof listingsTable.$inferSelect, seller: typeof usersTable.$inferSelect) => ({
  id: listing.id,
  sellerId: listing.sellerId,
  seller: formatUser(seller),
  title: listing.title,
  description: listing.description,
  game: listing.game,
  category: listing.category,
  price: listing.price,
  stock: listing.stock,
  hasQuantity: QUANTITY_CATEGORIES.has(listing.category),
  imageUrl: listing.imageUrl,
  status: listing.status,
  createdAt: listing.createdAt,
  updatedAt: listing.updatedAt,
});

const formatTransaction = (
  tx: typeof transactionsTable.$inferSelect,
  listing: typeof listingsTable.$inferSelect,
  listingSeller: typeof usersTable.$inferSelect,
  buyer: typeof usersTable.$inferSelect,
  seller: typeof usersTable.$inferSelect
) => ({
  id: tx.id,
  listingId: tx.listingId,
  listing: formatListing(listing, listingSeller),
  buyerId: tx.buyerId,
  buyer: formatUser(buyer),
  sellerId: tx.sellerId,
  seller: formatUser(seller),
  amount: tx.amount,
  quantity: tx.quantity,
  status: tx.status,
  sellerProofUrl: tx.sellerProofUrl,
  buyerProofUrl: tx.buyerProofUrl,
  disputeReason: tx.disputeReason,
  createdAt: tx.createdAt,
  updatedAt: tx.updatedAt,
});

async function getFullTransaction(txId: number) {
  const tx = await db.query.transactionsTable.findFirst({
    where: eq(transactionsTable.id, txId),
  });
  if (!tx) return null;

  const [listing, buyer, seller] = await Promise.all([
    db.query.listingsTable.findFirst({ where: eq(listingsTable.id, tx.listingId), with: { seller: true } }),
    db.query.usersTable.findFirst({ where: eq(usersTable.id, tx.buyerId) }),
    db.query.usersTable.findFirst({ where: eq(usersTable.id, tx.sellerId) }),
  ]);

  if (!listing || !buyer || !seller) return null;
  return formatTransaction(tx, listing, listing.seller, buyer, seller);
}

router.get("/transactions", requireAuth, async (req: AuthRequest, res) => {
  const userId = req.userId!;
  const txns = await db.query.transactionsTable.findMany({
    where: or(
      eq(transactionsTable.buyerId, userId),
      eq(transactionsTable.sellerId, userId)
    ),
    orderBy: (t, { desc }) => [desc(t.createdAt)],
  });

  const results = await Promise.all(txns.map((tx) => getFullTransaction(tx.id)));
  res.json(results.filter(Boolean));
});

router.post("/transactions", financialRateLimit, requireAuth, async (req: AuthRequest, res) => {
  const { listingId, quantity } = req.body;
  const buyerId = req.userId!;
  const buyer = req.user!;

  // Verifikasi Turnstile anti-bot
  const cfToken = req.headers["x-cf-turnstile-response"] as string | undefined;
  const turnstile = await verifyTurnstile(cfToken, getClientIpFromRequest(req));
  if (!turnstile.success) {
    res.status(400).json({ error: "Bad request", message: turnstile.error ?? "Verifikasi bot gagal" });
    return;
  }

  if (!listingId) {
    res.status(400).json({ error: "Bad request", message: "listingId is required" });
    return;
  }

  const listing = await db.query.listingsTable.findFirst({
    where: eq(listingsTable.id, listingId),
  });

  if (!listing) {
    res.status(404).json({ error: "Not found", message: "Listing not found" });
    return;
  }

  if (listing.status !== "active") {
    res.status(400).json({ error: "Bad request", message: "Listing is not available" });
    return;
  }

  if (listing.sellerId === buyerId) {
    res.status(400).json({ error: "Bad request", message: "You cannot buy your own listing" });
    return;
  }

  const hasQuantity = QUANTITY_CATEGORIES.has(listing.category);
  const requestedQty = hasQuantity ? Math.max(1, parseInt(quantity) || 1) : 1;

  if (hasQuantity && requestedQty > listing.stock) {
    res.status(400).json({
      error: "Bad request",
      message: `Stok tidak cukup. Tersedia: ${listing.stock}`,
    });
    return;
  }

  const totalAmount = listing.price * requestedQty;

  const result = await db.transaction(async (trx) => {
    // Atomic: hold buyer balance in escrow hanya jika saldo masih cukup (cegah race condition)
    const [updatedBuyer] = await trx.update(usersTable)
      .set({
        walletBalance: sql`${usersTable.walletBalance} - ${totalAmount}`,
        escrowBalance: sql`${usersTable.escrowBalance} + ${totalAmount}`,
      })
      .where(and(
        eq(usersTable.id, buyerId),
        gte(usersTable.walletBalance, totalAmount),
      ))
      .returning({ id: usersTable.id });

    if (!updatedBuyer) {
      return { error: "Saldo tidak mencukupi" };
    }

    await trx.insert(walletTransactionsTable).values({
      userId: buyerId,
      type: "escrow_hold",
      amount: -totalAmount,
      description: `Escrow untuk pembelian: ${listing.title}${hasQuantity ? ` (x${requestedQty})` : ""}`,
    });

    // Atomic: kurangi stok hanya jika stok masih cukup (cegah race condition)
    const [updatedListing] = await trx.update(listingsTable)
      .set({
        stock: sql`${listingsTable.stock} - ${requestedQty}`,
        status: sql`CASE WHEN ${listingsTable.stock} - ${requestedQty} <= 0 THEN 'sold' ELSE 'active' END`,
        updatedAt: new Date(),
      })
      .where(and(
        eq(listingsTable.id, listingId),
        gte(listingsTable.stock, requestedQty),
      ))
      .returning({ id: listingsTable.id });

    if (!updatedListing) {
      throw new Error("STOCK_INSUFFICIENT");
    }

    // Create transaction
    const [tx] = await trx.insert(transactionsTable).values({
      listingId,
      buyerId,
      sellerId: listing.sellerId,
      amount: totalAmount,
      quantity: requestedQty,
      status: "awaiting_delivery",
    }).returning();

    return { txId: tx.id };
  }).catch((err) => {
    if (err.message === "STOCK_INSUFFICIENT") {
      return { error: "Stok tidak cukup atau listing sudah tidak tersedia" };
    }
    throw err;
  });

  if ("error" in result) {
    res.status(400).json({ error: "Bad request", message: result.error });
    return;
  }

  const full = await getFullTransaction(result.txId);

  // Notify activity webhook
  if (full) {
    const txListing = await db.query.listingsTable.findFirst({ where: eq(listingsTable.id, listingId) });
    if (txListing) {
      const txSeller = await db.query.usersTable.findFirst({ where: eq(usersTable.id, txListing.sellerId) });
      notifyTransactionCreated(req.user!.username, txSeller?.username ?? "Unknown", txListing.title, full.amount);
    }
  }

  res.status(201).json(full);
});

router.get("/transactions/active-count", requireAuth, async (req: AuthRequest, res) => {
  const userId = req.userId!;
  const rows = await db
    .select({ id: transactionsTable.id })
    .from(transactionsTable)
    .where(
      and(
        or(
          eq(transactionsTable.buyerId, userId),
          eq(transactionsTable.sellerId, userId),
        ),
        inArray(transactionsTable.status, ["pending", "awaiting_delivery", "delivery_confirmed", "disputed"]),
      ),
    );
  res.json({ count: rows.length });
});

router.get("/transactions/:transactionId", requireAuth, async (req: AuthRequest, res) => {
  const txId = parseInt(req.params.transactionId);
  if (isNaN(txId)) {
    res.status(400).json({ error: "Bad request", message: "Invalid transaction ID" });
    return;
  }

  const full = await getFullTransaction(txId);
  if (!full) {
    res.status(404).json({ error: "Not found", message: "Transaction not found" });
    return;
  }

  if (full.buyerId !== req.userId && full.sellerId !== req.userId) {
    res.status(403).json({ error: "Forbidden", message: "Access denied" });
    return;
  }

  res.json(full);
});

router.post("/transactions/:transactionId/seller-confirm", financialRateLimit, requireAuth, async (req: AuthRequest, res) => {
  const txId = parseInt(req.params.transactionId);
  const userId = req.userId!;
  const { proofUrl, notes } = req.body;

  const tx = await db.query.transactionsTable.findFirst({
    where: eq(transactionsTable.id, txId),
  });

  if (!tx) {
    res.status(404).json({ error: "Not found", message: "Transaction not found" });
    return;
  }

  if (tx.sellerId !== userId) {
    res.status(403).json({ error: "Forbidden", message: "Only the seller can confirm delivery" });
    return;
  }

  if (tx.status !== "awaiting_delivery") {
    res.status(400).json({ error: "Bad request", message: "Transaction is not in awaiting_delivery status" });
    return;
  }

  if (!proofUrl || (typeof proofUrl === "string" && proofUrl.trim() === "")) {
    res.status(400).json({ error: "Bad request", message: "Bukti pengiriman wajib dilampirkan" });
    return;
  }

  // Validate proofUrl is from our storage
  const apiUrl = process.env.API_URL || "https://api.p2pmarket.web.id";
  if (typeof proofUrl === "string" && !proofUrl.startsWith(apiUrl) && !proofUrl.startsWith("/storage/")) {
    res.status(400).json({ error: "Bad request", message: "URL bukti tidak valid" });
    return;
  }

  const [updated] = await db.update(transactionsTable)
    .set({
      status: "delivery_confirmed",
      sellerProofUrl: proofUrl,
      updatedAt: new Date(),
    })
    .where(and(eq(transactionsTable.id, txId), eq(transactionsTable.status, "awaiting_delivery")))
    .returning({ id: transactionsTable.id });

  if (!updated) {
    res.status(400).json({ error: "Bad request", message: "Status transaksi sudah berubah" });
    return;
  }

  const full = await getFullTransaction(txId);
  res.json(full);
});

router.post("/transactions/:transactionId/buyer-confirm", financialRateLimit, requireAuth, async (req: AuthRequest, res) => {
  const txId = parseInt(req.params.transactionId);
  const userId = req.userId!;
  const { proofUrl } = req.body;

  const tx = await db.query.transactionsTable.findFirst({
    where: eq(transactionsTable.id, txId),
  });

  if (!tx) {
    res.status(404).json({ error: "Not found", message: "Transaction not found" });
    return;
  }

  if (tx.buyerId !== userId) {
    res.status(403).json({ error: "Forbidden", message: "Only the buyer can confirm receipt" });
    return;
  }

  // Hanya boleh konfirmasi setelah seller sudah mark delivery (cegah bypass alur escrow)
  if (tx.status !== "delivery_confirmed") {
    res.status(400).json({
      error: "Bad request",
      message: "Transaksi belum dikonfirmasi pengiriman oleh penjual",
    });
    return;
  }

  // Validate proofUrl if provided
  if (proofUrl && typeof proofUrl === "string") {
    const apiUrl = process.env.API_URL || "https://api.p2pmarket.web.id";
    if (!proofUrl.startsWith(apiUrl) && !proofUrl.startsWith("/storage/")) {
      res.status(400).json({ error: "Bad request", message: "URL bukti tidak valid" });
      return;
    }
  }

  // ALL in a single transaction: status change + financial ops
  const confirmedTx = await db.transaction(async (trx) => {
    const [confirmed] = await trx.update(transactionsTable)
      .set({
        status: "completed",
        buyerProofUrl: proofUrl || null,
        updatedAt: new Date(),
      })
      .where(and(
        eq(transactionsTable.id, txId),
        eq(transactionsTable.status, "delivery_confirmed"),
      ))
      .returning({ id: transactionsTable.id, buyerId: transactionsTable.buyerId, sellerId: transactionsTable.sellerId, amount: transactionsTable.amount });

    if (!confirmed) return null;

    // Financial ops in same transaction
    await trx.update(usersTable)
      .set({
        escrowBalance: sql`${usersTable.escrowBalance} - ${confirmed.amount}`,
        totalTrades: sql`${usersTable.totalTrades} + 1`,
      })
      .where(eq(usersTable.id, confirmed.buyerId));

    await trx.update(usersTable)
      .set({
        walletBalance: sql`${usersTable.walletBalance} + ${confirmed.amount}`,
        totalTrades: sql`${usersTable.totalTrades} + 1`,
      })
      .where(eq(usersTable.id, confirmed.sellerId));

    await trx.insert(walletTransactionsTable).values({
      userId: confirmed.buyerId,
      type: "escrow_release",
      amount: 0,
      description: `Escrow selesai - pembayaran diteruskan ke penjual`,
    });

    await trx.insert(walletTransactionsTable).values({
      userId: confirmed.sellerId,
      type: "payment_received",
      amount: confirmed.amount,
      description: `Pembayaran diterima dari transaksi #${txId}`,
    });

    return confirmed;
  });

  if (!confirmedTx) {
    res.status(400).json({ error: "Bad request", message: "Transaksi tidak dapat dikonfirmasi (sudah diproses atau status berubah)" });
    return;
  }

  const full = await getFullTransaction(txId);
  res.json(full);
});

router.post("/transactions/:transactionId/dispute", financialRateLimit, requireAuth, async (req: AuthRequest, res) => {
  const txId = parseInt(req.params.transactionId);
  const userId = req.userId!;
  const { reason } = req.body;

  if (!reason) {
    res.status(400).json({ error: "Bad request", message: "reason is required" });
    return;
  }

  const tx = await db.query.transactionsTable.findFirst({
    where: eq(transactionsTable.id, txId),
  });

  if (!tx) {
    res.status(404).json({ error: "Not found", message: "Transaction not found" });
    return;
  }

  if (tx.buyerId !== userId && tx.sellerId !== userId) {
    res.status(403).json({ error: "Forbidden", message: "Access denied" });
    return;
  }

  if (!["awaiting_delivery", "delivery_confirmed"].includes(tx.status)) {
    res.status(400).json({ error: "Bad request", message: "Cannot dispute a transaction in this state" });
    return;
  }

  await db.update(transactionsTable)
    .set({
      status: "disputed",
      disputeReason: reason,
      updatedAt: new Date(),
    })
    .where(and(
      eq(transactionsTable.id, txId),
      inArray(transactionsTable.status, ["awaiting_delivery", "delivery_confirmed"]),
    ));

  // Notify dispute
  const listing = await db.query.listingsTable.findFirst({ where: eq(listingsTable.id, tx.listingId) });
  notifyDispute(req.user!.username, listing?.title ?? "Unknown", txId);

  const full = await getFullTransaction(txId);
  res.json(full);
});

export default router;
