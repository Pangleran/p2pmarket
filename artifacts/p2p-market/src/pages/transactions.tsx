import {
  useGetTransactions, useGetAdminWithdrawals, useApproveWithdrawal, useRejectWithdrawal,
  getGetAdminWithdrawalsQueryKey,
  useGetAdminUsers, useBanUser, useUnbanUser, getGetAdminUsersQueryKey,
  useGetAdminPendingCounts, getGetAdminPendingCountsQueryKey,
  useGetAdminDisputes, useResolveDisputeBuyer, useResolveDisputeSeller,
  getGetAdminDisputesQueryKey,
} from "@workspace/api-client-react";
import type { AdminDisputeTransaction } from "@workspace/api-client-react";
import { useAuthStore, useAuthHeaders } from "@/lib/store";
import { Link } from "wouter";
import { format } from "date-fns";
import { id } from "date-fns/locale";
import { StatusBadge } from "./dashboard";
import {
  ArrowRightLeft, ArrowLeft, Search, ArrowDownToLine, Clock, CheckCircle, XCircle,
  Check, X, Users, ShieldBan, ShieldCheck, Laptop, Smartphone,
  Monitor, Globe, Wallet, Star, Calendar, Gavel, ExternalLink, UserCheck, UserX,
  Database, Upload, Download, Send,
} from "lucide-react";
import { useState, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import type { AdminUser } from "@workspace/api-client-react";
import { ADMIN_DISCORD_ID } from "../lib/trust-tier";

const PAYMENT_METHOD_NAMES: Record<string, string> = {
  bca: "BCA", bri: "BRI", bni: "BNI", mandiri: "Mandiri", bsi: "BSI",
  gopay: "GoPay", ovo: "OVO", dana: "DANA", shopeepay: "ShopeePay",
  bank_transfer: "Transfer Bank", qris: "QRIS",
};

function StatusChip({ status }: { status: string }) {
  if (status === "pending") return (
    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-amber-100 text-amber-700">
      <Clock size={11} /> Menunggu
    </span>
  );
  if (status === "approved") return (
    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-700">
      <CheckCircle size={11} /> Disetujui
    </span>
  );
  return (
    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-red-100 text-red-700">
      <XCircle size={11} /> Ditolak
    </span>
  );
}

function DeviceIcon({ device }: { device?: string | null }) {
  if (!device) return <Monitor size={14} className="text-slate-400" />;
  if (/android|ios/i.test(device)) return <Smartphone size={14} className="text-slate-400" />;
  return <Monitor size={14} className="text-slate-400" />;
}

// ─── ADMIN WITHDRAWALS ─────────────────────────────────────────────────────

function AdminWithdrawals() {
  const requestOptions = useAuthHeaders();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { data: withdrawals, isLoading } = useGetAdminWithdrawals({ request: requestOptions });
  const approveMutation = useApproveWithdrawal({ request: requestOptions });
  const rejectMutation = useRejectWithdrawal({ request: requestOptions });

  const [rejectingId, setRejectingId] = useState<number | null>(null);
  const [rejectNote, setRejectNote] = useState("");
  const [filterStatus, setFilterStatus] = useState<"all" | "pending" | "approved" | "rejected">("pending");

  const filtered = withdrawals?.filter(w => filterStatus === "all" ? true : w.status === filterStatus);

  const handleApprove = async (withdrawalId: number) => {
    try {
      await approveMutation.mutateAsync({ withdrawalId });
      queryClient.invalidateQueries({ queryKey: getGetAdminWithdrawalsQueryKey() });
      queryClient.invalidateQueries({ queryKey: getGetAdminPendingCountsQueryKey() });
      toast({ title: "Penarikan Disetujui", description: "Dana akan dikirim ke rekening user." });
    } catch (e: any) {
      toast({ title: "Gagal", description: e?.response?.data?.message, variant: "destructive" });
    }
  };

  const handleReject = async (withdrawalId: number) => {
    try {
      await rejectMutation.mutateAsync({ withdrawalId, data: { adminNote: rejectNote || null } });
      queryClient.invalidateQueries({ queryKey: getGetAdminWithdrawalsQueryKey() });
      queryClient.invalidateQueries({ queryKey: getGetAdminPendingCountsQueryKey() });
      toast({ title: "Penarikan Ditolak", description: "Saldo dikembalikan ke user." });
      setRejectingId(null);
      setRejectNote("");
    } catch (e: any) {
      toast({ title: "Gagal", description: e?.response?.data?.message, variant: "destructive" });
    }
  };

  return (
    <div>
      <div className="flex gap-2 mb-6">
        {(["pending", "all", "approved", "rejected"] as const).map(s => (
          <button
            key={s}
            onClick={() => setFilterStatus(s)}
            className={`px-4 py-2 rounded-lg text-sm font-bold transition-colors ${filterStatus === s ? "bg-indigo-600 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"}`}
          >
            {s === "all" ? "Semua" : s === "pending" ? "Menunggu" : s === "approved" ? "Disetujui" : "Ditolak"}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="p-16 text-center text-slate-400">Memuat...</div>
      ) : !filtered?.length ? (
        <div className="text-center py-20 bg-white rounded-3xl border border-slate-200">
          <ArrowDownToLine size={56} className="mx-auto text-slate-200 mb-4" />
          <h3 className="text-lg font-bold text-slate-400">Tidak ada permintaan penarikan</h3>
        </div>
      ) : (
        <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="divide-y divide-slate-100">
            {filtered?.map(w => (
              <div key={w.id} className="p-5">
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 rounded-xl bg-indigo-50 flex items-center justify-center flex-shrink-0">
                    <ArrowDownToLine size={22} className="text-indigo-500" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2 mb-1">
                      <p className="font-bold text-secondary">{w.user.username}</p>
                      <span className="text-xs text-slate-400">@{w.user.username}</span>
                      <StatusChip status={w.status} />
                    </div>
                    <p className="text-sm text-slate-600">
                      <span className="font-semibold">{PAYMENT_METHOD_NAMES[w.method] ?? w.method.toUpperCase()}</span>
                      {" · "}{w.accountNumber}{" · "}{w.accountName}
                    </p>
                    {w.adminNote && <p className="text-xs text-red-500 mt-1">Catatan: {w.adminNote}</p>}
                    <p className="text-xs text-slate-400 mt-1">
                      {format(new Date(w.createdAt), "dd MMM yyyy, HH:mm", { locale: id })}
                    </p>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="font-display font-black text-xl text-secondary">Rp {w.amount.toLocaleString("id-ID")}</p>
                  </div>
                </div>

                {w.status === "pending" && (
                  <div className="mt-4 flex gap-3">
                    {rejectingId === w.id ? (
                      <div className="flex-1 flex flex-col sm:flex-row gap-3">
                        <input
                          type="text"
                          value={rejectNote}
                          onChange={e => setRejectNote(e.target.value)}
                          placeholder="Alasan penolakan (opsional)..."
                          className="flex-1 px-4 py-2 rounded-xl border border-slate-200 text-sm focus:ring-2 focus:ring-red-200 bg-slate-50"
                          autoFocus
                        />
                        <div className="flex gap-2">
                          <button
                            onClick={() => handleReject(w.id)}
                            disabled={rejectMutation.isPending}
                            className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-red-500 text-white font-bold text-sm hover:bg-red-600 transition-colors disabled:opacity-50"
                          >
                            <X size={15} /> Tolak
                          </button>
                          <button
                            onClick={() => { setRejectingId(null); setRejectNote(""); }}
                            className="px-4 py-2 rounded-xl bg-slate-100 text-slate-600 font-bold text-sm hover:bg-slate-200 transition-colors"
                          >
                            Batal
                          </button>
                        </div>
                      </div>
                    ) : (
                      <>
                        <button
                          onClick={() => handleApprove(w.id)}
                          disabled={approveMutation.isPending}
                          className="flex items-center gap-1.5 px-5 py-2.5 rounded-xl bg-emerald-500 text-white font-bold text-sm hover:bg-emerald-600 transition-colors disabled:opacity-50 shadow-sm"
                        >
                          <Check size={16} /> Setujui
                        </button>
                        <button
                          onClick={() => setRejectingId(w.id)}
                          className="flex items-center gap-1.5 px-5 py-2.5 rounded-xl bg-red-50 text-red-600 font-bold text-sm hover:bg-red-100 transition-colors border border-red-200"
                        >
                          <X size={16} /> Tolak
                        </button>
                      </>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── ADMIN USERS ───────────────────────────────────────────────────────────

function AdminUsers() {
  const requestOptions = useAuthHeaders();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { data: users, isLoading } = useGetAdminUsers({ request: requestOptions });
  const banMutation = useBanUser({ request: requestOptions });
  const unbanMutation = useUnbanUser({ request: requestOptions });

  const [search, setSearch] = useState("");
  const [selectedUser, setSelectedUser] = useState<AdminUser | null>(null);
  const [banReason, setBanReason] = useState("");
  const [showBanModal, setShowBanModal] = useState(false);

  const filtered = users?.filter(u =>
    u.username.toLowerCase().includes(search.toLowerCase()) ||
    u.discordId.includes(search)
  );

  const handleBan = async () => {
    if (!selectedUser) return;
    try {
      await banMutation.mutateAsync({ userId: selectedUser.id, data: { reason: banReason || null } });
      queryClient.invalidateQueries({ queryKey: getGetAdminUsersQueryKey() });
      toast({ title: "User Dibanned", description: `${selectedUser.username} tidak bisa login lagi.` });
      setShowBanModal(false);
      setBanReason("");
      setSelectedUser(null);
    } catch (e: any) {
      toast({ title: "Gagal", variant: "destructive" });
    }
  };

  const handleUnban = async (user: AdminUser) => {
    try {
      await unbanMutation.mutateAsync({ userId: user.id });
      queryClient.invalidateQueries({ queryKey: getGetAdminUsersQueryKey() });
      toast({ title: "User Di-unban", description: `${user.username} bisa login kembali.` });
    } catch (e: any) {
      toast({ title: "Gagal", variant: "destructive" });
    }
  };

  return (
    <div>
      {/* Ban Modal */}
      {showBanModal && selectedUser && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-3xl p-6 max-w-md w-full shadow-2xl">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 bg-red-100 rounded-xl flex items-center justify-center">
                <ShieldBan size={20} className="text-red-500" />
              </div>
              <div>
                <h3 className="font-bold text-secondary">Ban Pengguna</h3>
                <p className="text-sm text-slate-500">{selectedUser.username}</p>
              </div>
            </div>
            <p className="text-sm text-slate-600 mb-4">
              User ini tidak akan bisa login lewat Discord. Saldo dan data tetap tersimpan.
            </p>
            <input
              type="text"
              value={banReason}
              onChange={e => setBanReason(e.target.value)}
              placeholder="Alasan ban (opsional)..."
              className="w-full px-4 py-3 rounded-xl border border-slate-200 text-sm bg-slate-50 focus:ring-2 focus:ring-red-200 mb-4"
              autoFocus
            />
            <div className="flex gap-3">
              <button
                onClick={handleBan}
                disabled={banMutation.isPending}
                className="flex-1 py-3 rounded-xl bg-red-500 text-white font-bold text-sm hover:bg-red-600 transition-colors disabled:opacity-50"
              >
                {banMutation.isPending ? "Memproses..." : "Ban User"}
              </button>
              <button
                onClick={() => { setShowBanModal(false); setBanReason(""); setSelectedUser(null); }}
                className="flex-1 py-3 rounded-xl bg-slate-100 text-slate-700 font-bold text-sm hover:bg-slate-200 transition-colors"
              >
                Batal
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Search */}
      <div className="relative mb-6">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
        <input
          type="text"
          placeholder="Cari username atau Discord ID..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="w-full pl-11 pr-4 py-3 rounded-xl bg-white border border-slate-200 shadow-sm focus:ring-2 focus:ring-primary/20 text-sm"
        />
      </div>

      {isLoading ? (
        <div className="p-16 text-center text-slate-400">Memuat...</div>
      ) : !filtered?.length ? (
        <div className="text-center py-20 bg-white rounded-3xl border border-slate-200">
          <Users size={56} className="mx-auto text-slate-200 mb-4" />
          <h3 className="text-lg font-bold text-slate-400">Tidak ada pengguna</h3>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered?.map(u => (
            <div
              key={u.id}
              className={`bg-white rounded-2xl border shadow-sm overflow-hidden transition-all ${u.isBanned ? "border-red-200 bg-red-50/30" : "border-slate-200"}`}
            >
              <div className="p-5">
                <div className="flex items-start gap-4">
                  {/* Avatar & Identity */}
                  <div className="relative flex-shrink-0">
                    <img
                      src={u.avatarUrl || `https://api.dicebear.com/7.x/avataaars/svg?seed=${u.username}`}
                      className="w-12 h-12 rounded-xl bg-slate-100"
                    />
                    {u.isBanned && (
                      <div className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 rounded-full flex items-center justify-center">
                        <ShieldBan size={10} className="text-white" />
                      </div>
                    )}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2 mb-1">
                      <p className="font-bold text-secondary">{u.username}</p>
                      {u.isBanned ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold bg-red-100 text-red-700">
                          <ShieldBan size={10} /> BANNED
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold bg-emerald-100 text-emerald-700">
                          <ShieldCheck size={10} /> Aktif
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-slate-400 mb-2">Discord ID: {u.discordId}</p>

                    {/* Stats Grid */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-3">
                      <div className="bg-slate-50 rounded-lg px-3 py-2">
                        <p className="text-[10px] text-slate-400 font-medium mb-0.5">Saldo</p>
                        <p className="text-sm font-bold text-secondary">Rp {u.walletBalance.toLocaleString("id-ID")}</p>
                      </div>
                      <div className="bg-slate-50 rounded-lg px-3 py-2">
                        <p className="text-[10px] text-slate-400 font-medium mb-0.5">Escrow</p>
                        <p className="text-sm font-bold text-amber-600">Rp {u.escrowBalance.toLocaleString("id-ID")}</p>
                      </div>
                      <div className="bg-slate-50 rounded-lg px-3 py-2">
                        <p className="text-[10px] text-slate-400 font-medium mb-0.5">Rating</p>
                        <p className="text-sm font-bold text-yellow-500 flex items-center gap-0.5"><Star size={11} fill="currentColor" />{u.rating.toFixed(1)}</p>
                      </div>
                      <div className="bg-slate-50 rounded-lg px-3 py-2">
                        <p className="text-[10px] text-slate-400 font-medium mb-0.5">Transaksi</p>
                        <p className="text-sm font-bold text-secondary">{u.totalTrades}x</p>
                      </div>
                    </div>

                    {/* Login Info */}
                    <div className="flex flex-wrap gap-3 text-xs text-slate-500">
                      <span className="flex items-center gap-1">
                        <Calendar size={11} />
                        Daftar: {format(new Date(u.joinedAt), "dd MMM yyyy", { locale: id })}
                      </span>
                      {u.lastLoginAt && (
                        <span className="flex items-center gap-1">
                          <Clock size={11} />
                          Login: {format(new Date(u.lastLoginAt), "dd MMM yyyy, HH:mm", { locale: id })}
                        </span>
                      )}
                      {u.lastLoginIp && (
                        <span className="flex items-center gap-1">
                          <Globe size={11} />
                          {u.lastLoginIp}
                        </span>
                      )}
                      {u.lastLoginDevice && (
                        <span className="flex items-center gap-1">
                          <DeviceIcon device={u.lastLoginDevice} />
                          {u.lastLoginDevice}
                        </span>
                      )}
                    </div>

                    {u.isBanned && u.banReason && (
                      <p className="mt-2 text-xs text-red-500 font-medium">Alasan ban: {u.banReason}</p>
                    )}
                  </div>

                  {/* Action */}
                  <div className="flex-shrink-0">
                    {u.discordId === ADMIN_DISCORD_ID ? ( /* Admin check via admin-only endpoint */
                      <span className="text-xs font-bold text-primary bg-primary/10 px-3 py-1.5 rounded-lg">Admin</span>
                    ) : u.isBanned ? (
                      <button
                        onClick={() => handleUnban(u)}
                        disabled={unbanMutation.isPending}
                        className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-500 text-white font-bold text-sm hover:bg-emerald-600 transition-colors disabled:opacity-50 shadow-sm"
                      >
                        <ShieldCheck size={14} /> Unban
                      </button>
                    ) : (
                      <button
                        onClick={() => { setSelectedUser(u); setShowBanModal(true); }}
                        className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-red-50 text-red-600 font-bold text-sm hover:bg-red-100 transition-colors border border-red-200"
                      >
                        <ShieldBan size={14} /> Ban
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── ADMIN DISPUTES ────────────────────────────────────────────────────────

function AdminDisputes() {
  const requestOptions = useAuthHeaders();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { data: disputes, isLoading } = useGetAdminDisputes({ request: requestOptions });
  const resolveBuyerMutation = useResolveDisputeBuyer({ request: requestOptions });
  const resolveSellerMutation = useResolveDisputeSeller({ request: requestOptions });

  const [resolvingId, setResolvingId] = useState<number | null>(null);
  const [adminNote, setAdminNote] = useState("");
  const [pendingAction, setPendingAction] = useState<"buyer" | "seller" | null>(null);

  const openResolve = (txId: number, action: "buyer" | "seller") => {
    setResolvingId(txId);
    setPendingAction(action);
    setAdminNote("");
  };

  const handleResolve = async () => {
    if (!resolvingId || !pendingAction) return;
    try {
      if (pendingAction === "buyer") {
        await resolveBuyerMutation.mutateAsync({ txId: resolvingId, adminNote: adminNote || null });
        toast({ title: "Diselesaikan", description: "Sengketa dimenangkan pembeli. Saldo dikembalikan." });
      } else {
        await resolveSellerMutation.mutateAsync({ txId: resolvingId, adminNote: adminNote || null });
        toast({ title: "Diselesaikan", description: "Sengketa dimenangkan penjual. Saldo dilepas." });
      }
      queryClient.invalidateQueries({ queryKey: getGetAdminDisputesQueryKey() });
      queryClient.invalidateQueries({ queryKey: getGetAdminPendingCountsQueryKey() });
      setResolvingId(null);
      setPendingAction(null);
      setAdminNote("");
    } catch (e: any) {
      toast({ title: "Gagal", description: e?.response?.data?.message, variant: "destructive" });
    }
  };

  const isPending = resolveBuyerMutation.isPending || resolveSellerMutation.isPending;

  return (
    <div>
      {/* Confirm Modal */}
      {resolvingId && pendingAction && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-3xl p-6 max-w-md w-full shadow-2xl">
            <div className="flex items-center gap-3 mb-4">
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${pendingAction === "buyer" ? "bg-indigo-100" : "bg-emerald-100"}`}>
                {pendingAction === "buyer"
                  ? <UserCheck size={20} className="text-indigo-500" />
                  : <UserX size={20} className="text-emerald-500" />}
              </div>
              <div>
                <h3 className="font-bold text-secondary">
                  {pendingAction === "buyer" ? "Pembeli Menang" : "Penjual Menang"}
                </h3>
                <p className="text-sm text-slate-500">Sengketa #{resolvingId}</p>
              </div>
            </div>
            <p className="text-sm text-slate-600 mb-4">
              {pendingAction === "buyer"
                ? "Saldo escrow akan dikembalikan ke pembeli. Item akan kembali aktif di market."
                : "Saldo escrow akan dilepas ke penjual. Transaksi dianggap selesai."}
            </p>
            <input
              type="text"
              value={adminNote}
              onChange={e => setAdminNote(e.target.value)}
              placeholder="Catatan admin (opsional)..."
              className="w-full px-4 py-3 rounded-xl border border-slate-200 text-sm bg-slate-50 focus:ring-2 focus:ring-primary/20 mb-4"
              autoFocus
            />
            <div className="flex gap-3">
              <button
                onClick={handleResolve}
                disabled={isPending}
                className={`flex-1 py-3 rounded-xl font-bold text-sm text-white transition-colors disabled:opacity-50 ${pendingAction === "buyer" ? "bg-indigo-500 hover:bg-indigo-600" : "bg-emerald-500 hover:bg-emerald-600"}`}
              >
                {isPending ? "Memproses..." : "Konfirmasi"}
              </button>
              <button
                onClick={() => { setResolvingId(null); setPendingAction(null); }}
                className="flex-1 py-3 rounded-xl bg-slate-100 text-slate-700 font-bold text-sm hover:bg-slate-200 transition-colors"
              >
                Batal
              </button>
            </div>
          </div>
        </div>
      )}

      {isLoading ? (
        <div className="p-16 text-center text-slate-400">Memuat...</div>
      ) : !disputes?.length ? (
        <div className="text-center py-24 bg-white rounded-3xl border border-slate-200">
          <Gavel size={56} className="mx-auto text-slate-200 mb-4" />
          <h3 className="text-lg font-bold text-slate-400">Tidak ada sengketa aktif</h3>
          <p className="text-sm text-slate-400 mt-2">Semua transaksi berjalan lancar.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {disputes.map(tx => (
            <div key={tx.id} className="bg-white rounded-3xl border border-red-200 shadow-sm overflow-hidden">
              {/* Header */}
              <div className="bg-red-50 px-6 py-4 border-b border-red-100 flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-red-100 flex items-center justify-center">
                    <Gavel size={18} className="text-red-500" />
                  </div>
                  <div>
                    <p className="font-bold text-red-800">Sengketa Transaksi #{tx.id}</p>
                    <p className="text-xs text-red-500">{format(new Date(tx.updatedAt), "dd MMM yyyy, HH:mm", { locale: id })}</p>
                  </div>
                </div>
                <p className="font-display font-black text-2xl text-red-600">
                  <span className="text-sm font-bold">Rp</span> {tx.amount.toLocaleString("id-ID")}
                </p>
              </div>

              <div className="p-6 space-y-5">
                {/* Item */}
                <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-2xl border border-slate-100">
                  <div className="w-10 h-10 rounded-lg bg-slate-200 flex items-center justify-center overflow-hidden flex-shrink-0">
                    {tx.listing.imageUrl
                      ? <img src={tx.listing.imageUrl} className="w-full h-full object-cover" />
                      : <span className="text-xs font-bold text-slate-400">{tx.listing.game.slice(0,3)}</span>}
                  </div>
                  <div>
                    <p className="font-bold text-secondary text-sm">{tx.listing.title}</p>
                    <p className="text-xs text-slate-400">{tx.listing.game} · {tx.listing.category}</p>
                  </div>
                </div>

                {/* Parties */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="p-3 rounded-2xl border border-indigo-100 bg-indigo-50/50">
                    <p className="text-[10px] font-bold text-indigo-500 uppercase tracking-wider mb-1.5">Pembeli</p>
                    <div className="flex items-center gap-2">
                      <img src={tx.buyer.avatarUrl || `https://api.dicebear.com/7.x/avataaars/svg?seed=${tx.buyer.username}`} className="w-7 h-7 rounded-full" />
                      <div>
                        <p className="font-bold text-sm text-secondary">{tx.buyer.username}</p>
                        <p className="text-[10px] text-slate-400">@{tx.buyer.username}</p>
                      </div>
                    </div>
                  </div>
                  <div className="p-3 rounded-2xl border border-emerald-100 bg-emerald-50/50">
                    <p className="text-[10px] font-bold text-emerald-600 uppercase tracking-wider mb-1.5">Penjual</p>
                    <div className="flex items-center gap-2">
                      <img src={tx.seller.avatarUrl || `https://api.dicebear.com/7.x/avataaars/svg?seed=${tx.seller.username}`} className="w-7 h-7 rounded-full" />
                      <div>
                        <p className="font-bold text-sm text-secondary">{tx.seller.username}</p>
                        <p className="text-[10px] text-slate-400">@{tx.seller.username}</p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Dispute Reason */}
                <div className="p-4 bg-amber-50 rounded-2xl border border-amber-100">
                  <p className="text-xs font-bold text-amber-600 uppercase tracking-wider mb-1">Alasan Sengketa</p>
                  <p className="text-sm text-amber-900 leading-relaxed whitespace-pre-wrap">{tx.disputeReason || "-"}</p>
                </div>

                {/* Proofs */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <p className="text-xs font-bold text-slate-500 mb-2">Bukti Penjual</p>
                    {tx.sellerProofUrl ? (
                      <a href={tx.sellerProofUrl} target="_blank" rel="noreferrer" className="group block relative">
                        <img src={tx.sellerProofUrl} className="w-full h-28 object-cover rounded-xl border border-slate-200" />
                        <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity rounded-xl flex items-center justify-center">
                          <ExternalLink size={18} className="text-white" />
                        </div>
                      </a>
                    ) : (
                      <div className="w-full h-28 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-center text-slate-400 text-xs">Tidak ada bukti</div>
                    )}
                  </div>
                  <div>
                    <p className="text-xs font-bold text-slate-500 mb-2">Bukti Pembeli</p>
                    {tx.buyerProofUrl ? (
                      <a href={tx.buyerProofUrl} target="_blank" rel="noreferrer" className="group block relative">
                        <img src={tx.buyerProofUrl} className="w-full h-28 object-cover rounded-xl border border-slate-200" />
                        <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity rounded-xl flex items-center justify-center">
                          <ExternalLink size={18} className="text-white" />
                        </div>
                      </a>
                    ) : (
                      <div className="w-full h-28 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-center text-slate-400 text-xs">Tidak ada bukti</div>
                    )}
                  </div>
                </div>

                {/* Actions */}
                <div className="flex flex-col sm:flex-row gap-3 pt-2 border-t border-slate-100">
                  <button
                    onClick={() => openResolve(tx.id, "buyer")}
                    className="flex-1 flex items-center justify-center gap-2 py-3 rounded-2xl bg-indigo-500 text-white font-bold hover:bg-indigo-600 transition-colors shadow-sm"
                  >
                    <UserCheck size={18} /> Pembeli Menang (Refund)
                  </button>
                  <button
                    onClick={() => openResolve(tx.id, "seller")}
                    className="flex-1 flex items-center justify-center gap-2 py-3 rounded-2xl bg-emerald-500 text-white font-bold hover:bg-emerald-600 transition-colors shadow-sm"
                  >
                    <UserX size={18} /> Penjual Menang (Lepas Saldo)
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── ADMIN DATABASE ────────────────────────────────────────────────────────

function AdminDatabase() {
  const { token } = useAuthStore();
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [importing, setImporting] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [showBackupModal, setShowBackupModal] = useState(false);
  const [backupConfig, setBackupConfig] = useState({ webhookUrl: "", interval: "6h" as string, enabled: false });
  const [loadingConfig, setLoadingConfig] = useState(false);
  const [savingConfig, setSavingConfig] = useState(false);
  const [testingWebhook, setTestingWebhook] = useState(false);
  const [showLogsModal, setShowLogsModal] = useState(false);
  const [logsConfig, setLogsConfig] = useState({ webhookUrl: "", enabled: false });
  const [loadingLogs, setLoadingLogs] = useState(false);
  const [savingLogs, setSavingLogs] = useState(false);
  const [testingLogs, setTestingLogs] = useState(false);

  const apiUrl = import.meta.env.VITE_API_URL;
  const headers = { "X-Auth-Token": token!, "Content-Type": "application/json" };

  const handleExport = async () => {
    setExporting(true);
    try {
      const res = await fetch(`${apiUrl}/admin/database/export`, { headers: { "X-Auth-Token": token! } });
      if (!res.ok) throw new Error("Export gagal");
      const data = await res.json();
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `p2pmarket-backup-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
      toast({ title: "Export berhasil", description: "File backup telah diunduh." });
    } catch (err: any) {
      toast({ title: "Export gagal", description: err.message, variant: "destructive" });
    } finally {
      setExporting(false);
    }
  };

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!confirm("⚠️ PERINGATAN: Import akan MENGHAPUS semua data saat ini dan menggantinya dengan data dari file backup. Lanjutkan?")) {
      e.target.value = "";
      return;
    }
    setImporting(true);
    try {
      const text = await file.text();
      const data = JSON.parse(text);
      const res = await fetch(`${apiUrl}/admin/database/import`, {
        method: "POST",
        headers,
        body: JSON.stringify(data),
      });
      const result = await res.json();
      if (!res.ok) throw new Error(result.message || "Import gagal");
      toast({ title: "Import berhasil", description: "Database telah di-restore dari backup." });
    } catch (err: any) {
      toast({ title: "Import gagal", description: err.message, variant: "destructive" });
    } finally {
      setImporting(false);
      e.target.value = "";
    }
  };

  const openBackupModal = async () => {
    setShowBackupModal(true);
    setLoadingConfig(true);
    try {
      const res = await fetch(`${apiUrl}/admin/database/backup-config`, { headers: { "X-Auth-Token": token! } });
      if (res.ok) {
        const config = await res.json();
        setBackupConfig(config);
      }
    } catch {}
    setLoadingConfig(false);
  };

  const saveBackupConfig = async () => {
    setSavingConfig(true);
    try {
      const res = await fetch(`${apiUrl}/admin/database/backup-config`, {
        method: "POST",
        headers,
        body: JSON.stringify(backupConfig),
      });
      const result = await res.json();
      if (!res.ok) throw new Error(result.message || "Gagal menyimpan");
      toast({ title: "Tersimpan", description: "Konfigurasi auto backup disimpan." });
    } catch (err: any) {
      toast({ title: "Gagal", description: err.message, variant: "destructive" });
    } finally {
      setSavingConfig(false);
    }
  };

  const testWebhook = async () => {
    if (!backupConfig.webhookUrl) {
      toast({ title: "Webhook URL kosong", variant: "destructive" });
      return;
    }
    setTestingWebhook(true);
    try {
      const res = await fetch(`${apiUrl}/admin/database/test-webhook`, {
        method: "POST",
        headers,
        body: JSON.stringify({ webhookUrl: backupConfig.webhookUrl }),
      });
      const result = await res.json();
      if (!res.ok) throw new Error(result.message || "Test gagal");
      toast({ title: "Berhasil!", description: "Pesan test terkirim ke Discord." });
    } catch (err: any) {
      toast({ title: "Gagal", description: err.message, variant: "destructive" });
    } finally {
      setTestingWebhook(false);
    }
  };

  const openLogsModal = async () => {
    setShowLogsModal(true);
    setLoadingLogs(true);
    try {
      const res = await fetch(`${apiUrl}/admin/database/logs-config`, { headers: { "X-Auth-Token": token! } });
      if (res.ok) setLogsConfig(await res.json());
    } catch {}
    setLoadingLogs(false);
  };

  const saveLogsConfig2 = async () => {
    setSavingLogs(true);
    try {
      const res = await fetch(`${apiUrl}/admin/database/logs-config`, {
        method: "POST", headers,
        body: JSON.stringify(logsConfig),
      });
      const result = await res.json();
      if (!res.ok) throw new Error(result.message);
      toast({ title: "Tersimpan", description: "Konfigurasi webhook logs disimpan." });
    } catch (err: any) {
      toast({ title: "Gagal", description: err.message, variant: "destructive" });
    } finally { setSavingLogs(false); }
  };

  const testLogsWebhook = async () => {
    if (!logsConfig.webhookUrl) { toast({ title: "URL kosong", variant: "destructive" }); return; }
    setTestingLogs(true);
    try {
      const res = await fetch(`${apiUrl}/admin/database/test-logs-webhook`, {
        method: "POST", headers,
        body: JSON.stringify({ webhookUrl: logsConfig.webhookUrl }),
      });
      const result = await res.json();
      if (!res.ok) throw new Error(result.message);
      toast({ title: "Berhasil!", description: "Test terkirim ke Discord." });
    } catch (err: any) {
      toast({ title: "Gagal", description: err.message, variant: "destructive" });
    } finally { setTestingLogs(false); }
  };

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-3xl border border-slate-200 p-6">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 bg-blue-50 rounded-xl flex items-center justify-center">
            <Database size={20} className="text-blue-600" />
          </div>
          <div>
            <h3 className="font-bold text-secondary">Manajemen Database</h3>
            <p className="text-xs text-slate-500">Export, import, dan auto backup database</p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <button
            onClick={handleExport}
            disabled={exporting}
            className="flex items-center justify-center gap-2 px-4 py-3 bg-emerald-50 border border-emerald-200 text-emerald-700 font-semibold text-sm rounded-xl hover:bg-emerald-100 transition-colors disabled:opacity-50"
          >
            <Download size={16} />
            {exporting ? "Mengexport..." : "Export (.json)"}
          </button>

          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={importing}
            className="flex items-center justify-center gap-2 px-4 py-3 bg-amber-50 border border-amber-200 text-amber-700 font-semibold text-sm rounded-xl hover:bg-amber-100 transition-colors disabled:opacity-50"
          >
            <Upload size={16} />
            {importing ? "Mengimport..." : "Import (.json)"}
          </button>
          <input ref={fileInputRef} type="file" accept=".json" className="hidden" onChange={handleImport} />

          <button
            onClick={openBackupModal}
            className="flex items-center justify-center gap-2 px-4 py-3 bg-blue-50 border border-blue-200 text-blue-700 font-semibold text-sm rounded-xl hover:bg-blue-100 transition-colors"
          >
            <Clock size={16} />
            Auto Backup
          </button>

          <button
            onClick={openLogsModal}
            className="flex items-center justify-center gap-2 px-4 py-3 bg-purple-50 border border-purple-200 text-purple-700 font-semibold text-sm rounded-xl hover:bg-purple-100 transition-colors col-span-1 sm:col-span-3"
          >
            <Send size={16} />
            Activity Logs Webhook
          </button>
        </div>
      </div>

      {/* Activity Logs Modal */}
      {showLogsModal && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={() => setShowLogsModal(false)}>
          <div className="bg-white rounded-2xl w-full max-w-md p-6 space-y-5" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-lg text-secondary">Activity Logs Webhook</h3>
              <button onClick={() => setShowLogsModal(false)} className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center hover:bg-slate-200">
                <X size={16} />
              </button>
            </div>

            {loadingLogs ? (
              <div className="text-center py-8 text-slate-400">Memuat...</div>
            ) : (
              <>
                <p className="text-xs text-slate-500">Semua aktivitas (topup berhasil, penarikan baru, transaksi baru, sengketa) akan dikirim ke webhook ini.</p>

                <div>
                  <label className="block text-sm font-bold text-slate-600 mb-2">Discord Webhook URL</label>
                  <input
                    type="url"
                    placeholder="https://discord.com/api/webhooks/..."
                    value={logsConfig.webhookUrl}
                    onChange={e => setLogsConfig(c => ({ ...c, webhookUrl: e.target.value }))}
                    className="w-full px-4 py-3 rounded-xl bg-slate-50 border border-slate-200 text-sm focus:ring-2 focus:ring-purple-200 focus:bg-white"
                  />
                </div>

                <div className="flex items-center justify-between p-3 bg-slate-50 rounded-xl">
                  <span className="text-sm font-semibold text-slate-700">Status</span>
                  <button
                    onClick={() => setLogsConfig(c => ({ ...c, enabled: !c.enabled }))}
                    className={`relative w-12 h-6 rounded-full transition-colors ${logsConfig.enabled ? "bg-emerald-500" : "bg-slate-300"}`}
                  >
                    <div className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${logsConfig.enabled ? "translate-x-6" : "translate-x-0.5"}`} />
                  </button>
                </div>

                <div className="flex gap-2">
                  <button
                    onClick={testLogsWebhook}
                    disabled={testingLogs || !logsConfig.webhookUrl}
                    className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-slate-100 border border-slate-200 text-slate-700 font-semibold text-sm rounded-xl hover:bg-slate-200 transition-colors disabled:opacity-50"
                  >
                    <Send size={14} />
                    {testingLogs ? "Mengirim..." : "Kirim Test"}
                  </button>
                  <button
                    onClick={saveLogsConfig2}
                    disabled={savingLogs}
                    className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-purple-600 text-white font-semibold text-sm rounded-xl hover:bg-purple-700 transition-colors disabled:opacity-50"
                  >
                    {savingLogs ? "Menyimpan..." : "Simpan"}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Auto Backup Modal */}
      {showBackupModal && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={() => setShowBackupModal(false)}>
          <div className="bg-white rounded-2xl w-full max-w-md p-6 space-y-5" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-lg text-secondary">Auto Backup</h3>
              <button onClick={() => setShowBackupModal(false)} className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center hover:bg-slate-200">
                <X size={16} />
              </button>
            </div>

            {loadingConfig ? (
              <div className="text-center py-8 text-slate-400">Memuat...</div>
            ) : (
              <>
                <div>
                  <label className="block text-sm font-bold text-slate-600 mb-2">Discord Webhook URL</label>
                  <input
                    type="url"
                    placeholder="https://discord.com/api/webhooks/..."
                    value={backupConfig.webhookUrl}
                    onChange={e => setBackupConfig(c => ({ ...c, webhookUrl: e.target.value }))}
                    className="w-full px-4 py-3 rounded-xl bg-slate-50 border border-slate-200 text-sm focus:ring-2 focus:ring-blue-200 focus:bg-white"
                  />
                </div>

                <div>
                  <label className="block text-sm font-bold text-slate-600 mb-2">Interval Backup</label>
                  <div className="grid grid-cols-3 gap-2">
                    {(["2h", "6h", "12h"] as const).map(val => (
                      <button
                        key={val}
                        onClick={() => setBackupConfig(c => ({ ...c, interval: val }))}
                        className={`py-2.5 rounded-xl text-sm font-semibold border transition-all ${
                          backupConfig.interval === val
                            ? "bg-blue-600 text-white border-blue-600"
                            : "bg-slate-50 text-slate-700 border-slate-200 hover:border-blue-400"
                        }`}
                      >
                        {val === "2h" ? "2 Jam" : val === "6h" ? "6 Jam" : "12 Jam"}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="flex items-center justify-between p-3 bg-slate-50 rounded-xl">
                  <span className="text-sm font-semibold text-slate-700">Status Auto Backup</span>
                  <button
                    onClick={() => setBackupConfig(c => ({ ...c, enabled: !c.enabled }))}
                    className={`relative w-12 h-6 rounded-full transition-colors ${backupConfig.enabled ? "bg-emerald-500" : "bg-slate-300"}`}
                  >
                    <div className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${backupConfig.enabled ? "translate-x-6" : "translate-x-0.5"}`} />
                  </button>
                </div>

                <div className="flex gap-2">
                  <button
                    onClick={testWebhook}
                    disabled={testingWebhook || !backupConfig.webhookUrl}
                    className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-slate-100 border border-slate-200 text-slate-700 font-semibold text-sm rounded-xl hover:bg-slate-200 transition-colors disabled:opacity-50"
                  >
                    <Send size={14} />
                    {testingWebhook ? "Mengirim..." : "Kirim Test"}
                  </button>
                  <button
                    onClick={saveBackupConfig}
                    disabled={savingConfig}
                    className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-blue-600 text-white font-semibold text-sm rounded-xl hover:bg-blue-700 transition-colors disabled:opacity-50"
                  >
                    {savingConfig ? "Menyimpan..." : "Simpan"}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── MAIN PAGE ─────────────────────────────────────────────────────────────

export default function Transactions() {
  const { user } = useAuthStore();
  const requestOptions = useAuthHeaders();
  const { data: transactions, isLoading } = useGetTransactions({ request: requestOptions, query: { refetchInterval: 10000 } });
  
  const isAdmin = user?.isAdmin === true;
  const [filter, setFilter] = useState<"all" | "buy" | "sell" | "penarikan" | "pengguna" | "sengketa" | "database">("all");
  const { data: pendingCounts } = useGetAdminPendingCounts(
    { request: requestOptions },
    { enabled: isAdmin },
  );

  if (!user) return null;

  const ACTIVE_STATUSES = ["pending", "awaiting_delivery", "delivery_confirmed", "disputed"];

  const filtered = transactions?.filter(tx => {
    if (filter === "buy") return tx.buyerId === user.id;
    if (filter === "sell") return tx.sellerId === user.id;
    if (filter === "penarikan" || filter === "pengguna" || filter === "sengketa") return false;
    return true;
  });

  const activeBuyCount = transactions?.filter(tx =>
    tx.buyerId === user.id && ACTIVE_STATUSES.includes(tx.status)
  ).length ?? 0;
  const activeSellCount = transactions?.filter(tx =>
    tx.sellerId === user.id && ACTIVE_STATUSES.includes(tx.status)
  ).length ?? 0;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <Link href="/dashboard" className="flex items-center gap-2 text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 text-sm font-medium mb-8 transition-colors">
        <ArrowLeft size={16} />
        Kembali ke Dashboard
      </Link>
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
        <div>
          <h1 className="text-3xl font-display font-bold text-secondary">
            {filter === "penarikan" ? "Admin · Penarikan" :
             filter === "pengguna" ? "Admin · Pengguna" :
             filter === "sengketa" ? "Admin · Sengketa" :
             filter === "database" ? "Admin · Database" :
             "Riwayat Transaksi"}
          </h1>
          <p className="text-muted-foreground mt-1">
            {filter === "penarikan" ? "Kelola permintaan penarikan dana pengguna." :
             filter === "pengguna" ? "Kelola akun pengguna terdaftar." :
             filter === "sengketa" ? "Selesaikan sengketa antar pembeli dan penjual." :
             "Angka merah di tiap tab = transaksi aktif yang butuh tindakan kamu."}
          </p>
        </div>
        
        <div className={`grid bg-slate-100 p-1 rounded-xl gap-1 ${isAdmin ? "grid-cols-3 md:grid-cols-7" : "grid-cols-3"}`}>
          <button 
            onClick={() => setFilter("all")}
            className={`px-4 py-2 rounded-lg text-sm font-bold transition-colors ${filter === "all" ? "bg-white shadow-sm text-primary" : "text-slate-500 hover:text-slate-700"}`}
          >
            Semua
          </button>
          <button 
            onClick={() => setFilter("buy")}
            className={`relative px-4 py-2 rounded-lg text-sm font-bold transition-colors ${filter === "buy" ? "bg-white shadow-sm text-primary" : "text-slate-500 hover:text-slate-700"}`}
          >
            Pembelian
            {activeBuyCount > 0 && (
              <span className="absolute -top-1.5 -right-1.5 min-w-[18px] h-[18px] px-1 rounded-full bg-red-500 text-white text-[10px] font-black flex items-center justify-center shadow-sm ring-2 ring-white">
                {activeBuyCount > 9 ? "9+" : activeBuyCount}
              </span>
            )}
          </button>
          <button 
            onClick={() => setFilter("sell")}
            className={`relative px-4 py-2 rounded-lg text-sm font-bold transition-colors ${filter === "sell" ? "bg-white shadow-sm text-primary" : "text-slate-500 hover:text-slate-700"}`}
          >
            Penjualan
            {activeSellCount > 0 && (
              <span className="absolute -top-1.5 -right-1.5 min-w-[18px] h-[18px] px-1 rounded-full bg-red-500 text-white text-[10px] font-black flex items-center justify-center shadow-sm ring-2 ring-white">
                {activeSellCount > 9 ? "9+" : activeSellCount}
              </span>
            )}
          </button>
          {isAdmin && (
            <>
              <button 
                onClick={() => setFilter("penarikan")}
                className={`relative px-4 py-2 rounded-lg text-sm font-bold transition-colors ${filter === "penarikan" ? "bg-white shadow-sm text-primary" : "text-slate-500 hover:text-slate-700"}`}
              >
                Penarikan
                {(pendingCounts?.withdrawals ?? 0) > 0 && (
                  <span className="absolute -top-1.5 -right-1.5 min-w-[18px] h-[18px] px-1 rounded-full bg-red-500 text-white text-[10px] font-black flex items-center justify-center shadow-sm ring-2 ring-white">
                    {pendingCounts!.withdrawals > 99 ? "99+" : pendingCounts!.withdrawals}
                  </span>
                )}
              </button>
              <button 
                onClick={() => setFilter("pengguna")}
                className={`px-4 py-2 rounded-lg text-sm font-bold transition-colors ${filter === "pengguna" ? "bg-white shadow-sm text-primary" : "text-slate-500 hover:text-slate-700"}`}
              >
                Pengguna
              </button>
              <button 
                onClick={() => setFilter("sengketa")}
                className={`relative px-4 py-2 rounded-lg text-sm font-bold transition-colors ${filter === "sengketa" ? "bg-white shadow-sm text-primary" : "text-slate-500 hover:text-slate-700"}`}
              >
                Sengketa
                {(pendingCounts?.disputes ?? 0) > 0 && (
                  <span className="absolute -top-1.5 -right-1.5 min-w-[18px] h-[18px] px-1 rounded-full bg-red-500 text-white text-[10px] font-black flex items-center justify-center shadow-sm ring-2 ring-white">
                    {pendingCounts!.disputes > 99 ? "99+" : pendingCounts!.disputes}
                  </span>
                )}
              </button>
              <button 
                onClick={() => setFilter("database")}
                className={`px-4 py-2 rounded-lg text-sm font-bold transition-colors ${filter === "database" ? "bg-white shadow-sm text-primary" : "text-slate-500 hover:text-slate-700"}`}
              >
                Database
              </button>
            </>
          )}
        </div>
      </div>

      {filter === "penarikan" ? (
        <AdminWithdrawals />
      ) : filter === "pengguna" ? (
        <AdminUsers />
      ) : filter === "sengketa" ? (
        <AdminDisputes />
      ) : filter === "database" ? (
        <AdminDatabase />
      ) : isLoading ? (
        <div className="p-20 text-center text-slate-400">Memuat...</div>
      ) : filtered?.length === 0 ? (
        <div className="text-center py-24 bg-white rounded-3xl border border-slate-200">
          <ArrowRightLeft size={64} className="mx-auto text-slate-200 mb-4" />
          <h3 className="text-xl font-bold text-slate-400">Belum ada transaksi</h3>
          <p className="text-slate-500 mt-2">Kamu belum melakukan aktivitas jual/beli.</p>
        </div>
      ) : (
        <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="divide-y divide-slate-100">
            {filtered?.map((tx) => {
              const isBuyer = tx.buyerId === user.id;
              return (
                <Link key={tx.id} href={`/transaction/${tx.id}`} className="flex flex-col sm:flex-row sm:items-center p-6 hover:bg-slate-50 transition-colors group gap-4">
                  <div className="w-16 h-16 rounded-xl bg-slate-100 flex-shrink-0 overflow-hidden relative border border-slate-200">
                    {tx.listing?.imageUrl ? (
                      <img src={tx.listing.imageUrl} className="w-full h-full object-cover group-hover:scale-110 transition-transform" />
                    ) : (
                      <div className="w-full h-full flex justify-center items-center bg-slate-100 text-slate-300 font-bold text-xs uppercase">{(tx.listing?.game ?? "???").slice(0,3)}</div>
                    )}
                  </div>
                  
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded uppercase ${isBuyer ? "bg-indigo-100 text-indigo-700" : "bg-teal-100 text-teal-700"}`}>
                        {isBuyer ? "BELI" : "JUAL"}
                      </span>
                      <p className="text-xs text-slate-500">{format(new Date(tx.createdAt), "dd MMM yyyy, HH:mm", { locale: id })}</p>
                    </div>
                    <h4 className="font-bold text-lg text-secondary truncate mb-1">{tx.listing?.title ?? "Item dihapus"}</h4>
                    <p className="text-sm text-slate-500">
                      Dengan: <span className="font-medium text-slate-700">{isBuyer ? tx.seller.username : tx.buyer.username}</span>
                    </p>
                  </div>
                  
                  <div className="sm:text-right flex flex-row sm:flex-col items-center sm:items-end justify-between sm:justify-center w-full sm:w-auto mt-2 sm:mt-0">
                    <p className="font-display font-black text-secondary text-xl sm:mb-2">
                      <span className="text-xs font-bold text-slate-400">Rp</span> {tx.amount.toLocaleString("id-ID")}
                    </p>
                    <StatusBadge status={tx.status} />
                  </div>
                </Link>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
