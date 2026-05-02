import { AlertTriangle, RefreshCw, Scale } from "lucide-react";

const refundSections = [
  {
    title: "Ketentuan Umum Refund",
    icon: <RefreshCw size={18} className="text-amber-500" />,
    bg: "bg-amber-50 border-amber-100",
    content: `Sistem refund di P2P Market berjalan otomatis melalui mekanisme Escrow. Saldo pembeli ditahan hingga transaksi selesai atau dibatalkan melalui proses yang sah.`,
  },
  {
    title: "Kapan Refund Diberikan?",
    icon: <Scale size={18} className="text-emerald-500" />,
    bg: "bg-emerald-50 border-emerald-100",
    content: `Refund dikembalikan ke wallet pembeli dalam kondisi berikut:
• Admin memutuskan sengketa memenangkan pembeli
• Penjual terbukti melakukan penipuan (tidak mengirim item)
• Item yang diterima tidak sesuai deskripsi dan terbukti secara valid
• Transaksi dibatalkan sebelum penjual mengirim item (atas persetujuan admin)`,
  },
];

const disputeSections = [
  {
    step: "01",
    color: "bg-red-500",
    title: "Ajukan Sengketa",
    desc: "Pembeli atau penjual dapat mengajukan sengketa dari halaman detail transaksi. Sertakan alasan yang jelas dan bukti (URL screenshot/foto).",
  },
  {
    step: "02",
    color: "bg-orange-500",
    title: "Admin Meninjau",
    desc: "Admin akan bergabung ke chat transaksi untuk mengumpulkan informasi dari kedua belah pihak. Proses ini biasanya memakan waktu 1x24 jam.",
  },
  {
    step: "03",
    color: "bg-blue-500",
    title: "Pengumpulan Bukti",
    desc: "Kedua pihak diminta memberikan bukti yang relevan melalui fitur chat. Admin dapat meminta bukti tambahan jika diperlukan.",
  },
  {
    step: "04",
    color: "bg-primary",
    title: "Keputusan Final",
    desc: "Admin membuat keputusan berdasarkan bukti yang ada. Keputusan bersifat final dan tidak dapat diganggu gugat.",
  },
];

const conditions = [
  {
    label: "Penjual Menang",
    color: "bg-emerald-50 border-emerald-200",
    badge: "bg-emerald-500",
    items: [
      "Item terbukti telah dikirim sesuai deskripsi",
      "Pembeli tidak dapat membuktikan item belum diterima",
      "Saldo escrow dilepas ke penjual",
      "Transaksi dinyatakan selesai",
    ],
  },
  {
    label: "Pembeli Menang",
    color: "bg-red-50 border-red-200",
    badge: "bg-red-500",
    items: [
      "Penjual terbukti tidak mengirim item",
      "Item yang diterima tidak sesuai deskripsi",
      "Saldo escrow dikembalikan ke wallet pembeli",
      "Listing item diaktifkan kembali",
    ],
  },
];

const tips = [
  "Selalu minta bukti sebelum mengonfirmasi penerimaan item",
  "Screenshot setiap langkah transaksi di game sebagai bukti",
  "Jangan konfirmasi 'item sudah diterima' jika belum menerimanya",
  "Ajukan sengketa maksimal 72 jam setelah transaksi",
  "Simpan semua percakapan terkait transaksi sebagai bukti",
];

export default function RefundPolicy() {
  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <div className="text-center mb-10">
        <div className="w-16 h-16 bg-red-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
          <Scale size={32} className="text-red-500" />
        </div>
        <h1 className="text-3xl font-display font-bold text-secondary mb-2">Kebijakan Refund & Dispute</h1>
        <p className="text-slate-500 text-sm">Terakhir diperbarui: Maret 2026</p>
      </div>

      <div className="bg-amber-50 border border-amber-100 rounded-2xl p-5 mb-8 flex gap-3">
        <AlertTriangle size={20} className="text-amber-500 flex-shrink-0 mt-0.5" />
        <p className="text-sm text-amber-800">
          Sistem Escrow kami dirancang untuk melindungi kedua belah pihak. Baca kebijakan ini sebelum melakukan transaksi.
        </p>
      </div>

      {/* Refund sections */}
      <div className="space-y-4 mb-10">
        {refundSections.map((s, i) => (
          <div key={i} className={`rounded-2xl border p-5 ${s.bg}`}>
            <div className="flex items-center gap-2 mb-3">
              {s.icon}
              <h2 className="font-bold text-secondary">{s.title}</h2>
            </div>
            <p className="text-sm text-slate-700 leading-relaxed whitespace-pre-line">{s.content}</p>
          </div>
        ))}
      </div>

      {/* Dispute process */}
      <h2 className="font-bold text-xl text-secondary mb-5 flex items-center gap-2">
        <Scale size={20} className="text-primary" /> Proses Penyelesaian Sengketa
      </h2>
      <div className="relative mb-10">
        <div className="absolute left-6 top-8 bottom-8 w-0.5 bg-slate-100 hidden sm:block" />
        <div className="space-y-4">
          {disputeSections.map((s, i) => (
            <div key={i} className="bg-white rounded-2xl border border-slate-100 p-5 shadow-sm flex gap-4 items-start relative">
              <div className={`w-10 h-10 rounded-xl ${s.color} flex items-center justify-center text-white font-bold text-sm flex-shrink-0`}>
                {s.step}
              </div>
              <div>
                <h3 className="font-bold text-secondary mb-1">{s.title}</h3>
                <p className="text-sm text-slate-600 leading-relaxed">{s.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Outcomes */}
      <h2 className="font-bold text-xl text-secondary mb-5">Kemungkinan Keputusan</h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-10">
        {conditions.map((c, i) => (
          <div key={i} className={`rounded-2xl border p-5 ${c.color}`}>
            <div className="flex items-center gap-2 mb-4">
              <span className={`px-3 py-1 rounded-full text-white text-xs font-bold ${c.badge}`}>{c.label}</span>
            </div>
            <ul className="space-y-2">
              {c.items.map((item, j) => (
                <li key={j} className="flex items-start gap-2 text-sm text-slate-700">
                  <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-slate-400 flex-shrink-0" />
                  {item}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      {/* Tips */}
      <div className="bg-primary/5 rounded-2xl border border-primary/10 p-6">
        <h2 className="font-bold text-primary mb-4">Tips Melindungi Dirimu</h2>
        <ul className="space-y-3">
          {tips.map((tip, i) => (
            <li key={i} className="flex items-start gap-3 text-sm text-slate-700">
              <span className="w-5 h-5 rounded-full bg-primary text-white flex items-center justify-center text-xs font-bold flex-shrink-0 mt-0.5">{i + 1}</span>
              {tip}
            </li>
          ))}
        </ul>
      </div>

      <div className="mt-8 text-center text-xs text-slate-400">
        Keputusan admin bersifat final. Untuk pertanyaan lebih lanjut, hubungi kami melalui server Discord.
      </div>
    </div>
  );
}
