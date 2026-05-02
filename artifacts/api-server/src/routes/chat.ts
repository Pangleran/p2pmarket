import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { chatMessagesTable, transactionsTable, usersTable } from "@workspace/db/schema";
import { eq, asc } from "drizzle-orm";
import { requireAuth, type AuthRequest } from "../middlewares/auth";

const ADMIN_DISCORD_ID = "970041350865170462";

const router: IRouter = Router();

const ALLOWED_URL_PATTERN = /^https:\/\/discord\.gg\/\S+/i;

function censorPhoneNumber(raw: string): string {
  // Hapus semua non-digit dulu untuk hitung panjang
  const digits = raw.replace(/\D/g, "");
  if (digits.length < 4) return "***";
  // Tampilkan 3 karakter awal dari raw, lalu **, lalu 2 digit terakhir
  const prefix = raw.slice(0, 3);
  const suffix = digits.slice(-2);
  return `${prefix}**${suffix}`;
}

function censorUrl(_url: string): string {
  return "https://***/***.com";
}

function censorMessage(msg: string): string {
  let result = msg;

  // Sensor nomor telepon Indonesia (+62, 62, 08xx) — tampilkan sebagian
  result = result.replace(
    /(?:\+62|62|0)[\s\-.]?[0-9](?:[\s\-.]?[0-9]){7,12}/g,
    (match) => censorPhoneNumber(match),
  );

  // Sensor URL http/https yang bukan discord.gg invite
  result = result.replace(/https?:\/\/[^\s]+/gi, (match) => {
    if (ALLOWED_URL_PATTERN.test(match)) return match;
    return censorUrl(match);
  });

  // Sensor URL www. atau domain biasa (tanpa http)
  result = result.replace(
    /\b(?:www\.)[a-z0-9\-]+\.[a-z]{2,}(?:\/[^\s]*)?\b/gi,
    "https://***/***.com",
  );

  return result;
}

/**
 * Sanitize avatarUrl — jika masih berisi URL Discord CDN (mengekspos Discord ID),
 * ganti dengan URL proxy internal yang aman.
 */
function safeAvatarUrl(user: { id: number; avatarUrl: string | null }): string | null {
  if (!user.avatarUrl) return null;
  if (user.avatarUrl.includes("cdn.discordapp.com")) {
    const apiBaseUrl = process.env.API_URL || `http://localhost:${process.env.PORT || 3001}`;
    return `${apiBaseUrl}/users/${user.id}/avatar`;
  }
  return user.avatarUrl;
}

function formatMessage(
  msg: typeof chatMessagesTable.$inferSelect,
  sender: typeof usersTable.$inferSelect,
) {
  return {
    id: msg.id,
    transactionId: msg.transactionId,
    senderId: msg.senderId,
    sender: {
      id: sender.id,
      username: sender.username,
      avatarUrl: safeAvatarUrl(sender),
      isAdmin: sender.discordId === ADMIN_DISCORD_ID,
    },
    message: msg.message,
    imageUrl: msg.imageUrl,
    createdAt: msg.createdAt,
  };
}

router.get("/transactions/:txId/messages", requireAuth, async (req: AuthRequest, res) => {
  const txId = parseInt(req.params.txId);
  const userId = req.userId!;
  const user = req.user!;

  const tx = await db.query.transactionsTable.findFirst({
    where: eq(transactionsTable.id, txId),
  });

  if (!tx) { res.status(404).json({ error: "Not found" }); return; }

  const isParty = tx.buyerId === userId || tx.sellerId === userId;
  const isAdmin = user.discordId === ADMIN_DISCORD_ID;

  if (!isParty && !isAdmin) {
    res.status(403).json({ error: "Forbidden" });
    return;
  }

  const msgs = await db.query.chatMessagesTable.findMany({
    where: eq(chatMessagesTable.transactionId, txId),
    orderBy: [asc(chatMessagesTable.createdAt)],
    with: { sender: true },
  });

  res.json(msgs.map(m => formatMessage(m, m.sender)));
});

// Per-user per-transaction cooldown tracking (in-memory)
const sendCooldowns = new Map<string, number>();
const COOLDOWN_MS = 5000;

router.post("/transactions/:txId/messages", requireAuth, async (req: AuthRequest, res) => {
  const txId = parseInt(req.params.txId);
  const userId = req.userId!;
  const user = req.user!;
  const { message, imageUrl } = req.body ?? {};

  if (!message && !imageUrl) {
    res.status(400).json({ error: "message or imageUrl required" });
    return;
  }

  if (message && message.length > 2000) {
    res.status(400).json({ error: "Bad request", message: "Pesan terlalu panjang (maks 2000 karakter)" });
    return;
  }

  // Validate imageUrl — only allow our own storage URLs
  if (imageUrl && typeof imageUrl === "string") {
    const allowedPrefixes = [
      process.env.API_URL || "https://api.p2pmarket.web.id",
      "/storage/",
    ];
    const isAllowed = allowedPrefixes.some(prefix => imageUrl.startsWith(prefix));
    if (!isAllowed) {
      res.status(400).json({ error: "Bad request", message: "URL gambar tidak valid" });
      return;
    }
  }

  const tx = await db.query.transactionsTable.findFirst({
    where: eq(transactionsTable.id, txId),
  });

  if (!tx) { res.status(404).json({ error: "Not found" }); return; }

  const isParty = tx.buyerId === userId || tx.sellerId === userId;
  const isAdmin = user.discordId === ADMIN_DISCORD_ID;

  if (!isParty && !isAdmin) {
    res.status(403).json({ error: "Forbidden" });
    return;
  }

  // Cooldown check (skip for admin)
  if (!isAdmin) {
    const cooldownKey = `${userId}:${txId}`;
    const lastSent = sendCooldowns.get(cooldownKey) ?? 0;
    const now = Date.now();
    const remaining = COOLDOWN_MS - (now - lastSent);
    if (remaining > 0) {
      res.status(429).json({
        error: "Cooldown",
        message: `Tunggu ${Math.ceil(remaining / 1000)} detik sebelum mengirim pesan lagi.`,
        remainingMs: remaining,
      });
      return;
    }
    sendCooldowns.set(cooldownKey, now);
  }

  // Censor message
  const finalMessage = message ? censorMessage(message) : null;

  const [inserted] = await db.insert(chatMessagesTable).values({
    transactionId: txId,
    senderId: userId,
    message: finalMessage ?? null,
    imageUrl: imageUrl ?? null,
  }).returning();

  const sender = await db.query.usersTable.findFirst({
    where: eq(usersTable.id, userId),
  });

  const formatted = formatMessage(inserted, sender!);

  res.status(201).json(formatted);
});

export default router;
