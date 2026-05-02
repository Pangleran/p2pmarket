import fs from "fs/promises";
import path from "path";
import { db } from "@workspace/db";
import { transactionsTable, chatMessagesTable, listingsTable } from "@workspace/db/schema";
import { eq, and, lte, or, isNotNull } from "drizzle-orm";
import { ObjectStorageService } from "./objectStorage";
import { logger } from "./logger";

const objectStorageService = new ObjectStorageService();

const CLEANUP_DELAY_MS = 36 * 60 * 60 * 1000; // 36 jam
const JOB_INTERVAL_MS = 60 * 60 * 1000;         // cek tiap 1 jam
const ORPHAN_SCAN_INTERVAL_MS = 6 * 60 * 60 * 1000; // scan orphan tiap 6 jam

const UPLOAD_DIR = process.env.UPLOAD_DIR || path.resolve(process.cwd(), "uploads");
const API_URL = process.env.API_URL || "";

/**
 * Hapus file dari disk berdasarkan serving URL.
 * Mendukung format:
 *   - https://api.p2pmarket.web.id/storage/uploads/xxx.webp
 *   - /storage/uploads/xxx.webp
 *   - /api/storage/objects/uploads/xxx.webp (legacy)
 */
export async function deleteImageByUrl(url: string | null | undefined): Promise<void> {
  if (!url) return;

  let filename: string | null = null;

  // Format: full URL (https://api.../storage/uploads/xxx.webp)
  if (url.includes("/storage/uploads/")) {
    const match = url.match(/\/storage\/uploads\/([^/?#]+)/);
    if (match) filename = match[1];
  }
  // Format legacy: /api/storage/objects/uploads/xxx.webp
  else if (url.includes("/api/storage/objects/")) {
    const match = url.match(/\/uploads\/([^/?#]+)/);
    if (match) filename = match[1];
  }

  if (!filename) return;

  const objectPath = `/uploads/${filename}`;
  await objectStorageService.deleteFile(objectPath).catch(() => {});
}

/**
 * Hapus semua image dari listing imageUrl (bisa JSON array atau single URL).
 */
export async function deleteListingImages(imageUrl: string | null | undefined): Promise<void> {
  if (!imageUrl) return;

  // imageUrl bisa berupa JSON array atau single URL
  let urls: string[] = [];
  try {
    const parsed = JSON.parse(imageUrl);
    if (Array.isArray(parsed)) {
      urls = parsed;
    } else {
      urls = [imageUrl];
    }
  } catch {
    urls = [imageUrl];
  }

  await Promise.all(urls.map(u => deleteImageByUrl(u)));
}

/**
 * Cleanup proof images dari transaksi yang sudah selesai > 36 jam.
 */
async function runTransactionImageCleanup(): Promise<void> {
  const cutoff = new Date(Date.now() - CLEANUP_DELAY_MS);

  const txns = await db.query.transactionsTable.findMany({
    where: and(
      eq(transactionsTable.status, "completed"),
      lte(transactionsTable.updatedAt, cutoff),
      or(
        isNotNull(transactionsTable.sellerProofUrl),
        isNotNull(transactionsTable.buyerProofUrl),
      ),
    ),
  });

  if (txns.length === 0) return;

  logger.info({ count: txns.length }, "Image cleanup: processing completed transactions");

  for (const tx of txns) {
    try {
      // Hapus chat images untuk transaksi ini
      const chatMsgs = await db.query.chatMessagesTable.findMany({
        where: and(
          eq(chatMessagesTable.transactionId, tx.id),
          isNotNull(chatMessagesTable.imageUrl),
        ),
      });

      await Promise.all([
        deleteImageByUrl(tx.sellerProofUrl),
        deleteImageByUrl(tx.buyerProofUrl),
        ...chatMsgs.map(m => deleteImageByUrl(m.imageUrl)),
      ]);

      // Null-kan proof URL di DB supaya tidak coba dihapus lagi
      await db.update(transactionsTable)
        .set({ sellerProofUrl: null, buyerProofUrl: null })
        .where(eq(transactionsTable.id, tx.id));

      // Null-kan imageUrl di chat messages
      if (chatMsgs.length > 0) {
        await db.update(chatMessagesTable)
          .set({ imageUrl: null })
          .where(eq(chatMessagesTable.transactionId, tx.id));
      }

      logger.info({ txId: tx.id }, "Image cleanup: transaction images deleted");
    } catch (err) {
      logger.error({ err, txId: tx.id }, "Image cleanup: error processing transaction");
    }
  }
}

/**
 * Scan uploads/ folder dan hapus file yang tidak direferensikan di DB.
 * Ini menangkap orphan dari listing yang dihapus, upload gagal, dll.
 */
async function runOrphanFileScan(): Promise<void> {
  try {
    await fs.mkdir(UPLOAD_DIR, { recursive: true });
    const files = await fs.readdir(UPLOAD_DIR);

    if (files.length === 0) return;

    // Kumpulkan semua URL image yang ada di DB
    const [listings, transactions, chatMessages] = await Promise.all([
      db.query.listingsTable.findMany({
        columns: { imageUrl: true },
        where: isNotNull(listingsTable.imageUrl),
      }),
      db.query.transactionsTable.findMany({
        columns: { sellerProofUrl: true, buyerProofUrl: true },
        where: or(
          isNotNull(transactionsTable.sellerProofUrl),
          isNotNull(transactionsTable.buyerProofUrl),
        ),
      }),
      db.query.chatMessagesTable.findMany({
        columns: { imageUrl: true },
        where: isNotNull(chatMessagesTable.imageUrl),
      }),
    ]);

    // Extract semua filename yang masih direferensikan
    const referencedFiles = new Set<string>();

    for (const listing of listings) {
      if (!listing.imageUrl) continue;
      try {
        const parsed = JSON.parse(listing.imageUrl);
        const urls = Array.isArray(parsed) ? parsed : [listing.imageUrl];
        for (const url of urls) {
          const match = url.match(/([a-f0-9-]+\.\w+)$/);
          if (match) referencedFiles.add(match[1]);
        }
      } catch {
        const match = listing.imageUrl.match(/([a-f0-9-]+\.\w+)$/);
        if (match) referencedFiles.add(match[1]);
      }
    }

    for (const tx of transactions) {
      for (const url of [tx.sellerProofUrl, tx.buyerProofUrl]) {
        if (!url) continue;
        const match = url.match(/([a-f0-9-]+\.\w+)$/);
        if (match) referencedFiles.add(match[1]);
      }
    }

    for (const msg of chatMessages) {
      if (!msg.imageUrl) continue;
      const match = msg.imageUrl.match(/([a-f0-9-]+\.\w+)$/);
      if (match) referencedFiles.add(match[1]);
    }

    // Hapus file yang tidak direferensikan (orphan)
    let deletedCount = 0;
    let deletedBytes = 0;

    for (const file of files) {
      if (referencedFiles.has(file)) continue;

      const filePath = path.join(UPLOAD_DIR, file);
      try {
        const stat = await fs.stat(filePath);
        await fs.unlink(filePath);
        deletedCount++;
        deletedBytes += stat.size;
      } catch {}
    }

    if (deletedCount > 0) {
      logger.info(
        { deletedCount, deletedMB: (deletedBytes / 1024 / 1024).toFixed(2) },
        "Orphan cleanup: removed unreferenced files",
      );
    }
  } catch (err) {
    logger.error({ err }, "Orphan cleanup: scan failed");
  }
}

export async function runImageCleanupJob(): Promise<void> {
  await runTransactionImageCleanup();
}

export function startImageCleanupJob(): void {
  // Jalankan transaction cleanup sekali saat startup
  runImageCleanupJob().catch(err =>
    logger.error({ err }, "Image cleanup job: startup run failed")
  );

  // Jadwalkan transaction cleanup tiap 1 jam
  setInterval(() => {
    runImageCleanupJob().catch(err =>
      logger.error({ err }, "Image cleanup job: scheduled run failed")
    );
  }, JOB_INTERVAL_MS);

  // Jalankan orphan scan 5 menit setelah startup (beri waktu DB ready)
  setTimeout(() => {
    runOrphanFileScan().catch(err =>
      logger.error({ err }, "Orphan cleanup: startup run failed")
    );
  }, 5 * 60 * 1000);

  // Jadwalkan orphan scan tiap 6 jam
  setInterval(() => {
    runOrphanFileScan().catch(err =>
      logger.error({ err }, "Orphan cleanup: scheduled run failed")
    );
  }, ORPHAN_SCAN_INTERVAL_MS);

  logger.info(
    { transactionCleanupHours: 1, orphanScanHours: 6 },
    "Image cleanup jobs: started",
  );
}
