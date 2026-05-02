import crypto from "crypto";

const BASE_URL = "https://wijayapay.com/api";

function getCredentials() {
  const apiKey = process.env.WIJAYAPAY_API_KEY;
  const codeMerchant = process.env.WIJAYAPAY_CODE_MERCHANT;
  if (!apiKey) throw new Error("WIJAYAPAY_API_KEY tidak dikonfigurasi");
  if (!codeMerchant) throw new Error("WIJAYAPAY_CODE_MERCHANT tidak dikonfigurasi");
  return { apiKey, codeMerchant };
}

function makeSignature(codeMerchant: string, apiKey: string, refId: string): string {
  return crypto.createHash("md5").update(`${codeMerchant}${apiKey}${refId}`).digest("hex");
}

export interface CreateInvoiceParams {
  refId: string;
  nominal: number;
  codePayment: string;
}

export interface InvoiceData {
  refId: string;
  paymentUrl: string;
  qrisUrl?: string;
  vaNumber?: string;
  paymentCode?: string;
  nominal: number;
  status: string;
  expiredAt?: string;
}

export async function createInvoice(params: CreateInvoiceParams): Promise<InvoiceData> {
  const { apiKey, codeMerchant } = getCredentials();
  const signature = makeSignature(codeMerchant, apiKey, params.refId);

  const body = new URLSearchParams({
    code_merchant: codeMerchant,
    api_key: apiKey,
    ref_id: params.refId,
    code_payment: params.codePayment,
    nominal: String(params.nominal),
  });

  const res = await fetch(`${BASE_URL}/transaction/create`, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      "X-Signature": signature,
    },
    body: body.toString(),
  });

  const text = await res.text();
  if (!res.ok) {
    throw new Error(`WijayaPay error ${res.status}: ${text}`);
  }

  let json: any;
  try { json = JSON.parse(text); } catch { throw new Error(`WijayaPay response bukan JSON: ${text}`); }

  if (!json.success) {
    throw new Error(json.message || "Gagal membuat transaksi WijayaPay");
  }

  const d = json.data ?? json;
  return {
    refId: params.refId,
    paymentUrl: d.payment_url ?? d.url ?? "",
    qrisUrl: d.qr_image ?? d.qr_url ?? d.qris_url ?? d.qr_code ?? undefined,
    vaNumber: d.nomor_va ?? d.virtual_account ?? d.va_number ?? undefined,
    paymentCode: d.nomor_pembayaran ?? d.pay_code ?? d.payment_code ?? undefined,
    nominal: params.nominal,
    status: d.status ?? "PENDING",
    expiredAt: d.expired ?? d.expired_at ?? d.expired_time ?? undefined,
  };
}

export async function getInvoiceStatus(refId: string): Promise<"PENDING" | "PAID" | "EXPIRED" | "FAILED"> {
  const { apiKey, codeMerchant } = getCredentials();
  const url = `${BASE_URL}/get-status?code_merchant=${encodeURIComponent(codeMerchant)}&api_key=${encodeURIComponent(apiKey)}&ref_id=${encodeURIComponent(refId)}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`WijayaPay status check error ${res.status}`);
  const json = await res.json() as any;
  const status = (json.status_pembayaran ?? json.data?.status ?? json.status ?? "PENDING").toUpperCase();
  if (status === "PAID" || status === "SUCCESS" || status === "SETTLEMENT") return "PAID";
  if (status === "EXPIRED" || status === "CANCEL" || status === "CANCELLED") return "EXPIRED";
  if (status === "FAILED" || status === "FAILURE") return "FAILED";
  return "PENDING";
}

export function verifyWebhookSignature(payload: any): boolean {
  const secret = process.env.WIJAYAPAY_WEBHOOK_SECRET;
  if (!secret) return false;
  try {
    const { apiKey, codeMerchant } = getCredentials();
    const refId = payload.ref_id ?? payload.merchant_ref ?? "";
    const expected = makeSignature(codeMerchant, apiKey, refId);
    const incoming = payload.signature ?? "";
    return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(incoming));
  } catch { return false; }
}

export function isWijayaPayConfigured(): boolean {
  return !!(process.env.WIJAYAPAY_API_KEY && process.env.WIJAYAPAY_CODE_MERCHANT);
}
