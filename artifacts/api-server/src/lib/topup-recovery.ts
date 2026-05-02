import { db } from "@workspace/db";
import { topupsTable, usersTable, walletTransactionsTable } from "@workspace/db/schema";
import { eq, and, gte, sql } from "drizzle-orm";
import { getInvoiceStatus } from "../services/wijayapay";
import { notifyTopupSuccess } from "./activity-webhook";
import { logger } from "./logger";

const FEE_RATE = 0.007;

/**
 * On server startup, check all pending topups that haven't expired
 * and reconcile their status with WijayaPay.
 * This handles the case where a webhook was missed during server downtime.
 */
export async function reconcilePendingTopups() {
  try {
    const pendingTopups = await db.query.topupsTable.findMany({
      where: and(
        eq(topupsTable.status, "pending"),
        gte(topupsTable.expiresAt, new Date())
      ),
    });

    if (pendingTopups.length === 0) {
      logger.info("[TopupRecovery] No pending topups to reconcile");
      return;
    }

    logger.info({ count: pendingTopups.length }, "[TopupRecovery] Checking pending topups...");

    for (const topup of pendingTopups) {
      try {
        if (!topup.invoiceId) continue;

        const status = await getInvoiceStatus(topup.invoiceId);

        if (status === "PAID") {
          const fee = Math.ceil(topup.amount * FEE_RATE);
          const creditAmount = topup.amount - fee;

          // All financial operations in a single DB transaction
          const credited = await db.transaction(async (trx) => {
            const [updated] = await trx.update(topupsTable)
              .set({ status: "approved", updatedAt: new Date() })
              .where(and(eq(topupsTable.id, topup.id), eq(topupsTable.status, "pending")))
              .returning({ id: topupsTable.id });

            if (!updated) return false;

            await trx.update(usersTable)
              .set({ walletBalance: sql`${usersTable.walletBalance} + ${creditAmount}` })
              .where(eq(usersTable.id, topup.userId));

            await trx.insert(walletTransactionsTable).values({
              userId: topup.userId,
              type: "topup",
              amount: creditAmount,
              description: `Top up via ${topup.method} Rp ${topup.amount.toLocaleString("id-ID")} (fee 0.7%: Rp ${fee.toLocaleString("id-ID")}) [recovered]`,
            });

            return true;
          });

          if (!credited) {
            logger.info({ topupId: topup.id }, "[TopupRecovery] Already processed, skipping");
            continue;
          }

          const user = await db.query.usersTable.findFirst({ where: eq(usersTable.id, topup.userId) });
          notifyTopupSuccess(user?.username ?? `User#${topup.userId}`, topup.amount, topup.method);

          logger.info({ topupId: topup.id, userId: topup.userId, amount: creditAmount }, "[TopupRecovery] Credited user from missed payment");

        } else if (status === "EXPIRED" || status === "FAILED") {
          await db.update(topupsTable)
            .set({ status: "rejected", adminNote: `WijayaPay: ${status} (recovered)`, updatedAt: new Date() })
            .where(and(eq(topupsTable.id, topup.id), eq(topupsTable.status, "pending")));

          logger.info({ topupId: topup.id, status }, "[TopupRecovery] Marked as expired/failed");
        }
      } catch (err) {
        logger.warn({ err, topupId: topup.id }, "[TopupRecovery] Failed to check topup, will retry next restart");
      }
    }

    logger.info("[TopupRecovery] Reconciliation complete");
  } catch (err) {
    logger.error({ err }, "[TopupRecovery] Failed to run reconciliation");
  }
}
