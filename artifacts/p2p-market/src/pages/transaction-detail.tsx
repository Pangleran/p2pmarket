import { useState, useRef, useEffect, useCallback } from "react";
import { useRoute, Link } from "wouter";
import {
  useGetTransactionById, useSellerConfirmSent, useBuyerConfirmReceived,
  useDisputeTransaction, getGetTransactionsQueryKey, getGetWalletBalanceQueryKey,
  useGetChatMessages, useSendChatMessage, getGetChatMessagesQueryKey,
  getGetTransactionActiveCountQueryKey,
} from "@workspace/api-client-react";
import { useAuthStore, useAuthHeaders } from "@/lib/store";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import {
  ShieldCheck, CheckCircle2, AlertTriangle, ArrowLeft, Image as ImageIcon,
  ExternalLink, Send, MessageCircle, ImagePlus, X as XIcon, Clock,
  Upload, Loader2,
} from "lucide-react";

const ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/jpg", "image/png", "image/gif", "image/webp", "image/bmp", "image/tiff"];

function useImageUpload(token: string | null) {
  const [isUploading, setIsUploading] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);
  const [uploadedUrl, setUploadedUrl] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const reset = useCallback(() => {
    setPreview(null);
    setUploadedUrl(null);
    setErrorMsg(null);
  }, []);

  const handleFile = useCallback(async (file: File): Promise<string | null> => {
    if (!file) return null;
    setErrorMsg(null);

    if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
      setErrorMsg("Hanya file gambar yang diperbolehkan (JPG, PNG, GIF, WEBP).");
      return null;
    }
    if (file.size > 5 * 1024 * 1024) {
      setErrorMsg("Ukuran file maksimal 5MB.");
      return null;
    }

    setPreview(URL.createObjectURL(file));
    setIsUploading(true);
    setUploadedUrl(null);
    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL}/storage/upload`, {
        method: "POST",
        headers: {
          "Content-Type": file.type,
          "X-File-Name": file.name,
          ...(token ? { "X-Auth-Token": token } : {}),
        },
        body: file,
      });
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        setErrorMsg(errData.error || "Gagal mengupload gambar.");
        return null;
      }
      const { url: servingUrl } = await res.json();
      setUploadedUrl(servingUrl);
      return servingUrl;
    } catch {
      setErrorMsg("Terjadi kesalahan saat upload.");
      return null;
    } finally {
      setIsUploading(false);
    }
  }, [token]);

  return { handleFile, isUploading, preview, uploadedUrl, errorMsg, reset };
}

import { format } from "date-fns";
import { id } from "date-fns/locale";
const CHAT_COOLDOWN_MS = 5000;

interface DiscordInviteInfo {
  name: string;
  icon: string | null;
  guildId: string;
  memberCount: number;
}

function DiscordInvitePreview({ url }: { url: string }) {
  const [info, setInfo] = useState<DiscordInviteInfo | null>(null);
  const [invalid, setInvalid] = useState(false);

  useEffect(() => {
    const match = url.match(/discord\.gg\/(\S+)/i);
    if (!match) { setInvalid(true); return; }
    const code = match[1].replace(/[/?#].*$/, "");
    fetch(`https://discord.com/api/v10/invites/${code}?with_counts=true`)
      .then(r => r.ok ? r.json() : Promise.reject())
      .then(data => {
        if (!data?.guild) { setInvalid(true); return; }
        setInfo({
          name: data.guild.name,
          icon: data.guild.icon
            ? `https://cdn.discordapp.com/icons/${data.guild.id}/${data.guild.icon}.png?size=64`
            : null,
          guildId: data.guild.id,
          memberCount: data.approximate_member_count ?? 0,
        });
      })
      .catch(() => setInvalid(true));
  }, [url]);

  if (invalid) {
    return (
      <a href={url} target="_blank" rel="noreferrer"
        className="text-xs underline opacity-70 break-all hover:opacity-100 transition-opacity">
        {url}
      </a>
    );
  }

  if (!info) {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs opacity-60">
        <Loader2 size={11} className="animate-spin" /> Memuat info server...
      </span>
    );
  }

  return (
    <a href={url} target="_blank" rel="noreferrer"
      className="flex items-center gap-2.5 mt-1 px-3 py-2 rounded-xl bg-[#5865F2]/10 border border-[#5865F2]/25 hover:bg-[#5865F2]/20 transition-colors no-underline max-w-[220px]">
      {info.icon ? (
        <img src={info.icon} alt={info.name} className="w-8 h-8 rounded-full flex-shrink-0 border border-white/30" />
      ) : (
        <div className="w-8 h-8 rounded-full bg-[#5865F2] flex items-center justify-center flex-shrink-0 text-white text-xs font-bold">
          {info.name.slice(0, 1).toUpperCase()}
        </div>
      )}
      <div className="min-w-0">
        <p className="text-[11px] font-bold text-[#5865F2] truncate leading-tight">{info.name}</p>
        <p className="text-[10px] text-slate-400 leading-tight">
          {info.memberCount > 0 ? `${info.memberCount.toLocaleString("id-ID")} anggota` : "Discord Server"}
        </p>
        <p className="text-[9px] text-[#5865F2]/70 font-medium leading-tight mt-0.5">Klik untuk bergabung</p>
      </div>
    </a>
  );
}

function renderMessageParts(text: string): React.ReactNode {
  const re = /(https:\/\/discord\.gg\/\S+)/gi;
  const parts = text.split(re);
  return parts.map((part, i) =>
    /^https:\/\/discord\.gg\/\S+$/i.test(part)
      ? <DiscordInvitePreview key={i} url={part} />
      : (part ? <span key={i}>{part}</span> : null)
  );
}

function ChatPanel({ txId, buyerId, sellerId, status }: {
  txId: number;
  buyerId: number;
  sellerId: number;
  status: string;
}) {
  const { user, token } = useAuthStore();
  const requestOptions = useAuthHeaders();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const bottomRef = useRef<HTMLDivElement>(null);

  const { data: messages = [] } = useGetChatMessages(txId, { request: requestOptions }, {
    refetchInterval: 4000,
  });
  const sendMutation = useSendChatMessage({ request: requestOptions });

  const [text, setText] = useState("");
  const [imageMode, setImageMode] = useState(false);
  const chatUpload = useImageUpload(token);
  const [cooldownSec, setCooldownSec] = useState(0);
  const cooldownRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const isAdmin = user?.isAdmin === true;
  const isDisputed = status === "disputed";
  const canChat = user && (user.id === buyerId || user.id === sellerId || (isAdmin && isDisputed));
  const isCoolingDown = cooldownSec > 0;

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length]);

  const startCooldown = useCallback(() => {
    setCooldownSec(CHAT_COOLDOWN_MS / 1000);
    if (cooldownRef.current) clearInterval(cooldownRef.current);
    cooldownRef.current = setInterval(() => {
      setCooldownSec(prev => {
        if (prev <= 1) {
          clearInterval(cooldownRef.current!);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  }, []);

  useEffect(() => () => { if (cooldownRef.current) clearInterval(cooldownRef.current); }, []);

  const handleSend = async () => {
    const trimMsg = text.trim();
    const uploadedImgUrl = chatUpload.uploadedUrl;
    if (!trimMsg && !uploadedImgUrl) return;
    if (isCoolingDown || chatUpload.isUploading) return;

    try {
      await sendMutation.mutateAsync({
        txId,
        data: {
          ...(trimMsg ? { message: trimMsg } : {}),
          ...(uploadedImgUrl ? { imageUrl: uploadedImgUrl } : {}),
        },
      });
      queryClient.invalidateQueries({ queryKey: getGetChatMessagesQueryKey(txId) });
      setText("");
      chatUpload.reset();
      setImageMode(false);
      if (!isAdmin) startCooldown();
    } catch (err: any) {
      const msg = err?.response?.data?.message || "Gagal mengirim pesan";
      toast({ title: "Gagal", description: msg, variant: "destructive" });
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
      {/* Header */}
      <div className="px-5 py-4 border-b border-slate-100 flex items-center gap-3">
        <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center">
          <MessageCircle size={18} className="text-primary" />
        </div>
        <div>
          <p className="font-bold text-secondary text-sm">Chat Transaksi</p>
          <p className="text-[11px] text-slate-400">
            {isDisputed ? "Pembeli · Penjual · Admin" : "Pembeli · Penjual"}
          </p>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3 min-h-[280px] max-h-[400px]">
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full py-10 text-slate-400">
            <MessageCircle size={40} className="mb-3 opacity-30" />
            <p className="text-sm">Belum ada pesan. Mulai chat!</p>
          </div>
        )}
        {messages.map(msg => {
          const isMe = msg.senderId === user?.id;
          const isMsgAdmin = msg.sender.isAdmin === true;
          return (
            <div key={msg.id} className={`flex gap-2.5 ${isMe ? "flex-row-reverse" : ""}`}>
              <div className="relative flex-shrink-0">
                <img
                  src={msg.sender.avatarUrl || `https://api.dicebear.com/7.x/avataaars/svg?seed=${msg.sender.username}`}
                  className="w-8 h-8 rounded-full border-2 border-white shadow-sm"
                />
                {isMsgAdmin && (
                  <div className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 bg-primary rounded-full flex items-center justify-center">
                    <ShieldCheck size={8} className="text-white" />
                  </div>
                )}
              </div>
              <div className={`max-w-[72%] space-y-1 ${isMe ? "items-end" : "items-start"} flex flex-col`}>
                <p className={`text-[10px] font-bold text-slate-400 ${isMe ? "text-right" : ""}`}>
                  {isMe ? "Kamu" : msg.sender.username}
                  {isMsgAdmin && " (Admin)"}
                </p>
                {msg.message && (
                  <div className={`px-4 py-2.5 rounded-2xl text-sm leading-relaxed flex flex-col gap-1 ${
                    isMe
                      ? "bg-primary text-white rounded-tr-sm"
                      : "bg-slate-100 text-slate-800 rounded-tl-sm"
                  }`}>
                    {renderMessageParts(msg.message)}
                  </div>
                )}
                {msg.imageUrl && (
                  <a href={msg.imageUrl} target="_blank" rel="noreferrer" className="group block">
                    <img
                      src={msg.imageUrl}
                      alt="gambar"
                      className="max-w-full rounded-2xl border border-slate-200 max-h-48 object-cover"
                    />
                    <div className="text-[10px] text-slate-400 mt-1 flex items-center gap-1 hover:text-primary transition-colors">
                      <ExternalLink size={10} /> Buka gambar
                    </div>
                  </a>
                )}
                <p className="text-[10px] text-slate-400">
                  {format(new Date(msg.createdAt), "HH:mm", { locale: id })}
                </p>
              </div>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      {canChat ? (
        <div className="px-4 pb-4 pt-2 border-t border-slate-100">
          {imageMode ? (
            <div className="space-y-2">
              <label className={`flex flex-col items-center justify-center w-full rounded-xl border-2 border-dashed cursor-pointer transition-colors ${chatUpload.preview ? "border-primary/40 bg-primary/5" : "border-slate-200 bg-slate-50 hover:border-primary/30"}`}>
                {chatUpload.preview ? (
                  <div className="relative w-full">
                    <img src={chatUpload.preview} alt="Preview" className="w-full max-h-36 object-contain rounded-xl" />
                    {chatUpload.isUploading && (
                      <div className="absolute inset-0 flex items-center justify-center bg-white/70 rounded-xl">
                        <Loader2 size={22} className="animate-spin text-primary" />
                      </div>
                    )}
                    {chatUpload.uploadedUrl && (
                      <div className="absolute top-2 right-2 bg-emerald-500 text-white text-xs font-bold px-2 py-1 rounded-full flex items-center gap-1">
                        <CheckCircle2 size={11} /> Siap kirim
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="py-5 flex flex-col items-center gap-1.5 text-slate-400">
                    <Upload size={22} />
                    <span className="text-xs font-medium">Klik untuk pilih gambar</span>
                  </div>
                )}
                <input type="file" accept="image/*" className="hidden"
                  onChange={e => { const f = e.target.files?.[0]; if (f) chatUpload.handleFile(f); }} />
              </label>
              {chatUpload.errorMsg && (
                <p className="text-xs text-red-500 px-1">{chatUpload.errorMsg}</p>
              )}
              <div className="flex gap-2">
                <button onClick={() => { setImageMode(false); chatUpload.reset(); }}
                  className="p-2.5 rounded-xl bg-slate-100 text-slate-500 hover:bg-slate-200 transition-colors">
                  <XIcon size={16} />
                </button>
                <button onClick={handleSend}
                  disabled={!chatUpload.uploadedUrl || sendMutation.isPending || isCoolingDown || chatUpload.isUploading}
                  className="flex-1 py-2.5 rounded-xl bg-primary text-white hover:bg-primary/90 transition-colors disabled:opacity-40 flex items-center justify-center gap-2 text-sm font-medium">
                  {chatUpload.isUploading ? <><Loader2 size={14} className="animate-spin" /> Mengupload...</> : isCoolingDown ? <><Clock size={14} />{cooldownSec}s</> : <><Send size={14} /> Kirim Gambar</>}
                </button>
              </div>
            </div>
          ) : (
            <div className="flex gap-2">
              <button
                onClick={() => setImageMode(true)}
                className="p-2.5 rounded-xl bg-slate-100 text-slate-500 hover:bg-slate-200 transition-colors flex-shrink-0"
                title="Kirim gambar"
              >
                <ImagePlus size={16} />
              </button>
              <input
                type="text"
                value={text}
                onChange={e => setText(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={isCoolingDown ? `Tunggu ${cooldownSec}s sebelum kirim lagi...` : "Ketik pesan... (Enter untuk kirim)"}
                disabled={isCoolingDown}
                className="flex-1 px-4 py-2.5 rounded-xl border border-slate-200 bg-slate-50 text-sm focus:ring-2 focus:ring-primary/20 disabled:opacity-60 disabled:cursor-not-allowed"
              />
              <button
                onClick={handleSend}
                disabled={!text.trim() || sendMutation.isPending || isCoolingDown}
                title={isCoolingDown ? `Tunggu ${cooldownSec} detik lagi` : "Kirim pesan"}
                className="p-2.5 rounded-xl bg-primary text-white hover:bg-primary/90 transition-colors disabled:opacity-40 flex-shrink-0 relative overflow-hidden"
              >
                {isCoolingDown ? (
                  <span className="font-mono text-xs font-bold">{cooldownSec}s</span>
                ) : (
                  <Send size={16} />
                )}
              </button>
            </div>
          )}
          {!isAdmin && (
            <p className="text-[10px] text-slate-400 mt-1.5 flex items-center gap-1">
              <Clock size={9} />
              Cooldown 5 detik per pesan · Chat dipantau sistem
            </p>
          )}
        </div>
      ) : (
        <div className="px-4 pb-4 pt-2 border-t border-slate-100">
          <p className="text-xs text-center text-slate-400">
            {isAdmin && !isDisputed
              ? "Admin hanya bisa chat saat transaksi dalam sengketa."
              : "Hanya pembeli dan penjual yang bisa chat."}
          </p>
        </div>
      )}
    </div>
  );
}

export default function TransactionDetail() {
  const [, params] = useRoute("/transaction/:id");
  const txId = parseInt(params?.id || "0");
  const { user, token } = useAuthStore();
  const requestOptions = useAuthHeaders();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: tx, isLoading } = useGetTransactionById(txId, { request: requestOptions, query: { refetchInterval: 5000 } });

  const sellerConfirmMutation = useSellerConfirmSent({ request: requestOptions });
  const buyerConfirmMutation = useBuyerConfirmReceived({ request: requestOptions });
  const disputeMutation = useDisputeTransaction({ request: requestOptions });

  const sellerUpload = useImageUpload(token);
  const buyerUpload = useImageUpload(token);

  const [disputeReason, setDisputeReason] = useState("");
  const [showDispute, setShowDispute] = useState(false);
  const [showConfirmReceived, setShowConfirmReceived] = useState(false);

  if (isLoading) return <div className="p-20 text-center text-slate-400">Memuat...</div>;
  if (!tx) return <div className="p-20 text-center text-slate-400">Transaksi tidak ditemukan.</div>;

  const isBuyer = user?.id === tx.buyerId;
  const isSeller = user?.id === tx.sellerId;

  const handleSellerConfirm = async () => {
    try {
      await sellerConfirmMutation.mutateAsync({ transactionId: txId, data: { proofUrl: sellerUpload.uploadedUrl || undefined } });
      queryClient.invalidateQueries({ queryKey: getGetTransactionsQueryKey() });
      queryClient.invalidateQueries({ queryKey: getGetTransactionActiveCountQueryKey() });
      toast({ title: "Berhasil", description: "Bukti pengiriman tersimpan. Menunggu konfirmasi pembeli." });
      sellerUpload.reset();
    } catch(e) {
      toast({ title: "Gagal", variant: "destructive" });
    }
  };

  const handleBuyerConfirm = async () => {
    try {
      await buyerConfirmMutation.mutateAsync({ transactionId: txId, data: { proofUrl: buyerUpload.uploadedUrl || undefined } });
      queryClient.invalidateQueries({ queryKey: getGetTransactionsQueryKey() });
      queryClient.invalidateQueries({ queryKey: getGetWalletBalanceQueryKey() });
      queryClient.invalidateQueries({ queryKey: getGetTransactionActiveCountQueryKey() });
      toast({ title: "Berhasil", description: "Transaksi selesai! Saldo dilepas ke penjual." });
      setShowConfirmReceived(false);
      buyerUpload.reset();
    } catch(e) {
      toast({ title: "Gagal", variant: "destructive" });
    }
  };

  const handleDispute = async () => {
    if (!disputeReason) return toast({ title: "Wajib diisi", description: "Alasan sengketa wajib diisi", variant: "destructive" });
    try {
      await disputeMutation.mutateAsync({ transactionId: txId, data: { reason: disputeReason } });
      queryClient.invalidateQueries({ queryKey: getGetTransactionsQueryKey() });
      queryClient.invalidateQueries({ queryKey: getGetTransactionActiveCountQueryKey() });
      toast({ title: "Berhasil", description: "Sengketa dibuka. Admin akan meninjau." });
      setShowDispute(false);
    } catch(e) {
      toast({ title: "Gagal", variant: "destructive" });
    }
  };

  const steps = [
    { key: "pending", label: "Dibayar", desc: "Saldo ditahan Escrow" },
    { key: "awaiting_delivery", label: "Dikirim", desc: "Penjual kirim item" },
    { key: "delivery_confirmed", label: "Diterima", desc: "Pembeli konfirmasi" },
    { key: "completed", label: "Selesai", desc: "Saldo dilepas" },
  ];

  const getStepIndex = (status: string) => {
    if (status === 'completed') return 3;
    if (status === 'delivery_confirmed') return 2;
    if (status === 'awaiting_delivery') return 1;
    return 0;
  };

  const currentIndex = getStepIndex(tx.status);

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8 md:py-12">
      {/* Confirm Received Modal */}
      {showConfirmReceived && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-3xl p-6 max-w-sm w-full shadow-2xl">
            <div className="flex items-center justify-center w-14 h-14 rounded-2xl bg-emerald-100 mx-auto mb-4">
              <CheckCircle2 size={28} className="text-emerald-500" />
            </div>
            <h3 className="font-bold text-secondary text-center text-lg mb-2">Konfirmasi Penerimaan</h3>
            <p className="text-sm text-slate-500 text-center mb-1">Apakah kamu yakin item sudah diterima?</p>
            <p className="text-xs text-red-500 text-center font-semibold mb-4">⚠ Barang yang sudah diterima tidak dapat dikembalikan.</p>
            <label className={`flex flex-col items-center justify-center w-full rounded-xl border-2 border-dashed cursor-pointer transition-colors mb-4 ${buyerUpload.preview ? "border-emerald-300 bg-emerald-50" : "border-slate-200 bg-slate-50 hover:border-emerald-200"}`}>
              {buyerUpload.preview ? (
                <div className="relative w-full">
                  <img src={buyerUpload.preview} alt="Preview" className="w-full max-h-36 object-contain rounded-xl" />
                  {buyerUpload.isUploading && (
                    <div className="absolute inset-0 flex items-center justify-center bg-white/70 rounded-xl">
                      <Loader2 size={24} className="animate-spin text-emerald-500" />
                    </div>
                  )}
                  {buyerUpload.uploadedUrl && (
                    <div className="absolute top-2 right-2 bg-emerald-500 text-white text-xs font-bold px-2 py-1 rounded-full flex items-center gap-1">
                      <CheckCircle2 size={12} /> Terupload
                    </div>
                  )}
                </div>
              ) : (
                <div className="py-5 flex flex-col items-center gap-1.5 text-slate-400">
                  <Upload size={24} />
                  <span className="text-xs font-medium">Upload bukti terima (opsional)</span>
                </div>
              )}
              <input
                type="file"
                accept="image/*"
                className="hidden"
                onChange={e => { const f = e.target.files?.[0]; if (f) buyerUpload.handleFile(f); }}
              />
            </label>
            {buyerUpload.errorMsg && (
              <p className="text-xs text-red-500 px-1 mb-1">{buyerUpload.errorMsg}</p>
            )}
            <div className="flex gap-3">
              <button
                onClick={handleBuyerConfirm}
                disabled={buyerConfirmMutation.isPending || buyerUpload.isUploading}
                className="flex-1 py-3 rounded-xl bg-emerald-500 text-white font-bold hover:bg-emerald-600 transition-colors disabled:opacity-50"
              >
                {buyerConfirmMutation.isPending ? "Memproses..." : "Ya, Sudah Diterima"}
              </button>
              <button
                onClick={() => { setShowConfirmReceived(false); buyerUpload.reset(); }}
                className="flex-1 py-3 rounded-xl bg-slate-100 text-slate-700 font-bold hover:bg-slate-200 transition-colors"
              >
                Batal
              </button>
            </div>
          </div>
        </div>
      )}

      <Link href="/dashboard" className="flex items-center gap-2 text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 text-sm font-medium mb-8 transition-colors">
        <ArrowLeft size={16} />
        Kembali ke Dashboard
      </Link>
      <div className="mb-8">
        <h1 className="text-3xl font-display font-bold text-secondary flex items-center gap-3">
          Detail Transaksi <span className="text-primary opacity-50">#{tx.id}</span>
        </h1>
        <p className="text-muted-foreground mt-2">Dibuat pada {format(new Date(tx.createdAt), 'dd MMMM yyyy, HH:mm', { locale: id })}</p>
      </div>

      {tx.status === 'disputed' && (
        <div className="bg-red-50 border border-red-200 rounded-2xl p-6 mb-8 flex items-start gap-4">
          <AlertTriangle className="text-red-500 mt-1 flex-shrink-0" size={24} />
          <div>
            <h3 className="font-bold text-red-800 text-lg">Dalam Sengketa</h3>
            <p className="text-red-600 mt-1">Transaksi sedang ditinjau oleh Admin. Alasan: {tx.disputeReason}</p>
          </div>
        </div>
      )}

      <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-8 mb-8">
        {/* Stepper */}
        <div className="relative flex justify-between mb-12">
          <div className="absolute top-5 left-0 w-full h-1 bg-slate-100 rounded-full z-0"></div>
          <div className="absolute top-5 left-0 h-1 bg-primary rounded-full z-0 transition-all duration-500" style={{ width: `${(currentIndex / 3) * 100}%` }}></div>

          {steps.map((step, i) => {
            const isActive = i <= currentIndex;
            return (
              <div key={step.key} className="relative z-10 flex flex-col items-center">
                <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm border-4 transition-colors ${
                  isActive ? "bg-primary border-primary/20 text-white" : "bg-slate-100 border-white text-slate-400"
                }`}>
                  {isActive ? <CheckCircle2 size={20} /> : i + 1}
                </div>
                <div className="mt-3 text-center">
                  <p className={`font-bold text-sm ${isActive ? "text-secondary" : "text-slate-400"}`}>{step.label}</p>
                  <p className="text-[11px] text-slate-500 hidden sm:block mt-0.5">{step.desc}</p>
                </div>
              </div>
            );
          })}
        </div>

        {/* Item Info */}
        <div className="flex flex-col sm:flex-row items-center justify-between p-6 bg-slate-50 rounded-2xl border border-slate-100 gap-6">
          <div className="flex-1">
            <span className="text-xs font-bold text-primary uppercase tracking-wider">{tx.listing.game}</span>
            <h3 className="font-bold text-xl text-secondary mt-1">{tx.listing.title}</h3>
            <p className="text-sm text-slate-500 mt-2">
              Penjual: <span className="font-bold text-slate-700">{tx.seller.username}</span> • Pembeli: <span className="font-bold text-slate-700">{tx.buyer.username}</span>
            </p>
          </div>
          <div className="text-right whitespace-nowrap">
            <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Total Dibayar</p>
            <p className="text-3xl font-display font-black text-secondary"><span className="text-lg font-bold text-primary">Rp</span> {tx.amount.toLocaleString("id-ID")}</p>
          </div>
        </div>
      </div>

      {/* Action + Proofs */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8">
        {/* Status & Actions */}
        <div className="space-y-6">
          <h3 className="font-bold text-xl text-secondary flex items-center gap-2">
            <ShieldCheck className="text-primary" /> Status & Tindakan
          </h3>

          {isSeller && tx.status === 'awaiting_delivery' && (
            <div className="bg-white p-6 rounded-3xl border border-primary/30 shadow-lg shadow-primary/5">
              <h4 className="font-bold text-secondary mb-2">Kirim Item Sekarang!</h4>
              <p className="text-sm text-slate-500 mb-4">Pembeli telah membayar dan saldo aman di Escrow. Kirim item ke pembeli, lalu klik tombol konfirmasi. Upload bukti screenshot bersifat opsional.</p>
              <div className="space-y-4">
                <label className={`flex flex-col items-center justify-center w-full rounded-xl border-2 border-dashed cursor-pointer transition-colors ${sellerUpload.preview ? "border-primary/40 bg-primary/5" : "border-slate-200 bg-slate-50 hover:border-primary/30"}`}>
                  {sellerUpload.preview ? (
                    <div className="relative w-full">
                      <img src={sellerUpload.preview} alt="Preview" className="w-full max-h-48 object-contain rounded-xl" />
                      {sellerUpload.isUploading && (
                        <div className="absolute inset-0 flex items-center justify-center bg-white/70 rounded-xl">
                          <Loader2 size={28} className="animate-spin text-primary" />
                        </div>
                      )}
                      {sellerUpload.uploadedUrl && (
                        <div className="absolute top-2 right-2 bg-emerald-500 text-white text-xs font-bold px-2 py-1 rounded-full flex items-center gap-1">
                          <CheckCircle2 size={12} /> Terupload
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="py-8 flex flex-col items-center gap-2 text-slate-400">
                      <Upload size={32} />
                      <span className="text-sm font-medium">Klik untuk pilih gambar</span>
                      <span className="text-xs">JPG, PNG, GIF, WEBP — maks 10MB</span>
                    </div>
                  )}
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={e => { const f = e.target.files?.[0]; if (f) sellerUpload.handleFile(f); }}
                  />
                </label>
                {sellerUpload.errorMsg && (
                  <p className="text-xs text-red-500 px-1">{sellerUpload.errorMsg}</p>
                )}
                <button
                  onClick={handleSellerConfirm}
                  disabled={sellerConfirmMutation.isPending || sellerUpload.isUploading}
                  className="w-full py-3 rounded-xl bg-primary text-white font-bold shadow-md hover:-translate-y-0.5 transition-all flex justify-center items-center gap-2 disabled:opacity-50 disabled:hover:translate-y-0"
                >
                  {sellerConfirmMutation.isPending ? <><Loader2 size={18} className="animate-spin" /> Menyimpan...</> : <><CheckCircle2 size={18} /> Saya Sudah Mengirim Item</>}
                </button>
              </div>
            </div>
          )}

          {isBuyer && (tx.status === 'awaiting_delivery' || tx.status === 'delivery_confirmed') && (
            <div className="bg-white p-6 rounded-3xl border border-primary/30 shadow-lg shadow-primary/5">
              <h4 className="font-bold text-secondary mb-2">Konfirmasi Penerimaan</h4>
              <p className="text-sm text-slate-500 mb-6">Penjual mengklaim telah mengirim item. Silakan cek akun game kamu terlebih dahulu, lalu klik tombol di bawah jika item sudah diterima.</p>
              <button
                onClick={() => setShowConfirmReceived(true)}
                className="w-full py-3 rounded-xl bg-emerald-500 text-white font-bold shadow-md hover:-translate-y-0.5 transition-all flex justify-center items-center gap-2"
              >
                <CheckCircle2 size={18} /> Item Sudah Diterima
              </button>
            </div>
          )}

          {(isBuyer || isSeller) && (tx.status === 'awaiting_delivery' || tx.status === 'delivery_confirmed') && (
            <button
              onClick={() => setShowDispute(!showDispute)}
              className="text-sm font-bold text-slate-400 hover:text-red-500 flex items-center gap-1 transition-colors"
            >
              <AlertTriangle size={14} /> Ada masalah? Buka Sengketa
            </button>
          )}

          {showDispute && (
            <div className="bg-red-50 p-6 rounded-2xl border border-red-100">
              <textarea
                value={disputeReason} onChange={e => setDisputeReason(e.target.value)}
                placeholder="Jelaskan secara detail masalah Anda..."
                className="w-full px-4 py-3 rounded-xl bg-white border border-red-200 focus:ring-2 focus:ring-red-200 mb-4 h-24 resize-none"
              />
              <button
                onClick={handleDispute} disabled={disputeMutation.isPending}
                className="w-full py-2.5 rounded-xl bg-red-500 text-white font-bold shadow-sm hover:bg-red-600 transition-colors"
              >
                Kirim Laporan
              </button>
            </div>
          )}

          {tx.status === 'completed' && (
            <div className="bg-emerald-50 text-emerald-800 p-6 rounded-2xl border border-emerald-200 text-center">
              <CheckCircle2 size={48} className="mx-auto mb-4 text-emerald-500 opacity-50" />
              <h4 className="font-bold text-lg mb-1">Transaksi Selesai</h4>
              <p className="text-sm opacity-80">Saldo telah dilepas ke penjual. Terima kasih telah menggunakan P2PMarket.</p>
            </div>
          )}

          {tx.status === 'cancelled' && (
            <div className="bg-slate-50 text-slate-600 p-6 rounded-2xl border border-slate-200 text-center">
              <AlertTriangle size={48} className="mx-auto mb-4 text-slate-400 opacity-50" />
              <h4 className="font-bold text-lg mb-1">Transaksi Dibatalkan</h4>
              <p className="text-sm opacity-80">Saldo escrow telah dikembalikan ke pembeli.</p>
            </div>
          )}
        </div>

        {/* Bukti Transaksi */}
        <div className="space-y-6">
          <h3 className="font-bold text-xl text-secondary flex items-center gap-2">
            <ImageIcon className="text-slate-400" /> Bukti Transaksi
          </h3>

          <div className="bg-white rounded-3xl border border-slate-200 p-6 space-y-6">
            <div>
              <p className="text-sm font-bold text-slate-700 mb-3 flex items-center justify-between">
                Bukti Pengiriman (Penjual)
                {tx.sellerProofUrl && <a href={tx.sellerProofUrl} target="_blank" className="text-primary text-xs flex items-center gap-1 hover:underline">Buka <ExternalLink size={12}/></a>}
              </p>
              {tx.sellerProofUrl ? (
                <img src={tx.sellerProofUrl} alt="Seller Proof" className="w-full h-48 object-cover rounded-xl border border-slate-200 bg-slate-50" />
              ) : (
                <div className="w-full h-32 rounded-xl bg-slate-50 border border-slate-100 flex items-center justify-center text-slate-400 text-sm italic">Belum ada bukti</div>
              )}
            </div>

            <div className="border-t border-slate-100 pt-6">
              <p className="text-sm font-bold text-slate-700 mb-3 flex items-center justify-between">
                Bukti Penerimaan (Pembeli)
                {tx.buyerProofUrl && <a href={tx.buyerProofUrl} target="_blank" className="text-primary text-xs flex items-center gap-1 hover:underline">Buka <ExternalLink size={12}/></a>}
              </p>
              {tx.buyerProofUrl ? (
                <img src={tx.buyerProofUrl} alt="Buyer Proof" className="w-full h-48 object-cover rounded-xl border border-slate-200 bg-slate-50" />
              ) : (
                <div className="w-full h-32 rounded-xl bg-slate-50 border border-slate-100 flex items-center justify-center text-slate-400 text-sm italic">Belum ada bukti</div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Chat Panel - hidden when transaction is cancelled or completed */}
      {tx.status !== "cancelled" && tx.status !== "completed" && (
        <ChatPanel
          txId={txId}
          buyerId={tx.buyerId}
          sellerId={tx.sellerId}
          status={tx.status}
        />
      )}
    </div>
  );
}
