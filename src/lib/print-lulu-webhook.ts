import { createHmac, timingSafeEqual } from "crypto";
import { getPrintOrderById, updatePrintOrder } from "./print-db";

/** Verify Lulu `Lulu-HMAC-SHA256` header (hex or base64 digest). */
export function verifyLuluWebhookSignature(
  rawBody: string,
  headerValue: string | null,
  secret: string
): boolean {
  if (!headerValue || !secret) return false;
  const trimmed = headerValue.trim();

  const hexDigest = createHmac("sha256", secret)
    .update(rawBody, "utf8")
    .digest("hex");
  try {
    if (
      timingSafeEqual(
        Buffer.from(hexDigest, "hex"),
        Buffer.from(trimmed.toLowerCase(), "hex")
      )
    ) {
      return true;
    }
  } catch {
    /* header may not be hex */
  }

  if (hexDigest.toLowerCase() === trimmed.toLowerCase()) {
    return true;
  }

  const b64Digest = createHmac("sha256", secret)
    .update(rawBody, "utf8")
    .digest("base64");
  if (b64Digest === trimmed) return true;

  return false;
}

function mapLuluStatusName(name: string | undefined): string | null {
  if (!name) return null;
  switch (name) {
    case "UNPAID":
    case "PAYMENT_IN_PROGRESS":
      return "lulu_unpaid";
    case "PRODUCTION_DELAYED":
    case "PRODUCTION_READY":
    case "IN_PRODUCTION":
    case "NORMALIZING":
    case "NORMALIZED":
    case "CREATED":
      return "lulu_in_production";
    case "SHIPPED":
      return "shipped";
    case "DELIVERED":
      return "delivered";
    case "REJECTED":
    case "ERROR":
      return "failed";
    case "CANCELED":
      return "cancelled";
    default:
      return null;
  }
}

type LuluWebhookJob = {
  id?: number;
  external_id?: string;
  status?: { name?: string; message?: string };
  line_items?: Array<{
    tracking_id?: string;
    tracking_urls?: string[];
  }>;
};

export async function handleLuluPrintJobWebhookPayload(
  rawBody: string
): Promise<{ ok: boolean; error?: string }> {
  let job: LuluWebhookJob;
  try {
    job = JSON.parse(rawBody) as LuluWebhookJob;
  } catch {
    return { ok: false, error: "Invalid JSON" };
  }

  const externalId = job.external_id;
  if (!externalId) {
    return { ok: false, error: "Missing external_id" };
  }

  const order = await getPrintOrderById(externalId);
  if (!order) {
    return { ok: false, error: "Order not found" };
  }

  const statusName = job.status?.name;
  const mapped = mapLuluStatusName(statusName);
  const luluJobId = job.id != null ? String(job.id) : order.luluPrintJobId;

  const trackingList =
    job.line_items?.flatMap((li) => li.tracking_urls ?? []) ?? [];
  const trackingPayload =
    trackingList.length > 0 ? { trackingUrls: trackingList } : undefined;

  const patch: Parameters<typeof updatePrintOrder>[1] = {
    luluPrintJobId: luluJobId ?? undefined,
    luluJobStatus: statusName ?? undefined,
    trackingUrls: trackingPayload ?? undefined,
  };

  if (mapped) {
    patch.status = mapped;
  }

  if (statusName === "REJECTED" || statusName === "ERROR") {
    patch.errorMessage = job.status?.message ?? statusName;
  }

  await updatePrintOrder(order.id, patch);
  return { ok: true };
}
