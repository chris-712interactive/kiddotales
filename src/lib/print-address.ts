import type { LuluShippingAddress, LuluShippingOption } from "./lulu";

export const LULU_SHIPPING_OPTIONS: LuluShippingOption[] = [
  "MAIL",
  "PRIORITY_MAIL",
  "GROUND_HD",
  "GROUND_BUS",
  "GROUND",
  "EXPEDITED",
  "EXPRESS",
];

export function parseShippingOption(
  raw: unknown
): LuluShippingOption | null {
  if (typeof raw !== "string") return null;
  return LULU_SHIPPING_OPTIONS.includes(raw as LuluShippingOption)
    ? (raw as LuluShippingOption)
    : null;
}

/** Build Lulu shipping_address from client JSON. */
export function parseShippingAddress(raw: unknown): LuluShippingAddress | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const name = String(o.name ?? "").trim();
  const street1 = String(o.street1 ?? "").trim();
  const city = String(o.city ?? "").trim();
  const postcode = String(o.postcode ?? "").trim();
  const country_code = String(o.country_code ?? "")
    .trim()
    .toUpperCase()
    .slice(0, 2);
  const phone_number = String(o.phone_number ?? "").trim();
  const email = String(o.email ?? "").trim();

  if (!name || !street1 || !city || !postcode || country_code.length !== 2) {
    return null;
  }
  if (!phone_number || phone_number.length < 8) {
    return null;
  }
  if (!email || !email.includes("@")) {
    return null;
  }

  const state_code = o.state_code != null ? String(o.state_code).trim() : "";
  const street2 = o.street2 != null ? String(o.street2).trim() : "";

  return {
    name,
    street1,
    ...(street2 ? { street2 } : {}),
    city,
    postcode,
    country_code,
    ...(state_code ? { state_code } : {}),
    phone_number,
    email,
    ...(o.is_business === true ? { is_business: true } : {}),
  };
}
