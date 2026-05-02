import { Request, Response, NextFunction } from "express";
import { db } from "@workspace/db";
import { usersTable } from "@workspace/db/schema";
import { eq } from "drizzle-orm";

export interface AuthRequest extends Request {
  userId?: number;
  user?: typeof usersTable.$inferSelect;
}

export async function requireAuth(req: AuthRequest, res: Response, next: NextFunction) {
  const token = req.headers["x-auth-token"] as string;

  if (!token) {
    res.status(401).json({ error: "Unauthorized", message: "Authentication required" });
    return;
  }

  const user = await db.query.usersTable.findFirst({
    where: eq(usersTable.sessionToken, token),
  });

  if (!user) {
    res.status(401).json({ error: "Unauthorized", message: "Invalid or expired token" });
    return;
  }

  // Session expiration: 7 days
  if (user.lastLoginAt) {
    const tokenAge = Date.now() - new Date(user.lastLoginAt).getTime();
    if (tokenAge > 7 * 24 * 60 * 60 * 1000) {
      res.status(401).json({ error: "Unauthorized", message: "Session expired, please login again" });
      return;
    }
  }

  if (user.isBanned) {
    res.status(403).json({ error: "Forbidden", message: `Akun kamu telah dibanned.${user.banReason ? " Alasan: " + user.banReason : ""}` });
    return;
  }

  req.userId = user.id;
  req.user = user;
  next();
}
