import { useMutation, useQuery } from "@tanstack/react-query";
import type { UseQueryOptions, UseMutationOptions } from "@tanstack/react-query";
import { customFetch } from "./custom-fetch";
import type { TopupWithUser, AdminUser, RejectTopupRequest, BanUserRequest } from "./generated/api.schemas";

type RequestOptions = { request?: RequestInit };

// ─── TRANSACTION ACTIVE COUNT ────────────────────────────────────────────────

export type TransactionActiveCount = { count: number };

export const getGetTransactionActiveCountQueryKey = () => [`/transactions/active-count`] as const;

export const useGetTransactionActiveCount = (
  options?: Omit<UseQueryOptions<TransactionActiveCount>, "queryKey" | "queryFn">,
) =>
  useQuery<TransactionActiveCount>({
    queryKey: getGetTransactionActiveCountQueryKey(),
    queryFn: () => customFetch<TransactionActiveCount>("/transactions/active-count", { method: "GET" }),
    refetchInterval: 30000,
    ...options,
  });

// ─── PENDING COUNTS ─────────────────────────────────────────────────────────

export type PendingCounts = { topups: number; withdrawals: number; disputes: number };

export const getGetAdminPendingCountsQueryKey = () => [`/admin/pending-counts`] as const;

export const useGetAdminPendingCounts = (
  { request }: RequestOptions = {},
  options?: Omit<UseQueryOptions<PendingCounts>, "queryKey" | "queryFn">,
) =>
  useQuery<PendingCounts>({
    queryKey: getGetAdminPendingCountsQueryKey(),
    queryFn: () => customFetch<PendingCounts>("/admin/pending-counts", { ...request, method: "GET" }),
    refetchInterval: 30000,
    ...options,
  });

// ─── ADMIN DISPUTES ──────────────────────────────────────────────────────────

export type AdminDisputeListing = {
  id: number; title: string; game: string; category: string; imageUrl: string | null; status: string;
};
export type AdminDisputeUser = {
  id: number; username: string; discordId: string; avatarUrl: string | null;
};
export type AdminDisputeTransaction = {
  id: number; listingId: number; buyerId: number; sellerId: number; amount: number;
  status: string; sellerProofUrl: string | null; buyerProofUrl: string | null;
  disputeReason: string | null; createdAt: string; updatedAt: string;
  listing: AdminDisputeListing; buyer: AdminDisputeUser; seller: AdminDisputeUser;
};

export const getGetAdminDisputesQueryKey = () => [`/admin/disputes`] as const;

export const useGetAdminDisputes = (
  { request }: RequestOptions = {},
  options?: UseQueryOptions<AdminDisputeTransaction[]>,
) =>
  useQuery<AdminDisputeTransaction[]>({
    queryKey: getGetAdminDisputesQueryKey(),
    queryFn: () => customFetch<AdminDisputeTransaction[]>("/admin/disputes", { ...request, method: "GET" }),
    ...options,
  });

export const useResolveDisputeBuyer = ({ request }: RequestOptions = {}) =>
  useMutation({
    mutationFn: ({ txId, adminNote }: { txId: number; adminNote?: string | null }) =>
      customFetch<{ success: boolean }>(`/admin/disputes/${txId}/resolve-buyer`, {
        ...request,
        method: "POST",
        body: JSON.stringify({ adminNote: adminNote ?? null }),
        headers: { "Content-Type": "application/json", ...(request?.headers ?? {}) },
      }),
  });

export const useResolveDisputeSeller = ({ request }: RequestOptions = {}) =>
  useMutation({
    mutationFn: ({ txId, adminNote }: { txId: number; adminNote?: string | null }) =>
      customFetch<{ success: boolean }>(`/admin/disputes/${txId}/resolve-seller`, {
        ...request,
        method: "POST",
        body: JSON.stringify({ adminNote: adminNote ?? null }),
        headers: { "Content-Type": "application/json", ...(request?.headers ?? {}) },
      }),
  });

// ─── ADMIN TOPUPS ───────────────────────────────────────────────────────────

export const getGetAdminTopupsQueryKey = () => [`/admin/topups`] as const;

export const useGetAdminTopups = (
  { request }: RequestOptions = {},
  options?: UseQueryOptions<TopupWithUser[]>,
) =>
  useQuery<TopupWithUser[]>({
    queryKey: getGetAdminTopupsQueryKey(),
    queryFn: () => customFetch<TopupWithUser[]>("/admin/topups", { ...request, method: "GET" }),
    ...options,
  });

export const useApproveTopup = ({ request }: RequestOptions = {}) =>
  useMutation({
    mutationFn: ({ topupId }: { topupId: number }) =>
      customFetch<{ success: boolean }>(`/admin/topups/${topupId}/approve`, { ...request, method: "POST" }),
  });

export const useRejectTopup = ({ request }: RequestOptions = {}) =>
  useMutation({
    mutationFn: ({ topupId, data }: { topupId: number; data: RejectTopupRequest }) =>
      customFetch<{ success: boolean }>(`/admin/topups/${topupId}/reject`, {
        ...request,
        method: "POST",
        body: JSON.stringify(data),
        headers: { "Content-Type": "application/json", ...(request?.headers ?? {}) },
      }),
  });

// ─── ADMIN USERS ────────────────────────────────────────────────────────────

export const getGetAdminUsersQueryKey = () => [`/admin/users`] as const;

export const useGetAdminUsers = (
  { request }: RequestOptions = {},
  options?: UseQueryOptions<AdminUser[]>,
) =>
  useQuery<AdminUser[]>({
    queryKey: getGetAdminUsersQueryKey(),
    queryFn: () => customFetch<AdminUser[]>("/admin/users", { ...request, method: "GET" }),
    ...options,
  });

export const useBanUser = ({ request }: RequestOptions = {}) =>
  useMutation({
    mutationFn: ({ userId, data }: { userId: number; data: BanUserRequest }) =>
      customFetch<{ success: boolean }>(`/admin/users/${userId}/ban`, {
        ...request,
        method: "POST",
        body: JSON.stringify(data),
        headers: { "Content-Type": "application/json", ...(request?.headers ?? {}) },
      }),
  });

export const useUnbanUser = ({ request }: RequestOptions = {}) =>
  useMutation({
    mutationFn: ({ userId }: { userId: number }) =>
      customFetch<{ success: boolean }>(`/admin/users/${userId}/unban`, {
        ...request,
        method: "POST",
      }),
  });
