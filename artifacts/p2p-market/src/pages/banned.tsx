import { useEffect } from "react";
import { useLocation } from "wouter";
import { ShieldX, MessageCircle, Mail, ChevronLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuthStore } from "@/lib/store";

const EMAIL = "ikyfareza@p2pmarket.com";
const WA_NUMBER = "6281525984792";

export default function Banned() {
  const [, setLocation] = useLocation();
  const { logout } = useAuthStore();
  const params = new URLSearchParams(window.location.search);
  const reason = params.get("reason") || "";

  useEffect(() => {
    logout();
  }, []);

  const handleWhatsApp = () => {
    const msg = encodeURIComponent(
      "Halo, akun saya telah dibanned dari P2P Market. Saya ingin mengajukan banding."
    );
    window.open(`https://wa.me/${WA_NUMBER}?text=${msg}`, "_blank");
  };

  const handleEmail = () => {
    const subject = encodeURIComponent("Banding Banned Akun - P2P Market");
    const body = encodeURIComponent(
      "Halo,\n\nAkun saya telah dibanned dari P2P Market. Saya ingin mengajukan banding.\n\nAlasan ban (jika ada): " +
        reason +
        "\n\nSaya berharap dapat mendiskusikan hal ini lebih lanjut.\n\nTerima kasih."
    );
    window.open(`mailto:${EMAIL}?subject=${subject}&body=${body}`, "_blank");
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900 flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        {/* Icon */}
        <div className="flex justify-center mb-6">
          <div className="w-24 h-24 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center">
            <ShieldX className="w-12 h-12 text-red-500" />
          </div>
        </div>

        {/* Title */}
        <div className="text-center mb-6">
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white mb-2">
            Akun Kamu Dibanned
          </h1>
          <p className="text-slate-500 dark:text-slate-400 text-sm">
            Akses kamu ke P2P Market telah diblokir oleh admin.
          </p>
        </div>

        {/* Reason card */}
        {reason && (
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-2xl p-4 mb-6">
            <p className="text-xs font-semibold text-red-400 uppercase tracking-wider mb-1">
              Alasan
            </p>
            <p className="text-sm text-red-700 dark:text-red-300 font-medium">
              {reason}
            </p>
          </div>
        )}

        {/* Info */}
        <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl p-5 mb-6 shadow-sm">
          <p className="text-sm text-slate-600 dark:text-slate-300 text-center mb-4">
            Jika kamu merasa ini adalah kesalahan atau ingin mengajukan banding,
            silakan hubungi admin melalui:
          </p>

          <div className="space-y-3">
            <button
              onClick={handleWhatsApp}
              className="w-full flex items-center gap-3 p-3 rounded-xl bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 hover:bg-green-100 dark:hover:bg-green-900/40 transition-colors text-left"
            >
              <div className="w-9 h-9 rounded-full bg-green-500 flex items-center justify-center flex-shrink-0">
                <MessageCircle className="w-4 h-4 text-white" />
              </div>
              <div>
                <p className="text-xs text-green-600 dark:text-green-400 font-semibold uppercase tracking-wider">
                  WhatsApp
                </p>
                <p className="text-sm font-bold text-green-700 dark:text-green-300">
                  0815-2598-4792
                </p>
              </div>
            </button>

            <button
              onClick={handleEmail}
              className="w-full flex items-center gap-3 p-3 rounded-xl bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 hover:bg-blue-100 dark:hover:bg-blue-900/40 transition-colors text-left"
            >
              <div className="w-9 h-9 rounded-full bg-blue-500 flex items-center justify-center flex-shrink-0">
                <Mail className="w-4 h-4 text-white" />
              </div>
              <div>
                <p className="text-xs text-blue-600 dark:text-blue-400 font-semibold uppercase tracking-wider">
                  Email
                </p>
                <p className="text-sm font-bold text-blue-700 dark:text-blue-300">
                  {EMAIL}
                </p>
              </div>
            </button>
          </div>
        </div>

        {/* Back */}
        <Button
          variant="outline"
          className="w-full"
          onClick={() => setLocation("/")}
        >
          <ChevronLeft className="w-4 h-4 mr-1" />
          Kembali ke Beranda
        </Button>
      </div>
    </div>
  );
}
