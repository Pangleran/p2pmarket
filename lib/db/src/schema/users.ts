import { pgTable, text, serial, real, integer, timestamp, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const usersTable = pgTable("users", {
  id: serial("id").primaryKey(),
  username: text("username").notNull(),
  discordId: text("discord_id").notNull().unique(),
  avatarUrl: text("avatar_url"),
  discordAvatarHash: text("discord_avatar_hash"),
  rating: real("rating").notNull().default(5.0),
  totalTrades: integer("total_trades").notNull().default(0),
  walletBalance: real("wallet_balance").notNull().default(0),
  escrowBalance: real("escrow_balance").notNull().default(0),
  sessionToken: text("session_token"),
  isBanned: boolean("is_banned").notNull().default(false),
  banReason: text("ban_reason"),
  lastLoginAt: timestamp("last_login_at", { withTimezone: true }),
  lastLoginIp: text("last_login_ip"),
  lastLoginDevice: text("last_login_device"),
  joinedAt: timestamp("joined_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertUserSchema = createInsertSchema(usersTable).omit({ id: true, joinedAt: true });
export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof usersTable.$inferSelect;
