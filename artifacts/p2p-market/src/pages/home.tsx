import { Link } from "wouter";
import { ShieldCheck, Zap, Coins, Users, ArrowRight } from "lucide-react";
import { motion } from "framer-motion";
import { useAuthStore } from "@/lib/store";
import { useEffect } from "react";
import { useToast } from "@/hooks/use-toast";
import { SEO } from "@/components/seo";

export default function Home() {
  const { user } = useAuthStore();
  const { toast } = useToast();

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("turnstile_error") === "1") {
      toast({ title: "Verifikasi gagal", description: "Verifikasi keamanan tidak berhasil. Coba lagi.", variant: "destructive" });
      window.history.replaceState({}, "", window.location.pathname);
    }
  }, []);

  const features = [
    {
      icon: <ShieldCheck size={32} className="text-emerald-500" />,
      title: "Sistem Escrow Aman",
      desc: "Saldo ditahan aman hingga item diterima. Bebas penipuan dan scam."
    },
    {
      icon: <Zap size={32} className="text-amber-500" />,
      title: "Transaksi Instan",
      desc: "Proses cepat dan mulus. Konfirmasi langsung dari Discord."
    },
    {
      icon: <Coins size={32} className="text-primary" />,
      title: "Tanpa Potongan",
      desc: "Jual beli item game favoritmu tanpa biaya admin tersembunyi."
    }
  ];

  return (
    <div className="flex flex-col min-h-[calc(100vh-4rem)]">
      <SEO path="/" />
      {/* Hero Section */}
      <section className="relative pt-20 pb-32 overflow-hidden flex-1 flex items-center">
        <div className="absolute inset-0 z-0">
          <img 
            src={`${import.meta.env.BASE_URL}images/hero-bg.png`} 
            alt="Hero background" 
            className="w-full h-full object-cover object-center opacity-10 dark:opacity-20"
          />
          <div className="absolute inset-0 bg-gradient-to-b from-background/50 via-background/80 to-background" />
        </div>
        
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10 w-full">
          <div className="text-center max-w-3xl mx-auto">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
            >
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 text-primary font-medium text-sm mb-6 border border-primary/20">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-primary"></span>
                </span>
                Platform Trading Komunitas #1
              </div>
              <h1 className="text-5xl md:text-7xl font-display font-extrabold tracking-tight text-secondary mb-6 text-balance">
                Trading Item Game <br className="hidden md:block"/>
                <span className="gradient-text">Lebih Aman & Cepat</span>
              </h1>
              <p className="text-lg md:text-xl text-muted-foreground mb-10 max-w-2xl mx-auto">
                Platform P2P pertama yang terintegrasi dengan komunitas Discord. Jual beli item, akun, dan skin dengan sistem Escrow terpercaya.
              </p>
              
              <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
                <Link 
                  href="/market"
                  className="w-full sm:w-auto px-8 py-4 rounded-2xl bg-primary text-primary-foreground font-semibold text-lg shadow-lg shadow-primary/30 hover:shadow-xl hover:shadow-primary/40 hover:-translate-y-1 transition-all flex items-center justify-center gap-2"
                >
                  Jelajahi Market <ArrowRight size={20} />
                </Link>
                {!user && (
                  <button className="w-full sm:w-auto px-8 py-4 rounded-2xl bg-white text-secondary font-semibold text-lg shadow-md border border-slate-200 hover:bg-slate-50 transition-all flex items-center justify-center gap-2">
                    <img src="https://assets-global.website-files.com/6257adef93867e50d84d30e2/636e0a6a49cf127bf92de1e2_icon_clyde_blurple_RGB.png" alt="Discord" className="w-6 h-6" />
                    Gabung Sekarang
                  </button>
                )}
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-24 bg-white relative z-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-display font-bold text-secondary mb-4">Mengapa Pilih P2PMarket?</h2>
            <p className="text-muted-foreground">Sistem yang dirancang khusus untuk gamers.</p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {features.map((f, i) => (
              <motion.div 
                key={i}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: i * 0.1 }}
                className="bg-slate-50 rounded-3xl p-8 border border-slate-100 hover:shadow-xl hover:-translate-y-1 transition-all"
              >
                <div className="w-16 h-16 rounded-2xl bg-white shadow-sm flex items-center justify-center mb-6">
                  {f.icon}
                </div>
                <h3 className="text-xl font-bold text-secondary mb-3">{f.title}</h3>
                <p className="text-slate-600 leading-relaxed">{f.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
