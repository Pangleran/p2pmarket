import { useEffect, useRef } from "react";
import { useLocation } from "wouter";
import { AlertCircle } from "lucide-react";
import { useAuthStore } from "@/lib/store";

// Paths yang secara khusus menjebak bot (honeypot)
const HONEYPOT_PATHS = new Set([
  "/admin", "/administrator", "/wp-admin", "/wp-login.php",
  "/phpmyadmin", "/pma", "/.env", "/.git/config",
  "/config.json", "/config.php", "/app/config",
  "/api/v1/users", "/api/v2/users", "/api/admin",
]);

// Pola yang khas digunakan scanner bot
const SCANNER_PATTERNS = [
  /\.(env|git|htaccess|htpasswd|bash_history|config|bak|sql|dump|tar|gz|zip)$/i,
  /\.(php|asp|aspx|jsp|cgi|pl|py|rb|sh|bat)$/i,
  /\.(json|xml|yaml|yml|toml|ini|cfg|conf)$/i,
  /\/(\.git|\.svn|\.hg|node_modules|vendor|wp-admin|wp-login|phpmyadmin)/i,
  /\/(config|setup|install|installer|setup\.php)/i,
  /\/(proc|etc\/passwd|windows\/system32)/i,
  /\/(actuator|metrics|swagger|api-docs|openapi)/i,
];

function classifyPath(path: string): "honeypot" | "scanner" | "not_found" {
  if (HONEYPOT_PATHS.has(path)) return "honeypot";
  const lower = path.toLowerCase();
  for (const pattern of SCANNER_PATTERNS) {
    if (pattern.test(lower)) return "scanner";
  }
  return "not_found";
}

export default function NotFound() {
  const [location] = useLocation();
  const { token } = useAuthStore();
  const reported = useRef(false);

  useEffect(() => {
    if (reported.current) return;
    reported.current = true;

    const logType = classifyPath(location);

    fetch(`${import.meta.env.VITE_API_URL}/security/report`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        path: location,
        logType,
        userAgent: navigator.userAgent,
        referer: document.referrer || undefined,
        token: token || undefined,
      }),
    }).catch(() => {});
  }, [location, token]);

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-slate-50 dark:bg-slate-950">
      <div className="w-full max-w-md mx-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl p-8 shadow-sm">
        <div className="flex mb-4 gap-3 items-center">
          <AlertCircle className="h-8 w-8 text-red-500 flex-shrink-0" />
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">404 — Halaman Tidak Ditemukan</h1>
        </div>
        <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
          Halaman{" "}
          <code className="bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 px-1.5 py-0.5 rounded text-xs font-mono">
            {location}
          </code>{" "}
          tidak ada.
        </p>
      </div>
    </div>
  );
}
