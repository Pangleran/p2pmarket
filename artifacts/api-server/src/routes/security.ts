import { Router } from "express";
import { logSecurityEventFromFrontend, type LogType } from "../lib/security-logger";
import rateLimit from "express-rate-limit";

const router = Router();

const VALID_LOG_TYPES = new Set<LogType>(["not_found", "scanner", "honeypot"]);

// Rate limit lebih ketat agar tidak bisa di-abuse
const reportRateLimit = rateLimit({
  windowMs: 60 * 1000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) =>
    (req.headers["x-forwarded-for"] as string)?.split(",")[0]?.trim() ||
    req.socket?.remoteAddress ||
    "unknown",
});

// POST /api/security/report — public, dipanggil oleh frontend saat 404
router.post("/security/report", reportRateLimit, (req, res) => {
  const { path, logType, userAgent, referer, token } = req.body ?? {};

  if (typeof path !== "string" || !path.startsWith("/")) {
    res.status(400).json({ error: "path tidak valid" });
    return;
  }

  const resolvedType: LogType = VALID_LOG_TYPES.has(logType) ? logType : "not_found";

  // Fire-and-forget: jangan tunggu geo lookup
  logSecurityEventFromFrontend(req, {
    path,
    logType: resolvedType,
    userAgent: typeof userAgent === "string" ? userAgent : undefined,
    referer: typeof referer === "string" ? referer : undefined,
    token: typeof token === "string" ? token : undefined,
  }).catch(() => {});

  res.status(204).end();
});

export default router;
