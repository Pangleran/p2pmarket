import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { usersTable, walletTransactionsTable, withdrawalsTable, transactionsTable, listingsTable, securityLogsTable } from "@workspace/db/schema";
import { eq, desc, and, sql, lte } from "drizzle-orm";
import { requireAuth, type AuthRequest } from "../middlewares/auth";
import { deleteListingImages } from "../lib/cleanup-job";

const ADMIN_DISCORD_ID = "970041350865170462";

const router: IRouter = Router();

function requireAdmin(req: AuthRequest, res: any, next: any) {
  requireAuth(req, res, () => {
    if (req.user?.discordId !== ADMIN_DISCORD_ID) {
      res.status(403).json({ error: "Forbidden", message: "Akses ditolak" });
      return;
    }
    next();
  });
}

// ─── PENDING COUNTS ────────────────────────────────────────────────────────

router.get("/admin/pending-counts", requireAdmin, async (req: AuthRequest, res) => {
  const [withdrawalRows, disputeRows] = await Promise.all([
    db.query.withdrawalsTable.findMany({ where: eq(withdrawalsTable.status, "pending") }),
    db.query.transactionsTable.findMany({ where: eq(transactionsTable.status, "disputed") }),
  ]);
  res.json({ topups: 0, withdrawals: withdrawalRows.length, disputes: disputeRows.length });
});

// ─── DISPUTES ───────────────────────────────────────────────────────────────

async function getAdminTransaction(txId: number) {
  const tx = await db.query.transactionsTable.findFirst({ where: eq(transactionsTable.id, txId) });
  if (!tx) return null;
  const [listing, buyer, seller] = await Promise.all([
    db.query.listingsTable.findFirst({ where: eq(listingsTable.id, tx.listingId) }),
    db.query.usersTable.findFirst({ where: eq(usersTable.id, tx.buyerId) }),
    db.query.usersTable.findFirst({ where: eq(usersTable.id, tx.sellerId) }),
  ]);
  if (!listing || !buyer || !seller) return null;
  return { ...tx, listing, buyer, seller };
}

router.get("/admin/disputes", requireAdmin, async (req: AuthRequest, res) => {
  const disputed = await db.query.transactionsTable.findMany({
    where: eq(transactionsTable.status, "disputed"),
    orderBy: (t, { desc }) => [desc(t.updatedAt)],
  });
  const results = await Promise.all(disputed.map(t => getAdminTransaction(t.id)));
  res.json(results.filter(Boolean));
});

router.post("/admin/disputes/:txId/resolve-buyer", requireAdmin, async (req: AuthRequest, res) => {
  const txId = parseInt(req.params.txId);
  const { adminNote } = req.body ?? {};

  try {
    const result = await db.transaction(async (trx) => {
      // Atomic: update status from "disputed" to "cancelled"
      const [updatedTx] = await trx.update(transactionsTable)
        .set({ status: "cancelled", disputeReason: sql`COALESCE(${transactionsTable.disputeReason}, '') || ${adminNote ? `\n[Admin] ${adminNote}` : ""}`, updatedAt: new Date() })
        .where(and(eq(transactionsTable.id, txId), eq(transactionsTable.status, "disputed")))
        .returning();

      if (!updatedTx) return null;

      // Financial operations in same transaction
      await trx.update(usersTable).set({
        escrowBalance: sql`${usersTable.escrowBalance} - ${updatedTx.amount}`,
        walletBalance: sql`${usersTable.walletBalance} + ${updatedTx.amount}`,
      }).where(eq(usersTable.id, updatedTx.buyerId));

      await trx.update(listingsTable).set({ status: "active", stock: sql`${listingsTable.stock} + ${updatedTx.quantity}` }).where(eq(listingsTable.id, updatedTx.listingId));

      await trx.insert(walletTransactionsTable).values({
        userId: updatedTx.buyerId,
        type: "refund",
        amount: updatedTx.amount,
        description: `Refund sengketa #${txId} - dimenangkan pembeli${adminNote ? `: ${adminNote}` : ""}`,
      });

      return updatedTx;
    });

    if (!result) {
      const exists = await db.query.transactionsTable.findFirst({ where: eq(transactionsTable.id, txId) });
      if (!exists) { res.status(404).json({ error: "Not found" }); return; }
      res.status(400).json({ error: "Already resolved" }); return;
    }

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: "Internal error", message: "Gagal menyelesaikan sengketa" });
  }
});

router.post("/admin/disputes/:txId/resolve-seller", requireAdmin, async (req: AuthRequest, res) => {
  const txId = parseInt(req.params.txId);
  const { adminNote } = req.body ?? {};

  try {
    const result = await db.transaction(async (trx) => {
      // Atomic: update status from "disputed" to "completed"
      const [updatedTx] = await trx.update(transactionsTable)
        .set({ status: "completed", disputeReason: sql`COALESCE(${transactionsTable.disputeReason}, '') || ${adminNote ? `\n[Admin] ${adminNote}` : ""}`, updatedAt: new Date() })
        .where(and(eq(transactionsTable.id, txId), eq(transactionsTable.status, "disputed")))
        .returning();

      if (!updatedTx) return null;

      // Financial operations in same transaction
      await trx.update(usersTable).set({
        escrowBalance: sql`${usersTable.escrowBalance} - ${updatedTx.amount}`,
        totalTrades: sql`${usersTable.totalTrades} + 1`,
      }).where(eq(usersTable.id, updatedTx.buyerId));

      await trx.update(usersTable).set({
        walletBalance: sql`${usersTable.walletBalance} + ${updatedTx.amount}`,
        totalTrades: sql`${usersTable.totalTrades} + 1`,
      }).where(eq(usersTable.id, updatedTx.sellerId));

      await trx.insert(walletTransactionsTable).values({ userId: updatedTx.sellerId, type: "payment_received", amount: updatedTx.amount, description: `Sengketa #${txId} dimenangkan penjual${adminNote ? `: ${adminNote}` : ""}` });
      await trx.insert(walletTransactionsTable).values({ userId: updatedTx.buyerId, type: "escrow_release", amount: 0, description: `Escrow sengketa #${txId} dilepas ke penjual` });

      return updatedTx;
    });

    if (!result) {
      const exists = await db.query.transactionsTable.findFirst({ where: eq(transactionsTable.id, txId) });
      if (!exists) { res.status(404).json({ error: "Not found" }); return; }
      res.status(400).json({ error: "Already resolved" }); return;
    }

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: "Internal error", message: "Gagal menyelesaikan sengketa" });
  }
});

// ─── WITHDRAWALS ───────────────────────────────────────────────────────────

router.get("/admin/withdrawals", requireAdmin, async (req: AuthRequest, res) => {
  const withdrawals = await db.query.withdrawalsTable.findMany({
    with: { user: true },
    orderBy: (w, { desc }) => [desc(w.createdAt)],
  });
  res.json(withdrawals);
});

router.post("/admin/withdrawals/:withdrawalId/approve", requireAdmin, async (req: AuthRequest, res) => {
  const { withdrawalId } = req.params;

  const existing = await db.query.withdrawalsTable.findFirst({
    where: eq(withdrawalsTable.id, parseInt(withdrawalId)),
  });

  if (!existing) { res.status(404).json({ error: "Not found" }); return; }
  if (existing.status !== "pending") {
    res.status(400).json({ error: "Bad request", message: "Penarikan sudah diproses" });
    return;
  }

  const [updated] = await db.update(withdrawalsTable)
    .set({ status: "approved", updatedAt: new Date() })
    .where(and(eq(withdrawalsTable.id, parseInt(withdrawalId)), eq(withdrawalsTable.status, "pending")))
    .returning();

  if (!updated) {
    res.status(400).json({ error: "Bad request", message: "Penarikan sudah diproses sebelumnya" });
    return;
  }

  res.json(updated);
});

router.post("/admin/withdrawals/:withdrawalId/reject", requireAdmin, async (req: AuthRequest, res) => {
  const { withdrawalId } = req.params;
  const { adminNote } = req.body ?? {};

  const existing = await db.query.withdrawalsTable.findFirst({
    where: eq(withdrawalsTable.id, parseInt(withdrawalId)),
    with: { user: true },
  });

  if (!existing) { res.status(404).json({ error: "Not found" }); return; }
  if (existing.status !== "pending") {
    res.status(400).json({ error: "Bad request", message: "Penarikan sudah diproses" });
    return;
  }

  const [updated] = await db.update(withdrawalsTable)
    .set({ status: "rejected", adminNote: adminNote ?? null, updatedAt: new Date() })
    .where(and(eq(withdrawalsTable.id, parseInt(withdrawalId)), eq(withdrawalsTable.status, "pending")))
    .returning();

  if (!updated) {
    res.status(400).json({ error: "Bad request", message: "Penarikan sudah diproses" });
    return;
  }

  await db.update(usersTable)
    .set({ walletBalance: sql`${usersTable.walletBalance} + ${existing.amount}` })
    .where(eq(usersTable.id, existing.userId));

  await db.insert(walletTransactionsTable).values({
    userId: existing.userId,
    type: "refund",
    amount: existing.amount,
    description: `Penarikan ditolak admin - Rp ${existing.amount.toLocaleString("id-ID")} dikembalikan${adminNote ? `: ${adminNote}` : ""}`,
  });

  res.json(updated);
});

// ─── USERS ─────────────────────────────────────────────────────────────────

/**
 * Sanitize avatarUrl — jika masih berisi URL Discord CDN, ganti dengan URL proxy.
 */
function safeAvatarUrl(user: { id: number; avatarUrl: string | null }): string | null {
  if (!user.avatarUrl) return null;
  if (user.avatarUrl.includes("cdn.discordapp.com")) {
    const apiBaseUrl = process.env.API_URL || `http://localhost:${process.env.PORT || 3001}`;
    return `${apiBaseUrl}/users/${user.id}/avatar`;
  }
  return user.avatarUrl;
}

router.get("/admin/users", requireAdmin, async (req: AuthRequest, res) => {
  const users = await db.query.usersTable.findMany({
    orderBy: (u, { desc }) => [desc(u.joinedAt)],
  });

  const result = users.map(u => ({
    id: u.id,
    username: u.username,
    discordId: u.discordId,
    avatarUrl: safeAvatarUrl(u),
    walletBalance: u.walletBalance,
    escrowBalance: u.escrowBalance,
    rating: u.rating,
    totalTrades: u.totalTrades,
    isBanned: u.isBanned,
    banReason: u.banReason,
    lastLoginAt: u.lastLoginAt,
    lastLoginIp: u.lastLoginIp,
    lastLoginDevice: u.lastLoginDevice,
    joinedAt: u.joinedAt,
  }));

  res.json(result);
});

router.post("/admin/users/:userId/ban", requireAdmin, async (req: AuthRequest, res) => {
  const { userId } = req.params;
  const { reason } = req.body ?? {};

  const user = await db.query.usersTable.findFirst({
    where: eq(usersTable.id, parseInt(userId)),
  });

  if (!user) { res.status(404).json({ error: "Not found" }); return; }
  if (user.discordId === ADMIN_DISCORD_ID) {
    res.status(400).json({ error: "Bad request", message: "Tidak bisa ban admin" });
    return;
  }

  const [updated] = await db.update(usersTable)
    .set({ isBanned: true, banReason: reason ?? null, sessionToken: null })
    .where(eq(usersTable.id, parseInt(userId)))
    .returning();

  // Hapus semua listing aktif milik user yang di-ban (beserta image-nya)
  const bannedListings = await db.query.listingsTable.findMany({
    columns: { imageUrl: true },
    where: and(eq(listingsTable.sellerId, parseInt(userId)), eq(listingsTable.status, "active")),
  });

  // Hapus image dari disk
  await Promise.all(bannedListings.map(l => deleteListingImages(l.imageUrl)));

  // Hapus record listing
  await db.delete(listingsTable)
    .where(and(eq(listingsTable.sellerId, parseInt(userId)), eq(listingsTable.status, "active")));

  res.json({ success: true, user: { id: updated.id, username: updated.username, isBanned: updated.isBanned } });
});

router.post("/admin/users/:userId/unban", requireAdmin, async (req: AuthRequest, res) => {
  const { userId } = req.params;

  const user = await db.query.usersTable.findFirst({
    where: eq(usersTable.id, parseInt(userId)),
  });

  if (!user) { res.status(404).json({ error: "Not found" }); return; }

  const [updated] = await db.update(usersTable)
    .set({ isBanned: false, banReason: null })
    .where(eq(usersTable.id, parseInt(userId)))
    .returning();

  res.json({ success: true, user: { id: updated.id, username: updated.username, isBanned: updated.isBanned } });
});

// ─── SYNC USERNAMES ─────────────────────────────────────────────────────────

router.post("/admin/sync-usernames", requireAdmin, async (req: AuthRequest, res) => {
  const botToken = process.env.DISCORD_BOT_TOKEN;
  if (!botToken) {
    res.status(500).json({ error: "DISCORD_BOT_TOKEN belum dikonfigurasi di .env" });
    return;
  }

  const users = await db.query.usersTable.findMany();
  const results: { id: number; oldUsername: string; newUsername: string }[] = [];
  const errors: { id: number; discordId: string; error: string }[] = [];

  for (const user of users) {
    try {
      const discordRes = await fetch(`https://discord.com/api/v10/users/${user.discordId}`, {
        headers: { Authorization: `Bot ${botToken}` },
      });

      if (!discordRes.ok) {
        errors.push({ id: user.id, discordId: user.discordId, error: `Discord API ${discordRes.status}` });
        continue;
      }

      const discordUser = await discordRes.json() as { username: string; avatar: string | null };
      
      if (discordUser.username !== user.username || discordUser.avatar !== user.discordAvatarHash) {
        const apiBaseUrl = process.env.API_URL || `http://localhost:${process.env.PORT || 3001}`;
        const discordAvatarHash = discordUser.avatar || null;
        const avatarUrl = discordAvatarHash
          ? `${apiBaseUrl}/users/${user.id}/avatar`
          : `https://api.dicebear.com/7.x/avataaars/svg?seed=${discordUser.username}`;

        await db.update(usersTable)
          .set({ username: discordUser.username, avatarUrl, discordAvatarHash })
          .where(eq(usersTable.id, user.id));

        results.push({ id: user.id, oldUsername: user.username, newUsername: discordUser.username });
      }

      // Rate limit: Discord allows 50 req/sec, kita pakai delay 100ms biar aman
      await new Promise(resolve => setTimeout(resolve, 100));
    } catch (err: any) {
      errors.push({ id: user.id, discordId: user.discordId, error: err.message });
    }
  }

  res.json({
    success: true,
    totalUsers: users.length,
    updated: results.length,
    changes: results,
    errors,
  });
});

// ─── SECURITY LOGS ──────────────────────────────────────────────────────────

router.get("/admin/security-logs", requireAdmin, async (_req: AuthRequest, res) => {
  const [logs, totalRows] = await Promise.all([
    db.query.securityLogsTable.findMany({
      orderBy: [desc(securityLogsTable.createdAt)],
      limit: 20,
    }),
    db.select({ count: sql<number>`count(*)::int` }).from(securityLogsTable),
  ]);

  res.json({ logs, total: totalRows[0]?.count ?? 0 });
});

router.delete("/admin/security-logs", requireAdmin, async (_req: AuthRequest, res) => {
  await db.delete(securityLogsTable);
  res.json({ success: true });
});

export default router;
