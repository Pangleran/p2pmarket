import { useState, useMemo } from "react";
import { Link } from "wouter";
import { useRequestWithdrawal, useGetMyWithdrawals, useGetWalletBalance, getGetWalletBalanceQueryKey, getGetMyWithdrawalsQueryKey } from "@workspace/api-client-react";
import { useAuthStore, useAuthHeaders } from "@/lib/store";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { ArrowDownToLine, ArrowLeft, Clock, CheckCircle, XCircle, ChevronRight, Wallet, X } from "lucide-react";
import { format } from "date-fns";
import { id as idLocale } from "date-fns/locale";
import { TurnstileWidget } from "@/components/turnstile-widget";

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

export default function Withdraw() {
  const { user } = useAuthStore();
  const authHeaders = useAuthHeaders();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [cfToken, setCfToken] = useState<string | null>(null);

  const requestOptions = useMemo(() => ({
    headers: {
      ...authHeaders.headers,
      ...(cfToken ? { "x-cf-turnstile-response": cfToken } : {}),
    },
  }), [authHeaders.headers, cfToken]);

  const { data: balance } = useGetWalletBalance({ request: requestOptions });
  const { data: withdrawals, isLoading: loadingHistory } = useGetMyWithdrawals({ request: requestOptions });

  const [amount, setAmount] = useState<number>(50000);
  const [method, setMethod] = useState<string>("");
  const [accountNumber, setAccountNumber] = useState("");
  const [accountName, setAccountName] = useState("");
  const [tab, setTab] = useState<"form" | "history">("form");

  const withdrawMutation = useRequestWithdrawal({ request: requestOptions });
  const [cancellingId, setCancellingId] = useState<number | null>(null);

  const handleCancel = async (withdrawalId: number) => {
    if (!confirm("Yakin ingin membatalkan penarikan ini? Saldo akan dikembalikan.")) return;
    setCancellingId(withdrawalId);
    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL}/wallet/withdraw/${withdrawalId}/cancel`, {
        method: "POST",
        headers: { "X-Auth-Token": useAuthStore.getState().token! },
      });
      const data = await res.json();
      if (!res.ok) {
        toast({ title: "Gagal", description: data.message ?? "Gagal membatalkan penarikan", variant: "destructive" });
        return;
      }
      toast({ title: "Berhasil", description: "Penarikan dibatalkan, saldo dikembalikan." });
      queryClient.invalidateQueries({ queryKey: getGetWalletBalanceQueryKey() });
      queryClient.invalidateQueries({ queryKey: getGetMyWithdrawalsQueryKey() });
    } catch {
      toast({ title: "Gagal", description: "Koneksi gagal, coba lagi", variant: "destructive" });
    } finally {
      setCancellingId(null);
    }
  };

  if (!user) return null;

  const currentBalance = balance?.balance ?? 0;

  const handleWithdraw = async () => {
    if (!method) {
      toast({ title: "Isi jenis rekening / e-wallet", variant: "destructive" });
      return;
    }
    if (!accountNumber) {
      toast({ title: "Isi nomor rekening / e-wallet", variant: "destructive" });
      return;
    }
    if (!accountName) {
      toast({ title: "Isi nama pemilik rekening", variant: "destructive" });
      return;
    }
    if (amount > currentBalance) {
      toast({ title: "Saldo tidak mencukupi", variant: "destructive" });
      return;
    }
    if (!cfToken) {
      toast({ title: "Verifikasi diperlukan", description: "Selesaikan verifikasi keamanan terlebih dahulu.", variant: "destructive" });
      return;
    }
    try {
      await withdrawMutation.mutateAsync({
        data: { amount, method, accountNumber, accountName },
      });
      queryClient.invalidateQueries({ queryKey: getGetWalletBalanceQueryKey() });
      queryClient.invalidateQueries({ queryKey: getGetMyWithdrawalsQueryKey() });
      toast({ title: "Permintaan Penarikan Dikirim", description: "Admin akan memproses penarikanmu segera." });
      setAmount(50000);
      setMethod("");
      setAccountNumber("");
      setAccountName("");
      setTab("history");
    } catch (e: any) {
      const msg = e?.response?.data?.message ?? "Penarikan gagal";
      toast({ title: "Gagal", description: msg, variant: "destructive" });
    }
  };

  const predefinedAmounts = [10000, 50000, 100000, 250000, 500000];

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <Link href="/dashboard" className="flex items-center gap-2 text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 text-sm font-medium mb-8 transition-colors">
        <ArrowLeft size={16} />
        Kembali ke Dashboard
      </Link>
      <div className="text-center mb-8">
        <div className="w-16 h-16 bg-emerald-50 rounded-2xl flex items-center justify-center text-emerald-600 mx-auto mb-4">
          <ArrowDownToLine size={32} />
        </div>
        <h1 className="text-3xl font-display font-bold text-secondary mb-2">Tarik Saldo</h1>
        <p className="text-muted-foreground">Cairkan saldo wallet kamu ke rekening atau e-wallet.</p>
      </div>

      <div className="bg-gradient-to-r from-emerald-500 to-teal-500 rounded-2xl p-5 mb-8 text-white flex items-center justify-between">
        <div>
          <p className="text-emerald-100 text-sm font-medium mb-1">Saldo Aktif</p>
          <p className="text-3xl font-display font-black"><span className="text-lg font-bold text-emerald-200">Rp</span> {currentBalance.toLocaleString("id-ID")}</p>
        </div>
        <Wallet size={40} className="text-emerald-200" />
      </div>

      <div className="flex bg-slate-100 p-1 rounded-xl mb-8">
        <button
          onClick={() => setTab("form")}
          className={`flex-1 py-2.5 rounded-lg text-sm font-bold transition-colors ${tab === "form" ? "bg-white shadow-sm text-primary" : "text-slate-500 hover:text-slate-700"}`}
        >
          Ajukan Penarikan
        </button>
        <button
          onClick={() => setTab("history")}
          className={`flex-1 py-2.5 rounded-lg text-sm font-bold transition-colors ${tab === "history" ? "bg-white shadow-sm text-primary" : "text-slate-500 hover:text-slate-700"}`}
        >
          Riwayat Penarikan
        </button>
      </div>

      {tab === "form" ? (
        <div className="space-y-6">
          <div className="bg-white rounded-3xl p-7 border border-slate-200 shadow-sm">
            <h3 className="font-bold text-lg text-secondary mb-5">1. Jumlah Penarikan (Rp)</h3>
            <div className="grid grid-cols-3 sm:grid-cols-5 gap-3 mb-5">
              {predefinedAmounts.map(val => (
                <button
                  key={val}
                  onClick={() => setAmount(val)}
                  className={`py-3 rounded-xl border-2 font-bold text-sm transition-all ${
                    amount === val ? "border-emerald-500 bg-emerald-50 text-emerald-700" : "border-slate-100 bg-white text-slate-600 hover:border-slate-300"
                  }`}
                >
                  {val.toLocaleString("id-ID")}
                </button>
              ))}
            </div>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                <span className="text-slate-400 font-bold text-sm">Rp</span>
              </div>
              <input
                type="number"
                value={amount}
                onChange={e => setAmount(parseInt(e.target.value) || 0)}
                className="w-full pl-16 pr-4 py-4 rounded-xl bg-slate-50 border border-slate-200 focus:bg-white focus:ring-2 focus:ring-emerald-200 text-xl font-bold text-secondary"
              />
            </div>
            {amount > currentBalance && (
              <p className="text-red-500 text-sm mt-2 font-medium">Jumlah melebihi saldo aktif kamu.</p>
            )}
          </div>

          <div className="bg-white rounded-3xl p-7 border border-slate-200 shadow-sm">
            <h3 className="font-bold text-lg text-secondary mb-5">2. Detail Rekening</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-bold text-slate-600 mb-2">Jenis Rekening / E-Wallet <span className="text-red-500">*</span></label>
                <input
                  type="text"
                  placeholder="Contoh: BCA, BRI, Mandiri, GoPay, DANA, OVO"
                  value={method}
                  onChange={e => setMethod(e.target.value)}
                  className="w-full px-4 py-3.5 rounded-xl bg-slate-50 border border-slate-200 focus:bg-white focus:ring-2 focus:ring-emerald-200 font-medium"
                />
              </div>
              <div>
                <label className="block text-sm font-bold text-slate-600 mb-2">Nomor Rekening / E-Wallet <span className="text-red-500">*</span></label>
                <input
                  type="text"
                  placeholder="Contoh: 1234567890 atau 081234567890"
                  value={accountNumber}
                  onChange={e => setAccountNumber(e.target.value)}
                  className="w-full px-4 py-3.5 rounded-xl bg-slate-50 border border-slate-200 focus:bg-white focus:ring-2 focus:ring-emerald-200 font-medium"
                />
              </div>
              <div>
                <label className="block text-sm font-bold text-slate-600 mb-2">Nama Pemilik Rekening <span className="text-red-500">*</span></label>
                <input
                  type="text"
                  placeholder="Contoh: Budi Santoso"
                  value={accountName}
                  onChange={e => setAccountName(e.target.value)}
                  className="w-full px-4 py-3.5 rounded-xl bg-slate-50 border border-slate-200 focus:bg-white focus:ring-2 focus:ring-emerald-200 font-medium"
                />
              </div>
            </div>
          </div>

          <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-sm">
            <div className="mb-4">
              <p className="text-xs text-slate-500 mb-2 font-medium">Verifikasi keamanan sebelum menarik saldo:</p>
              <TurnstileWidget
                onVerify={setCfToken}
                onExpire={() => setCfToken(null)}
                onError={() => setCfToken(null)}
              />
            </div>
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
              <div>
                <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Total Penarikan</p>
                <p className="text-2xl font-display font-black text-emerald-600"><span className="text-sm font-bold text-slate-400 mr-0.5">Rp</span>{amount.toLocaleString("id-ID")}</p>
              </div>
              <button
                onClick={handleWithdraw}
                disabled={withdrawMutation.isPending || amount <= 0 || amount > currentBalance || !cfToken}
                className="px-5 py-3 sm:px-7 sm:py-4 rounded-xl bg-emerald-500 text-white font-bold text-sm sm:text-base shadow-lg shadow-emerald-200 hover:bg-emerald-600 hover:-translate-y-0.5 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {withdrawMutation.isPending ? "Memproses..." : "Ajukan Penarikan"} <ChevronRight size={16} />
              </button>
            </div>
          </div>
        </div>
      ) : (
        <div>
          {loadingHistory ? (
            <div className="text-center py-16 text-slate-400">Memuat riwayat...</div>
          ) : !withdrawals?.length ? (
            <div className="text-center py-20 bg-white rounded-3xl border border-slate-200">
              <ArrowDownToLine size={56} className="mx-auto text-slate-200 mb-4" />
              <h3 className="text-lg font-bold text-slate-400">Belum ada riwayat penarikan</h3>
            </div>
          ) : (
            <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
              <div className="divide-y divide-slate-100">
                {withdrawals.map(w => (
                    <div key={w.id} className="p-5 flex items-center gap-4">
                      <div className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 bg-slate-100">
                        <ArrowDownToLine size={20} className="text-slate-400" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-0.5">
                          <p className="font-bold text-secondary">{w.method}</p>
                          <StatusChip status={w.status} />
                        </div>
                        <p className="text-sm text-slate-500 truncate">{w.accountName} · {w.accountNumber}</p>
                        {w.adminNote && w.status === "rejected" && (
                          <p className="text-xs text-red-500 mt-0.5">Alasan: {w.adminNote}</p>
                        )}
                        <p className="text-xs text-slate-400 mt-1">{format(new Date(w.createdAt), "dd MMM yyyy, HH:mm", { locale: idLocale })}</p>
                        {w.status === "pending" && (
                          <button
                            onClick={() => handleCancel(w.id)}
                            disabled={cancellingId === w.id}
                            className="mt-2 inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold bg-red-50 text-red-600 border border-red-200 hover:bg-red-100 transition-colors disabled:opacity-50"
                          >
                            <X size={12} />
                            {cancellingId === w.id ? "Membatalkan..." : "Batalkan"}
                          </button>
                        )}
                      </div>
                      <div className="text-right flex-shrink-0">
                        <p className="font-display font-black text-secondary">Rp {w.amount.toLocaleString("id-ID")}</p>
                      </div>
                    </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
