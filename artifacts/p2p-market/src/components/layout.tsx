import { Link, useLocation } from "wouter";
import { LogOut, Menu, Wallet, User as UserIcon, Gamepad2, ChevronDown, Activity, Plus, ArrowDownToLine, Sun, Moon, X, ShieldCheck } from "lucide-react";
import { useAuthStore, useAuthHeaders } from "@/lib/store";
import { useState } from "react";
import { useLogout, useGetWalletBalance, useGetTransactionActiveCount, useGetAdminPendingCounts } from "@workspace/api-client-react";
import { motion, AnimatePresence } from "framer-motion";
import { useTheme } from "@/lib/theme";
import { TurnstileWidget } from "@/components/turnstile-widget";


export function Layout({ children }: { children: React.ReactNode }) {
  const [location, setLocation] = useLocation();
  const { user, logout } = useAuthStore();
  const requestOptions = useAuthHeaders();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [showLoginModal, setShowLoginModal] = useState(false);
  const { _hasHydrated } = useAuthStore();
  const logoutMutation = useLogout();
  const { theme, toggleTheme } = useTheme();

  const { data: walletBalance } = useGetWalletBalance({
    request: requestOptions,
    query: { enabled: _hasHydrated && !!user },
  });
  const isAdmin = user?.isAdmin === true;
  const { data: txActiveCount } = useGetTransactionActiveCount({
    enabled: _hasHydrated && !!user,
    refetchInterval: 30000,
  });
  const { data: pendingCounts } = useGetAdminPendingCounts(
    {},
    { enabled: _hasHydrated && isAdmin, refetchInterval: 30000 },
  );
  const txBadgeCount = isAdmin
    ? (pendingCounts?.withdrawals ?? 0) + (pendingCounts?.disputes ?? 0) + (txActiveCount?.count ?? 0)
    : (txActiveCount?.count ?? 0);

  const handleDiscordLogin = () => {
    setShowLoginModal(true);
  };

  const handleTurnstileVerified = (token: string) => {
    window.location.href = `${import.meta.env.VITE_API_URL}/auth/discord?cf_token=${encodeURIComponent(token)}`;
  };

  const handleLogout = async () => {
    try {
      await logoutMutation.mutateAsync();
    } catch (e) {
      // ignore
    } finally {
      logout();
      setLocation("/");
      setIsDropdownOpen(false);
    }
  };

  const navLinks = [
    { name: "Market", href: "/market" },
    ...(user ? [
      { name: "Dashboard", href: "/dashboard" },
      { name: "Transaksi", href: "/transactions" },
      ...(isAdmin ? [{ name: "Logs", href: "/logs" }] : []),
    ] : []),
  ];

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <header className="sticky top-0 z-50 w-full border-b border-border bg-white/80 dark:bg-card/90 backdrop-blur-md">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-8">
            <Link href="/" className="flex items-center gap-2 group">
              <img
                src="/logo.png"
                alt="P2P Market Logo"
                className="w-9 h-9 group-hover:scale-105 transition-transform"
              />
              <span className="font-display font-bold text-xl tracking-tight text-secondary">
                P2P<span className="text-primary">Market</span>
              </span>
            </Link>

            <nav className="hidden md:flex gap-1">
              {navLinks.map((link) => (
                <Link
                  key={link.name}
                  href={link.href}
                  className={`relative px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                    location.startsWith(link.href)
                      ? "bg-primary/10 text-primary"
                      : "text-muted-foreground hover:bg-slate-100 hover:text-secondary"
                  }`}
                >
                  {link.name}
                  {link.href === "/transactions" && txBadgeCount > 0 && (
                    <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[9px] font-bold min-w-[16px] h-4 px-0.5 rounded-full flex items-center justify-center">
                      {txBadgeCount > 9 ? "9+" : txBadgeCount}
                    </span>
                  )}
                </Link>
              ))}
            </nav>
          </div>

          <div className="flex items-center gap-3">
            {/* Dark / Light Toggle */}
            <button
              onClick={toggleTheme}
              title={theme === "dark" ? "Mode Terang" : "Mode Gelap"}
              className="w-9 h-9 rounded-xl flex items-center justify-center bg-slate-100 dark:bg-muted text-slate-700 dark:text-muted-foreground hover:bg-slate-200 dark:hover:bg-muted/80 transition-colors"
            >
              <AnimatePresence mode="wait" initial={false}>
                {theme === "dark" ? (
                  <motion.span
                    key="sun"
                    initial={{ rotate: -90, opacity: 0 }}
                    animate={{ rotate: 0, opacity: 1 }}
                    exit={{ rotate: 90, opacity: 0 }}
                    transition={{ duration: 0.18 }}
                  >
                    <Sun size={17} />
                  </motion.span>
                ) : (
                  <motion.span
                    key="moon"
                    initial={{ rotate: 90, opacity: 0 }}
                    animate={{ rotate: 0, opacity: 1 }}
                    exit={{ rotate: -90, opacity: 0 }}
                    transition={{ duration: 0.18 }}
                  >
                    <Moon size={17} />
                  </motion.span>
                )}
              </AnimatePresence>
            </button>

            {user ? (
              <div className="relative flex items-center gap-3">
                <Link
                  href="/market/new"
                  className="hidden md:flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 text-primary hover:bg-primary/20 transition-colors font-medium text-sm"
                >
                  <Plus size={16} /> Jual Item
                </Link>
                <div className="hidden sm:flex items-center gap-2 px-4 py-2 rounded-full bg-slate-100 dark:bg-muted border border-slate-200 dark:border-border">
                  <Wallet size={16} className="text-primary" />
                  <span className="font-semibold text-sm text-foreground">
                    Rp {(walletBalance?.balance ?? user.walletBalance).toLocaleString("id-ID")}
                  </span>
                </div>

                <button
                  onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                  className="flex items-center gap-2 hover:opacity-80 transition-opacity"
                >
                  <img
                    src={user.avatarUrl || "https://api.dicebear.com/7.x/avataaars/svg?seed=fallback"}
                    alt="Avatar"
                    className="w-10 h-10 rounded-full border-2 border-primary/20 object-cover bg-slate-100"
                  />
                  <ChevronDown size={16} className="text-muted-foreground hidden sm:block" />
                </button>

                <AnimatePresence>
                  {isDropdownOpen && (
                    <motion.div
                      initial={{ opacity: 0, y: 10, scale: 0.95 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: 10, scale: 0.95 }}
                      transition={{ duration: 0.15 }}
                      className="absolute right-0 top-full mt-2 w-56 bg-white dark:bg-card rounded-2xl shadow-xl border border-slate-100 dark:border-border py-2 overflow-hidden"
                    >
                      <div className="px-4 py-3 border-b border-slate-100 dark:border-border mb-2">
                        <p className="font-bold text-sm truncate text-foreground">{user.username}</p>
                        <p className="text-xs text-muted-foreground truncate">@{user.username}</p>
                      </div>

                      <Link href="/profile" className="flex items-center gap-3 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50 hover:text-primary transition-colors" onClick={() => setIsDropdownOpen(false)}>
                        <UserIcon size={16} /> Profil Saya
                      </Link>
                      <Link href="/topup" className="flex items-center gap-3 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50 hover:text-primary transition-colors" onClick={() => setIsDropdownOpen(false)}>
                        <Activity size={16} /> Top Up Wallet
                      </Link>
                      <Link href="/withdraw" className="flex items-center gap-3 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50 hover:text-emerald-600 transition-colors" onClick={() => setIsDropdownOpen(false)}>
                        <ArrowDownToLine size={16} /> Tarik Saldo
                      </Link>
                      <div className="h-px bg-slate-100 dark:bg-border my-2" />
                      <button
                        onClick={handleLogout}
                        className="w-full flex items-center gap-3 px-4 py-2 text-sm text-destructive hover:bg-destructive/10 transition-colors"
                      >
                        <LogOut size={16} /> Keluar
                      </button>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            ) : (
              /* Login button — hanya tampil di desktop, di mobile masuk hamburger */
              <button
                onClick={handleDiscordLogin}
                className="hidden md:flex items-center gap-2 px-6 py-2.5 rounded-xl bg-[#5865F2] hover:bg-[#4752C4] text-white font-semibold transition-all shadow-lg shadow-[#5865F2]/25 hover:-translate-y-0.5"
              >
                <Gamepad2 size={18} />
                Login Discord
              </button>
            )}

            <button
              className="md:hidden p-2 text-slate-600 dark:text-slate-300 hover:bg-slate-100 rounded-lg"
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            >
              {isMobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
            </button>
          </div>
        </div>

        {/* Mobile Menu */}
        <AnimatePresence>
          {isMobileMenuOpen && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="md:hidden border-t border-slate-100 dark:border-border bg-white dark:bg-card overflow-hidden"
            >
              <div className="px-4 py-4 space-y-2 flex flex-col">
                {navLinks.map((link) => (
                  <Link
                    key={link.name}
                    href={link.href}
                    onClick={() => setIsMobileMenuOpen(false)}
                    className={`relative px-4 py-3 rounded-xl text-sm font-medium flex items-center justify-between transition-colors ${
                      location.startsWith(link.href)
                        ? "bg-primary/10 text-primary"
                        : "text-slate-700 hover:bg-slate-50"
                    }`}
                  >
                    <span>{link.name}</span>
                    {link.href === "/transactions" && txBadgeCount > 0 && (
                      <span className="bg-red-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full">
                        {txBadgeCount > 9 ? "9+" : txBadgeCount}
                      </span>
                    )}
                  </Link>
                ))}
                {user && (
                  <Link
                    href="/market/new"
                    onClick={() => setIsMobileMenuOpen(false)}
                    className="px-4 py-3 rounded-xl text-sm font-medium text-primary bg-primary/10"
                  >
                    + Jual Item Baru
                  </Link>
                )}
                {!user && (
                  <>
                    <div className="h-px bg-slate-100 my-1" />
                    <button
                      onClick={() => { setIsMobileMenuOpen(false); handleDiscordLogin(); }}
                      className="flex items-center justify-center gap-2.5 px-4 py-3 rounded-xl bg-[#5865F2] hover:bg-[#4752C4] text-white font-semibold text-sm transition-colors shadow-md shadow-[#5865F2]/20"
                    >
                      <Gamepad2 size={18} />
                      Login dengan Discord
                    </button>
                  </>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </header>

      <main className="flex-1">
        {children}
      </main>

      <footer className="bg-white dark:bg-card border-t border-slate-200 dark:border-border mt-auto">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 md:py-10">
          <div className="flex flex-col md:flex-row justify-between gap-8">
            <div>
              <div className="flex items-center gap-2 mb-3">
                <img
                  src="/logo.png"
                  alt="P2P Market Logo"
                  className="w-8 h-8 opacity-60"
                />
                <span className="font-display font-bold text-lg text-slate-400 dark:text-slate-500">
                  P2P<span className="text-slate-300 dark:text-slate-600">Market</span>
                </span>
              </div>
              <p className="text-slate-400 dark:text-slate-500 text-xs max-w-xs">
                Platform jual beli item game yang aman dengan sistem Escrow. Transaksi terlindungi sepenuhnya.
              </p>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-6">
              <div>
                <p className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-3">Platform</p>
                <ul className="space-y-2">
                  <li><Link href="/market" className="text-sm text-slate-400 hover:text-primary transition-colors">Market</Link></li>
                  <li><Link href="/cara-kerja" className="text-sm text-slate-400 hover:text-primary transition-colors">Cara Kerja</Link></li>
                </ul>
              </div>
              <div>
                <p className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-3">Kebijakan</p>
                <ul className="space-y-2">
                  <li><Link href="/terms" className="text-sm text-slate-400 hover:text-primary transition-colors">Syarat & Ketentuan</Link></li>
                  <li><Link href="/privacy" className="text-sm text-slate-400 hover:text-primary transition-colors">Kebijakan Privasi</Link></li>
                  <li><Link href="/refund-policy" className="text-sm text-slate-400 hover:text-primary transition-colors">Kebijakan Refund</Link></li>
                </ul>
              </div>
              <div>
                <p className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-3">Bantuan</p>
                <ul className="space-y-2">
                  <li><Link href="/cara-kerja" className="text-sm text-slate-400 hover:text-primary transition-colors">Panduan Transaksi</Link></li>
                  <li><Link href="/refund-policy" className="text-sm text-slate-400 hover:text-primary transition-colors">Kebijakan Dispute</Link></li>
                  <li><Link href="/contact" className="text-sm text-slate-400 hover:text-primary transition-colors">Hubungi Kami</Link></li>
                </ul>
              </div>
            </div>
          </div>
          <div className="border-t border-slate-100 dark:border-border mt-8 pt-6">
            <p className="text-slate-400 dark:text-slate-500 text-xs text-center">
              © {new Date().getFullYear()} P2P Market. Platform trading aman dengan sistem Escrow.
            </p>
          </div>
        </div>
      </footer>

      {/* Turnstile Login Modal */}
      <AnimatePresence>
        {showLoginModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
            onClick={(e) => { if (e.target === e.currentTarget) setShowLoginModal(false); }}
          >
            <motion.div
              initial={{ scale: 0.92, opacity: 0, y: 16 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.92, opacity: 0, y: 16 }}
              className="bg-white dark:bg-card rounded-3xl shadow-2xl p-8 w-full max-w-sm"
            >
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-blue-50 dark:bg-blue-950 flex items-center justify-center">
                    <ShieldCheck size={20} className="text-blue-500" />
                  </div>
                  <div>
                    <h2 className="font-display font-bold text-secondary dark:text-white text-base">Verifikasi Keamanan</h2>
                    <p className="text-xs text-slate-500">Selesaikan sebelum login Discord</p>
                  </div>
                </div>
                <button
                  onClick={() => setShowLoginModal(false)}
                  className="w-8 h-8 rounded-full flex items-center justify-center text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                >
                  <X size={16} />
                </button>
              </div>

              <div className="flex flex-col items-center gap-4">
                <p className="text-sm text-slate-600 dark:text-slate-400 text-center">
                  Selesaikan verifikasi di bawah ini untuk melanjutkan login dengan Discord.
                </p>
                <TurnstileWidget
                  onVerify={handleTurnstileVerified}
                  onError={() => setShowLoginModal(false)}
                />
                <p className="text-xs text-slate-400 text-center">
                  Setelah terverifikasi, kamu akan diarahkan ke Discord secara otomatis.
                </p>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
