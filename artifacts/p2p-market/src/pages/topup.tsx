import { useState, useEffect, useCallback } from "react";
import { useLocation } from "wouter";
import {
  Wallet, QrCode, ArrowLeft, ShieldCheck,
  CheckCircle2, Clock, XCircle, ExternalLink, RefreshCw, Copy, Check,
} from "lucide-react";
import { useAuthStore } from "@/lib/store";

const PAYMENT_METHODS = [
  {
    group: "QRIS",
    icon: <QrCode size={20} className="text-emerald-500" />,
    bg: "bg-emerald-50 dark:bg-emerald-900/20",
    border: "border-emerald-200 dark:border-emerald-800",
    items: [
      { code: "QRIS", label: "QRIS", desc: "GoPay, OVO, DANA, ShopeePay, LinkAja, dan semua app QRIS" },
    ],
  },
];

const PRESET_AMOUNTS = [5_000, 10_000, 25_000, 50_000, 100_000, 250_000];
const FEE_RATE = 0.007; // 0.7%

type Step = "select" | "paying" | "success" | "expired";

interface InvoiceResult {
  topupId: number;
  invoiceId: string;
  paymentUrl: string;
  qrisUrl?: string;
  vaNumber?: string;
  paymentCode?: string;
  amount: number;
  method: string;
  expiresAt: string;
}

function formatRp(n: number) {
  return `Rp ${n.toLocaleString("id-ID")}`;
}

function useCountdown(expiresAt: string | null) {
  const [seconds, setSeconds] = useState<number>(Infinity);

  useEffect(() => {
    if (!expiresAt) return;
    const calc = () => Math.max(0, Math.floor((new Date(expiresAt).getTime() - Date.now()) / 1000));
    setSeconds(calc());
    const id = setInterval(() => {
      const s = calc();
      setSeconds(s);
      if (s === 0) clearInterval(id);
    }, 1000);
    return () => clearInterval(id);
  }, [expiresAt]);

  const display = seconds === Infinity ? 0 : seconds;
  const m = Math.floor(display / 60);
  const s = display % 60;
  return { seconds, label: seconds === Infinity ? "--:--" : `${m}:${s.toString().padStart(2, "0")}` };
}

export default function Topup() {
  const [, setLocation] = useLocation();
  const { token } = useAuthStore();

  const [step, setStep] = useState<Step>("select");
  const [selectedMethod, setSelectedMethod] = useState<string>("QRIS");
  const [amount, setAmount] = useState<number>(50_000);
  const [customAmount, setCustomAmount] = useState("");
  const [invoice, setInvoice] = useState<InvoiceResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [checkingPending, setCheckingPending] = useState(true);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!token) { setCheckingPending(false); return; }
    fetch(`${import.meta.env.VITE_API_URL}/wallet/topup/pending`, { headers: { "X-Auth-Token": token } })
      .then(r => r.json())
      .then(data => {
        if (data.pending) {
          if (data.expired) {
            setInvoice({ topupId: data.topupId, invoiceId: data.invoiceId, paymentUrl: "", amount: data.amount, method: data.method, expiresAt: data.expiresAt });
            setStep("expired");
          } else {
            setInvoice({
              topupId: data.topupId, invoiceId: data.invoiceId, paymentUrl: data.paymentUrl,
              vaNumber: data.vaNumber, qrisUrl: data.qrisUrl, paymentCode: data.paymentCode,
              amount: data.amount, method: data.method, expiresAt: data.expiresAt,
            });
            setStep("paying");
          }
        }
      })
      .catch(() => {})
      .finally(() => setCheckingPending(false));
  }, [token]);

  const { seconds, label: countdownLabel } = useCountdown(invoice?.expiresAt ?? null);

  const finalAmount = customAmount ? parseInt(customAmount.replace(/\D/g, ""), 10) || 0 : amount;
  const fee = Math.ceil(finalAmount * FEE_RATE);
  const netAmount = finalAmount - fee;

  const handleCreate = async () => {
    setError("");
    if (finalAmount < 5_000) {
      setError("Nominal minimal Rp 5.000");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL}/wallet/topup/create`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Auth-Token": token! },
        body: JSON.stringify({ amount: finalAmount, paymentMethod: selectedMethod }),
      });
      const data = await res.json();
      if (!res.ok) {
        if (res.status === 409 && data.topupId) {
          if (data.expired) {
            setInvoice({ topupId: data.topupId, invoiceId: "", paymentUrl: "", amount: 0, method: "", expiresAt: "" });
            setStep("expired");
          } else {
            setInvoice({ topupId: data.topupId, invoiceId: data.invoiceId, paymentUrl: data.paymentUrl, amount: data.amount, method: data.method, expiresAt: data.expiresAt });
            setStep("paying");
          }
          return;
        }
        setError(data.message ?? "Gagal membuat invoice");
        return;
      }
      setInvoice(data);
      setStep("paying");
    } catch {
      setError("Koneksi gagal, coba lagi");
    } finally {
      setLoading(false);
    }
  };

  const pollStatus = useCallback(async () => {
    if (!invoice) return;
    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL}/wallet/topup/${invoice.topupId}/status`, {
        headers: { "X-Auth-Token": token! },
      });
      const data = await res.json();
      if (data.status === "PAID") setStep("success");
      if (data.status === "EXPIRED") setStep("expired");
    } catch {}
  }, [invoice, token]);

  useEffect(() => {
    if (step !== "paying") return;
    const id = setInterval(pollStatus, 5000);
    return () => clearInterval(id);
  }, [step, pollStatus]);

  useEffect(() => {
    if (step === "paying" && seconds === 0 && invoice) {
      setStep("expired");
    }
  }, [seconds, step, invoice]);

  const copyText = async (text: string) => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const methodLabel = PAYMENT_METHODS
    .flatMap(g => g.items)
    .find(m => m.code === (invoice?.method ?? selectedMethod))?.label ?? selectedMethod;

  if (checkingPending) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-900 flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900 px-4 py-10">
      <div className="max-w-lg mx-auto">
        <button
          onClick={() => {
            if (step === "select") setLocation("/dashboard");
            else if (step === "paying" || step === "expired") return;
            else setStep("select");
          }}
          className={`flex items-center gap-2 text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 text-sm font-medium mb-8 transition-colors ${step === "paying" || step === "expired" ? "opacity-50 cursor-not-allowed" : ""}`}
        >
          <ArrowLeft size={16} />
          {step === "select" ? "Kembali ke Dashboard" : "Kembali"}
        </button>

        {step === "select" && (
          <div className="bg-white dark:bg-slate-800 rounded-3xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden">
            <div className="bg-gradient-to-br from-blue-600 to-blue-700 px-8 py-8 text-white text-center">
              <div className="w-14 h-14 bg-white/20 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <Wallet size={28} className="text-white" />
              </div>
              <h1 className="text-xl font-display font-bold mb-1 text-white">Top Up Saldo</h1>
              <p className="text-blue-100 text-sm">Pilih metode pembayaran dan nominal</p>
            </div>

            <div className="p-6 space-y-6">
              <div>
                <p className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-3">Nominal</p>
                <div className="grid grid-cols-3 gap-2 mb-3">
                  {PRESET_AMOUNTS.map(v => (
                    <button
                      key={v}
                      onClick={() => { setAmount(v); setCustomAmount(""); }}
                      className={`py-2.5 rounded-xl text-sm font-semibold border transition-all ${
                        amount === v && !customAmount
                          ? "bg-blue-600 text-white border-blue-600"
                          : "bg-slate-50 dark:bg-slate-700 text-slate-700 dark:text-slate-200 border-slate-200 dark:border-slate-600 hover:border-blue-400"
                      }`}
                    >
                      {formatRp(v)}
                    </button>
                  ))}
                </div>
                <input
                  type="text"
                  placeholder="Atau masukkan nominal lain..."
                  value={customAmount}
                  onChange={e => {
                    const raw = e.target.value.replace(/\D/g, "");
                    setCustomAmount(raw);
                    if (raw) setAmount(0);
                  }}
                  className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-700 text-sm text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                {finalAmount > 0 && (
                  <div className="mt-3 p-3 bg-slate-50 dark:bg-slate-700 rounded-xl space-y-1.5">
                    <div className="flex justify-between text-xs text-slate-500 dark:text-slate-400">
                      <span>Total Bayar</span>
                      <span className="font-semibold text-slate-700 dark:text-slate-200">{formatRp(finalAmount)}</span>
                    </div>
                    <div className="flex justify-between text-xs text-slate-500 dark:text-slate-400">
                      <span>Biaya layanan (0.7%)</span>
                      <span className="font-semibold text-red-500">-{formatRp(fee)}</span>
                    </div>
                    <div className="border-t border-slate-200 dark:border-slate-600 pt-1.5 flex justify-between text-xs">
                      <span className="font-semibold text-slate-700 dark:text-slate-200">Saldo yang masuk</span>
                      <span className="font-bold text-emerald-600 dark:text-emerald-400">{formatRp(netAmount)}</span>
                    </div>
                  </div>
                )}
              </div>

              <div>
                <p className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-3">Metode Pembayaran</p>
                <div className="space-y-3">
                  {PAYMENT_METHODS.map(group => (
                    <div key={group.group}>
                      <p className="text-xs text-slate-400 dark:text-slate-500 font-medium mb-2">{group.group}</p>
                      <div className="space-y-1.5">
                        {group.items.map(item => (
                          <button
                            key={item.code}
                            onClick={() => setSelectedMethod(item.code)}
                            className={`w-full flex items-center gap-3 p-3.5 rounded-xl border text-left transition-all ${
                              selectedMethod === item.code
                                ? `${group.bg} ${group.border} border-2`
                                : "bg-slate-50 dark:bg-slate-700 border-slate-200 dark:border-slate-600 hover:border-slate-300"
                            }`}
                          >
                            <div className={`w-9 h-9 rounded-xl ${group.bg} flex items-center justify-center flex-shrink-0`}>
                              {group.icon}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="font-semibold text-slate-800 dark:text-slate-200 text-sm">{item.label}</p>
                              <p className="text-xs text-slate-500 dark:text-slate-400 truncate">{item.desc}</p>
                            </div>
                            {selectedMethod === item.code && (
                              <CheckCircle2 size={18} className="text-blue-600 flex-shrink-0" />
                            )}
                          </button>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {error && (
                <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl px-4 py-3 text-sm text-red-600 dark:text-red-400">
                  {error}
                </div>
              )}

              <button
                onClick={handleCreate}
                disabled={loading || finalAmount < 5_000}
                className="w-full py-4 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold rounded-2xl transition-colors"
              >
                {loading ? "Membuat Invoice..." : `Lanjutkan ${formatRp(netAmount)}`}
              </button>

              <div className="flex items-center gap-2 justify-center text-xs text-slate-400">
                <ShieldCheck size={14} />
                Pembayaran diproses secara otomatis
              </div>
            </div>
          </div>
        )}

        {step === "paying" && invoice && (
          <div className="bg-white dark:bg-slate-800 rounded-3xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden">
            <div className="bg-gradient-to-br from-blue-600 to-blue-700 px-8 py-8 text-white text-center">
              <h1 className="text-xl font-display font-bold mb-1 text-white">{methodLabel}</h1>
              <p className="text-3xl font-bold mt-3">{formatRp(invoice.amount)}</p>
              <div className={`inline-flex items-center gap-1.5 mt-3 px-3 py-1.5 rounded-full text-sm font-semibold ${
                seconds > 300 ? "bg-white/20" : seconds > 60 ? "bg-amber-500/80" : "bg-red-500/80"
              }`}>
                <Clock size={14} />
                Bayar dalam {countdownLabel}
              </div>
            </div>

            <div className="p-6 space-y-5">
              {invoice.vaNumber && (
                <div className="bg-slate-50 dark:bg-slate-700 rounded-2xl p-5">
                  <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Nomor Virtual Account</p>
                  <div className="flex items-center gap-3">
                    <p className="text-2xl font-mono font-bold text-slate-800 dark:text-slate-200 flex-1 break-all">
                      {invoice.vaNumber}
                    </p>
                    <button
                      onClick={() => copyText(invoice.vaNumber!)}
                      className="flex items-center gap-1.5 px-3 py-2 bg-blue-600 text-white rounded-xl text-xs font-semibold flex-shrink-0"
                    >
                      {copied ? <Check size={14} /> : <Copy size={14} />}
                      {copied ? "Disalin!" : "Salin"}
                    </button>
                  </div>
                </div>
              )}

              {invoice.paymentCode && (
                <div className="bg-slate-50 dark:bg-slate-700 rounded-2xl p-5">
                  <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Kode Pembayaran</p>
                  <div className="flex items-center gap-3">
                    <p className="text-2xl font-mono font-bold text-slate-800 dark:text-slate-200 flex-1 break-all">
                      {invoice.paymentCode}
                    </p>
                    <button
                      onClick={() => copyText(invoice.paymentCode!)}
                      className="flex items-center gap-1.5 px-3 py-2 bg-blue-600 text-white rounded-xl text-xs font-semibold flex-shrink-0"
                    >
                      {copied ? <Check size={14} /> : <Copy size={14} />}
                      {copied ? "Disalin!" : "Salin"}
                    </button>
                  </div>
                </div>
              )}

              {invoice.qrisUrl && (
                <div className="flex flex-col items-center gap-3">
                  <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Scan QR Code</p>
                  <img
                    src={invoice.qrisUrl}
                    alt="QRIS QR Code"
                    className="w-56 h-56 rounded-2xl border border-slate-200 dark:border-slate-600"
                    onError={e => (e.currentTarget.style.display = "none")}
                  />
                </div>
              )}

              {invoice.paymentUrl && (
                <a
                  href={invoice.paymentUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-center gap-2 w-full py-3.5 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 text-blue-700 dark:text-blue-300 font-semibold rounded-2xl text-sm hover:bg-blue-100 transition-colors"
                >
                  <ExternalLink size={16} />
                  Buka Halaman Pembayaran
                </a>
              )}

              <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-2xl p-4 text-xs text-amber-700 dark:text-amber-300 leading-relaxed">
                <strong>Cara bayar:</strong>
                {invoice.method === "QRIS"
                  ? " Buka aplikasi dompet digital kamu, pilih menu Scan QR, lalu scan kode QR di atas menggunakan aplikasi e-wallet atau mobile banking."
                  : ` Transfer ke nomor Virtual Account di atas melalui ATM, mobile banking, atau internet banking ${methodLabel}.`
                }
                {" "}Saldo akan masuk otomatis setelah pembayaran berhasil.
              </div>

              <button
                onClick={pollStatus}
                className="flex items-center justify-center gap-2 w-full py-3 text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 text-sm font-medium rounded-2xl border border-slate-200 dark:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
              >
                <RefreshCw size={14} />
                Cek Status Pembayaran
              </button>
            </div>
          </div>
        )}

        {step === "success" && (
          <div className="bg-white dark:bg-slate-800 rounded-3xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden text-center">
            <div className="bg-gradient-to-br from-emerald-500 to-emerald-600 px-8 py-10 text-white">
              <CheckCircle2 size={56} className="mx-auto mb-4" />
              <h1 className="text-xl font-display font-bold mb-1 text-white">Pembayaran Berhasil!</h1>
              <p className="text-emerald-100 text-sm">Saldo kamu telah ditambahkan</p>
              {invoice && (
                <p className="text-3xl font-bold mt-4">{formatRp(invoice.amount)}</p>
              )}
            </div>
            <div className="p-6">
              <button
                onClick={() => setLocation("/dashboard")}
                className="w-full py-3.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-2xl transition-colors"
              >
                Kembali ke Dashboard
              </button>
            </div>
          </div>
        )}

        {step === "expired" && (
          <div className="bg-white dark:bg-slate-800 rounded-3xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden text-center">
            <div className="bg-gradient-to-br from-red-500 to-red-600 px-8 py-10 text-white">
              <XCircle size={56} className="mx-auto mb-4" />
              <h1 className="text-xl font-display font-bold mb-1 text-white">Pembayaran Kedaluwarsa</h1>
              <p className="text-red-100 text-sm">Invoice telah melewati batas waktu pembayaran</p>
            </div>
            <div className="p-6 space-y-3">
              <button
                onClick={async () => {
                  try {
                    await fetch(`${import.meta.env.VITE_API_URL}/wallet/topup/dismiss`, {
                      method: "POST",
                      headers: { "X-Auth-Token": token! },
                    });
                  } catch {}
                  setInvoice(null);
                  setStep("select");
                }}
                className="w-full py-3.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-2xl transition-colors"
              >
                Buat Top Up Baru
              </button>
              <button
                onClick={() => setLocation("/dashboard")}
                className="w-full py-3 text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 text-sm font-medium rounded-2xl border border-slate-200 dark:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
              >
                Kembali ke Dashboard
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}