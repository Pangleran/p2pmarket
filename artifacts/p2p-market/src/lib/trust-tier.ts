// ─── Trust Tier System ──────────────────────────────────────────────────────
// 5 tingkatan kepercayaan + tier khusus Owner

export const ADMIN_DISCORD_ID = "970041350865170462";

export type TrustTierLevel = "baru" | "pemula" | "aktif" | "terpercaya" | "top_seller" | "owner";

export interface TrustTier {
  level: TrustTierLevel;
  label: string;
  /** Tailwind text color class */
  color: string;
  /** Tailwind bg color class for badge */
  bgColor: string;
  /** Tailwind border color class */
  borderColor: string;
  /** Whether to show checkmark on shield icon */
  shieldCheck: boolean;
  /** Show crown icon (Top Seller & Owner) */
  crown: boolean;
  /** Is this the owner/admin tier? */
  isOwner: boolean;
}

const TIERS: Record<TrustTierLevel, Omit<TrustTier, "level">> = {
  baru: {
    label: "Baru",
    color: "text-slate-500",
    bgColor: "bg-slate-50",
    borderColor: "border-slate-200",
    shieldCheck: false,
    crown: false,
    isOwner: false,
  },
  pemula: {
    label: "Pemula",
    color: "text-blue-600",
    bgColor: "bg-blue-50",
    borderColor: "border-blue-200",
    shieldCheck: false,
    crown: false,
    isOwner: false,
  },
  aktif: {
    label: "Aktif",
    color: "text-green-600",
    bgColor: "bg-green-50",
    borderColor: "border-green-200",
    shieldCheck: true,
    crown: false,
    isOwner: false,
  },
  terpercaya: {
    label: "Terpercaya",
    color: "text-emerald-600",
    bgColor: "bg-emerald-50",
    borderColor: "border-emerald-200",
    shieldCheck: true,
    crown: false,
    isOwner: false,
  },
  top_seller: {
    label: "Top Seller",
    color: "text-amber-600",
    bgColor: "bg-amber-50",
    borderColor: "border-amber-200",
    shieldCheck: true,
    crown: true,
    isOwner: false,
  },
  owner: {
    label: "Owner",
    color: "text-transparent bg-clip-text bg-gradient-to-r from-purple-500 via-pink-500 to-amber-500",
    bgColor: "bg-gradient-to-r from-purple-50 via-pink-50 to-amber-50",
    borderColor: "border-purple-200",
    shieldCheck: true,
    crown: true,
    isOwner: true,
  },
};

/**
 * Menentukan trust tier berdasarkan jumlah trade, rating, dan isAdmin flag.
 *
 * Tier:
 * - Owner:       Admin/Owner (by isAdmin flag)
 * - Baru:        0 trade
 * - Pemula:      1–9 trade
 * - Aktif:       10–49 trade, rating ≥ 4.0
 * - Terpercaya:  50–99 trade, rating ≥ 4.5
 * - Top Seller:  100+ trade, rating ≥ 4.5
 */
export function getTrustTier(totalTrades: number, rating: number, isAdminOrDiscordId?: boolean | string): TrustTier {
  // Owner override — admin selalu dapat tier Owner
  const isOwner = typeof isAdminOrDiscordId === "boolean"
    ? isAdminOrDiscordId
    : isAdminOrDiscordId === ADMIN_DISCORD_ID;
  if (isOwner) {
    return { level: "owner", ...TIERS.owner };
  }

  let level: TrustTierLevel;

  if (totalTrades >= 100 && rating >= 4.5) {
    level = "top_seller";
  } else if (totalTrades >= 50 && rating >= 4.5) {
    level = "terpercaya";
  } else if (totalTrades >= 10 && rating >= 4.0) {
    level = "aktif";
  } else if (totalTrades >= 1) {
    level = "pemula";
  } else {
    level = "baru";
  }

  return { level, ...TIERS[level] };
}
