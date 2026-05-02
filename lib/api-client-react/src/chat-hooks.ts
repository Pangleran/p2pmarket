import { useMutation, useQuery } from "@tanstack/react-query";
import type { UseQueryOptions } from "@tanstack/react-query";
import { customFetch } from "./custom-fetch";

type RequestOptions = { request?: RequestInit };

export type ChatSender = {
  id: number;
  username: string;
  avatarUrl: string | null;
  isAdmin?: boolean;
};

export type ChatMessage = {
  id: number;
  transactionId: number;
  senderId: number;
  sender: ChatSender;
  message: string | null;
  imageUrl: string | null;
  createdAt: string;
};

export const getGetChatMessagesQueryKey = (txId: number) =>
  [`/transactions/${txId}/messages`] as const;

export const useGetChatMessages = (
  txId: number,
  { request }: RequestOptions = {},
  options?: UseQueryOptions<ChatMessage[]>,
) =>
  useQuery<ChatMessage[]>({
    queryKey: getGetChatMessagesQueryKey(txId),
    queryFn: () =>
      customFetch<ChatMessage[]>(`/transactions/${txId}/messages`, {
        ...request,
        method: "GET",
      }),
    refetchInterval: 4000,
    ...options,
  });

export const useSendChatMessage = ({ request }: RequestOptions = {}) =>
  useMutation({
    mutationFn: ({
      txId,
      data,
    }: {
      txId: number;
      data: { message?: string; imageUrl?: string };
    }) =>
      customFetch<ChatMessage>(`/transactions/${txId}/messages`, {
        ...request,
        method: "POST",
        body: JSON.stringify(data),
        headers: {
          "Content-Type": "application/json",
          ...(request?.headers ?? {}),
        },
      }),
  });
