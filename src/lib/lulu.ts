/**
 * Lulu Print API client (use from server / API routes only).
 * Sandbox: api.sandbox.lulu.com + sandbox client credentials.
 * Production: api.lulu.com + live credentials.
 * @see https://api.lulu.com/api-docs/openapi-specs/openapi_public.yml
 */

/** Match Stripe: production on Vercel production or LULU_USE_LIVE=true */
export function isLuluLiveMode(): boolean {
  if (process.env.VERCEL_ENV === "production") return true;
  if (process.env.LULU_USE_LIVE === "true") return true;
  return false;
}

export function getLuluApiBaseUrl(): string {
  return isLuluLiveMode()
    ? "https://api.lulu.com"
    : "https://api.sandbox.lulu.com";
}

function getLuluClientKey(): string | undefined {
  return isLuluLiveMode()
    ? process.env.LULU_CLIENT_KEY_LIVE ?? process.env.LULU_CLIENT_KEY
    : process.env.LULU_CLIENT_KEY;
}

function getLuluClientSecret(): string | undefined {
  return isLuluLiveMode()
    ? process.env.LULU_CLIENT_SECRET_LIVE ?? process.env.LULU_CLIENT_SECRET
    : process.env.LULU_CLIENT_SECRET;
}

/** Webhook HMAC secret from Lulu webhook configuration (per environment). */
export function getLuluWebhookSecret(): string | undefined {
  return isLuluLiveMode()
    ? process.env.LULU_WEBHOOK_SECRET_LIVE ?? process.env.LULU_WEBHOOK_SECRET
    : process.env.LULU_WEBHOOK_SECRET;
}

export function isLuluConfigured(): boolean {
  return Boolean(getLuluClientKey() && getLuluClientSecret());
}

type TokenState = {
  accessToken: string;
  expiresAtMs: number;
};

let cachedToken: TokenState | null = null;

async function fetchAccessToken(): Promise<string> {
  const key = getLuluClientKey();
  const secret = getLuluClientSecret();
  if (!key || !secret) {
    throw new Error("Lulu API credentials are not configured");
  }

  const now = Date.now();
  if (cachedToken && cachedToken.expiresAtMs > now + 30_000) {
    return cachedToken.accessToken;
  }

  const base = getLuluApiBaseUrl();
  const auth = Buffer.from(`${key}:${secret}`, "utf8").toString("base64");
  const res = await fetch(
    `${base}/auth/realms/glasstree/protocol/openid-connect/token`,
    {
      method: "POST",
      headers: {
        Authorization: `Basic ${auth}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: "grant_type=client_credentials",
    }
  );

  if (!res.ok) {
    const t = await res.text();
    throw new Error(`Lulu token request failed: ${res.status} ${t}`);
  }

  const data = (await res.json()) as {
    access_token?: string;
    expires_in?: number;
  };
  if (!data.access_token) {
    throw new Error("Lulu token response missing access_token");
  }

  const expiresInSec = typeof data.expires_in === "number" ? data.expires_in : 3600;
  cachedToken = {
    accessToken: data.access_token,
    expiresAtMs: now + expiresInSec * 1000,
  };
  return cachedToken.accessToken;
}

async function luluFetch<T>(
  path: string,
  init: RequestInit & { method?: string }
): Promise<T> {
  const base = getLuluApiBaseUrl();
  const token = await fetchAccessToken();
  const url = path.startsWith("http") ? path : `${base}${path.startsWith("/") ? "" : "/"}${path}`;
  const res = await fetch(url, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      ...(init.headers as Record<string, string>),
    },
  });

  const text = await res.text();
  if (!res.ok) {
    throw new Error(`Lulu API ${init.method ?? "GET"} ${path}: ${res.status} ${text}`);
  }
  if (!text) return {} as T;
  try {
    return JSON.parse(text) as T;
  } catch {
    return {} as T;
  }
}

export type LuluShippingAddress = {
  name: string;
  street1: string;
  street2?: string;
  city: string;
  postcode: string;
  country_code: string;
  state_code?: string;
  phone_number: string;
  /** Required for carriers / Lulu validation in practice */
  email?: string;
  is_business?: boolean;
  title?: "MR" | "MISS" | "MRS" | "MS" | "DR";
  organization?: string;
};

export type LuluShippingOption =
  | "MAIL"
  | "PRIORITY_MAIL"
  | "GROUND_HD"
  | "GROUND_BUS"
  | "GROUND"
  | "EXPEDITED"
  | "EXPRESS";

export type LuluCostCalculationRequest = {
  line_items: Array<{
    page_count: number;
    pod_package_id: string;
    quantity: number;
  }>;
  shipping_address: LuluShippingAddress;
  shipping_option: LuluShippingOption;
};

/** Response shape varies; we read totals from known fields. */
export type LuluCostCalculationResponse = {
  currency?: string;
  total_cost_incl_tax?: string;
  total_cost_excl_tax?: string;
  total_tax?: string;
  line_item_costs?: unknown[];
  shipping_cost?: Record<string, string>;
  fulfillment_cost?: Record<string, string>;
  shipping_address?: LuluShippingAddress & { warnings?: unknown[] };
};

export async function createPrintJobCostCalculation(
  body: LuluCostCalculationRequest
): Promise<LuluCostCalculationResponse> {
  console.log(
    "[Lulu] print-job-cost-calculations payload:",
    JSON.stringify(body, null, 2)
  );
  return luluFetch<LuluCostCalculationResponse>("/print-job-cost-calculations/", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export type LuluPrintableNormalization = {
  cover: { source_url: string };
  interior: { source_url: string };
  pod_package_id: string;
};

export type LuluPrintJobCreateRequest = {
  contact_email: string;
  external_id?: string;
  line_items: Array<{
    external_id?: string;
    printable_normalization: LuluPrintableNormalization;
    quantity: number;
    title: string;
  }>;
  production_delay?: number;
  shipping_address: LuluShippingAddress;
  shipping_level: LuluShippingOption;
};

export type LuluPrintJob = {
  id?: number;
  external_id?: string;
  status?: { name?: string; message?: string };
  shipping_level?: string;
  line_items?: unknown[];
};

export async function createPrintJob(
  body: LuluPrintJobCreateRequest
): Promise<LuluPrintJob> {
  return luluFetch<LuluPrintJob>("/print-jobs/", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export async function getPrintJob(id: number | string): Promise<LuluPrintJob> {
  return luluFetch<LuluPrintJob>(`/print-jobs/${id}/`, { method: "GET" });
}

export type LuluCoverDimensionsResponse = {
  width: string;
  height: string;
  unit: "pt" | "mm" | "inch";
};

export async function getCoverDimensions(params: {
  pod_package_id: string;
  interior_page_count: number;
  unit?: "pt" | "mm" | "inch";
}): Promise<LuluCoverDimensionsResponse> {
  return luluFetch<LuluCoverDimensionsResponse>("/cover-dimensions/", {
    method: "POST",
    body: JSON.stringify({
      pod_package_id: params.pod_package_id,
      interior_page_count: params.interior_page_count,
      ...(params.unit ? { unit: params.unit } : {}),
    }),
  });
}

export type LuluWebhookTopic = "PRINT_JOB_STATUS_CHANGED";

export type LuluWebhook = {
  id: string;
  is_active: boolean;
  topics: LuluWebhookTopic[];
  url: string;
};

type LuluWebhookListResponse = {
  count?: number;
  next?: string | null;
  previous?: string | null;
  results?: LuluWebhook[];
};

export async function listLuluWebhooks(): Promise<LuluWebhook[]> {
  const res = await luluFetch<LuluWebhookListResponse | LuluWebhook[]>(
    "/webhooks/",
    { method: "GET" }
  );
  if (Array.isArray(res)) return res;
  return Array.isArray(res.results) ? res.results : [];
}

export async function createLuluWebhook(params: {
  url: string;
  topics?: LuluWebhookTopic[];
}): Promise<LuluWebhook> {
  return luluFetch<LuluWebhook>("/webhooks/", {
    method: "POST",
    body: JSON.stringify({
      url: params.url,
      topics: params.topics ?? ["PRINT_JOB_STATUS_CHANGED"],
    }),
  });
}
