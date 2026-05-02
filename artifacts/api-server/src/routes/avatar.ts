import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { usersTable } from "@workspace/db/schema";
import { eq } from "drizzle-orm";

const router: IRouter = Router();

/**
 * Extract avatar hash dari URL Discord CDN yang tersimpan di DB.
 * Format: https://cdn.discordapp.com/avatars/{discordId}/{hash}.png?size=256
 */
function extractAvatarHashFromUrl(url: string | null): string | null {
  if (!url) return null;
  const match = url.match(/\/avatars\/\d+\/([a-f0-9]+)\./);
  return match ? match[1] : null;
}

/**
 * Avatar Proxy Endpoint
 * Melayani avatar user tanpa mengekspos Discord ID atau URL Discord CDN.
 * Frontend hanya melihat: /api/users/:userId/avatar
 */
router.get("/users/:userId/avatar", async (req, res) => {
  const userId = parseInt(req.params.userId);
  if (isNaN(userId)) {
    res.status(400).send("Invalid user ID");
    return;
  }

  const user = await db.query.usersTable.findFirst({
    where: eq(usersTable.id, userId),
    columns: { discordId: true, discordAvatarHash: true, avatarUrl: true, username: true },
  });

  if (!user) {
    res.status(404).send("User not found");
    return;
  }

  // Tentukan avatar hash: prioritas kolom baru, fallback extract dari URL lama
  const avatarHash = user.discordAvatarHash || extractAvatarHashFromUrl(user.avatarUrl);

  // Jika user punya avatar Discord, proxy dari CDN
  if (avatarHash) {
    const discordUrl = `https://cdn.discordapp.com/avatars/${user.discordId}/${avatarHash}.png?size=256`;

    try {
      const response = await fetch(discordUrl);
      if (response.ok) {
        const contentType = response.headers.get("content-type") || "image/png";
        const buffer = Buffer.from(await response.arrayBuffer());

        // Cache selama 1 jam untuk mengurangi request ke Discord CDN
        res.set({
          "Content-Type": contentType,
          "Cache-Control": "public, max-age=3600, s-maxage=3600",
          "X-Content-Type-Options": "nosniff",
        });
        res.send(buffer);
        return;
      }
    } catch (err) {
      // Fallback ke DiceBear jika Discord CDN gagal
    }
  }

  // Fallback: redirect ke DiceBear avatar
  const fallbackUrl = `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(user.username)}`;
  res.redirect(302, fallbackUrl);
});

export default router;
