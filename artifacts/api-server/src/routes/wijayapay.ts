import { Router, type IRouter, type Request, type Response } from "express";
import { db } from "@workspace/db";
import { topupsTable, usersTable, walletTransactionsTable } from "@workspace/db/schema";
import { eq, and, sql } from "drizzle-orm";
import { requireAuth, type AuthRequest } from "../middlewares/auth";
import { notifyTopupSuccess } from "../lib/activity-webhook";
import { financialRateLimit } from "../middlewares/security";
import {
  createInvoice,
  getInvoiceStatus,
  verifyWebhookSignature,
  isWijayaPayConfigured,
} from "../services/wijayapay";
import { logger } from "../lib/logger";

const router: IRouter = Router();

// In-memory cache for topup status polling (10s TTL)
const topupStatusCache = new Map<number, { status: string; cachedAt: number }>();

const INVOICE_DURATION_SECONDS = 3600;
const MIN_TOPUP = 5_000;
const MAX_TOPUP = 10_000_000;
const FEE_RATE = 0.007; // 0.7%

const VALID_METHODS = [
  "QRIS",
  "BRIVA", "BCAVA", "BNIVA", "BSIVA", "MANDIRIVA", "PERMATAVA",
  "MAYBANKVA", "MUALAMATVA", "CIMBVA", "DANAMONVA", "BANKNEOVA", "OCBCVA",
  "ALFAMART", "INDOMARET",
];

router.post("/wallet/topup/create", financialRateLimit, requireAuth, async (req: AuthRequest, res) => {
  if (!isWijayaPayConfigured()) {
    res.status(503).json({ error: "Service Unavailable", message: "Pembayaran belum dikonfigurasi" });
    return;
  }

  const userId = req.userId!;
  const { paymentMethod } = req.body;
  const amount = Math.floor(Number(req.body.amount));

  if (!amount || amount < MIN_TOPUP || amount > MAX_TOPUP) {
    res.status(400).json({
      error: "Bad request",
      message: `Nominal harus antara Rp ${MIN_TOPUP.toLocaleString("id-ID")} dan Rp ${MAX_TOPUP.toLocaleString("id-ID")}`,
      minTopup: MIN_TOPUP,
      maxTopup: MAX_TOPUP,
    });
    return;
  }

  if (!paymentMethod || !VALID_METHODS.includes(paymentMethod)) {
    res.status(400).json({ error: "Bad request", message: "Metode pembayaran tidak valid" });
    return;
  }

  const existing = await db.query.topupsTable.findFirst({
    where: and(eq(topupsTable.userId, userId), eq(topupsTable.status, "pending")),
  });

  if (existing) {
    const isExpired = existing.expiresAt && new Date(existing.expiresAt) <= new Date();
    if (isExpired) {
      // Auto-dismiss expired record and proceed to create new topup
      await db.update(topupsTable)
        .set({ status: "rejected", adminNote: "Auto-expired on new topup", updatedAt: new Date() })
        .where(eq(topupsTable.id, existing.id));
      // Fall through to create new invoice below
    } else {
      res.status(409).json({
        error: "Conflict",
        message: "Kamu sudah memiliki invoice aktif. Selesaikan pembayaran atau tunggu hingga expired.",
        expired: false,
        topupId: existing.id,
        invoiceId: existing.invoiceId,
        paymentUrl: existing.paymentUrl,
        expiresAt: existing.expiresAt,
        amount: existing.amount,
        method: existing.method,
      });
      return;
    }
  }

  const refId = `TOPUP-${userId}-${Date.now()}`;

  let invoiceData: Awaited<ReturnType<typeof createInvoice>>;
  try {
    invoiceData = await createInvoice({
      refId,
      nominal: amount,
      codePayment: paymentMethod,
    });
  } catch (err: any) {
    logger.error({ err: err?.message }, "[WijayaPay] Create invoice error");
    res.status(502).json({ error: "Payment Error", message: err?.message ?? "Gagal membuat invoice. Coba lagi nanti." });
    return;
  }

  const wpExpiry = invoiceData.expiredAt ? new Date(invoiceData.expiredAt) : null;
  const minExpiry = new Date(Date.now() + 5 * 60 * 1000);
  const fallback = new Date(Date.now() + INVOICE_DURATION_SECONDS * 1000);
  const expiresAt = (wpExpiry && wpExpiry > minExpiry) ? wpExpiry : fallback;

  const [topup] = await db.insert(topupsTable).values({
    userId,
    amount,
    method: paymentMethod,
    status: "pending",
    invoiceId: refId,
    paymentUrl: invoiceData.paymentUrl,
    vaNumber: invoiceData.vaNumber ?? null,
    qrisUrl: invoiceData.qrisUrl ?? null,
    paymentCode: invoiceData.paymentCode ?? null,
    expiresAt,
  }).returning();

  res.status(201).json({
    topupId: topup.id,
    invoiceId: refId,
    paymentUrl: invoiceData.paymentUrl,
    qrisUrl: invoiceData.qrisUrl,
    vaNumber: invoiceData.vaNumber,
    paymentCode: invoiceData.paymentCode,
    amount,
    method: paymentMethod,
    expiresAt: expiresAt.toISOString(),
  });
});

router.get("/wallet/topup/pending", requireAuth, async (req: AuthRequest, res) => {
  const userId = req.userId!;
  const topup = await db.query.topupsTable.findFirst({
    where: and(eq(topupsTable.userId, userId), eq(topupsTable.status, "pending")),
  });

  if (!topup) {
    res.json({ pending: false });
    return;
  }

  const isExpired = topup.expiresAt && new Date(topup.expiresAt) <= new Date();

  // Auto-dismiss expired record so it doesn't block future topups
  if (isExpired) {
    await db.update(topupsTable)
      .set({ status: "rejected", adminNote: "Auto-expired", updatedAt: new Date() })
      .where(eq(topupsTable.id, topup.id));
    res.json({ pending: false });
    return;
  }

  res.json({
    pending: true,
    expired: false,
    topupId: topup.id,
    invoiceId: topup.invoiceId,
    paymentUrl: topup.paymentUrl ?? "",
    vaNumber: topup.vaNumber ?? undefined,
    qrisUrl: topup.qrisUrl ?? undefined,
    paymentCode: topup.paymentCode ?? undefined,
    amount: topup.amount,
    method: topup.method,
    expiresAt: topup.expiresAt,
  });
});

router.post("/wallet/topup/dismiss", requireAuth, async (req: AuthRequest, res) => {
  const userId = req.userId!;
  const topup = await db.query.topupsTable.findFirst({
    where: and(eq(topupsTable.userId, userId), eq(topupsTable.status, "pending")),
  });

  if (!topup) {
    res.json({ success: true, message: "Tidak ada invoice pending" });
    return;
  }

  await db.update(topupsTable)
    .set({ status: "rejected", adminNote: "Dismissed oleh user", updatedAt: new Date() })
    .where(eq(topupsTable.id, topup.id));

  res.json({ success: true, message: "Invoice berhasil dihapus" });
});

router.get("/wallet/topup/:topupId/status", requireAuth, async (req: AuthRequest, res) => {
  const userId = req.userId!;
  const topupId = parseInt(req.params.topupId);

  if (isNaN(topupId)) {
    res.status(400).json({ error: "Bad request", message: "Invalid topup ID" });
    return;
  }

  const topup = await db.query.topupsTable.findFirst({
    where: and(eq(topupsTable.id, topupId), eq(topupsTable.userId, userId)),
  });

  if (!topup) {
    res.status(404).json({ error: "Not found", message: "Topup tidak ditemukan" });
    return;
  }

  if (topup.status === "approved") { res.json({ status: "PAID", topupId }); return; }
  if (topup.status === "rejected") { res.json({ status: "EXPIRED", topupId }); return; }

  if (!topup.invoiceId) { res.json({ status: "PENDING", topupId }); return; }

  if (topup.expiresAt && new Date(topup.expiresAt) < new Date()) {
    await db.update(topupsTable)
      .set({ status: "rejected", adminNote: "Invoice expired", updatedAt: new Date() })
      .where(eq(topupsTable.id, topupId));
    topupStatusCache.delete(topupId);
    res.json({ status: "EXPIRED", topupId });
    return;
  }

  // Check in-memory cache (10s TTL) to avoid hammering external API
  const cached = topupStatusCache.get(topupId);
  if (cached && (Date.now() - cached.cachedAt) < 10_000) {
    res.json({ status: cached.status, topupId });
    return;
  }

  let wpStatus: "PENDING" | "PAID" | "EXPIRED" | "FAILED" = "PENDING";
  try {
    wpStatus = await getInvoiceStatus(topup.invoiceId);
  } catch (err) {
    logger.warn({ err }, "[WijayaPay] Status check failed, returning PENDING");
  }

  // Cache the result
  topupStatusCache.set(topupId, { status: wpStatus, cachedAt: Date.now() });

  if (wpStatus === "PAID") {
    topupStatusCache.delete(topupId);
    await creditUser(userId, topupId, topup.amount, topup.method);
    res.json({ status: "PAID", topupId });
    return;
  }

  if (wpStatus === "EXPIRED" || wpStatus === "FAILED") {
    topupStatusCache.delete(topupId);
    await db.update(topupsTable)
      .set({ status: "rejected", adminNote: `WijayaPay status: ${wpStatus}`, updatedAt: new Date() })
      .where(eq(topupsTable.id, topupId));
    res.json({ status: "EXPIRED", topupId });
    return;
  }

  res.json({ status: "PENDING", topupId });
});

router.post("/wallet/topup/callback", async (req: Request, res) => {
  const payload = req.body;
  logger.info({ payload }, "[WijayaPay] Callback received");

  try {
    const valid = verifyWebhookSignature(payload);
    if (!valid) {
      logger.warn("[WijayaPay] Invalid webhook signature");
      res.status(403).json({ error: "Invalid signature" });
      return;
    }
  } catch (err) {
    logger.error({ err }, "[WijayaPay] Signature verification error");
    res.status(403).json({ error: "Signature error" });
    return;
  }

  res.status(200).json({ status: "ok" });

  const status = (payload.status ?? "").toUpperCase();
  if (status !== "PAID" && status !== "SUCCESS" && status !== "SETTLEMENT") {
    logger.info({ status, ref: payload.ref_id }, "[WijayaPay] Non-PAID callback, skipped");
    return;
  }

  const refId = payload.data?.ref_id ?? payload.ref_id ?? payload.merchant_ref ?? "";
  const topup = await db.query.topupsTable.findFirst({
    where: eq(topupsTable.invoiceId, refId),
  });

  if (!topup) {
    logger.warn({ refId }, "[WijayaPay] Topup not found for ref_id");
    return;
  }

  if (topup.status === "approved") {
    logger.info({ topupId: topup.id }, "[WijayaPay] Topup already approved, skip");
    return;
  }

  await creditUser(topup.userId, topup.id, topup.amount, topup.method);
});

async function creditUser(userId: number, topupId: number, amount: number, method: string) {
  try {
    const fee = Math.ceil(amount * FEE_RATE);
    const creditAmount = amount - fee;

    // All financial operations in a single DB transaction
    const result = await db.transaction(async (trx) => {
      const [updated] = await trx.update(topupsTable)
        .set({ status: "approved", updatedAt: new Date() })
        .where(and(eq(topupsTable.id, topupId), eq(topupsTable.status, "pending")))
        .returning({ id: topupsTable.id });

      if (!updated) return null; // Already processed

      await trx.update(usersTable)
        .set({ walletBalance: sql`${usersTable.walletBalance} + ${creditAmount}` })
        .where(eq(usersTable.id, userId));

      await trx.insert(walletTransactionsTable).values({
        userId,
        type: "topup",
        amount: creditAmount,
        description: `Top up via ${method} Rp ${amount.toLocaleString("id-ID")} (fee 0.7%: Rp ${fee.toLocaleString("id-ID")})`,
      });

      return { credited: true };
    });

    if (!result) {
      logger.info({ userId, topupId }, "[WijayaPay] Topup already processed, skipping credit");
      return;
    }

    // Notification outside transaction (non-critical)
    const user = await db.query.usersTable.findFirst({ where: eq(usersTable.id, userId) });
    notifyTopupSuccess(user?.username ?? `User#${userId}`, amount, method);

    logger.info({ userId, topupId, amount, fee, creditAmount }, "[WijayaPay] User credited");
  } catch (err) {
    logger.error({ err, userId, topupId }, "[WijayaPay] Failed to credit user");
  }
}

export default router;
