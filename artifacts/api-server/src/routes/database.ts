import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import {
  usersTable, listingsTable, transactionsTable,
  walletTransactionsTable, withdrawalsTable, topupsTable,
  chatMessagesTable, securityLogsTable,
} from "@workspace/db/schema";
import { eq, sql } from "drizzle-orm";
import { requireAuth, type AuthRequest } from "../middlewares/auth";
import { logger } from "../lib/logger";
import { loadLogsConfig, saveLogsConfig, sendActivityLog } from "../lib/activity-webhook";
import cron from "node-cron";
import fs from "fs";
import path from "path";

const ADMIN_DISCORD_ID = "970041350865170462";
const CONFIG_PATH = path.resolve(process.cwd(), "backup-config.json");

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

// ─── Backup Config ─────────────────────────────────────────────────────────

interface BackupConfig {
  webhookUrl: string;
  interval: "2h" | "6h" | "12h";
  enabled: boolean;
}

function isValidDiscordWebhook(url: string): boolean {
  return /^https:\/\/(discord\.com|discordapp\.com)\/api\/webhooks\/\d+\/[\w-]+$/.test(url);
}

function loadConfig(): BackupConfig {
  try {
    if (fs.existsSync(CONFIG_PATH)) {
      return JSON.parse(fs.readFileSync(CONFIG_PATH, "utf-8"));
    }
  } catch {}
  return { webhookUrl: "", interval: "6h", enabled: false };
}

function saveConfig(config: BackupConfig) {
  fs.writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2));
}

// ─── Export Database ───────────────────────────────────────────────────────

async function exportDatabase() {
  const [users, listings, transactions, walletTransactions, withdrawals, topups, chatMessages, securityLogs] = await Promise.all([
    db.select().from(usersTable),
    db.select().from(listingsTable),
    db.select().from(transactionsTable),
    db.select().from(walletTransactionsTable),
    db.select().from(withdrawalsTable),
    db.select().from(topupsTable),
    db.select().from(chatMessagesTable),
    db.select().from(securityLogsTable),
  ]);

  return {
    exportedAt: new Date().toISOString(),
    version: 1,
    tables: {
      users,
      listings,
      transactions,
      walletTransactions,
      withdrawals,
      topups,
      chatMessages,
      securityLogs,
    },
  };
}

router.get("/admin/database/export", requireAdmin, async (_req: AuthRequest, res) => {
  try {
    const data = await exportDatabase();
    res.setHeader("Content-Type", "application/json");
    res.setHeader("Content-Disposition", `attachment; filename="p2pmarket-backup-${new Date().toISOString().slice(0, 10)}.json"`);
    res.json(data);
  } catch (err: any) {
    logger.error({ err }, "[Database] Export failed");
    res.status(500).json({ error: "Export failed", message: err.message });
  }
});

// ─── Import Database ───────────────────────────────────────────────────────

router.post("/admin/database/import", requireAdmin, async (req: AuthRequest, res) => {
  try {
    const data = req.body;

    if (!data?.tables) {
      res.status(400).json({ error: "Bad request", message: "Format backup tidak valid" });
      return;
    }

    const { tables } = data;

    // Entire import in a single transaction — if anything fails, nothing changes
    await db.transaction(async (trx) => {
      // Clear all tables in correct order (respect FK constraints)
      await trx.delete(chatMessagesTable);
      await trx.delete(securityLogsTable);
      await trx.delete(walletTransactionsTable);
      await trx.delete(withdrawalsTable);
      await trx.delete(topupsTable);
      await trx.delete(transactionsTable);
      await trx.delete(listingsTable);
      await trx.delete(usersTable);

      // Insert data in correct order
      if (tables.users?.length) await trx.insert(usersTable).values(tables.users);
      if (tables.listings?.length) await trx.insert(listingsTable).values(tables.listings);
      if (tables.transactions?.length) await trx.insert(transactionsTable).values(tables.transactions);
      if (tables.walletTransactions?.length) await trx.insert(walletTransactionsTable).values(tables.walletTransactions);
      if (tables.withdrawals?.length) await trx.insert(withdrawalsTable).values(tables.withdrawals);
      if (tables.topups?.length) await trx.insert(topupsTable).values(tables.topups);
      if (tables.chatMessages?.length) await trx.insert(chatMessagesTable).values(tables.chatMessages);
      if (tables.securityLogs?.length) await trx.insert(securityLogsTable).values(tables.securityLogs);

      // Reset sequences
      await trx.execute(sql`SELECT setval('users_id_seq', COALESCE((SELECT MAX(id) FROM users), 0) + 1, false)`);
      await trx.execute(sql`SELECT setval('listings_id_seq', COALESCE((SELECT MAX(id) FROM listings), 0) + 1, false)`);
      await trx.execute(sql`SELECT setval('transactions_id_seq', COALESCE((SELECT MAX(id) FROM transactions), 0) + 1, false)`);
      await trx.execute(sql`SELECT setval('wallet_transactions_id_seq', COALESCE((SELECT MAX(id) FROM wallet_transactions), 0) + 1, false)`);
      await trx.execute(sql`SELECT setval('withdrawals_id_seq', COALESCE((SELECT MAX(id) FROM withdrawals), 0) + 1, false)`);
      await trx.execute(sql`SELECT setval('topups_id_seq', COALESCE((SELECT MAX(id) FROM topups), 0) + 1, false)`);
      await trx.execute(sql`SELECT setval('chat_messages_id_seq', COALESCE((SELECT MAX(id) FROM chat_messages), 0) + 1, false)`);
      await trx.execute(sql`SELECT setval('security_logs_id_seq', COALESCE((SELECT MAX(id) FROM security_logs), 0) + 1, false)`);
    });

    logger.info("[Database] Import completed successfully");
    res.json({ success: true, message: "Database berhasil di-import" });
  } catch (err: any) {
    logger.error({ err }, "[Database] Import failed");
    res.status(500).json({ error: "Import failed", message: err.message });
  }
});

// ─── Auto Backup Config ────────────────────────────────────────────────────

router.get("/admin/database/backup-config", requireAdmin, async (_req: AuthRequest, res) => {
  const config = loadConfig();
  res.json(config);
});

router.post("/admin/database/backup-config", requireAdmin, async (req: AuthRequest, res) => {
  const { webhookUrl, interval, enabled } = req.body;

  if (!webhookUrl || typeof webhookUrl !== "string") {
    res.status(400).json({ error: "Bad request", message: "Webhook URL wajib diisi" });
    return;
  }

  if (!isValidDiscordWebhook(webhookUrl)) {
    res.status(400).json({ error: "Bad request", message: "URL harus berupa Discord Webhook (https://discord.com/api/webhooks/...)" });
    return;
  }

  if (!["2h", "6h", "12h"].includes(interval)) {
    res.status(400).json({ error: "Bad request", message: "Interval tidak valid" });
    return;
  }

  const config: BackupConfig = { webhookUrl, interval, enabled: !!enabled };
  saveConfig(config);
  scheduleBackup(config);

  res.json({ success: true, message: "Konfigurasi backup disimpan", config });
});

// ─── Test Webhook ──────────────────────────────────────────────────────────

router.post("/admin/database/test-webhook", requireAdmin, async (req: AuthRequest, res) => {
  const { webhookUrl } = req.body;

  if (!webhookUrl) {
    res.status(400).json({ error: "Bad request", message: "Webhook URL wajib diisi" });
    return;
  }

  try {
    await sendBackupToDiscord(webhookUrl);
    res.json({ success: true, message: "Test backup berhasil dikirim ke Discord!" });
  } catch (err: any) {
    res.status(500).json({ error: "Webhook error", message: err.message });
  }
});

// ─── Webhook Logs Config ───────────────────────────────────────────────────

router.get("/admin/database/logs-config", requireAdmin, async (_req: AuthRequest, res) => {
  const config = loadLogsConfig();
  res.json(config);
});

router.post("/admin/database/logs-config", requireAdmin, async (req: AuthRequest, res) => {
  const { webhookUrl, enabled } = req.body;

  if (!webhookUrl || typeof webhookUrl !== "string") {
    res.status(400).json({ error: "Bad request", message: "Webhook URL wajib diisi" });
    return;
  }

  if (!isValidDiscordWebhook(webhookUrl)) {
    res.status(400).json({ error: "Bad request", message: "URL harus berupa Discord Webhook (https://discord.com/api/webhooks/...)" });
    return;
  }

  saveLogsConfig({ webhookUrl, enabled: !!enabled });
  res.json({ success: true, message: "Konfigurasi webhook logs disimpan" });
});

router.post("/admin/database/test-logs-webhook", requireAdmin, async (req: AuthRequest, res) => {
  const { webhookUrl } = req.body;
  if (!webhookUrl) {
    res.status(400).json({ error: "Bad request", message: "Webhook URL wajib diisi" });
    return;
  }

  try {
    const testRes = await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content: "✅ **P2PMarket Activity Logs**\nWebhook terhubung! Semua aktivitas (topup, penarikan, transaksi, sengketa) akan dikirim ke sini." }),
    });
    if (!testRes.ok) throw new Error(`Discord error: ${testRes.status}`);
    res.json({ success: true, message: "Test berhasil!" });
  } catch (err: any) {
    res.status(500).json({ error: "Failed", message: err.message });
  }
});

// ─── Send Backup to Discord ────────────────────────────────────────────────

async function sendBackupToDiscord(webhookUrl: string) {
  try {
    const data = await exportDatabase();
    const jsonStr = JSON.stringify(data, null, 2);
    const filename = `p2pmarket-backup-${new Date().toISOString().replace(/[:.]/g, "-")}.json`;

    const formData = new FormData();
    formData.append("content", `Users: ${data.tables.users.length} | Listings: ${data.tables.listings.length} | Transactions: ${data.tables.transactions.length}`);
    formData.append("files[0]", new Blob([jsonStr], { type: "application/json" }), filename);

    const res = await fetch(webhookUrl, {
      method: "POST",
      body: formData,
    });

    if (!res.ok) {
      logger.error({ status: res.status }, "[Backup] Discord webhook failed");
    } else {
      logger.info("[Backup] Auto backup sent to Discord");
    }
  } catch (err) {
    logger.error({ err }, "[Backup] Failed to send backup");
  }
}

// ─── Cron Scheduler ────────────────────────────────────────────────────────

let cronJob: ReturnType<typeof cron.schedule> | null = null;

function intervalToCron(interval: string): string {
  switch (interval) {
    case "2h": return "0 */2 * * *";
    case "6h": return "0 */6 * * *";
    case "12h": return "0 */12 * * *";
    default: return "0 */6 * * *";
  }
}

function scheduleBackup(config: BackupConfig) {
  if (cronJob) {
    cronJob.stop();
    cronJob = null;
  }

  if (config.enabled && config.webhookUrl) {
    const cronExpr = intervalToCron(config.interval);
    cronJob = cron.schedule(cronExpr, () => {
      sendBackupToDiscord(config.webhookUrl);
    });
    logger.info({ interval: config.interval, cron: cronExpr }, "[Backup] Auto backup scheduled");
  } else {
    logger.info("[Backup] Auto backup disabled");
  }
}

// Initialize on startup
const initialConfig = loadConfig();
if (initialConfig.enabled) {
  scheduleBackup(initialConfig);
}

export default router;
