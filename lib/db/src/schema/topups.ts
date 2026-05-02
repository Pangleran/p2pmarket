import { pgTable, text, serial, real, integer, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { usersTable } from "./users";

export const topupsTable = pgTable("topups", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => usersTable.id),
  amount: real("amount").notNull(),
  method: text("method").notNull(),
  status: text("status", {
    enum: ["pending", "approved", "rejected"],
  }).notNull().default("pending"),
  proofUrl: text("proof_url"),
  adminNote: text("admin_note"),
  invoiceId: text("invoice_id"),
  paymentUrl: text("payment_url"),
  vaNumber: text("va_number"),
  qrisUrl: text("qris_url"),
  paymentCode: text("payment_code"),
  expiresAt: timestamp("expires_at", { withTimezone: true }),
  qrisTrxId: text("qris_trx_id"),
  qrisQrString: text("qris_qr_string"),
  qrisExpiresAt: timestamp("qris_expires_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertTopupSchema = createInsertSchema(topupsTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertTopup = z.infer<typeof insertTopupSchema>;
export type Topup = typeof topupsTable.$inferSelect;
