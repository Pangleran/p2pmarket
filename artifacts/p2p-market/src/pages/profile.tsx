import { useState } from "react";
import { useAuthStore, useAuthHeaders } from "@/lib/store";
import { useGetMe, useGetMyListings, useDeleteListing, getGetMyListingsQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { ShieldCheck, Shield, Crown, ArrowLeft, Star, Package, Clock, Gamepad2, Trash2 } from "lucide-react";
import { Link } from "wouter";
import { format } from "date-fns";
import { id } from "date-fns/locale";
import { getTrustTier } from "../lib/trust-tier";

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

export default function Profile() {
  const { user } = useAuthStore();
  const requestOptions = useAuthHeaders();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [deletingId, setDeletingId] = useState<number | null>(null);

  const { data: profile, isLoading: loadingProfile } = useGetMe({ request: requestOptions });
  const { data: listings, isLoading: loadingListings } = useGetMyListings({ request: requestOptions });

  const { mutate: deleteListing, isPending: isDeleting } = useDeleteListing({
    request: requestOptions,
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getGetMyListingsQueryKey() });
        toast({ title: "Listing dihapus", description: "Listing berhasil dihapus dari marketplace." });
        setDeletingId(null);
      },
      onError: () => {
        toast({ title: "Gagal menghapus", description: "Terjadi kesalahan, coba lagi.", variant: "destructive" });
        setDeletingId(null);
      },
    },
  });

  function handleDelete(listingId: number) {
    deleteListing({ listingId });
  }

  if (loadingProfile) return <div className="p-20 text-center text-slate-400">Memuat profil...</div>;
  if (!profile) return null;

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <Link href="/dashboard" className="flex items-center gap-2 text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 text-sm font-medium mb-8 transition-colors">
        <ArrowLeft size={16} />
        Kembali ke Dashboard
      </Link>
      {/* Header Profile */}
      <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden mb-8">
        <div className="h-32 bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600"></div>
        <div className="px-8 pb-8 relative">
          <img 
            src={profile.avatarUrl || "https://api.dicebear.com/7.x/avataaars/svg?seed=fallback"} 
            className="w-24 h-24 rounded-2xl border-4 border-white bg-slate-100 absolute -top-12 shadow-lg"
          />
           <div className="pt-14">
             <div>
              {(() => {
                const tier = getTrustTier(profile.totalTrades, profile.rating, profile.isAdmin);
                return (
                  <>
                    <h1 className={`text-3xl font-display font-bold mb-1 ${tier.isOwner ? "owner-gradient-text" : "text-secondary"}`}>{profile.username}</h1>
                    <p className="text-slate-500 font-medium">@{profile.username}</p>
                    
                    <div className="flex flex-wrap items-center gap-4 mt-4">
                      <div className={`flex items-center gap-1 text-sm font-bold px-3 py-1 rounded-lg border ${tier.isOwner ? "owner-gradient-badge border-purple-200" : `${tier.color} ${tier.bgColor} ${tier.borderColor}`}`}>
                        {tier.isOwner ? (
                          <>
                            <Crown size={15} className="text-purple-500" />
                            <ShieldCheck size={16} className="text-pink-500" />
                            <span className="owner-gradient-text">{tier.label}</span>
                          </>
                        ) : (
                          <>
                            {tier.crown && <Crown size={15} className="fill-amber-400" />}
                            {tier.shieldCheck ? <ShieldCheck size={16} /> : <Shield size={16} />}
                            {tier.label}
                          </>
                        )}
                      </div>
                      {!tier.isOwner && (
                        <div className="flex items-center gap-1 text-sm font-bold text-amber-600 bg-amber-50 px-3 py-1 rounded-lg">
                          <Star size={16} className="fill-amber-500" /> {profile.rating.toFixed(1)} Rating
                        </div>
                      )}
                      {!tier.isOwner && (
                        <div className="flex items-center gap-1 text-sm font-bold text-slate-600 bg-slate-100 px-3 py-1 rounded-lg">
                          <Package size={16} /> {profile.totalTrades} Transaksi
                        </div>
                      )}
                      <div className="flex items-center gap-1 text-sm font-bold text-slate-600 bg-slate-100 px-3 py-1 rounded-lg">
                        <Clock size={16} /> Bergabung {format(new Date(profile.joinedAt), "MMM yyyy", { locale: id })}
                      </div>
                    </div>
                  </>
                );
              })()}
            </div>
          </div>
        </div>
      </div>

      {/* My Listings */}
      <div>
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-display font-bold text-secondary">Listing Saya</h2>
          <Link href="/market/new" className="text-sm font-bold text-primary hover:underline">
            + Tambah Baru
          </Link>
        </div>

        {loadingListings ? (
          <div className="text-slate-400">Memuat listing...</div>
        ) : listings?.length === 0 ? (
          <div className="bg-slate-50 rounded-3xl border border-slate-200 border-dashed p-12 text-center">
            <Package size={48} className="mx-auto text-slate-300 mb-4" />
            <p className="text-slate-500 font-medium">Kamu belum memiliki item yang dijual.</p>
            <Link href="/market/new" className="mt-4 inline-block px-6 py-2.5 rounded-xl bg-primary text-white font-bold shadow-sm">
              Mulai Jualan
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {listings?.map(item => (
              <div key={item.id} className="bg-white rounded-2xl border border-slate-200 overflow-hidden flex flex-col shadow-sm hover:shadow-md transition-shadow">
                <div className="h-32 bg-slate-100 relative overflow-hidden">
                  {getListingImage(item.imageUrl, item.category) ? (
                    <img
                      src={getListingImage(item.imageUrl, item.category)!}
                      alt={item.title}
                      className={`w-full h-full ${item.imageUrl ? "object-cover" : "object-contain p-3"}`}
                    />
                  ) : (
                    <div className="w-full h-full flex flex-col items-center justify-center text-slate-300">
                      <Gamepad2 size={28} className="mb-1" />
                      <span className="text-[9px] font-semibold uppercase tracking-wider">{item.game}</span>
                    </div>
                  )}
                  <div className="absolute top-2 right-2 px-2 py-1 bg-white/90 backdrop-blur-sm text-[10px] font-bold rounded text-secondary uppercase">
                    {item.status}
                  </div>
                </div>
                <div className="p-4 flex-1 flex flex-col">
                  <p className="text-[10px] font-bold text-primary uppercase tracking-wider mb-1">{item.game}</p>
                  <h3 className="font-bold text-secondary text-sm line-clamp-2 mb-2">{item.title}</h3>
                  <div className="mt-auto flex items-center justify-between pt-3 border-t border-slate-100">
                    <p className="font-display font-bold text-secondary"><span className="text-[10px] text-slate-400 mr-0.5">Rp</span>{item.price.toLocaleString("id-ID")}</p>
                    <div className="flex items-center gap-2">
                      {item.status === "active" && (
                        deletingId === item.id ? (
                          <div className="flex items-center gap-1">
                            <button
                              onClick={() => handleDelete(item.id)}
                              disabled={isDeleting}
                              className="text-[10px] font-bold text-white bg-red-500 hover:bg-red-600 px-2 py-0.5 rounded transition-colors disabled:opacity-50"
                            >
                              {isDeleting ? "..." : "Ya, Hapus"}
                            </button>
                            <button
                              onClick={() => setDeletingId(null)}
                              className="text-[10px] font-bold text-slate-500 hover:text-slate-700 px-2 py-0.5 rounded transition-colors"
                            >
                              Batal
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() => setDeletingId(item.id)}
                            className="text-slate-400 hover:text-red-500 transition-colors"
                            title="Hapus listing"
                          >
                            <Trash2 size={14} />
                          </button>
                        )
                      )}
                      <Link href={`/market/${item.id}`} className="text-xs font-bold text-primary hover:underline">Lihat Detail</Link>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
