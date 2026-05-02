import { useState } from "react";
import { Mail, MessageCircle, ChevronDown, Phone } from "lucide-react";
import { useAuthStore } from "@/lib/store";
import { SEO } from "@/components/seo";

const EMAIL = "ikyfareza@p2pmarket.com";
const WA_NUMBER = "6281525984792";

const PROBLEM_OPTIONS = [
  "Saldo tidak masuk setelah top up",
  "Penjual tidak mengirim item",
  "Item yang diterima tidak sesuai deskripsi",
  "Pembeli tidak mengonfirmasi penerimaan",
  "Masalah penarikan saldo",
  "Akun terkena ban / pemblokiran",
  "Laporan penipuan",
  "Bug / masalah teknis pada platform",
  "Lainnya",
];

export default function Contact() {
  const { user } = useAuthStore();
  const [problem, setProblem] = useState("");
  const [detail, setDetail] = useState("");

  const username = user?.username ?? "(belum login)";
  const userId = user?.id ? `#${user.id}` : "(belum login)";

  const buildMessage = () =>
    `Username : ${username}\nUserid : ${userId}\nMasalah : ${problem || "(belum dipilih)"}\n\nJelaskan detail masalahmu :\n${detail}`;

  const handleWhatsApp = () => {
    const msg = encodeURIComponent(buildMessage());
    window.open(`https://wa.me/${WA_NUMBER}?text=${msg}`, "_blank");
  };

  const handleEmail = () => {
    const subject = encodeURIComponent(`[P2P Market] ${problem || "Bantuan"}`);
    const body = encodeURIComponent(buildMessage());
    window.open(`mailto:${EMAIL}?subject=${subject}&body=${body}`, "_blank");
  };

  const isReady = problem !== "";

  return (
    <div className="max-w-xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <SEO
        title="Hubungi Kami"
        description="Butuh bantuan? Hubungi tim P2PMarket via WhatsApp atau Email. Kami siap membantu masalah transaksi, saldo, dan akun kamu."
        path="/contact"
      />
      <div className="text-center mb-10">
        <div className="w-16 h-16 bg-emerald-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
          <Phone size={32} className="text-emerald-500" />
        </div>
        <h1 className="text-3xl font-display font-bold text-secondary mb-2">Hubungi Kami</h1>
        <p className="text-slate-500 text-sm">Ada kendala? Tim kami siap membantu kamu.</p>
      </div>

      <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-7 space-y-6">

        {/* Identitas pengguna (readonly) */}
        {user && (
          <div className="bg-slate-50 rounded-2xl p-4 space-y-2">
            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">Identitas Kamu</p>
            <div className="flex justify-between text-sm">
              <span className="text-slate-500">Username</span>
              <span className="font-bold text-secondary">{username}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-slate-500">User ID</span>
              <span className="font-bold text-secondary font-mono text-xs">{userId}</span>
            </div>
          </div>
        )}

        {/* Pilihan masalah */}
        <div>
          <label className="block text-sm font-bold text-slate-700 mb-2">
            Pilih Jenis Masalah <span className="text-red-400">*</span>
          </label>
          <div className="relative">
            <select
              value={problem}
              onChange={e => setProblem(e.target.value)}
              className="w-full appearance-none px-4 py-3.5 rounded-xl bg-slate-50 border border-slate-200 focus:bg-white focus:ring-2 focus:ring-primary/20 text-sm font-medium text-secondary pr-10"
            >
              <option value="">-- Pilih jenis masalah --</option>
              {PROBLEM_OPTIONS.map(opt => (
                <option key={opt} value={opt}>{opt}</option>
              ))}
            </select>
            <ChevronDown size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
          </div>
        </div>

        {/* Detail masalah */}
        <div>
          <label className="block text-sm font-bold text-slate-700 mb-2">
            Jelaskan Detail Masalahmu
          </label>
          <textarea
            value={detail}
            onChange={e => setDetail(e.target.value)}
            rows={4}
            placeholder="Ceritakan secara detail apa yang terjadi, ID transaksi yang bermasalah (jika ada), dll."
            className="w-full px-4 py-3 rounded-xl bg-slate-50 border border-slate-200 focus:bg-white focus:ring-2 focus:ring-primary/20 text-sm resize-none"
          />
        </div>

        {/* Preview format pesan */}
        {problem && (
          <div className="bg-slate-50 rounded-xl border border-slate-100 p-4">
            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Preview Pesan</p>
            <pre className="text-xs text-slate-600 whitespace-pre-wrap font-mono leading-relaxed">
              {buildMessage()}
            </pre>
          </div>
        )}

        {/* Tombol kontak */}
        <div className="space-y-3 pt-2">
          <button
            onClick={handleWhatsApp}
            disabled={!isReady}
            className="w-full flex items-center justify-center gap-3 py-4 rounded-xl bg-[#25D366] text-white font-bold text-base shadow-lg shadow-[#25D366]/30 hover:-translate-y-0.5 transition-all disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:translate-y-0"
          >
            <MessageCircle size={20} />
            Kirim via WhatsApp
          </button>
          <button
            onClick={handleEmail}
            disabled={!isReady}
            className="w-full flex items-center justify-center gap-3 py-4 rounded-xl bg-primary text-white font-bold text-base shadow-lg shadow-primary/25 hover:-translate-y-0.5 transition-all disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:translate-y-0"
          >
            <Mail size={20} />
            Kirim via Email
          </button>
        </div>

        {/* Info kontak langsung */}
        <div className="border-t border-slate-100 pt-5 space-y-2">
          <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">Kontak Darurat Langsung</p>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm text-slate-600">
              <MessageCircle size={15} className="text-[#25D366]" />
              WhatsApp
            </div>
            <a href={`https://wa.me/${WA_NUMBER}`} target="_blank" rel="noreferrer" className="text-sm font-bold text-secondary hover:text-primary transition-colors">
              0815-2598-4792
            </a>
          </div>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm text-slate-600">
              <Mail size={15} className="text-primary" />
              Email
            </div>
            <a href={`mailto:${EMAIL}`} className="text-sm font-bold text-secondary hover:text-primary transition-colors">
              {EMAIL}
            </a>
          </div>
        </div>

      </div>

      <p className="text-center text-xs text-slate-400 mt-6">
        Respon biasanya dalam 1×24 jam pada hari kerja.
      </p>
    </div>
  );
}
