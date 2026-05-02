import { Request, Response, NextFunction } from "express";
import rateLimit from "express-rate-limit";
import { logSecurityEvent } from "../lib/security-logger";

// ─── Blocked paths: common scanner / recon targets ───────────────────────────
const BLOCKED_PATTERNS = [
  /\.(env|git|svn|htaccess|htpasswd|DS_Store|bash_history|ssh|config|bak|old|orig|backup|swp|log|sql|dump|tar|gz|zip|rar|7z)$/i,
  /\.(json|xml|yaml|yml|toml|ini|cfg|conf|properties)$/i,
  /\.(php|asp|aspx|jsp|cgi|pl|py|rb|sh|bat|cmd)$/i,
  /\.(txt|md|csv|doc|docx|xls|xlsx|pdf)$/i,
  /\/(\.git|\.svn|\.hg|\.env|\.env\.\w+|node_modules|vendor|wp-admin|wp-login|phpmyadmin|admin\/config|server\/config|api\/config)/i,
  /\/(config|configuration|settings|setup|install|installer|setup\.php)/i,
  /\/(proc|etc\/passwd|etc\/shadow|windows\/system32)/i,
  /\/package\.json|\/package-lock\.json|\/yarn\.lock|\/pnpm-lock\.yaml/i,
  /\/tsconfig|\/vite\.config|\/webpack\.config|\/\.babelrc|\/jest\.config/i,
  /\/(robots\.txt|sitemap\.xml|crossdomain\.xml|clientaccesspolicy\.xml)/i,
  /\/(actuator|metrics|health\/details|swagger|api-docs|openapi)/i,
];

export function blockScanners(req: Request, res: Response, next: NextFunction) {
  const path = req.path.toLowerCase();

  for (const pattern of BLOCKED_PATTERNS) {
    if (pattern.test(path)) {
      res.status(404).end();
      logSecurityEvent(req, 404, "scanner").catch(() => {});
      return;
    }
  }

  next();
}

// ─── Rate Limiters ────────────────────────────────────────────────────────────

// Auth endpoints: very strict (5 attempts per 10 minutes per IP)
export const authRateLimit = rateLimit({
  windowMs: 10 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: false,
  message: { error: "Too Many Requests", message: "Terlalu banyak percobaan login. Coba lagi dalam 10 menit." },
  keyGenerator: (req) => {
    return (
      (req.headers["x-forwarded-for"] as string)?.split(",")[0]?.trim() ||
      req.socket?.remoteAddress ||
      "unknown"
    );
  },
});

// General API: 1200 requests per minute — keyed by token (if present) then IP
// Replit shared-proxy IP means multiple users/agents share one IP bucket
export const apiRateLimit = rateLimit({
  windowMs: 60 * 1000,
  max: 1200,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too Many Requests", message: "Terlalu banyak permintaan. Coba lagi sebentar lagi." },
  keyGenerator: (req) => {
    // Authenticated users get their own bucket via token, so one user can't block another
    const token = req.headers["x-auth-token"] as string;
    if (token) return `token:${token}`;
    return (
      (req.headers["x-forwarded-for"] as string)?.split(",")[0]?.trim() ||
      req.socket?.remoteAddress ||
      "unknown"
    );
  },
});

// Financial endpoints: strict (10 requests per minute per user)
export const financialRateLimit = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too Many Requests", message: "Terlalu banyak permintaan finansial. Coba lagi dalam 1 menit." },
  keyGenerator: (req) => {
    const token = req.headers["x-auth-token"] as string;
    if (token) return `financial:${token}`;
    return (
      (req.headers["x-forwarded-for"] as string)?.split(",")[0]?.trim() ||
      req.socket?.remoteAddress ||
      "unknown"
    );
  },
});

// Admin endpoints: 300 requests per minute, keyed by token (same as apiRateLimit)
// so each admin gets their own bucket and cannot exhaust others
export const adminRateLimit = rateLimit({
  windowMs: 60 * 1000,
  max: 300,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too Many Requests", message: "Terlalu banyak permintaan admin. Coba lagi dalam 1 menit." },
  keyGenerator: (req) => {
    const token = req.headers["x-auth-token"] as string;
    if (token) return `admin:token:${token}`;
    return (
      (req.headers["x-forwarded-for"] as string)?.split(",")[0]?.trim() ||
      req.socket?.remoteAddress ||
      "unknown-admin"
    );
  },
});

// ─── Method Guard ─────────────────────────────────────────────────────────────
const ALLOWED_METHODS = new Set(["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"]);

export function methodGuard(req: Request, res: Response, next: NextFunction) {
  if (!ALLOWED_METHODS.has(req.method)) {
    res.status(405).end();
    return;
  }
  next();
}

// ─── Fake honeypot paths — trap bots silently ─────────────────────────────────
const HONEYPOT_PATHS = new Set([
  "/admin", "/administrator", "/wp-admin", "/wp-login.php",
  "/phpmyadmin", "/pma", "/.env", "/.git/config",
  "/config.json", "/config.php", "/app/config",
  "/api/v1/users", "/api/v2/users", "/api/admin",
]);

export function honeypot(req: Request, res: Response, next: NextFunction) {
  if (HONEYPOT_PATHS.has(req.path)) {
    res.status(404).end();
    logSecurityEvent(req, 404, "honeypot").catch(() => {});
    return;
  }
  next();
}
