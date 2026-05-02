import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { listingsTable, usersTable, transactionsTable } from "@workspace/db/schema";
import { eq, and, gte, lte, ilike, or, inArray } from "drizzle-orm";
import { requireAuth, type AuthRequest } from "../middlewares/auth";
import { verifyTurnstile, getClientIpFromRequest } from "../lib/turnstile";
import { deleteListingImages } from "../lib/cleanup-job";

const router: IRouter = Router();

function escapeLike(str: string): string {
  return str.replace(/[%_\\]/g, '\\$&');
}

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

router.get("/listings/my", requireAuth, async (req: AuthRequest, res) => {
  const userId = req.userId!;
  const listings = await db.query.listingsTable.findMany({
    where: eq(listingsTable.sellerId, userId),
    orderBy: (l, { desc }) => [desc(l.createdAt)],
  });

  const result = listings.map((l) => formatListing(l, req.user!));
  res.json(result);
});

router.get("/listings", async (req, res) => {
  const { game, category, minPrice, maxPrice, search } = req.query;

  const conditions = [eq(listingsTable.status, "active")];

  if (game) conditions.push(eq(listingsTable.game, game as string));
  if (category) conditions.push(eq(listingsTable.category, category as string));
  if (minPrice) conditions.push(gte(listingsTable.price, parseFloat(minPrice as string)));
  if (maxPrice) conditions.push(lte(listingsTable.price, parseFloat(maxPrice as string)));
  if (search) {
    const escaped = escapeLike(search as string);
    conditions.push(
      or(
        ilike(listingsTable.title, `%${escaped}%`),
        ilike(listingsTable.description, `%${escaped}%`),
        ilike(listingsTable.game, `%${escaped}%`)
      )!
    );
  }

  const listings = await db.query.listingsTable.findMany({
    where: and(...conditions),
    with: { seller: true },
    orderBy: (l, { desc }) => [desc(l.createdAt)],
  });

  const result = listings.map((l) => formatListing(l, l.seller));
  res.json(result);
});

router.get("/listings/:listingId", async (req, res) => {
  const listingId = parseInt(req.params.listingId);
  if (isNaN(listingId)) {
    res.status(400).json({ error: "Bad request", message: "Invalid listing ID" });
    return;
  }

  const listing = await db.query.listingsTable.findFirst({
    where: eq(listingsTable.id, listingId),
    with: { seller: true },
  });

  if (!listing) {
    res.status(404).json({ error: "Not found", message: "Listing not found" });
    return;
  }

  res.json(formatListing(listing, listing.seller));
});

router.post("/listings", requireAuth, async (req: AuthRequest, res) => {
  const { title, description, game, category, price, imageUrl, stock } = req.body;
  const userId = req.userId!;

  if (!title || !description || !game || !category || price == null) {
    res.status(400).json({ error: "Bad request", message: "Missing required fields" });
    return;
  }

  if (typeof title === "string" && title.length > 200) {
    res.status(400).json({ error: "Bad request", message: "Judul terlalu panjang (maks 200 karakter)" });
    return;
  }

  if (typeof description === "string" && description.length > 5000) {
    res.status(400).json({ error: "Bad request", message: "Deskripsi terlalu panjang (maks 5000 karakter)" });
    return;
  }

  const parsedPrice = parseFloat(price);
  if (!Number.isFinite(parsedPrice) || parsedPrice <= 0) {
    res.status(400).json({ error: "Bad request", message: "Harga harus berupa angka positif" });
    return;
  }

  if (parsedPrice > 100_000_000) {
    res.status(400).json({ error: "Bad request", message: "Harga maksimal Rp 100.000.000" });
    return;
  }

  // Verifikasi Turnstile anti-bot
  const cfToken = req.headers["x-cf-turnstile-response"] as string | undefined;
  const turnstile = await verifyTurnstile(cfToken, getClientIpFromRequest(req));
  if (!turnstile.success) {
    res.status(400).json({ error: "Bad request", message: turnstile.error ?? "Verifikasi bot gagal" });
    return;
  }

  const hasQuantity = QUANTITY_CATEGORIES.has(category);
  const parsedStock = hasQuantity ? Math.max(1, Math.min(10000, parseInt(stock) || 1)) : 1;

  // Validate imageUrl
  let validImageUrl: string | null = null;
  if (imageUrl && typeof imageUrl === "string") {
    const storageUrl = process.env.API_URL || "https://api.p2pmarket.web.id";
    if (imageUrl.startsWith(storageUrl) || imageUrl.startsWith("/storage/")) {
      validImageUrl = imageUrl;
    }
  }

  const [listing] = await db.insert(listingsTable).values({
    sellerId: userId,
    title,
    description,
    game,
    category,
    price: parsedPrice,
    stock: parsedStock,
    imageUrl: validImageUrl,
    status: "active",
  }).returning();

  res.status(201).json(formatListing(listing, req.user!));
});

router.patch("/listings/:listingId", requireAuth, async (req: AuthRequest, res) => {
  const listingId = parseInt(req.params.listingId);
  const userId = req.userId!;

  if (isNaN(listingId)) {
    res.status(400).json({ error: "Bad request", message: "Invalid listing ID" });
    return;
  }

  const listing = await db.query.listingsTable.findFirst({
    where: eq(listingsTable.id, listingId),
    with: { seller: true },
  });

  if (!listing) {
    res.status(404).json({ error: "Not found", message: "Listing not found" });
    return;
  }

  if (listing.sellerId !== userId) {
    res.status(403).json({ error: "Forbidden", message: "You can only update your own listings" });
    return;
  }

  if (listing.status !== "active") {
    res.status(400).json({ error: "Bad request", message: "Only active listings can be updated" });
    return;
  }

  const { title, description, game, category, price, imageUrl, stock } = req.body;

  if (title !== undefined && typeof title === "string" && title.length > 200) {
    res.status(400).json({ error: "Bad request", message: "Judul terlalu panjang (maks 200 karakter)" });
    return;
  }

  if (description !== undefined && typeof description === "string" && description.length > 5000) {
    res.status(400).json({ error: "Bad request", message: "Deskripsi terlalu panjang (maks 5000 karakter)" });
    return;
  }

  if (price !== undefined) {
    const parsedPrice = parseFloat(price);
    if (!Number.isFinite(parsedPrice) || parsedPrice <= 0) {
      res.status(400).json({ error: "Bad request", message: "Harga harus berupa angka positif" });
      return;
    }
    if (parsedPrice > 100_000_000) {
      res.status(400).json({ error: "Bad request", message: "Harga maksimal Rp 100.000.000" });
      return;
    }
  }

  const updates: Partial<typeof listingsTable.$inferInsert> = {};
  if (title !== undefined) updates.title = title;
  if (description !== undefined) updates.description = description;
  if (game !== undefined) updates.game = game;
  if (category !== undefined) updates.category = category;
  if (price !== undefined) updates.price = parseFloat(price);
  if (imageUrl !== undefined) updates.imageUrl = imageUrl;
  if (stock !== undefined) {
    const targetCategory = (category as string | undefined) ?? listing.category;
    if (QUANTITY_CATEGORIES.has(targetCategory)) {
      updates.stock = Math.max(1, parseInt(stock));
    }
  }

  if (Object.keys(updates).length === 0) {
    res.status(400).json({ error: "Bad request", message: "No fields to update" });
    return;
  }

  const [updated] = await db.update(listingsTable)
    .set(updates)
    .where(eq(listingsTable.id, listingId))
    .returning();

  res.json(formatListing(updated, listing.seller));
});

router.delete("/listings/:listingId", requireAuth, async (req: AuthRequest, res) => {
  const listingId = parseInt(req.params.listingId);
  const userId = req.userId!;

  if (isNaN(listingId)) {
    res.status(400).json({ error: "Bad request", message: "Invalid listing ID" });
    return;
  }

  const listing = await db.query.listingsTable.findFirst({
    where: eq(listingsTable.id, listingId),
  });

  if (!listing) {
    res.status(404).json({ error: "Not found", message: "Listing not found" });
    return;
  }

  if (listing.sellerId !== userId) {
    res.status(403).json({ error: "Forbidden", message: "You can only delete your own listings" });
    return;
  }

  const activeTransactions = await db.query.transactionsTable.findFirst({
    where: and(
      eq(transactionsTable.listingId, listingId),
      inArray(transactionsTable.status, ["awaiting_delivery", "delivery_confirmed", "disputed"]),
    ),
  });

  if (activeTransactions) {
    res.status(400).json({ error: "Bad request", message: "Tidak dapat menghapus listing yang memiliki transaksi aktif" });
    return;
  }

  // Hapus image dari disk sebelum hapus record
  await deleteListingImages(listing.imageUrl);

  await db.delete(listingsTable)
    .where(eq(listingsTable.id, listingId));

  res.json({ success: true, message: "Listing deleted" });
});

export default router;
