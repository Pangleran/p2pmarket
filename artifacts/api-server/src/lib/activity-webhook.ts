import fs from "fs";
import path from "path";
import { logger } from "./logger";

const CONFIG_PATH = path.resolve(process.cwd(), "webhook-logs-config.json");

interface WebhookLogsConfig {
  webhookUrl: string;
  enabled: boolean;
}

export function loadLogsConfig(): WebhookLogsConfig {
  try {
    if (fs.existsSync(CONFIG_PATH)) {
      return JSON.parse(fs.readFileSync(CONFIG_PATH, "utf-8"));
    }
  } catch {}
  return { webhookUrl: "", enabled: false };
}

export function saveLogsConfig(config: WebhookLogsConfig) {
  fs.writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2));
}

export async function sendActivityLog(message: string) {
  const config = loadLogsConfig();
  if (!config.enabled || !config.webhookUrl) return;

  try {
    await fetch(config.webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content: message }),
    });
  } catch (err) {
    logger.error({ err }, "[ActivityWebhook] Failed to send");
  }
}

// ─── Helper functions for specific events ──────────────────────────────────

export function notifyTopupSuccess(username: string, amount: number, method: string) {
  const msg = `💰 **Topup Berhasil**\n👤 ${username}\n💵 Rp ${amount.toLocaleString("id-ID")}\n📱 ${method}`;
  sendActivityLog(msg);
}

export function notifyWithdrawalRequest(username: string, amount: number, method: string, accountNumber: string) {
  const msg = `🏧 **Penarikan Baru**\n👤 ${username}\n💵 Rp ${amount.toLocaleString("id-ID")}\n🏦 ${method} · ${accountNumber}`;
  sendActivityLog(msg);
}

export function notifyTransactionCreated(buyer: string, seller: string, title: string, amount: number) {
  const msg = `🛒 **Transaksi Baru**\n👤 Pembeli: ${buyer}\n🏪 Penjual: ${seller}\n📦 ${title}\n💵 Rp ${amount.toLocaleString("id-ID")}`;
  sendActivityLog(msg);
}

export function notifyDispute(reporter: string, title: string, transactionId: number) {
  const msg = `⚠️ **Sengketa Dibuka**\n👤 Pelapor: ${reporter}\n📦 ${title}\n🆔 Transaksi #${transactionId}`;
  sendActivityLog(msg);
}

export function notifyDisputeResolved(transactionId: number, winner: string) {
  const msg = `✅ **Sengketa Selesai**\n🆔 Transaksi #${transactionId}\n🏆 Dimenangkan: ${winner}`;
  sendActivityLog(msg);
}
