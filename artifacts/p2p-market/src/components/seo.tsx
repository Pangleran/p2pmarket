import { Helmet } from "react-helmet-async";

interface SEOProps {
  title?: string;
  description?: string;
  path?: string;
  image?: string;
  noindex?: boolean;
}

const SITE_NAME = "P2PMarket";
const BASE_URL = "https://p2pmarket.web.id";
const DEFAULT_DESCRIPTION = "Marketplace jual beli item game terpercaya. Trading dengan sistem escrow otomatis. Aman, cepat, tanpa tipu-tipu.";
const DEFAULT_IMAGE = `${BASE_URL}/opengraph.jpg`;

export function SEO({ title, description, path = "/", image, noindex }: SEOProps) {
  const fullTitle = title ? `${title} — ${SITE_NAME}` : `${SITE_NAME} — Jual Beli Item Game Aman & Terpercaya`;
  const desc = description || DEFAULT_DESCRIPTION;
  const url = `${BASE_URL}${path}`;
  const img = image || DEFAULT_IMAGE;

  return (
    <Helmet>
      <title>{fullTitle}</title>
      <meta name="description" content={desc} />
      <link rel="canonical" href={url} />
      {noindex && <meta name="robots" content="noindex, nofollow" />}

      {/* Open Graph */}
      <meta property="og:title" content={fullTitle} />
      <meta property="og:description" content={desc} />
      <meta property="og:url" content={url} />
      <meta property="og:image" content={img} />

      {/* Twitter Card */}
      <meta name="twitter:title" content={fullTitle} />
      <meta name="twitter:description" content={desc} />
      <meta name="twitter:image" content={img} />
    </Helmet>
  );
}
