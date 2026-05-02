import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { usersTable } from "@workspace/db/schema";
import { eq } from "drizzle-orm";
import { requireAuth, type AuthRequest } from "../middlewares/auth";

const router: IRouter = Router();

const ADMIN_DISCORD_ID = "970041350865170462";

/**
 * Sanitize avatarUrl — jika masih berisi URL Discord CDN (mengekspos Discord ID),
 * ganti dengan URL proxy internal yang aman.
 */
function safeAvatarUrl(user: typeof usersTable.$inferSelect): string | null {
  if (!user.avatarUrl) return null;
  if (user.avatarUrl.includes("cdn.discordapp.com")) {
    const apiBaseUrl = process.env.API_URL || `http://localhost:${process.env.PORT || 3001}`;
    return `${apiBaseUrl}/users/${user.id}/avatar`;
  }
  return user.avatarUrl;
}

const formatPublicUser = (user: typeof usersTable.$inferSelect) => ({
  id: user.id,
  username: user.username,
  avatarUrl: safeAvatarUrl(user),
  rating: user.rating,
  totalTrades: user.totalTrades,
  isAdmin: user.discordId === ADMIN_DISCORD_ID,
  joinedAt: user.joinedAt,
});

router.get("/users/me", requireAuth, async (req: AuthRequest, res) => {
  const user = req.user!;
  res.json({
    ...formatPublicUser(user),
    walletBalance: user.walletBalance,
  });
});

router.get("/users/:userId", async (req, res) => {
  const userId = parseInt(req.params.userId);
  if (isNaN(userId)) {
    res.status(400).json({ error: "Bad request", message: "Invalid user ID" });
    return;
  }

  const user = await db.query.usersTable.findFirst({
    where: eq(usersTable.id, userId),
  });

  if (!user) {
    res.status(404).json({ error: "Not found", message: "User not found" });
    return;
  }

  res.json(formatPublicUser(user));
});

export default router;
