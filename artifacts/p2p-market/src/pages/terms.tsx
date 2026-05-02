import { ShieldCheck, FileText } from "lucide-react";

const sections = [
  {
    title: "1. Penerimaan Syarat",
    content: `Dengan mengakses atau menggunakan platform P2P Market ("Platform"), kamu menyetujui untuk terikat oleh Syarat & Ketentuan ini. Jika kamu tidak menyetujui syarat-syarat ini, mohon untuk tidak menggunakan Platform kami.`,
  },
  {
    title: "2. Eligibilitas Pengguna",
    content: `Untuk menggunakan Platform ini kamu wajib:
• Berusia minimal 13 tahun atau lebih
• Memiliki akun Discord yang aktif dan berusia minimal 3 hari
• Tidak sedang dalam status banned oleh platform kami
• Mematuhi seluruh ketentuan layanan Discord`,
  },
  {
    title: "3. Sistem Escrow",
    content: `Platform menggunakan sistem Escrow untuk melindungi transaksi:
• Saat membeli, saldo kamu ditahan sementara di sistem Escrow
• Penjual wajib mengirim item dan mengupload bukti pengiriman
• Pembeli mengonfirmasi penerimaan item sebelum saldo dilepas ke penjual
• Jika terjadi sengketa, admin berwenang memutuskan hasil transaksi`,
  },
  {
    title: "4. Kewajiban Penjual",
    content: `Sebagai penjual, kamu setuju untuk:
• Hanya menjual item yang benar-benar kamu miliki
• Memberikan informasi produk yang akurat dan tidak menyesatkan
• Mengirim item sesuai deskripsi dalam waktu yang wajar
• Mengupload bukti pengiriman yang valid (screenshot/foto)
• Tidak membatalkan transaksi secara sepihak setelah pembayaran diterima`,
  },
  {
    title: "5. Kewajiban Pembeli",
    content: `Sebagai pembeli, kamu setuju untuk:
• Melakukan pembayaran menggunakan saldo wallet yang tersedia
• Mengonfirmasi penerimaan item hanya jika item benar-benar telah diterima
• Tidak menyalahgunakan sistem sengketa untuk keuntungan pribadi
• Memberikan waktu yang wajar kepada penjual untuk memproses pengiriman`,
  },
  {
    title: "6. Larangan",
    content: `Pengguna dilarang untuk:
• Melakukan penipuan dalam bentuk apapun
• Menggunakan akun palsu atau menggunakan lebih dari satu akun
• Memanipulasi sistem rating atau feedback
• Menjual item yang ilegal atau melanggar hukum yang berlaku
• Melakukan serangan siber atau upaya peretasan pada platform`,
  },
  {
    title: "7. Tanggung Jawab Platform",
    content: `Platform berperan sebagai perantara (marketplace) dan bertanggung jawab untuk:
• Menyediakan sistem Escrow yang aman
• Memediasi sengketa antara pembeli dan penjual
• Menjaga keamanan data pengguna sesuai kebijakan privasi
• Platform tidak bertanggung jawab atas kerugian akibat penipuan yang terjadi di luar sistem Platform`,
  },
  {
    title: "8. Penangguhan & Pemblokiran",
    content: `Kami berhak menangguhkan atau memblokir akun pengguna yang:
• Terbukti melakukan penipuan
• Melanggar syarat dan ketentuan ini
• Mendapat laporan dari pengguna lain yang valid
• Melakukan aktivitas mencurigakan yang merugikan pengguna lain`,
  },
  {
    title: "9. Perubahan Syarat",
    content: `P2P Market berhak mengubah Syarat & Ketentuan ini sewaktu-waktu. Perubahan akan diumumkan melalui platform. Dengan terus menggunakan platform setelah perubahan, kamu dianggap menyetujui syarat yang baru.`,
  },
  {
    title: "10. Hukum yang Berlaku",
    content: `Syarat & Ketentuan ini diatur oleh hukum Republik Indonesia. Segala perselisihan yang timbul akan diselesaikan secara musyawarah, dan jika tidak tercapai kesepakatan, akan diselesaikan melalui jalur hukum yang berlaku.`,
  },
];

export default function Terms() {
  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <div className="text-center mb-10">
        <div className="w-16 h-16 bg-primary/10 rounded-2xl flex items-center justify-center text-primary mx-auto mb-4">
          <FileText size={32} />
        </div>
        <h1 className="text-3xl font-display font-bold text-secondary mb-2">Syarat & Ketentuan</h1>
        <p className="text-slate-500 text-sm">Terakhir diperbarui: Maret 2026</p>
      </div>

      <div className="bg-blue-50 border border-blue-100 rounded-2xl p-5 mb-8 flex gap-3">
        <ShieldCheck size={20} className="text-primary flex-shrink-0 mt-0.5" />
        <p className="text-sm text-blue-800">
          Dengan menggunakan P2P Market, kamu telah membaca dan menyetujui seluruh syarat & ketentuan yang berlaku di bawah ini.
        </p>
      </div>

      <div className="space-y-6">
        {sections.map((s, i) => (
          <div key={i} className="bg-white rounded-2xl border border-slate-100 p-6 shadow-sm">
            <h2 className="font-bold text-secondary text-lg mb-3">{s.title}</h2>
            <p className="text-slate-600 text-sm leading-relaxed whitespace-pre-line">{s.content}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
