import { pgTable, serial, text, integer, timestamp } from "drizzle-orm/pg-core";
import { usersTable } from "./users";

export const securityLogsTable = pgTable("security_logs", {
  id: serial("id").primaryKey(),
  path: text("path").notNull(),
  method: text("method").notNull(),
  statusCode: integer("status_code").notNull().default(404),
  logType: text("log_type").notNull().default("not_found"), // not_found | scanner | honeypot
  userId: integer("user_id").references(() => usersTable.id, { onDelete: "set null" }),
  username: text("username"),
  ip: text("ip"),
  country: text("country"),
  city: text("city"),
  device: text("device"),
  userAgent: text("user_agent"),
  referer: text("referer"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type SecurityLog = typeof securityLogsTable.$inferSelect;
