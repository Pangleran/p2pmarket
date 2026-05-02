import app from "./app";
import { logger } from "./lib/logger";
import { startImageCleanupJob } from "./lib/cleanup-job";
import { reconcilePendingTopups } from "./lib/topup-recovery";
import { pool } from "@workspace/db";

const rawPort = process.env["PORT"];

if (!rawPort) {
  throw new Error(
    "PORT environment variable is required but was not provided.",
  );
}

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

// ─── Global error safety net (cegah server crash dari async error tak terduga)
process.on("unhandledRejection", (reason) => {
  logger.error({ reason }, "[Process] Unhandled Promise Rejection — server tetap berjalan");
});

process.on("uncaughtException", (err) => {
  logger.error({ err }, "[Process] Uncaught Exception — server tetap berjalan");
});

// ─── Start server ─────────────────────────────────────────────────────────────
const server = app.listen(port, (err?: Error) => {
  if (err) {
    logger.error({ err }, "Error listening on port");
    process.exit(1);
  }

  logger.info({ port }, "Server listening");
  startImageCleanupJob();
  // Recover any pending topups that may have been paid during downtime
  reconcilePendingTopups();
});

// ─── Graceful shutdown (handle SIGTERM dari Replit saat restart/deploy) ────────
async function shutdown(signal: string) {
  logger.info({ signal }, "Shutdown signal diterima, menutup koneksi...");

  server.close(async () => {
    logger.info("HTTP server ditutup");
    try {
      await pool.end();
      logger.info("DB pool ditutup");
    } catch (err) {
      logger.error({ err }, "Error saat menutup DB pool");
    }
    process.exit(0);
  });

  // Force exit jika graceful shutdown terlalu lama (10 detik)
  setTimeout(() => {
    logger.warn("Force shutdown setelah 10 detik timeout");
    process.exit(1);
  }, 10_000);
}

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));
