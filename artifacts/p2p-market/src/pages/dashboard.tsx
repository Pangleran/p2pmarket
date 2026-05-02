import { useAuthStore, useAuthHeaders } from "@/lib/store";
import { useGetWalletBalance, useGetWalletTransactions, useGetTransactions } from "@workspace/api-client-react";
import { Wallet, Activity, ArrowRightLeft, Clock, ShoppingCart, Tag, ShieldCheck, ArrowDownToLine } from "lucide-react";
import { Link } from "wouter";
import { format } from "date-fns";
import { id } from "date-fns/locale";
import { motion } from "framer-motion";

export default function Dashboard() {
  const { user } = useAuthStore();
  const requestOptions = useAuthHeaders();
  
  const { data: balance, isLoading: loadingBalance } = useGetWalletBalance({ request: requestOptions });
  const { data: history, isLoading: loadingHistory } = useGetWalletTransactions({ request: requestOptions });
  const { data: transactions, isLoading: loadingTx } = useGetTransactions({ request: requestOptions });

  if (!user) return null;

  const activeTransactions = transactions?.filter(t => 
    t.status === 'pending' || t.status === 'awaiting_delivery' || t.status === 'delivery_confirmed' || t.status === 'disputed'
  ) || [];

  return (
    <motion.div 
      initial={{ opacity: 0 }} 
      animate={{ opacity: 1 }} 
      className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8"
    >
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between mb-8 gap-4">
        <div>
          <h1 className="text-3xl font-display font-bold text-secondary">Dashboard</h1>
          <p className="text-muted-foreground mt-1">Selamat datang kembali, {user.username}!</p>
        </div>
        <div className="flex items-center gap-3">
          <Link href="/topup" className="px-5 py-2.5 rounded-xl bg-slate-100 text-secondary font-semibold hover:bg-slate-200 transition-colors">
            Isi Saldo
          </Link>
          <Link href="/market/new" className="px-5 py-2.5 rounded-xl bg-primary text-white font-semibold hover:bg-primary/90 transition-colors shadow-lg shadow-primary/20">
            Jual Item
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div className="bg-gradient-to-br from-primary to-blue-700 rounded-3xl p-6 text-white shadow-xl shadow-primary/20 relative overflow-hidden">
          <div className="absolute top-0 right-0 -mt-4 -mr-4 w-32 h-32 bg-white/10 rounded-full blur-2xl"></div>
          <div className="flex items-center gap-3 text-primary-foreground/80 mb-4 font-medium">
            <Wallet size={20} /> Saldo Aktif
          </div>
          <div className="text-4xl font-display font-bold mb-4">
            <span className="text-2xl font-normal opacity-80 mr-1">Rp</span>{loadingBalance ? "..." : (balance?.balance || 0).toLocaleString("id-ID")}
          </div>
          <Link href="/withdraw" className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-white/20 hover:bg-white/30 text-white text-sm font-semibold transition-all backdrop-blur-sm border border-white/20">
            <ArrowDownToLine size={15} /> Tarik Saldo
          </Link>
        </div>

        <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-sm">
          <div className="flex items-center gap-3 text-slate-500 mb-4 font-medium">
            <ShieldCheckIcon size={20} className="text-amber-500" /> Saldo Ditahan (Escrow)
          </div>
          <div className="text-4xl font-display font-bold text-secondary mb-1">
            <span className="text-2xl font-normal text-slate-400 mr-1">Rp</span>{loadingBalance ? "..." : (balance?.escrowBalance || 0).toLocaleString("id-ID")}
          </div>
          <p className="text-xs text-slate-400 mt-2">Saldo yang sedang dalam transaksi berjalan</p>
        </div>

        <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-sm flex flex-col justify-center">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-3 text-slate-500 font-medium">
              <Activity size={20} className="text-emerald-500" /> Transaksi Aktif
            </div>
            <span className="text-3xl font-display font-bold text-secondary">{activeTransactions.length}</span>
          </div>
          <Link href="/transactions" className="text-primary text-sm font-semibold hover:underline mt-2 inline-flex items-center gap-1">
            Lihat semua transaksi <ArrowRightLeft size={14} />
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
              <h2 className="text-xl font-bold flex items-center gap-2 text-secondary">
                <ShoppingCart size={20} className="text-primary" /> Transaksi Berjalan
              </h2>
            </div>
            <div className="p-0">
              {loadingTx ? (
                <div className="p-8 text-center text-slate-400">Memuat...</div>
              ) : activeTransactions.length === 0 ? (
                <div className="p-12 text-center text-slate-400 flex flex-col items-center">
                  <Activity size={48} className="mb-4 opacity-20" />
                  <p>Tidak ada transaksi berjalan.</p>
                  <Link href="/market" className="text-primary font-medium mt-2 hover:underline">Mulai belanja</Link>
                </div>
              ) : (
                <div className="divide-y divide-slate-100">
                  {activeTransactions.slice(0, 5).map(tx => (
                    <Link key={tx.id} href={`/transaction/${tx.id}`} className="flex items-center p-6 hover:bg-slate-50 transition-colors group">
                      <div className="w-12 h-12 rounded-xl bg-slate-100 flex items-center justify-center mr-4 group-hover:scale-105 transition-transform">
                        <Tag className="text-slate-500" size={20} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <h4 className="font-bold text-secondary truncate">{tx.listing?.title ?? "Item dihapus"}</h4>
                        <p className="text-sm text-slate-500 flex items-center gap-1 mt-1">
                          {tx.buyerId === user.id ? "Pembelian" : "Penjualan"} • <span className="font-medium text-slate-700">Rp {tx.amount.toLocaleString("id-ID")}</span>
                        </p>
                      </div>
                      <div className="text-right ml-4">
                        <StatusBadge status={tx.status} />
                        <p className="text-xs text-slate-400 mt-1.5">{format(new Date(tx.createdAt), 'dd MMM yyyy', { locale: id })}</p>
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="space-y-6">
          <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="p-6 border-b border-slate-100 bg-slate-50/50">
              <h2 className="text-xl font-bold flex items-center gap-2 text-secondary">
                <Clock size={20} className="text-slate-400" /> Riwayat Saldo
              </h2>
            </div>
            <div className="p-0">
              {loadingHistory ? (
                <div className="p-8 text-center text-slate-400">Memuat...</div>
              ) : history?.length === 0 ? (
                <div className="p-8 text-center text-slate-400 text-sm">Belum ada riwayat saldo.</div>
              ) : (
                <div className="divide-y divide-slate-100">
                  {history?.slice(0, 5).map(item => (
                    <div key={item.id} className="p-5 flex justify-between items-center">
                      <div>
                        <p className="font-semibold text-sm text-secondary capitalize">{item.type.replace('_', ' ')}</p>
                        <p className="text-xs text-slate-400 mt-0.5">{format(new Date(item.createdAt), 'dd MMM, HH:mm')}</p>
                      </div>
                      <div className={`font-bold text-sm ${
                        item.amount < 0 ? 'text-red-500' :
                        item.amount === 0 ? 'text-slate-400' :
                        'text-emerald-500'
                      }`}>
                        {item.amount > 0 ? '+' : item.amount < 0 ? '-' : ''}Rp {Math.abs(item.amount).toLocaleString("id-ID")}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

function ShieldCheckIcon(props: any) {
  return <ShieldCheck {...props} />;
}

export function StatusBadge({ status }: { status: string }) {
  const config: Record<string, { color: string, label: string }> = {
    pending: { color: "bg-amber-100 text-amber-700 border-amber-200", label: "Menunggu Pengiriman" },
    awaiting_delivery: { color: "bg-blue-100 text-blue-700 border-blue-200", label: "Sedang Dikirim" },
    delivery_confirmed: { color: "bg-emerald-100 text-emerald-700 border-emerald-200", label: "Selesai" },
    completed: { color: "bg-emerald-100 text-emerald-700 border-emerald-200", label: "Selesai" },
    disputed: { color: "bg-red-100 text-red-700 border-red-200", label: "Sengketa" },
    cancelled: { color: "bg-slate-100 text-slate-700 border-slate-200", label: "Dibatalkan" },
  };

  const current = config[status] || { color: "bg-slate-100 text-slate-700", label: status };

  return (
    <span className={`px-2.5 py-1 text-[11px] font-bold rounded-full border uppercase tracking-wider ${current.color}`}>
      {current.label}
    </span>
  );
}
