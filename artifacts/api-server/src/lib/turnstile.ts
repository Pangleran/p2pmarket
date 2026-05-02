const TURNSTILE_SECRET = process.env.TURNSTILE_SECRET_KEY!;
const TURNSTILE_VERIFY_URL = "https://challenges.cloudflare.com/turnstile/v0/siteverify";

export async function verifyTurnstile(token: string | string[] | undefined, ip?: string): Promise<{ success: boolean; error?: string }> {
  if (!token) {
    return { success: false, error: "Verifikasi Turnstile diperlukan" };
  }
  const tokenStr = Array.isArray(token) ? token[0] : token;

  if (!TURNSTILE_SECRET) {
    console.warn("[Turnstile] TURNSTILE_SECRET_KEY tidak diset — verifikasi gagal (fail-closed)");
    return { success: false, error: "Turnstile not configured" };
  }

  try {
    const body = new URLSearchParams({
      secret: TURNSTILE_SECRET,
      response: tokenStr,
      ...(ip ? { remoteip: ip } : {}),
    });

    const res = await fetch(TURNSTILE_VERIFY_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body,
    });

    const data = await res.json() as { success: boolean; "error-codes"?: string[] };

    if (!data.success) {
      const codes = data["error-codes"]?.join(", ") ?? "unknown";
      return { success: false, error: `Verifikasi bot gagal (${codes})` };
    }

    return { success: true };
  } catch (err: any) {
    console.error("[Turnstile] Verification error:", err.message);
    return { success: false, error: "Gagal menghubungi server verifikasi" };
  }
}

export function getClientIpFromRequest(req: any): string {
  return (
    (req.headers["x-forwarded-for"] as string)?.split(",")[0]?.trim() ||
    req.socket?.remoteAddress ||
    "unknown"
  );
}
