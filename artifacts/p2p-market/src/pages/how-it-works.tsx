import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronLeft, ChevronRight, ShieldCheck, Wallet, ShoppingBag, PackageCheck, Star, Scale } from "lucide-react";
import { Link } from "wouter";
import { SEO } from "@/components/seo";

const slides = [
  {
    id: 0,
    icon: <ShieldCheck size={56} strokeWidth={1.5} />,
    color: "from-blue-500 to-primary",
    bg: "from-blue-50 to-indigo-50",
    accent: "bg-primary",
    tag: "Langkah 1",
    title: "Login dengan Discord",
    desc: "Tidak perlu daftar manual. Klik tombol Login Discord dan masuk dengan akun Discord kamu secara aman menggunakan OAuth2.",
    detail: "Akun Discord kamu harus berusia minimal 3 hari untuk dapat bertransaksi.",
    visual: (
      <div className="flex flex-col items-center gap-4">
        <div className="w-24 h-24 rounded-3xl bg-[#5865F2] flex items-center justify-center shadow-2xl shadow-[#5865F2]/40">
          <svg viewBox="0 0 24 24" className="w-12 h-12 fill-white">
            <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057.1 18.082.114 18.105.134 18.12a19.963 19.963 0 0 0 6.002 3.03.078.078 0 0 0 .084-.028c.462-.63.874-1.295 1.226-1.994a.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03z"/>
          </svg>
        </div>
        <div className="flex gap-2">
          {[1, 2, 3].map(i => (
            <div key={i} className="w-2 h-2 rounded-full bg-primary/30" />
          ))}
        </div>
        <div className="bg-white rounded-2xl shadow-lg px-6 py-3 text-sm font-bold text-[#5865F2] border border-[#5865F2]/20">
          Login dengan Discord
        </div>
      </div>
    ),
  },
  {
    id: 1,
    icon: <Wallet size={56} strokeWidth={1.5} />,
    color: "from-emerald-400 to-teal-500",
    bg: "from-emerald-50 to-teal-50",
    accent: "bg-emerald-500",
    tag: "Langkah 2",
    title: "Isi Saldo Wallet",
    desc: "Top up saldo wallet kamu melalui Transfer Bank, QRIS, GoPay, OVO, atau DANA. Admin akan verifikasi pembayaran dan saldo langsung aktif.",
    detail: "Saldo tersimpan aman di wallet kamu dan hanya dipotong saat transaksi berlangsung.",
    visual: (
      <div className="flex flex-col items-center gap-4">
        <div className="bg-white rounded-3xl shadow-xl p-6 w-56 border border-slate-100">
          <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Saldo Wallet</p>
          <p className="text-3xl font-black text-secondary"><span className="text-base font-bold text-emerald-500">Rp</span> 250.000</p>
          <div className="mt-4 grid grid-cols-3 gap-2">
            {["BCA", "OVO", "QRIS"].map(m => (
              <div key={m} className="bg-slate-50 rounded-lg py-1.5 text-center text-[10px] font-bold text-slate-500">{m}</div>
            ))}
          </div>
        </div>
        <div className="flex items-center gap-2 text-sm text-emerald-600 font-semibold bg-emerald-50 px-4 py-2 rounded-full border border-emerald-100">
          <div className="w-2 h-2 rounded-full bg-emerald-500" />
          Saldo Aktif
        </div>
      </div>
    ),
  },
  {
    id: 2,
    icon: <ShoppingBag size={56} strokeWidth={1.5} />,
    color: "from-violet-500 to-purple-600",
    bg: "from-violet-50 to-purple-50",
    accent: "bg-violet-500",
    tag: "Langkah 3",
    title: "Temukan & Beli Item",
    desc: "Jelajahi ratusan listing item game — Cowoncy, Ticket Patreon, Custom Pet, dan banyak lagi. Temukan yang kamu butuhkan dengan harga terbaik.",
    detail: "Setiap listing menampilkan info lengkap: harga, kategori, deskripsi, dan profil penjual.",
    visual: (
      <div className="flex flex-col gap-3 w-56">
        {[
          { name: "Cowoncy 1M", price: "50.000", cat: "Cowoncy" },
          { name: "Ticket Patreon", price: "125.000", cat: "Ticket" },
          { name: "Custom Pet", price: "200.000", cat: "Pet" },
        ].map((item, i) => (
          <div key={i} className="bg-white rounded-xl shadow-md border border-slate-100 p-3 flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-violet-50 flex items-center justify-center text-violet-400 flex-shrink-0">
              <ShoppingBag size={16} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-bold text-secondary text-sm truncate">{item.name}</p>
              <p className="text-xs text-slate-400">{item.cat}</p>
            </div>
            <p className="text-xs font-bold text-violet-600 flex-shrink-0">Rp {item.price}</p>
          </div>
        ))}
      </div>
    ),
  },
  {
    id: 3,
    icon: <ShieldCheck size={56} strokeWidth={1.5} />,
    color: "from-amber-400 to-orange-500",
    bg: "from-amber-50 to-orange-50",
    accent: "bg-amber-500",
    tag: "Langkah 4",
    title: "Terlindungi oleh Escrow",
    desc: "Saat kamu membeli, saldo tidak langsung ke penjual — melainkan ditahan di sistem Escrow kami yang aman. Uangmu terjamin selama proses berlangsung.",
    detail: "Penjual baru menerima saldo SETELAH kamu mengonfirmasi item sudah diterima.",
    visual: (
      <div className="flex flex-col items-center gap-3">
        <div className="flex items-center gap-3">
          <div className="bg-white rounded-2xl shadow p-3 border border-slate-100 text-center">
            <p className="text-xs text-slate-400 mb-1">Pembeli</p>
            <div className="w-10 h-10 rounded-full bg-blue-100 mx-auto flex items-center justify-center text-blue-500 font-bold text-lg">B</div>
          </div>
          <div className="flex flex-col items-center">
            <div className="w-8 h-0.5 bg-amber-300" />
            <div className="bg-amber-400 text-white text-[10px] font-bold px-2 py-0.5 rounded my-1">Escrow</div>
            <div className="w-8 h-0.5 bg-amber-300" />
          </div>
          <div className="bg-white rounded-2xl shadow p-3 border border-slate-100 text-center">
            <p className="text-xs text-slate-400 mb-1">Penjual</p>
            <div className="w-10 h-10 rounded-full bg-emerald-100 mx-auto flex items-center justify-center text-emerald-500 font-bold text-lg">P</div>
          </div>
        </div>
        <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-2 text-xs text-amber-700 font-semibold text-center">
          🔒 Saldo aman ditahan sistem
        </div>
      </div>
    ),
  },
  {
    id: 4,
    icon: <PackageCheck size={56} strokeWidth={1.5} />,
    color: "from-sky-400 to-blue-500",
    bg: "from-sky-50 to-blue-50",
    accent: "bg-sky-500",
    tag: "Langkah 5",
    title: "Penjual Kirim Item",
    desc: "Penjual mengirim item ke akun game kamu dan mengupload bukti pengiriman berupa screenshot. Kamu bisa komunikasi langsung via chat transaksi.",
    detail: "Jika ada masalah, kamu bisa ajukan sengketa dan admin akan membantu menyelesaikan.",
    visual: (
      <div className="flex flex-col items-center gap-3 w-56">
        <div className="bg-white rounded-2xl shadow-lg border border-slate-100 p-4 w-full">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-8 h-8 rounded-lg bg-sky-100 flex items-center justify-center">
              <PackageCheck size={14} className="text-sky-500" />
            </div>
            <div>
              <p className="text-xs font-bold text-secondary">Penjual mengirim item</p>
              <p className="text-[10px] text-slate-400">Menunggu konfirmasimu</p>
            </div>
          </div>
          <div className="bg-sky-50 rounded-lg h-16 flex items-center justify-center border border-sky-100">
            <p className="text-[10px] text-sky-400 font-medium">📸 Bukti pengiriman</p>
          </div>
        </div>
        <div className="bg-white rounded-xl shadow border border-slate-100 p-3 w-full">
          <div className="flex gap-2 items-start">
            <div className="w-6 h-6 rounded-full bg-primary flex items-center justify-center text-white text-[10px] font-bold flex-shrink-0">P</div>
            <div className="bg-slate-50 rounded-lg px-3 py-2 text-[11px] text-slate-600">
              Item sudah dikirim ya! 🎮
            </div>
          </div>
        </div>
      </div>
    ),
  },
  {
    id: 5,
    icon: <Star size={56} strokeWidth={1.5} />,
    color: "from-rose-400 to-pink-500",
    bg: "from-rose-50 to-pink-50",
    accent: "bg-rose-500",
    tag: "Langkah 6",
    title: "Konfirmasi & Selesai!",
    desc: "Setelah item kamu terima, klik 'Item Sudah Diterima'. Saldo otomatis dilepas ke penjual dan transaksi selesai. Aman, cepat, dan terpercaya!",
    detail: "Histori transaksi tersimpan selamanya. Kamu bisa lihat riwayat di halaman Transaksi.",
    visual: (
      <div className="flex flex-col items-center gap-4">
        <div className="w-24 h-24 rounded-3xl bg-gradient-to-br from-rose-400 to-pink-500 flex items-center justify-center shadow-2xl shadow-rose-400/40">
          <Star size={44} className="text-white fill-white" />
        </div>
        <div className="bg-white rounded-2xl shadow-lg border border-slate-100 px-6 py-4 text-center">
          <p className="text-2xl font-black text-secondary mb-1">Selesai! 🎉</p>
          <p className="text-xs text-slate-400">Transaksi berhasil & aman</p>
        </div>
        <div className="flex gap-2">
          {[...Array(5)].map((_, i) => (
            <Star key={i} size={18} className="text-amber-400 fill-amber-400" />
          ))}
        </div>
      </div>
    ),
  },
  {
    id: 6,
    icon: <Scale size={56} strokeWidth={1.5} />,
    color: "from-slate-500 to-slate-700",
    bg: "from-slate-50 to-slate-100",
    accent: "bg-slate-600",
    tag: "Bonus",
    title: "Ada Masalah? Ajukan Sengketa",
    desc: "Jika ada masalah, kamu bisa mengajukan sengketa. Admin akan bergabung ke chat transaksi dan memediasi hingga keputusan final.",
    detail: "Keputusan admin berdasarkan bukti yang ada dan bersifat final untuk melindungi kedua pihak.",
    visual: (
      <div className="flex flex-col items-center gap-3 w-56">
        <div className="bg-white rounded-2xl shadow-lg border border-slate-100 p-4 w-full">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-8 h-8 rounded-lg bg-red-100 flex items-center justify-center">
              <Scale size={14} className="text-red-500" />
            </div>
            <div>
              <p className="text-xs font-bold text-secondary">Sengketa Diajukan</p>
              <p className="text-[10px] text-slate-400">Admin bergabung ke chat</p>
            </div>
          </div>
          <div className="space-y-2">
            {["Pembeli", "Penjual", "Admin 🛡️"].map((role, i) => (
              <div key={i} className={`flex gap-2 ${i === 1 ? "flex-row-reverse" : ""}`}>
                <div className={`w-5 h-5 rounded-full text-white text-[9px] flex items-center justify-center font-bold flex-shrink-0 ${i === 0 ? "bg-blue-400" : i === 1 ? "bg-emerald-400" : "bg-primary"}`}>
                  {role[0]}
                </div>
                <div className={`rounded-lg px-2 py-1 text-[10px] ${i === 2 ? "bg-primary/10 text-primary" : "bg-slate-50 text-slate-600"}`}>
                  {i === 0 ? "Item belum saya terima" : i === 1 ? "Sudah saya kirim" : "Mohon upload bukti masing-masing"}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    ),
  },
];

const variants = {
  enter: (dir: number) => ({ x: dir > 0 ? 300 : -300, opacity: 0 }),
  center: { x: 0, opacity: 1 },
  exit: (dir: number) => ({ x: dir > 0 ? -300 : 300, opacity: 0 }),
};

export default function HowItWorks() {
  const [current, setCurrent] = useState(0);
  const [direction, setDirection] = useState(1);

  const go = (idx: number) => {
    setDirection(idx > current ? 1 : -1);
    setCurrent(idx);
  };

  const prev = () => { if (current > 0) go(current - 1); };
  const next = () => { if (current < slides.length - 1) go(current + 1); };

  const slide = slides[current];

  return (
    <div className="min-h-[calc(100vh-64px)] flex flex-col">
      <SEO
        title="Cara Kerja P2PMarket"
        description="Pelajari cara jual beli item game di P2PMarket. Sistem escrow otomatis menjamin keamanan transaksi antara pembeli dan penjual."
        path="/cara-kerja"
      />
      <div className={`flex-1 bg-gradient-to-br ${slide.bg} transition-all duration-500`}>
        <div className="max-w-2xl mx-auto px-4 py-10 flex flex-col items-center min-h-[calc(100vh-64px)]">

          {/* Progress dots */}
          <div className="flex gap-2 mb-8">
            {slides.map((_, i) => (
              <button
                key={i}
                onClick={() => go(i)}
                className={`rounded-full transition-all duration-300 ${
                  i === current
                    ? `w-8 h-2.5 ${slide.accent}`
                    : "w-2.5 h-2.5 bg-slate-200 hover:bg-slate-300"
                }`}
              />
            ))}
          </div>

          {/* Slide content */}
          <div className="w-full flex-1 flex flex-col items-center justify-center overflow-hidden">
            <AnimatePresence mode="wait" custom={direction}>
              <motion.div
                key={current}
                custom={direction}
                variants={variants}
                initial="enter"
                animate="center"
                exit="exit"
                transition={{ duration: 0.3, ease: "easeInOut" }}
                className="flex flex-col items-center text-center w-full"
              >
                {/* Visual */}
                <div className="mb-8 flex items-center justify-center min-h-[220px]">
                  {slide.visual}
                </div>

                {/* Tag */}
                <span className={`inline-block px-4 py-1 rounded-full text-white text-xs font-bold mb-4 bg-gradient-to-r ${slide.color}`}>
                  {slide.tag}
                </span>

                {/* Title */}
                <h2 className="text-2xl sm:text-3xl font-display font-black text-secondary mb-4 leading-tight">
                  {slide.title}
                </h2>

                {/* Description */}
                <p className="text-slate-600 text-base leading-relaxed max-w-md mb-4">
                  {slide.desc}
                </p>

                {/* Detail note */}
                <div className="bg-white/70 backdrop-blur-sm border border-white rounded-xl px-4 py-2.5 text-xs text-slate-500 max-w-sm">
                  💡 {slide.detail}
                </div>
              </motion.div>
            </AnimatePresence>
          </div>

          {/* Navigation */}
          <div className="flex items-center justify-between w-full max-w-sm mt-10 gap-4">
            <button
              onClick={prev}
              disabled={current === 0}
              className="flex items-center gap-2 px-5 py-3 rounded-xl bg-white border border-slate-200 font-bold text-slate-600 hover:bg-slate-50 transition-all disabled:opacity-30 disabled:cursor-not-allowed shadow-sm"
            >
              <ChevronLeft size={18} /> Prev
            </button>

            <span className="text-sm text-slate-400 font-medium">
              {current + 1} / {slides.length}
            </span>

            {current < slides.length - 1 ? (
              <button
                onClick={next}
                className={`flex items-center gap-2 px-5 py-3 rounded-xl text-white font-bold transition-all shadow-lg bg-gradient-to-r ${slide.color}`}
              >
                Next <ChevronRight size={18} />
              </button>
            ) : (
              <Link href="/market">
                <button className="flex items-center gap-2 px-5 py-3 rounded-xl bg-primary text-white font-bold shadow-lg shadow-primary/30 hover:-translate-y-0.5 transition-all">
                  Mulai Sekarang <ChevronRight size={18} />
                </button>
              </Link>
            )}
          </div>

        </div>
      </div>
    </div>
  );
}
