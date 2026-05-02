import { Lock, Eye } from "lucide-react";

const sections = [
  {
    title: "1. Data yang Kami Kumpulkan",
    content: `Saat kamu login menggunakan Discord OAuth2, kami mengumpulkan:
• ID Discord kamu (digunakan sebagai identitas unik)
• Username dan avatar Discord kamu
• Waktu pembuatan akun Discord (untuk verifikasi usia akun)

Kami tidak mengumpulkan password, email, atau data sensitif lainnya dari Discord.`,
  },
  {
    title: "2. Data Transaksi",
    content: `Kami menyimpan data transaksi yang meliputi:
• Riwayat pembelian dan penjualan
• Riwayat top up dan penarikan saldo (termasuk data rekening/e-wallet)
• Bukti pengiriman yang diunggah oleh penjual
• Pesan dalam fitur chat transaksi
• Log sengketa dan keputusan admin`,
  },
  {
    title: "3. Penggunaan Data",
    content: `Data yang kami kumpulkan digunakan untuk:
• Mengidentifikasi dan mengautentikasi pengguna
• Memproses dan memvalidasi transaksi
• Menyelesaikan sengketa antara pembeli dan penjual
• Meningkatkan keamanan platform
• Mematuhi kewajiban hukum yang berlaku`,
  },
  {
    title: "4. Keamanan Data",
    content: `Kami berkomitmen menjaga keamanan datamu dengan:
• Menyimpan data di server yang terenkripsi
• Menggunakan token autentikasi yang aman dan memiliki masa berlaku
• Tidak menyimpan password atau kredensial sensitif apapun
• Membatasi akses data hanya kepada sistem yang memerlukannya`,
  },
  {
    title: "5. Berbagi Data dengan Pihak Ketiga",
    content: `Kami TIDAK menjual atau membagikan data pribadimu kepada pihak ketiga untuk tujuan komersial. Data hanya dibagikan kepada:
• Pihak berwenang jika diwajibkan oleh hukum
• Penyedia layanan teknis yang membantu operasional platform (hosting, database) dengan perjanjian kerahasiaan yang ketat`,
  },
  {
    title: "6. Data Rekening & E-Wallet",
    content: `Data nomor rekening dan e-wallet yang kamu masukkan saat penarikan:
• Disimpan hanya untuk keperluan proses penarikan
• Hanya dapat diakses oleh admin untuk memproses permintaan
• Tidak dibagikan kepada pengguna lain
• Kamu dapat meminta penghapusan data ini dengan menghubungi admin`,
  },
  {
    title: "7. Cookie & Penyimpanan Lokal",
    content: `Platform menggunakan penyimpanan lokal (localStorage) browser untuk:
• Menyimpan token autentikasi sesi kamu
• Mengingat preferensi pengguna

Kamu dapat menghapus data ini kapan saja melalui pengaturan browser.`,
  },
  {
    title: "8. Retensi Data",
    content: `Kami menyimpan datamu selama akun aktif. Jika akun dinonaktifkan atau kamu meminta penghapusan:
• Data profil akan dianonimkan
• Riwayat transaksi disimpan selama 12 bulan untuk keperluan audit
• Data chat transaksi dihapus setelah 6 bulan`,
  },
  {
    title: "9. Hak Pengguna",
    content: `Kamu memiliki hak untuk:
• Meminta salinan data pribadi yang kami simpan
• Meminta koreksi data yang tidak akurat
• Meminta penghapusan akun dan data terkait
• Menolak penggunaan data untuk keperluan tertentu

Hubungi admin melalui server Discord kami untuk menggunakan hak-hak tersebut.`,
  },
  {
    title: "10. Perubahan Kebijakan",
    content: `Kami dapat memperbarui kebijakan privasi ini dari waktu ke waktu. Perubahan signifikan akan diinformasikan melalui platform. Tanggal pembaruan terakhir selalu tercantum di bagian atas halaman ini.`,
  },
];

export default function Privacy() {
  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <div className="text-center mb-10">
        <div className="w-16 h-16 bg-violet-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
          <Lock size={32} className="text-violet-500" />
        </div>
        <h1 className="text-3xl font-display font-bold text-secondary mb-2">Kebijakan Privasi</h1>
        <p className="text-slate-500 text-sm">Terakhir diperbarui: Maret 2026</p>
      </div>

      <div className="bg-violet-50 border border-violet-100 rounded-2xl p-5 mb-8 flex gap-3">
        <Eye size={20} className="text-violet-500 flex-shrink-0 mt-0.5" />
        <p className="text-sm text-violet-800">
          Privasi kamu penting bagi kami. Dokumen ini menjelaskan data apa yang kami kumpulkan, bagaimana digunakan, dan bagaimana kami melindunginya.
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
