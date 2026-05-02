import { db } from "@workspace/db";
import { securityLogsTable, usersTable } from "@workspace/db/schema";
import { and, eq, gt } from "drizzle-orm";
import type { Request } from "express";

function getClientIp(req: Request): string {
  const forwarded = req.headers["x-forwarded-for"];
  if (typeof forwarded === "string") return forwarded.split(",")[0].trim();
  return req.socket?.remoteAddress || "unknown";
}

function parseDevice(ua: string | undefined): string {
  if (!ua) return "Unknown";
  if (/mobile/i.test(ua)) return "Mobile";
  if (/tablet|ipad/i.test(ua)) return "Tablet";
  return "Desktop";
}

async function getGeoInfo(ip: string): Promise<{ country: string | null; city: string | null }> {
  const skip = !ip || ip === "unknown" || ip === "127.0.0.1" || ip.startsWith("::") || ip.startsWith("10.") || ip.startsWith("192.168.");
  if (skip) return { country: null, city: null };
  try {
    const ctrl = new AbortController();
    const timeout = setTimeout(() => ctrl.abort(), 2000);
    const resp = await fetch(`http://ip-api.com/json/${ip}?fields=status,country,city`, {
      signal: ctrl.signal,
    });
    clearTimeout(timeout);
    if (!resp.ok) return { country: null, city: null };
    const data = await resp.json() as { status: string; country?: string; city?: string };
    if (data.status !== "success") return { country: null, city: null };
    return { country: data.country || null, city: data.city || null };
  } catch {
    return { country: null, city: null };
  }
}

export type LogType = "not_found" | "scanner" | "honeypot";

// Cek apakah path + IP sudah pernah dicatat dalam 24 jam terakhir
async function isDuplicate(path: string, ip: string): Promise<boolean> {
  try {
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const existing = await db.query.securityLogsTable.findFirst({
      where: and(
        eq(securityLogsTable.path, path),
        eq(securityLogsTable.ip, ip),
        gt(securityLogsTable.createdAt, since),
      ),
      columns: { id: true },
    });
    return existing != null;
  } catch {
    return false;
  }
}

export async function logSecurityEvent(
  req: Request,
  statusCode: number,
  logType: LogType = "not_found",
): Promise<void> {
  try {
    const ip = getClientIp(req);
    if (await isDuplicate(req.path, ip)) return;
    const device = parseDevice(req.headers["user-agent"]);

    let userId: number | null = null;
    let username: string | null = null;
    const token = req.headers["x-auth-token"] as string | undefined;
    if (token) {
      const user = await db.query.usersTable.findFirst({
        where: eq(usersTable.sessionToken, token),
        columns: { id: true, username: true },
      });
      if (user) { userId = user.id; username = user.username; }
    }

    const { country, city } = await getGeoInfo(ip);

    await db.insert(securityLogsTable).values({
      path: req.path,
      method: req.method,
      statusCode,
      logType,
      userId,
      username,
      ip,
      country,
      city,
      device,
      userAgent: (req.headers["user-agent"] as string | undefined) || null,
      referer: (req.headers["referer"] as string | undefined) || null,
    });
  } catch {
    // best-effort, jangan sampai error di sini blokir respons
  }
}

// Laporan dari frontend: IP dari req asli, path/UA/referer dari body
export async function logSecurityEventFromFrontend(
  req: Request,
  body: { path: string; logType: LogType; userAgent?: string; referer?: string; token?: string },
): Promise<void> {
  try {
    const ip = getClientIp(req);
    if (await isDuplicate(body.path, ip)) return;
    const device = parseDevice(body.userAgent);

    let userId: number | null = null;
    let username: string | null = null;
    if (body.token) {
      const user = await db.query.usersTable.findFirst({
        where: eq(usersTable.sessionToken, body.token),
        columns: { id: true, username: true },
      });
      if (user) { userId = user.id; username = user.username; }
    }

    const { country, city } = await getGeoInfo(ip);

    await db.insert(securityLogsTable).values({
      path: body.path,
      method: "GET",
      statusCode: 404,
      logType: body.logType,
      userId,
      username,
      ip,
      country,
      city,
      device,
      userAgent: body.userAgent || null,
      referer: body.referer || null,
    });
  } catch {
    // best-effort
  }
}
