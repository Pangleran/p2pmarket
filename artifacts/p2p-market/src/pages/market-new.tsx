import { useState, useEffect, useMemo, useCallback } from "react";
import { useLocation, Link } from "wouter";
import { useCreateListing } from "@workspace/api-client-react";
import { useAuthStore, useAuthHeaders } from "@/lib/store";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import { getGetListingsQueryKey } from "@workspace/api-client-react";
import { PackagePlus, ArrowLeft, Image as ImageIcon, Upload, Package, Plus, X, Loader2 } from "lucide-react";
import { TurnstileWidget } from "@/components/turnstile-widget";

const BASE = import.meta.env.BASE_URL;

const CATEGORY_IMAGES: Record<string, string> = {
  "Cowoncy": `${BASE}cowoncy.png`,
  "Ticket Patreon": `${BASE}ticket-patreon.png`,
  "Ticket Custom Pet": `${BASE}ticket-custom-pet.png`,
  "Ticket Custom": `${BASE}ticket-custom.png`,
};

const CATEGORIES = ["Cowoncy", "Ticket Patreon", "Ticket Custom Pet", "Ticket Custom", "Akun OWO"];

const QUANTITY_CATEGORIES = new Set(["Cowoncy", "Ticket Patreon", "Ticket Custom Pet", "Ticket Custom"]);

export default function MarketNew() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const authHeaders = useAuthHeaders();
  const queryClient = useQueryClient();
  const [cfToken, setCfToken] = useState<string | null>(null);

  const requestOptions = useMemo(() => ({
    headers: {
      ...authHeaders.headers,
      ...(cfToken ? { "x-cf-turnstile-response": cfToken } : {}),
    },
  }), [authHeaders.headers, cfToken]);

  const createMutation = useCreateListing({ request: requestOptions });

  const { token } = useAuthStore();

  const [formData, setFormData] = useState({
    title: "",
    description: "",
    game: "Discord",
    category: "Cowoncy",
    price: "",
    stock: "1",
    imageUrl: "",
  });

  // Multi-image upload state for Akun OWO
  // previews = local blob URLs for instant display, uploadedImages = server URLs for submission
  const [previews, setPreviews] = useState<string[]>([]);
  const [uploadedImages, setUploadedImages] = useState<string[]>([]);
  const [uploadingIndex, setUploadingIndex] = useState<number | null>(null);

  const isImageRequired = formData.category === "Akun OWO";
  const hasDefaultImage = !!CATEGORY_IMAGES[formData.category];
  const effectiveImageUrl = hasDefaultImage ? CATEGORY_IMAGES[formData.category] : formData.imageUrl;
  const hasQuantity = QUANTITY_CATEGORIES.has(formData.category);

  const ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/jpg", "image/png", "image/gif", "image/webp"];
  const MIN_IMAGES = 3;
  const MAX_IMAGES = 6;

  const handleImageUpload = useCallback(async (file: File, index: number) => {
    if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
      toast({ title: "Format tidak didukung", description: "Hanya JPG, PNG, GIF, WEBP yang diperbolehkan.", variant: "destructive" });
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast({ title: "File terlalu besar", description: "Ukuran maksimal 5MB per gambar.", variant: "destructive" });
      return;
    }

    // Show local preview immediately
    const localPreview = URL.createObjectURL(file);
    setPreviews(prev => {
      const updated = [...prev];
      updated[index] = localPreview;
      return updated;
    });

    setUploadingIndex(index);
    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL}/storage/upload`, {
        method: "POST",
        headers: {
          "Content-Type": file.type,
          "X-File-Name": file.name,
          ...(token ? { "X-Auth-Token": token } : {}),
        },
        body: file,
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        toast({ title: "Gagal upload", description: err.error || "Gagal mengupload gambar.", variant: "destructive" });
        // Remove preview on failure
        setPreviews(prev => { const u = [...prev]; u[index] = ""; return u; });
        return;
      }
      const { url } = await res.json();
      setUploadedImages(prev => {
        const updated = [...prev];
        updated[index] = url;
        return updated;
      });
    } catch {
      toast({ title: "Error", description: "Terjadi kesalahan saat upload.", variant: "destructive" });
      setPreviews(prev => { const u = [...prev]; u[index] = ""; return u; });
    } finally {
      setUploadingIndex(null);
    }
  }, [token, toast]);

  const removeImage = useCallback((index: number) => {
    setUploadedImages(prev => prev.filter((_, i) => i !== index));
    setPreviews(prev => prev.filter((_, i) => i !== index));
  }, []);

  useEffect(() => {
    if (CATEGORY_IMAGES[formData.category]) {
      setFormData(prev => ({ ...prev, imageUrl: "" }));
    }
    if (formData.category !== "Akun OWO") {
      setUploadedImages([]);
      setPreviews([]);
    }
  }, [formData.category]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (isImageRequired && uploadedImages.filter(Boolean).length < MIN_IMAGES) {
      toast({ title: "Gambar kurang", description: `Upload minimal ${MIN_IMAGES} screenshot akun OWO kamu.`, variant: "destructive" });
      return;
    }
    if (!cfToken) {
      toast({ title: "Verifikasi diperlukan", description: "Selesaikan verifikasi keamanan terlebih dahulu.", variant: "destructive" });
      return;
    }

    const stockVal = hasQuantity ? Math.max(1, parseInt(formData.stock) || 1) : 1;

    try {
      const res = await createMutation.mutateAsync({
        data: {
          title: formData.title,
          description: formData.description,
          game: formData.game,
          category: formData.category,
          price: parseInt(formData.price.replace(/\D/g, "")),
          stock: stockVal,
          imageUrl: isImageRequired
            ? JSON.stringify(uploadedImages.filter(Boolean))
            : hasDefaultImage ? null : (formData.imageUrl || null),
        }
      });
      queryClient.invalidateQueries({ queryKey: getGetListingsQueryKey() });
      toast({ title: "Berhasil!", description: "Listing item berhasil dibuat." });
      setLocation(`/market/${res.id}`);
    } catch (err) {
      toast({ title: "Gagal", description: "Tidak dapat membuat listing.", variant: "destructive" });
    }
  };

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <Link href="/market" className="flex items-center gap-2 text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 text-sm font-medium mb-8 transition-colors">
        <ArrowLeft size={16} />
        Kembali ke Market
      </Link>
      <div className="mb-8">
        <h1 className="text-3xl font-display font-bold text-secondary flex items-center gap-3">
          <PackagePlus className="text-primary" /> Jual Item Baru
        </h1>
        <p className="text-muted-foreground mt-2">Isi detail item yang ingin kamu jual di marketplace.</p>
      </div>

      <div className="bg-white rounded-3xl p-8 border border-slate-200 shadow-sm">
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-2">
            <label className="text-sm font-bold text-slate-700">Judul Listing</label>
            <input
              required
              value={formData.title}
              onChange={e => setFormData({ ...formData, title: e.target.value })}
              className="w-full px-4 py-3 rounded-xl bg-slate-50 border border-slate-200 focus:bg-white focus:ring-2 focus:ring-primary/20 transition-all"
              placeholder="Contoh: Cowoncy OWO 50.000 - Murah Meriah"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            <div className="space-y-2">
              <label className="text-sm font-bold text-slate-700">Game</label>
              <select
                value={formData.game}
                onChange={e => setFormData({ ...formData, game: e.target.value })}
                className="w-full px-4 py-3 rounded-xl bg-slate-50 border border-slate-200 focus:bg-white focus:ring-2 focus:ring-primary/20 transition-all font-medium"
              >
                <option>Discord</option>
              </select>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-bold text-slate-700">Kategori</label>
              <select
                value={formData.category}
                onChange={e => setFormData({ ...formData, category: e.target.value })}
                className="w-full px-4 py-3 rounded-xl bg-slate-50 border border-slate-200 focus:bg-white focus:ring-2 focus:ring-primary/20 transition-all font-medium"
              >
                {CATEGORIES.map(c => <option key={c}>{c}</option>)}
              </select>
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-bold text-slate-700">Deskripsi Detail</label>
            <textarea
              required
              rows={4}
              value={formData.description}
              onChange={e => setFormData({ ...formData, description: e.target.value })}
              className="w-full px-4 py-3 rounded-xl bg-slate-50 border border-slate-200 focus:bg-white focus:ring-2 focus:ring-primary/20 transition-all resize-none"
              placeholder="Jelaskan spesifikasi akun/item secara detail..."
            />
          </div>

          {/* Price & Stock side by side for quantity categories */}
          <div className={`grid gap-6 ${hasQuantity ? "grid-cols-1 sm:grid-cols-2" : "grid-cols-1"}`}>
            <div className="space-y-2">
              <label className="text-sm font-bold text-slate-700">
                Harga {hasQuantity ? "per Barang (Rp)" : "(Rp)"}
              </label>
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 font-bold">Rp</span>
                <input
                  required
                  type="number"
                  min="1"
                  value={formData.price}
                  onChange={e => setFormData({ ...formData, price: e.target.value })}
                  className="w-full pl-12 pr-4 py-3 rounded-xl bg-slate-50 border border-slate-200 focus:bg-white focus:ring-2 focus:ring-primary/20 transition-all font-bold text-lg"
                  placeholder="7000"
                />
              </div>
              {hasQuantity && formData.price && (
                <p className="text-xs text-primary font-semibold">
                  = Rp {parseInt(formData.price || "0").toLocaleString("id-ID")} / barang
                </p>
              )}
            </div>

            {hasQuantity && (
              <div className="space-y-2">
                <label className="text-sm font-bold text-slate-700 flex items-center gap-2">
                  <Package size={15} className="text-slate-400" />
                  Stok Barang (Total Unit)
                </label>
                <input
                  required
                  type="number"
                  min="1"
                  max="9999"
                  value={formData.stock}
                  onChange={e => setFormData({ ...formData, stock: e.target.value })}
                  className="w-full px-4 py-3 rounded-xl bg-slate-50 border border-slate-200 focus:bg-white focus:ring-2 focus:ring-primary/20 transition-all font-bold text-lg"
                  placeholder="100"
                />
                {formData.stock && formData.price && (
                  <p className="text-xs text-emerald-600 font-semibold">
                    Total nilai: Rp {(parseInt(formData.stock || "0") * parseInt(formData.price || "0")).toLocaleString("id-ID")}
                  </p>
                )}
              </div>
            )}
          </div>

          {hasDefaultImage ? (
            <div className="space-y-2">
              <label className="text-sm font-bold text-slate-700 flex items-center gap-2">
                <ImageIcon size={16} className="text-slate-400" /> Gambar Kategori
              </label>
              <div className="flex items-center gap-4 p-4 rounded-xl bg-slate-50 border border-slate-200">
                <img
                  src={effectiveImageUrl}
                  alt={formData.category}
                  className="w-16 h-16 object-contain rounded-xl bg-white border border-slate-100 p-1"
                />
                <div>
                  <p className="font-semibold text-slate-700 text-sm">{formData.category}</p>
                  <p className="text-xs text-slate-400 mt-0.5">Gambar otomatis dari kategori ini</p>
                </div>
              </div>
            </div>
          ) : isImageRequired ? (
            <div className="space-y-3">
              <label className="text-sm font-bold text-slate-700 flex items-center gap-2">
                <Upload size={16} className="text-red-400" />
                Screenshot Akun
                <span className="text-red-500 font-bold text-xs ml-1">* Wajib min {MIN_IMAGES} gambar</span>
              </label>
              <div className="grid grid-cols-3 gap-3">
                {Array.from({ length: MAX_IMAGES }).map((_, i) => {
                  const previewUrl = previews[i];
                  const isUploading = uploadingIndex === i;
                  const isRequired = i < MIN_IMAGES;

                  if (previewUrl) {
                    return (
                      <div key={i} className="relative aspect-square rounded-xl overflow-hidden border-2 border-emerald-300 bg-slate-100 group">
                        <img src={previewUrl} className="w-full h-full object-cover" />
                        {isUploading && (
                          <div className="absolute inset-0 bg-black/30 flex items-center justify-center">
                            <Loader2 size={24} className="text-white animate-spin" />
                          </div>
                        )}
                        <button
                          type="button"
                          onClick={() => removeImage(i)}
                          className="absolute top-1.5 right-1.5 w-6 h-6 bg-red-500 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity shadow-lg"
                        >
                          <X size={14} />
                        </button>
                      </div>
                    );
                  }

                  if (i > previews.filter(Boolean).length) return (
                    <div key={i} className="aspect-square rounded-xl border-2 border-dashed border-slate-200 bg-slate-50 flex items-center justify-center opacity-40">
                      <Plus size={24} className="text-slate-300" />
                    </div>
                  );

                  return (
                    <label
                      key={i}
                      className={`aspect-square rounded-xl border-2 border-dashed cursor-pointer flex flex-col items-center justify-center gap-1 transition-all hover:border-primary hover:bg-primary/5 ${
                        isRequired ? "border-red-300 bg-red-50/50" : "border-slate-300 bg-slate-50"
                      } ${isUploading ? "pointer-events-none opacity-60" : ""}`}
                    >
                      {isUploading ? (
                        <Loader2 size={24} className="text-primary animate-spin" />
                      ) : (
                        <>
                          <Plus size={24} className={isRequired ? "text-red-400" : "text-slate-400"} />
                          <span className="text-[10px] font-bold text-slate-400">
                            {isRequired ? "Wajib" : "Opsional"}
                          </span>
                        </>
                      )}
                      <input
                        type="file"
                        accept="image/jpeg,image/png,image/gif,image/webp"
                        className="hidden"
                        onChange={e => {
                          const file = e.target.files?.[0];
                          if (file) handleImageUpload(file, i);
                          e.target.value = "";
                        }}
                      />
                    </label>
                  );
                })}
              </div>
              <p className="text-xs text-slate-400">
                Pastikan area sensitif seperti nickname, user ID, atau informasi pribadi lainnya sudah di-blur sebelum upload.
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              <label className="text-sm font-bold text-slate-700 flex items-center gap-2">
                <Upload size={16} className="text-slate-400" />
                URL Gambar
                <span className="text-slate-400 font-normal text-xs ml-1">(Opsional)</span>
              </label>
              <input
                type="url"
                value={formData.imageUrl}
                onChange={e => setFormData({ ...formData, imageUrl: e.target.value })}
                className="w-full px-4 py-3 rounded-xl bg-slate-50 border border-slate-200 transition-all focus:bg-white focus:ring-2 focus:ring-primary/20"
                placeholder="https://example.com/image.png"
              />
              {formData.imageUrl && (
                <img
                  src={formData.imageUrl}
                  alt="Preview"
                  className="mt-2 h-28 w-full object-contain rounded-xl bg-slate-100 border border-slate-200"
                  onError={e => { (e.target as HTMLImageElement).style.display = "none"; }}
                />
              )}
            </div>
          )}

          <div className="pt-6 border-t border-slate-100">
            <div className="mb-4">
              <p className="text-xs text-slate-500 mb-2 font-medium">Verifikasi keamanan sebelum membuat listing:</p>
              <TurnstileWidget
                onVerify={setCfToken}
                onExpire={() => setCfToken(null)}
                onError={() => setCfToken(null)}
              />
            </div>
            <div className="flex justify-end gap-4">
              <button
                type="button"
                onClick={() => setLocation('/market')}
                className="px-6 py-3 rounded-xl font-bold text-slate-600 hover:bg-slate-100 transition-colors"
              >
                Batal
              </button>
              <button
                type="submit"
                disabled={createMutation.isPending || !cfToken}
                className="px-8 py-3 rounded-xl bg-primary text-white font-bold shadow-lg shadow-primary/25 hover:-translate-y-0.5 transition-all disabled:opacity-50 disabled:transform-none"
              >
                {createMutation.isPending ? "Menyimpan..." : "Buat Listing"}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
