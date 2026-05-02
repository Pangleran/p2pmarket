import { Router, type IRouter } from "express";
import { authRateLimit } from "../middlewares/security";
import { db } from "@workspace/db";
import { usersTable } from "@workspace/db/schema";
import { eq } from "drizzle-orm";
import crypto from "crypto";
import { verifyTurnstile } from "../lib/turnstile";

const router: IRouter = Router();

const DISCORD_CLIENT_ID = process.env.DISCORD_CLIENT_ID!;
const DISCORD_CLIENT_SECRET = process.env.DISCORD_CLIENT_SECRET!;
const DISCORD_EPOCH = 1420070400000n;
const MIN_ACCOUNT_AGE_DAYS = 3;

function getRedirectUri(): string {
  // API_URL = URL publik API, contoh: https://api.example.com
  if (process.env.API_URL) {
    return `${process.env.API_URL}/auth/discord/callback`;
  }
  const domain = process.env.REPLIT_DEV_DOMAIN;
  return domain
    ? `https://${domain}/auth/discord/callback`
    : `http://localhost:${process.env.PORT || 3001}/auth/discord/callback`;
}

function getFrontendUrl(): string {
  if (process.env.APP_URL) return process.env.APP_URL;
  const domain = process.env.REPLIT_DEV_DOMAIN;
  return domain ? `https://${domain}` : "http://localhost:5173";
}

function getDiscordAccountAgeMs(discordId: string): number {
  const snowflake = BigInt(discordId);
  const timestamp = Number((snowflake >> 22n) + DISCORD_EPOCH);
  return Date.now() - timestamp;
}

function parseDevice(userAgent: string | undefined): string {
  if (!userAgent) return "Unknown";
  if (/mobile|android|iphone|ipad/i.test(userAgent)) {
    if (/iphone|ipad/i.test(userAgent)) return "iOS";
    return "Android";
  }
  if (/windows/i.test(userAgent)) return "Windows";
  if (/macintosh|mac os/i.test(userAgent)) return "macOS";
  if (/linux/i.test(userAgent)) return "Linux";
  return "Desktop";
}

function getClientIp(req: any): string {
  return (
    (req.headers["x-forwarded-for"] as string)?.split(",")[0]?.trim() ||
    req.socket?.remoteAddress ||
    "unknown"
  );
}

router.get("/auth/discord", authRateLimit, async (req, res) => {
  if (!DISCORD_CLIENT_ID) {
    res.status(503).json({ error: "Service unavailable", message: "Discord OAuth belum dikonfigurasi. Hubungi admin." });
    return;
  }

  // Verifikasi Turnstile anti-bot sebelum redirect ke Discord
  const cfToken = req.query.cf_token as string | undefined;
  const clientIp = (req.headers["x-forwarded-for"] as string)?.split(",")[0]?.trim() || req.socket?.remoteAddress;
  const turnstile = await verifyTurnstile(cfToken, clientIp);
  if (!turnstile.success) {
    const frontendUrl = getFrontendUrl();
    res.redirect(`${frontendUrl}/?turnstile_error=1`);
    return;
  }

  // Generate CSRF state token
  const state = crypto.randomBytes(16).toString("hex");
  res.cookie("oauth_state", state, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    maxAge: 5 * 60 * 1000, // 5 minutes
  });

  const params = new URLSearchParams({
    client_id: DISCORD_CLIENT_ID,
    redirect_uri: getRedirectUri(),
    response_type: "code",
    scope: "identify",
    state,
  });

  res.redirect(`https://discord.com/api/oauth2/authorize?${params}`);
});

router.get("/auth/discord/callback", authRateLimit, async (req, res) => {
  const frontendUrl = getFrontendUrl();
  const { code, error, state } = req.query;

  // Verify CSRF state
  const savedState = req.cookies?.oauth_state;
  if (!state || !savedState || state !== savedState) {
    res.redirect(`${frontendUrl}/?auth_error=${encodeURIComponent("Verifikasi keamanan gagal. Coba login lagi.")}`);
    return;
  }
  res.clearCookie("oauth_state");

  if (error) {
    res.redirect(`${frontendUrl}/?auth_error=${encodeURIComponent("Login dibatalkan.")}`);
    return;
  }

  if (!code || typeof code !== "string") {
    res.redirect(`${frontendUrl}/?auth_error=${encodeURIComponent("Kode OAuth tidak valid.")}`);
    return;
  }

  try {
    const tokenRes = await fetch("https://discord.com/api/oauth2/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: DISCORD_CLIENT_ID,
        client_secret: DISCORD_CLIENT_SECRET,
        grant_type: "authorization_code",
        code,
        redirect_uri: getRedirectUri(),
      }),
    });

    if (!tokenRes.ok) {
      const err = await tokenRes.text();
      req.log.error({ err }, "Discord token exchange failed");
      res.redirect(`${frontendUrl}/?auth_error=${encodeURIComponent("Gagal menghubungi Discord. Coba lagi.")}`);
      return;
    }

    const tokenData = await tokenRes.json() as { access_token: string };

    const userRes = await fetch("https://discord.com/api/users/@me", {
      headers: { Authorization: `Bearer ${tokenData.access_token}` },
    });

    if (!userRes.ok) {
      res.redirect(`${frontendUrl}/?auth_error=${encodeURIComponent("Gagal mengambil data Discord.")}`);
      return;
    }

    const discordUser = await userRes.json() as {
      id: string;
      username: string;
      global_name: string | null;
      avatar: string | null;
    };

    const ageMs = getDiscordAccountAgeMs(discordUser.id);
    const ageDays = ageMs / (1000 * 60 * 60 * 24);

    if (ageDays < MIN_ACCOUNT_AGE_DAYS) {
      const daysLeft = Math.ceil(MIN_ACCOUNT_AGE_DAYS - ageDays);
      res.redirect(
        `${frontendUrl}/?auth_error=${encodeURIComponent(
          `Akun Discord kamu terlalu baru. Akun harus berusia minimal ${MIN_ACCOUNT_AGE_DAYS} hari. Coba lagi dalam ${daysLeft} hari.`
        )}`
      );
      return;
    }

    const displayName = discordUser.username;
    const discordAvatarHash = discordUser.avatar || null;

    const ip = getClientIp(req);
    const device = parseDevice(req.headers["user-agent"]);
    const now = new Date();

    let user = await db.query.usersTable.findFirst({
      where: eq(usersTable.discordId, discordUser.id),
    });

    if (user?.isBanned) {
      const reason = user.banReason || "";
      res.redirect(
        `${frontendUrl}/banned?reason=${encodeURIComponent(reason)}`
      );
      return;
    }

    const sessionToken = crypto.randomBytes(32).toString("hex");

    // Gunakan API URL untuk membuat avatar proxy URL
    const apiBaseUrl = process.env.API_URL || `http://localhost:${process.env.PORT || 3001}`;

    if (!user) {
      const [created] = await db.insert(usersTable).values({
        username: displayName,
        discordId: discordUser.id,
        discordAvatarHash,
        sessionToken,
        lastLoginAt: now,
        lastLoginIp: ip,
        lastLoginDevice: device,
      }).returning();
      user = created;
      // Set avatarUrl ke proxy endpoint (butuh user.id yang baru dibuat)
      const avatarUrl = discordAvatarHash
        ? `${apiBaseUrl}/users/${user.id}/avatar`
        : `https://api.dicebear.com/7.x/avataaars/svg?seed=${displayName}`;
      const [withAvatar] = await db.update(usersTable)
        .set({ avatarUrl })
        .where(eq(usersTable.id, user.id))
        .returning();
      user = withAvatar;
    } else {
      const avatarUrl = discordAvatarHash
        ? `${apiBaseUrl}/users/${user.id}/avatar`
        : `https://api.dicebear.com/7.x/avataaars/svg?seed=${displayName}`;
      const [updated] = await db.update(usersTable)
        .set({
          sessionToken,
          username: displayName,
          avatarUrl,
          discordAvatarHash,
          lastLoginAt: now,
          lastLoginIp: ip,
          lastLoginDevice: device,
        })
        .where(eq(usersTable.id, user.id))
        .returning();
      user = updated;
    }

    res.redirect(`${frontendUrl}/?token=${sessionToken}`);
  } catch (err) {
    req.log.error({ err }, "Discord OAuth error");
    res.redirect(`${frontendUrl}/?auth_error=${encodeURIComponent("Terjadi kesalahan. Silakan coba lagi.")}`);
  }
});

router.post("/auth/logout", async (req, res) => {
  const token = req.headers["x-auth-token"] as string;
  if (token) {
    await db.update(usersTable)
      .set({ sessionToken: null })
      .where(eq(usersTable.sessionToken, token));
  }
  res.json({ success: true, message: "Logged out" });
});

export default router;
