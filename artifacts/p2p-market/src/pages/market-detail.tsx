import { useState, useMemo, useCallback } from "react";
import { useRoute, useLocation, Link } from "wouter";
import { useGetListingById, useCreateTransaction, useDeleteListing, getGetTransactionsQueryKey, getGetWalletBalanceQueryKey, getGetTransactionActiveCountQueryKey, getGetMyListingsQueryKey } from "@workspace/api-client-react";
import { useAuthStore, useAuthHeaders } from "@/lib/store";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import { ShieldCheck, Shield, Crown, Gamepad2, ArrowLeft, AlertCircle, ShoppingBag, Minus, Plus, Package, TriangleAlert, ChevronLeft, ChevronRight, X, Trash2 } from "lucide-react";
import { getTrustTier } from "../lib/trust-tier";
import { format } from "date-fns";
import { id } from "date-fns/locale";
import { TurnstileWidget } from "@/components/turnstile-widget";
import { SEO } from "@/components/seo";

const BASE = import.meta.env.BASE_URL;
const CATEGORY_IMAGES: Record<string, string> = {
  "Cowoncy": `${BASE}cowoncy.png`,
  "Ticket Patreon": `${BASE}ticket-patreon.png`,
  "Ticket Custom Pet": `${BASE}ticket-custom-pet.png`,
  "Ticket Custom": `${BASE}ticket-custom.png`,
};
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

function parseImageUrls(imageUrl: string | null | undefined): string[] {
  if (!imageUrl) return [];
  try {
    const parsed = JSON.parse(imageUrl);
    if (Array.isArray(parsed)) return parsed;
  } catch {}
  return [imageUrl];
}

function ImageLightbox({ images, current, onClose, onPrev, onNext, onDot }: {
  images: string[]; current: number;
  onClose: () => void; onPrev: () => void; onNext: () => void; onDot: (i: number) => void;
}) {
  return (
    <div className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center" onClick={onClose}>
      <button onClick={onClose} className="absolute top-4 right-4 w-10 h-10 bg-white/10 hover:bg-white/20 text-white rounded-full flex items-center justify-center transition-colors z-10">
        <X size={24} />
      </button>

      <div className="relative w-full h-full flex items-center justify-center p-4" onClick={e => e.stopPropagation()}>
        <img src={images[current]} className="max-w-full max-h-full object-contain rounded-lg" />

        {images.length > 1 && (
          <>
            <button onClick={onPrev} className="absolute left-4 top-1/2 -translate-y-1/2 w-10 h-10 bg-white/10 hover:bg-white/20 text-white rounded-full flex items-center justify-center transition-colors">
              <ChevronLeft size={22} />
            </button>
            <button onClick={onNext} className="absolute right-4 top-1/2 -translate-y-1/2 w-10 h-10 bg-white/10 hover:bg-white/20 text-white rounded-full flex items-center justify-center transition-colors">
              <ChevronRight size={22} />
            </button>
            <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex gap-2">
              {images.map((_, i) => (
                <button key={i} onClick={() => onDot(i)} className={`w-2.5 h-2.5 rounded-full transition-all ${i === current ? "bg-white w-5" : "bg-white/40"}`} />
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function ImageGallery({ images, title, hasQuantity, status, stock }: { images: string[]; title: string; hasQuantity: boolean; status: string; stock: number }) {
  const [current, setCurrent] = useState(0);
  const [lightbox, setLightbox] = useState(false);
  const prev = useCallback(() => setCurrent(i => (i - 1 + images.length) % images.length), [images.length]);
  const next = useCallback(() => setCurrent(i => (i + 1) % images.length), [images.length]);

  return (
    <>
      <div className="w-full md:w-5/12 bg-slate-100 flex-shrink-0 relative min-h-[300px]">
        <img
          src={images[current]}
          className="w-full h-full absolute inset-0 object-cover cursor-pointer"
          onClick={() => setLightbox(true)}
        />

        {images.length > 1 && (
          <>
            <button onClick={prev} className="absolute left-2 top-1/2 -translate-y-1/2 w-8 h-8 bg-black/40 hover:bg-black/60 text-white rounded-full flex items-center justify-center transition-colors">
              <ChevronLeft size={18} />
            </button>
            <button onClick={next} className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 bg-black/40 hover:bg-black/60 text-white rounded-full flex items-center justify-center transition-colors">
              <ChevronRight size={18} />
            </button>
            <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-1.5">
              {images.map((_, i) => (
                <button key={i} onClick={() => setCurrent(i)} className={`w-2 h-2 rounded-full transition-all ${i === current ? "bg-white w-4" : "bg-white/50"}`} />
              ))}
            </div>
          </>
        )}

        {hasQuantity && status === "active" && (
          <div className="absolute top-4 right-4 flex items-center gap-1.5 px-3 py-1.5 bg-white/90 backdrop-blur-sm rounded-full shadow text-xs font-bold text-slate-700">
            <Package size={13} className="text-primary" />
            Stok: {stock} unit
          </div>
        )}
      </div>

      {lightbox && (
        <ImageLightbox
          images={images}
          current={current}
          onClose={() => setLightbox(false)}
          onPrev={prev}
          onNext={next}
          onDot={setCurrent}
        />
      )}
    </>
  );
}

export default function MarketDetail() {
  const [, params] = useRoute("/market/:id");
  const listingId = parseInt(params?.id || "0");
  const { user } = useAuthStore();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const authHeaders = useAuthHeaders();
  const [cfToken, setCfToken] = useState<string | null>(null);

  const requestOptions = useMemo(() => ({
    headers: {
      ...authHeaders.headers,
      ...(cfToken ? { "x-cf-turnstile-response": cfToken } : {}),
    },
  }), [authHeaders.headers, cfToken]);

  const { data: listing, isLoading } = useGetListingById(listingId);
  const buyMutation = useCreateTransaction({ request: requestOptions });
  const [confirmDelete, setConfirmDelete] = useState(false);
  const { mutate: deleteListing, isPending: isDeletePending } = useDeleteListing({
    request: authHeaders,
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getGetMyListingsQueryKey() });
        toast({ title: "Listing dihapus", description: "Listing berhasil dihapus dari marketplace." });
        setLocation("/profile");
      },
      onError: () => {
        toast({ title: "Gagal menghapus", description: "Terjadi kesalahan, coba lagi.", variant: "destructive" });
        setConfirmDelete(false);
      },
    },
  });

  const [qty, setQty] = useState(1);

  if (isLoading) return <div className="p-20 text-center text-slate-400">Memuat...</div>;
  if (!listing) return <div className="p-20 text-center text-slate-400">Listing tidak ditemukan.</div>;

  const isOwner = user?.id === listing.sellerId;
  const hasQuantity = (listing as any).hasQuantity === true;
  const stock = (listing as any).stock ?? 1;
  const maxQty = hasQuantity ? stock : 1;
  const safeQty = Math.min(qty, maxQty);
  const totalPrice = listing.price * safeQty;

  const changeQty = (delta: number) => {
    setQty(prev => Math.max(1, Math.min(maxQty, prev + delta)));
  };

  const handleBuy = async () => {
    if (!user) {
      toast({ title: "Login diperlukan", description: "Silakan login untuk membeli.", variant: "destructive" });
      return;
    }
    if (!cfToken) {
      toast({ title: "Verifikasi diperlukan", description: "Selesaikan verifikasi keamanan terlebih dahulu.", variant: "destructive" });
      return;
    }

    try {
      const res = await buyMutation.mutateAsync({ data: { listingId, quantity: safeQty } });
      queryClient.invalidateQueries({ queryKey: getGetTransactionsQueryKey() });
      queryClient.invalidateQueries({ queryKey: getGetWalletBalanceQueryKey() });
      queryClient.invalidateQueries({ queryKey: getGetTransactionActiveCountQueryKey() });
      toast({ title: "Berhasil!", description: "Transaksi berhasil dibuat. Saldo diamankan di Escrow." });
      setLocation(`/transaction/${res.id}`);
    } catch (err: any) {
      const msg: string = err?.response?.data?.message || err.message || "";
      if (msg.toLowerCase().includes("insufficient") || msg.toLowerCase().includes("wallet")) {
        toast({ title: "Saldo tidak cukup", description: "Silakan top up terlebih dahulu.", variant: "destructive" });
        setLocation("/topup");
      } else {
        toast({ title: "Gagal", description: msg || "Gagal membeli item.", variant: "destructive" });
      }
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <SEO
        title={`${listing.title} — Rp ${listing.price.toLocaleString("id-ID")}`}
        description={`Beli ${listing.title} (${listing.category}) seharga Rp ${listing.price.toLocaleString("id-ID")} di P2PMarket. Transaksi aman dengan escrow otomatis.`}
        path={`/market/${listingId}`}
      />
      <Link href="/market" className="flex items-center gap-2 text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 text-sm font-medium mb-8 transition-colors">
        <ArrowLeft size={16} />
        Kembali ke Market
      </Link>
      {/* Safety alert */}
      <div className="mb-6 flex items-start gap-3 px-5 py-4 rounded-2xl bg-amber-50 border border-amber-200 dark:bg-amber-950/30 dark:border-amber-800">
        <TriangleAlert size={20} className="text-amber-500 flex-shrink-0 mt-0.5" />
        <div>
          <p className="font-bold text-amber-800 dark:text-amber-400 text-sm">Peringatan Keamanan</p>
          <p className="text-amber-700 dark:text-amber-500 text-xs mt-0.5 leading-relaxed">
            <strong>Jangan pernah bertransaksi di luar website ini.</strong> Semua transaksi wajib dilakukan melalui sistem Escrow P2PMarket agar saldo kamu terlindungi. Kami tidak bertanggung jawab atas kerugian akibat transaksi di luar platform.
          </p>
        </div>
      </div>

      <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden flex flex-col md:flex-row">
        
        {/* Left: Image / Gallery */}
        {(() => {
          const images = parseImageUrls(listing.imageUrl);
          if (images.length > 0) {
            return <ImageGallery images={images} title={listing.title} hasQuantity={hasQuantity} status={listing.status} stock={stock} />;
          }

          const singleImage = getListingImage(listing.imageUrl, listing.category);
          if (singleImage) {
            return <ImageGallery images={[singleImage]} title={listing.title} hasQuantity={hasQuantity} status={listing.status} stock={stock} />;
          }

          return (
            <div className="w-full md:w-5/12 bg-slate-100 flex-shrink-0 relative min-h-[300px]">
              <div className="absolute inset-0 flex flex-col items-center justify-center text-slate-300">
                <Gamepad2 size={80} className="mb-4" />
                <span className="font-display font-bold uppercase tracking-widest text-slate-400">{listing.game}</span>
              </div>
              {hasQuantity && listing.status === "active" && (
                <div className="absolute top-4 right-4 flex items-center gap-1.5 px-3 py-1.5 bg-white/90 backdrop-blur-sm rounded-full shadow text-xs font-bold text-slate-700">
                  <Package size={13} className="text-primary" />
                  Stok: {stock} unit
                </div>
              )}
            </div>
          );
        })()}

        {/* Right: Details */}
        <div className="p-8 md:p-12 flex-1 flex flex-col">
          <div className="flex items-center gap-3 mb-4">
            <span className="px-3 py-1 bg-primary/10 text-primary text-xs font-bold rounded-lg uppercase tracking-wider">
              {listing.game}
            </span>
            <span className="px-3 py-1 bg-slate-100 text-slate-600 text-xs font-bold rounded-lg uppercase tracking-wider">
              {listing.category}
            </span>
          </div>

          <h1 className="text-3xl md:text-4xl font-display font-bold text-secondary mb-2">{listing.title}</h1>
          <p className="text-sm text-slate-400 mb-8">Ditambahkan pada {format(new Date(listing.createdAt), "dd MMMM yyyy", { locale: id })}</p>

          <div className="prose prose-slate max-w-none mb-10">
            <h3 className="text-lg font-bold text-secondary mb-2">Deskripsi</h3>
            <p className="whitespace-pre-wrap text-slate-600 leading-relaxed bg-slate-50 p-6 rounded-2xl border border-slate-100">
              {listing.description}
            </p>
          </div>

          <div className="mt-auto">
            {/* Seller Info */}
            {(() => {
              const tier = getTrustTier(listing.seller.totalTrades, listing.seller.rating, listing.seller.isAdmin);
              return (
                <div className={`flex items-center justify-between p-4 rounded-2xl border mb-8 ${tier.isOwner ? "owner-gradient-badge border-purple-200" : `${tier.bgColor} ${tier.borderColor}`}`}>
                  <div className="flex items-center gap-4">
                    <img src={listing.seller.avatarUrl || "https://api.dicebear.com/7.x/avataaars/svg?seed=fallback"} className="w-12 h-12 rounded-full border border-slate-200 bg-white" />
                    <div>
                      <p className={`font-bold ${tier.isOwner ? "owner-gradient-text" : "text-secondary"}`}>{maskUsername(listing.seller.username)}</p>
                      {tier.isOwner ? (
                        <p className="text-xs font-semibold flex items-center gap-1">
                          <Crown size={13} className="text-purple-500" />
                          <ShieldCheck size={14} className="text-pink-500" />
                          <span className="owner-gradient-text">{tier.label}</span>
                        </p>
                      ) : (
                        <p className={`text-xs font-semibold flex items-center gap-1 ${tier.color}`}>
                          {tier.crown && <Crown size={13} className="fill-amber-400" />}
                          {tier.shieldCheck ? <ShieldCheck size={14} /> : <Shield size={14} />}
                          {tier.label} ({listing.seller.totalTrades} Trade)
                        </p>
                      )}
                    </div>
                  </div>
                  {!tier.isOwner && (
                    <div className="text-right">
                      <p className="text-xs text-slate-500 font-bold uppercase">Rating</p>
                      <p className="font-display font-black text-secondary text-lg">⭐ {listing.seller.rating.toFixed(1)}</p>
                    </div>
                  )}
                </div>
              );
            })()}

            <div className="flex flex-col gap-5 pt-6 border-t border-slate-100">
              {/* Price row */}
              <div className="flex flex-col sm:flex-row items-start sm:items-end justify-between gap-4">
                <div>
                  <p className="text-sm font-bold text-slate-500 uppercase tracking-wider mb-1">
                    {hasQuantity ? "Harga per Barang" : "Harga Item"}
                  </p>
                  <p className="text-4xl font-display font-black text-secondary">
                    <span className="text-xl font-bold text-primary">Rp</span> {listing.price.toLocaleString("id-ID")}
                  </p>
                </div>

                {/* Quantity selector - only for OWO/ticket categories */}
                {hasQuantity && listing.status === "active" && !isOwner && (
                  <div className="flex flex-col items-end gap-1">
                    <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Jumlah</p>
                    <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-2xl p-1.5">
                      <button
                        onClick={() => changeQty(-1)}
                        disabled={qty <= 1}
                        className="w-9 h-9 rounded-xl bg-white border border-slate-200 flex items-center justify-center text-slate-600 hover:bg-primary hover:text-white hover:border-primary transition-all disabled:opacity-30 disabled:cursor-not-allowed shadow-sm"
                      >
                        <Minus size={16} />
                      </button>
                      <span className="w-12 text-center font-display font-black text-xl text-secondary">{qty}</span>
                      <button
                        onClick={() => changeQty(1)}
                        disabled={qty >= maxQty}
                        className="w-9 h-9 rounded-xl bg-white border border-slate-200 flex items-center justify-center text-slate-600 hover:bg-primary hover:text-white hover:border-primary transition-all disabled:opacity-30 disabled:cursor-not-allowed shadow-sm"
                      >
                        <Plus size={16} />
                      </button>
                    </div>
                    <p className="text-xs text-slate-400">Maks. {maxQty} unit tersedia</p>
                  </div>
                )}
              </div>

              {/* Total price + buy button */}
              <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
                {hasQuantity && qty > 1 ? (
                  <div>
                    <p className="text-xs text-slate-400 font-bold uppercase tracking-wider">Total ({qty} barang)</p>
                    <p className="text-2xl font-display font-black text-primary">
                      Rp {totalPrice.toLocaleString("id-ID")}
                    </p>
                  </div>
                ) : (
                  <div />
                )}

                {isOwner && listing.status === 'active' ? (
                  <div className="flex items-center gap-3 w-full sm:w-auto">
                    {confirmDelete ? (
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => deleteListing({ listingId: listing.id })}
                          disabled={isDeletePending}
                          className="px-5 py-3 rounded-2xl bg-red-500 text-white font-bold text-sm hover:bg-red-600 transition-colors disabled:opacity-50 flex items-center gap-2"
                        >
                          <Trash2 size={16} /> {isDeletePending ? "Menghapus..." : "Ya, Hapus"}
                        </button>
                        <button
                          onClick={() => setConfirmDelete(false)}
                          className="px-5 py-3 rounded-2xl border border-slate-200 text-slate-600 font-bold text-sm hover:bg-slate-50 transition-colors"
                        >
                          Batal
                        </button>
                      </div>
                    ) : (
                      <>
                        <button
                          onClick={() => setConfirmDelete(true)}
                          className="px-5 py-4 rounded-2xl border border-red-200 text-red-500 hover:bg-red-50 transition-colors flex items-center gap-2 font-bold"
                          title="Hapus listing"
                        >
                          <Trash2 size={20} />
                        </button>
                        <button
                          disabled
                          className="flex-1 sm:flex-none px-10 py-4 rounded-2xl bg-primary text-white font-bold text-lg opacity-50 cursor-not-allowed flex items-center justify-center gap-3"
                        >
                          Item Milikmu
                        </button>
                      </>
                    )}
                  </div>
                ) : (
                  <button
                    onClick={handleBuy}
                    disabled={buyMutation.isPending || listing.status !== 'active' || (!isOwner && listing.status === 'active' && !cfToken)}
                    className="w-full sm:w-auto px-10 py-4 rounded-2xl bg-primary text-white font-bold text-lg shadow-xl shadow-primary/30 hover:shadow-primary/40 hover:-translate-y-1 transition-all disabled:opacity-50 disabled:transform-none disabled:shadow-none flex items-center justify-center gap-3"
                  >
                    {buyMutation.isPending ? "Memproses..." :
                     listing.status !== 'active' ? "Terjual" :
                     <><ShoppingBag size={22} /> {hasQuantity && qty > 1 ? `Beli ${qty} Barang` : "Beli Sekarang"}</>}
                  </button>
                )}
              </div>

              {!isOwner && listing.status === 'active' && user && (
                <div className="mt-4">
                  <p className="text-xs text-slate-500 mb-2 font-medium">Verifikasi keamanan sebelum membeli:</p>
                  <TurnstileWidget
                    onVerify={setCfToken}
                    onExpire={() => setCfToken(null)}
                    onError={() => setCfToken(null)}
                  />
                </div>
              )}
            </div>
            
            <p className="text-xs text-slate-400 mt-4 flex items-center gap-1 justify-end">
              <AlertCircle size={14} /> Saldo akan ditahan oleh sistem Escrow sampai item diterima.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
