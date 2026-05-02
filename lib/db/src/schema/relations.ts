import { relations } from "drizzle-orm";
import { usersTable } from "./users";
import { listingsTable } from "./listings";
import { transactionsTable } from "./transactions";
import { walletTransactionsTable } from "./wallet_transactions";
import { withdrawalsTable } from "./withdrawals";
import { topupsTable } from "./topups";
import { chatMessagesTable } from "./chat_messages";

export const usersRelations = relations(usersTable, ({ many }) => ({
  listings: many(listingsTable),
  buyerTransactions: many(transactionsTable, { relationName: "buyer" }),
  sellerTransactions: many(transactionsTable, { relationName: "seller" }),
  walletTransactions: many(walletTransactionsTable),
  withdrawals: many(withdrawalsTable),
  topups: many(topupsTable),
}));

export const withdrawalsRelations = relations(withdrawalsTable, ({ one }) => ({
  user: one(usersTable, {
    fields: [withdrawalsTable.userId],
    references: [usersTable.id],
  }),
}));

export const topupsRelations = relations(topupsTable, ({ one }) => ({
  user: one(usersTable, {
    fields: [topupsTable.userId],
    references: [usersTable.id],
  }),
}));

export const listingsRelations = relations(listingsTable, ({ one }) => ({
  seller: one(usersTable, {
    fields: [listingsTable.sellerId],
    references: [usersTable.id],
  }),
}));

export const transactionsRelations = relations(transactionsTable, ({ one }) => ({
  listing: one(listingsTable, {
    fields: [transactionsTable.listingId],
    references: [listingsTable.id],
  }),
  buyer: one(usersTable, {
    fields: [transactionsTable.buyerId],
    references: [usersTable.id],
    relationName: "buyer",
  }),
  seller: one(usersTable, {
    fields: [transactionsTable.sellerId],
    references: [usersTable.id],
    relationName: "seller",
  }),
}));

export const walletTransactionsRelations = relations(walletTransactionsTable, ({ one }) => ({
  user: one(usersTable, {
    fields: [walletTransactionsTable.userId],
    references: [usersTable.id],
  }),
}));

export const chatMessagesRelations = relations(chatMessagesTable, ({ one }) => ({
  transaction: one(transactionsTable, {
    fields: [chatMessagesTable.transactionId],
    references: [transactionsTable.id],
  }),
  sender: one(usersTable, {
    fields: [chatMessagesTable.senderId],
    references: [usersTable.id],
  }),
}));
