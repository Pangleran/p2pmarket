import { useState } from "react";
import { Link } from "wouter";
import { useGetListings } from "@workspace/api-client-react";
import { Search, Gamepad2, Package, Shield, ShieldCheck, Crown } from "lucide-react";
import { motion } from "framer-motion";
import { getTrustTier } from "../lib/trust-tier";
import { SEO } from "@/components/seo";

const BASE = import.meta.env.BASE_URL;

const CATEGORY_IMAGES: Record<string, string> = {
  "Cowoncy": `${BASE}cowoncy.png`,
  "Ticket Patreon": `${BASE}ticket-patreon.png`,
  "Ticket Custom Pet": `${BASE}ticket-custom-pet.png`,
  "Ticket Custom": `${BASE}ticket-custom.png`,
};

const QUANTITY_CATEGORIES = new Set(["Cowoncy", "Ticket Patreon", "Ticket Custom Pet", "Ticket Custom"]);

function getListingImage(imageUrl: string | null | undefined, category: string) {
  if (imageUrl) {
    try {
      const parsed = JSON.parse(imageUrl);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed[0];
    } catch {}
    return imageUrl;
  }
  return CATEGORY_IMAGES[category] ?? null;
}

function maskUsername(name: string): string {
  if (!name) return "***";
  if (name.length <= 3) return name[0] + "**";
  const show = Math.ceil(name.length / 2);
  return name.slice(0, show) + "***";
}

const GAMES = ["Semua Game", "Discord"];

const CATEGORIES_BY_GAME: Record<string, string[]> = {
  Discord: ["Cowoncy", "Ticket Patreon", "Ticket Custom Pet", "Ticket Custom", "Akun OWO"],
};

export default function Market() {
  const [search, setSearch] = useState("");
  const [game, setGame] = useState("");
  const [category, setCategory] = useState("");

  const { data: listings, isLoading, isError } = useGetListings({
    search: search || undefined,
    game: game || undefined,
    category: category || undefined,
  });

  const categoryOptions = game ? (CATEGORIES_BY_GAME[game] ?? []) : [];

  function handleGameChange(val: string) {
    setGame(val === "Semua Game" ? "" : val);
    setCategory("");
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
      <SEO
        title="Marketplace"
        description="Jual beli Cowoncy, Huntbot, Gem, Custom Pet, Ticket dan item game lainnya. Harga murah, transaksi aman dengan escrow otomatis."
        path="/market"
      />
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end mb-6 gap-3">
        <div>
          <h1 className="text-2xl md:text-3xl font-display font-bold text-secondary">Marketplace</h1>
          <p className="text-muted-foreground text-sm mt-1">Temukan item game idamanmu dengan aman.</p>
        </div>
        <Link href="/market/new" className="px-5 py-2.5 rounded-xl bg-primary text-white font-semibold text-sm shadow-lg shadow-primary/20 hover:-translate-y-0.5 transition-all">
          + Jual Item
        </Link>
      </div>

      {/* Filters */}
      <div className="bg-white p-3 rounded-2xl border border-slate-200 shadow-sm flex flex-col md:flex-row gap-3 mb-6">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
          <input
            type="text"
            placeholder="Cari item, skin, atau akun..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2.5 rounded-xl bg-slate-50 border-none focus:ring-2 focus:ring-primary/20 transition-shadow text-sm"
          />
        </div>
        <div className="flex gap-3">
          <select
            value={game || "Semua Game"}
            onChange={(e) => handleGameChange(e.target.value)}
            className="px-3 py-2.5 rounded-xl bg-slate-50 border-none focus:ring-2 focus:ring-primary/20 text-slate-700 font-medium cursor-pointer text-sm"
          >
            {GAMES.map(g => <option key={g} value={g}>{g}</option>)}
          </select>
          <select
            value={category || "Semua Kategori"}
            onChange={(e) => setCategory(e.target.value === "Semua Kategori" ? "" : e.target.value)}
            disabled={categoryOptions.length === 0}
            className="px-3 py-2.5 rounded-xl bg-slate-50 border-none focus:ring-2 focus:ring-primary/20 text-slate-700 font-medium cursor-pointer text-sm disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <option value="Semua Kategori">Semua Kategori</option>
            {categoryOptions.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
      </div>

      {/* Grid */}
      {isLoading ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
          {[1,2,3,4,5,6,7,8,9,10,11,12].map(i => (
            <div key={i} className="animate-pulse bg-slate-100 rounded-2xl aspect-[3/4]"></div>
          ))}
        </div>
      ) : isError ? (
        <div className="text-center py-24 bg-white rounded-3xl border border-slate-200">
          <Gamepad2 size={48} className="mx-auto text-slate-200 mb-4" />
          <h3 className="text-lg font-bold text-slate-400">Gagal memuat item</h3>
          <p className="text-slate-500 mt-2 text-sm">Terjadi kesalahan, coba muat ulang halaman.</p>
        </div>
      ) : listings?.length === 0 ? (
        <div className="text-center py-24 bg-white rounded-3xl border border-slate-200">
          <Gamepad2 size={48} className="mx-auto text-slate-200 mb-4" />
          <h3 className="text-lg font-bold text-slate-400">Tidak ada item ditemukan</h3>
          <p className="text-slate-500 mt-2 text-sm">Coba ubah kata kunci atau filter pencarian.</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
          {listings?.map((item, i) => {
            const showStock = QUANTITY_CATEGORIES.has(item.category);
            const stock = (item as any).stock ?? 1;
            return (
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.3, delay: i * 0.04 }}
                key={item.id}
              >
                <Link
                  href={`/market/${item.id}`}
                  className="group block bg-white rounded-2xl overflow-hidden border border-slate-200 shadow-sm hover:shadow-lg hover:border-primary/30 transition-all duration-300 flex flex-col h-full"
                >
                  <div className="aspect-square bg-slate-100 relative overflow-hidden">
                    {getListingImage(item.imageUrl, item.category) ? (
                      <img
                        src={getListingImage(item.imageUrl, item.category)!}
                        alt={item.title}
                        className={`w-full h-full group-hover:scale-105 transition-transform duration-500 ${item.imageUrl ? "object-cover" : "object-contain p-3"}`}
                      />
                    ) : (
                      <div className="w-full h-full flex flex-col items-center justify-center text-slate-300">
                        <Gamepad2 size={32} className="mb-1" />
                        <span className="text-[10px] font-semibold uppercase tracking-wider">{item.game}</span>
                      </div>
                    )}
                    <div className="absolute top-2 left-2 px-2 py-0.5 bg-white/90 backdrop-blur-md text-[10px] font-bold rounded-md text-secondary shadow-sm">
                      {item.category}
                    </div>
                    {/* Stock badge for quantity categories */}
                    {showStock && (
                      <div className="absolute bottom-2 right-2 flex items-center gap-0.5 px-1.5 py-0.5 bg-emerald-500 text-white text-[10px] font-bold rounded-md shadow">
                        <Package size={9} />
                        {stock}
                      </div>
                    )}
                  </div>
                  
                  <div className="p-3 flex-1 flex flex-col">
                    <h3 className="font-bold text-secondary text-xs leading-tight mb-2 line-clamp-2">{item.title}</h3>
                    
                    <div className="mt-auto pt-2 flex flex-col gap-1.5 border-t border-slate-100">
                      <div className="flex items-center justify-between">
                         <div className="flex items-center gap-1.5">
                          <img src={item.seller.avatarUrl || "https://api.dicebear.com/7.x/avataaars/svg?seed=fallback"} className="w-5 h-5 rounded-full bg-slate-100 flex-shrink-0" />
                          <span className={`text-[10px] font-medium ${getTrustTier(item.seller.totalTrades, item.seller.rating, item.seller.isAdmin).isOwner ? "owner-gradient-text font-bold" : "text-slate-500"}`}>{maskUsername(item.seller.username)}</span>
                        </div>
                        <div className="text-right">
                          <span className="text-[10px] font-bold text-slate-400">Rp</span>
                          <span className="text-sm font-display font-black text-secondary ml-0.5">{item.price.toLocaleString("id-ID")}</span>
                          {showStock && <span className="text-[9px] text-slate-400 block -mt-0.5">/barang</span>}
                        </div>
                      </div>
                      {(() => {
                        const tier = getTrustTier(item.seller.totalTrades, item.seller.rating, item.seller.isAdmin);
                        return tier.isOwner ? (
                          <div className="flex items-center gap-0.5 text-[9px] font-semibold">
                            <Crown size={9} className="text-purple-500" />
                            <ShieldCheck size={10} className="text-pink-500" />
                            <span className="owner-gradient-text">{tier.label}</span>
                          </div>
                        ) : (
                          <div className={`flex items-center gap-0.5 text-[9px] font-semibold ${tier.color}`}>
                            {tier.crown && <Crown size={9} className="fill-amber-400" />}
                            {tier.shieldCheck ? <ShieldCheck size={10} /> : <Shield size={10} />}
                            <span>{tier.label}</span>
                            <span className="text-slate-400 font-normal">({item.seller.totalTrades})</span>
                          </div>
                        );
                      })()}
                    </div>
                  </div>
                </Link>
              </motion.div>
            );
          })}
        </div>
      )}
    </div>
  );
}
