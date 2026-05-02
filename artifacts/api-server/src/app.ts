import express, { type Express, type Request, type Response } from "express";
import cors from "cors";
import helmet from "helmet";
import cookieParser from "cookie-parser";
import pinoHttp from "pino-http";
import router from "./routes";
import { logger } from "./lib/logger";
import { blockScanners, honeypot, methodGuard, apiRateLimit } from "./middlewares/security";
import { logSecurityEvent } from "./lib/security-logger";
import { pool } from "@workspace/db";

const app: Express = express();

// ─── Trust proxy (Replit runs behind a reverse proxy) ────────────────────────
app.set("trust proxy", 1);

// ─── Remove X-Powered-By before anything else ────────────────────────────────
app.disable("x-powered-by");

// ─── Security headers via Helmet ──────────────────────────────────────────────
app.use(
  helmet({
    contentSecurityPolicy: false, // Managed by frontend
    crossOriginEmbedderPolicy: false,
    crossOriginResourcePolicy: { policy: "cross-origin" }, // Allow images to load from frontend domain
    hidePoweredBy: true,
    referrerPolicy: { policy: "no-referrer" },
    xssFilter: true,
    noSniff: true,
    frameguard: { action: "deny" },
    hsts: { maxAge: 31536000, includeSubDomains: true, preload: true },
  }),
);

// ─── CORS — support APP_URL (VPS), REPLIT_DEV_DOMAIN, dan localhost ───────────
const appOrigin = process.env.APP_URL ?? null;
const replitOrigin = process.env.REPLIT_DEV_DOMAIN
  ? `https://${process.env.REPLIT_DEV_DOMAIN}`
  : null;

app.use(
  cors({
    origin: (origin, cb) => {
      // No origin header (server-to-server, curl, etc.)
      if (!origin) return cb(null, true);
      // Localhost only in development
      if (process.env.NODE_ENV !== "production" && /^http:\/\/localhost(:\d+)?$/.test(origin)) return cb(null, true);
      // APP_URL — domain VPS produksi
      if (appOrigin && origin === appOrigin) return cb(null, true);
      // Replit dev domain (browser access via proxy)
      if (replitOrigin && origin.startsWith(replitOrigin)) return cb(null, true);
      cb(new Error("Not allowed by CORS"));
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "X-Auth-Token", "X-CF-Turnstile-Response", "X-File-Name"],
  }),
);

// ─── Cookie parser (for OAuth state) ─────────────────────────────────────────
app.use(cookieParser());

// ─── Body limits (prevent oversized payload attacks) ─────────────────────────
// Skip JSON parsing for file upload route (raw binary body)
app.use((req, res, next) => {
  if (req.path === "/storage/upload") return next();
  // Allow larger body for database import
  const limit = req.path === "/admin/database/import" ? "50mb" : "100kb";
  express.json({ limit })(req, res, next);
});
app.use((req, res, next) => {
  if (req.path === "/storage/upload") return next();
  express.urlencoded({ extended: true, limit: "100kb" })(req, res, next);
});

// ─── Request logger ───────────────────────────────────────────────────────────
app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return { id: req.id, method: req.method, url: req.url?.split("?")[0] };
      },
      res(res) {
        return { statusCode: res.statusCode };
      },
    },
  }),
);

// ─── Anti-scanner / bot protections ──────────────────────────────────────────
app.use(methodGuard);
app.use(honeypot);
app.use(blockScanners);

// ─── General API rate limit ───────────────────────────────────────────────────
app.use(apiRateLimit);

// ─── Main API routes ──────────────────────────────────────────────────────────
app.use(router);

// ─── Health check ─────────────────────────────────────────────────────────────
app.head("/health", (_req: Request, res: Response) => { res.sendStatus(200); });
app.get("/health", async (_req: Request, res: Response) => {
  const start = Date.now();
  try {
    const client = await pool.connect();
    await client.query("SELECT 1");
    client.release();
    res.json({
      status: "ok",
      db: "connected",
      latencyMs: Date.now() - start,
      uptime: Math.floor(process.uptime()),
    });
  } catch (err: any) {
    logger.error({ err }, "[Health] Database check failed");
    res.status(503).json({
      status: "degraded",
      db: "disconnected",
      uptime: Math.floor(process.uptime()),
    });
  }
});

// ─── Catch-all: return nothing for unknown paths (log as security event) ──────
app.use((req: Request, res: Response) => {
  res.status(404).end();
  // Catat di background, tidak blokir respons
  logSecurityEvent(req, 404).catch(() => {});
});

// ─── Global error handler ─────────────────────────────────────────────────────
app.use((err: any, _req: Request, res: Response, _next: any) => {
  logger.error({ err }, "Unhandled error");
  res.status(500).json({ error: "Internal Server Error" });
});

export default app;
