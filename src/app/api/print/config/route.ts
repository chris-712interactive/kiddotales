import { NextResponse } from "next/server";
import { getPrintProductConfig } from "@/lib/print-db";

/** Public: whether print ordering is enabled (no secrets). */
export async function GET() {
  try {
    const config = await getPrintProductConfig();
    return NextResponse.json({
      enabled: Boolean(config?.printsEnabled),
      defaultShippingOption: config?.defaultShippingOption ?? "MAIL",
      allowedShippingOptions: config?.allowedShippingOptions ?? [],
    });
  } catch {
    return NextResponse.json({ enabled: false, allowedShippingOptions: [] });
  }
}
