import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { usersTable, walletTransactionsTable, withdrawalsTable, topupsTable } from "@workspace/db/schema";
import { and, eq, gte, sql, count } from "drizzle-orm";
import { requireAuth, type AuthRequest } from "../middlewares/auth";
import { financialRateLimit } from "../middlewares/security";
import { verifyTurnstile, getClientIpFromRequest } from "../lib/turnstile";
import { notifyWithdrawalRequest } from "../lib/activity-webhook";

const router: IRouter = Router();

const MAX_TOPUP = 50_000_000;   // 50 juta maks per request topup
const MAX_WITHDRAW = 50_000_000;
const MIN_WITHDRAW = 10_000;    // 10 ribu minimum penarikan

function parsePositiveInt(val: unknown, max: number): number | null {
  const n = Math.floor(Number(val));
  if (!Number.isFinite(n) || n <= 0 || n > max) return null;
  return n;
}

router.get("/wallet/balance", requireAuth, async (req: AuthRequest, res) => {
  const user = req.user!;
  res.json({
    balance: user.walletBalance,
    escrowBalance: user.escrowBalance,
  });
});

router.post("/wallet/topup", financialRateLimit, requireAuth, async (req: AuthRequest, res) => {
  const { method, proofUrl } = req.body;
  const userId = req.userId!;

  const amount = parsePositiveInt(req.body.amount, MAX_TOPUP);
  if (amount === null) {
    res.status(400).json({ error: "Bad request", message: `Amount harus antara 1 dan ${MAX_TOPUP.toLocaleString("id-ID")}` });
    return;
  }

  if (!method) {
    res.status(400).json({ error: "Bad request", message: "Payment method is required" });
    return;
  }

  // Cegah submit topup baru jika masih ada yang pending
  const [existing] = await db
    .select({ count: count() })
    .from(topupsTable)
    .where(and(eq(topupsTable.userId, userId), eq(topupsTable.status, "pending")));

  if ((existing?.count ?? 0) > 0) {
    res.status(400).json({
      error: "Bad request",
      message: "Kamu masih memiliki topup yang sedang menunggu konfirmasi admin. Tunggu hingga diproses sebelum mengajukan topup baru.",
    });
    return;
  }

  const [topup] = await db.insert(topupsTable).values({
    userId,
    amount,
    method,
    proofUrl: proofUrl || null,
    status: "pending",
  }).returning();

  res.status(201).json(topup);
});

router.get("/wallet/transactions", requireAuth, async (req: AuthRequest, res) => {
  const userId = req.userId!;
  const txns = await db.query.walletTransactionsTable.findMany({
    where: eq(walletTransactionsTable.userId, userId),
    orderBy: (t, { desc }) => [desc(t.createdAt)],
    limit: 50,
  });
  res.json(txns);
});

router.post("/wallet/withdraw", financialRateLimit, requireAuth, async (req: AuthRequest, res) => {
  const userId = req.userId!;
  const { method, accountNumber, accountName } = req.body;

  const amount = parsePositiveInt(req.body.amount, MAX_WITHDRAW);
  if (amount === null || amount < MIN_WITHDRAW) {
    res.status(400).json({ error: "Bad request", message: `Jumlah penarikan harus antara Rp ${MIN_WITHDRAW.toLocaleString("id-ID")} dan Rp ${MAX_WITHDRAW.toLocaleString("id-ID")}` });
    return;
  }
  if (!method || !accountNumber || !accountName) {
    res.status(400).json({ error: "Bad request", message: "Semua field wajib diisi" });
    return;
  }

  // Verifikasi Turnstile anti-bot
  const cfToken = req.headers["x-cf-turnstile-response"] as string | undefined;
  const turnstile = await verifyTurnstile(cfToken, getClientIpFromRequest(req));
  if (!turnstile.success) {
    res.status(400).json({ error: "Bad request", message: turnstile.error ?? "Verifikasi bot gagal" });
    return;
  }

  // Cegah submit tarik saldo baru jika masih ada yang pending
  const [existingWd] = await db
    .select({ count: count() })
    .from(withdrawalsTable)
    .where(and(eq(withdrawalsTable.userId, userId), eq(withdrawalsTable.status, "pending")));

  if ((existingWd?.count ?? 0) > 0) {
    res.status(400).json({
      error: "Bad request",
      message: "Kamu masih memiliki permintaan tarik saldo yang sedang diproses admin. Tunggu hingga selesai sebelum mengajukan yang baru.",
    });
    return;
  }

  // Atomic: hanya deduct jika saldo masih cukup (cegah race condition)
  const [updated] = await db.update(usersTable)
    .set({ walletBalance: sql`${usersTable.walletBalance} - ${amount}` })
    .where(and(
      eq(usersTable.id, userId),
      gte(usersTable.walletBalance, amount),
    ))
    .returning({ walletBalance: usersTable.walletBalance });

  if (!updated) {
    res.status(400).json({ error: "Bad request", message: "Saldo tidak mencukupi" });
    return;
  }

  const [withdrawal] = await db.insert(withdrawalsTable).values({
    userId,
    amount,
    method,
    accountNumber,
    accountName,
    status: "pending",
  }).returning();

  await db.insert(walletTransactionsTable).values({
    userId,
    type: "withdrawal",
    amount: -amount,
    description: `Penarikan ke ${method.toUpperCase()} ${accountNumber} - menunggu konfirmasi admin`,
  });

  notifyWithdrawalRequest(req.user!.username, amount, method, accountNumber);

  res.status(201).json(withdrawal);
});

router.post("/wallet/withdraw/:id/cancel", financialRateLimit, requireAuth, async (req: AuthRequest, res) => {
  const userId = req.userId!;
  const withdrawalId = parseInt(req.params.id);

  if (!withdrawalId || isNaN(withdrawalId)) {
    res.status(400).json({ error: "Bad request", message: "ID penarikan tidak valid" });
    return;
  }

  const withdrawal = await db.query.withdrawalsTable.findFirst({
    where: and(eq(withdrawalsTable.id, withdrawalId), eq(withdrawalsTable.userId, userId)),
  });

  if (!withdrawal) {
    res.status(404).json({ error: "Not found", message: "Penarikan tidak ditemukan" });
    return;
  }

  if (withdrawal.status !== "pending") {
    res.status(400).json({ error: "Bad request", message: "Hanya penarikan yang masih pending yang bisa dibatalkan" });
    return;
  }

  // Atomic cancel: delete withdrawal + refund balance in one transaction
  await db.transaction(async (trx) => {
    // Atomic status check + delete (prevents double-cancel)
    const [deleted] = await trx.delete(withdrawalsTable)
      .where(and(eq(withdrawalsTable.id, withdrawalId), eq(withdrawalsTable.status, "pending")))
      .returning({ id: withdrawalsTable.id });

    if (!deleted) return; // Already cancelled/processed by another request

    // Refund balance
    await trx.update(usersTable)
      .set({ walletBalance: sql`${usersTable.walletBalance} + ${withdrawal.amount}` })
      .where(eq(usersTable.id, userId));

    // Delete the wallet transaction for this withdrawal
    await trx.delete(walletTransactionsTable).where(
      and(
        eq(walletTransactionsTable.userId, userId),
        eq(walletTransactionsTable.type, "withdrawal"),
        eq(walletTransactionsTable.amount, -withdrawal.amount),
      )
    );
  });

  res.json({ success: true, message: "Penarikan dibatalkan, saldo dikembalikan" });
});

router.get("/wallet/withdrawals", requireAuth, async (req: AuthRequest, res) => {
  const userId = req.userId!;
  const withdrawals = await db.query.withdrawalsTable.findMany({
    where: eq(withdrawalsTable.userId, userId),
    orderBy: (w, { desc }) => [desc(w.createdAt)],
  });
  res.json(withdrawals);
});

router.get("/wallet/topups", requireAuth, async (req: AuthRequest, res) => {
  const userId = req.userId!;
  const topups = await db.query.topupsTable.findMany({
    where: eq(topupsTable.userId, userId),
    orderBy: (t, { desc }) => [desc(t.createdAt)],
  });
  res.json(topups);
});

export default router;
