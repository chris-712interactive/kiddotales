import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { isAdminEmail } from "@/lib/admin";
import {
  getPrintProductConfig,
  updatePrintProductConfig,
} from "@/lib/print-db";
import type { LuluShippingOption } from "@/lib/lulu";

export async function GET() {
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!isAdminEmail(session.user.email)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const config = await getPrintProductConfig();
  if (!config) {
    return NextResponse.json({ error: "Config not found" }, { status: 404 });
  }

  return NextResponse.json({
    id: config.id,
    printsEnabled: config.printsEnabled,
    defaultPodPackageId: config.defaultPodPackageId,
    contactEmail: config.contactEmail,
    defaultShippingOption: config.defaultShippingOption,
    allowedShippingOptions: config.allowedShippingOptions,
  });
}

export async function PATCH(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!isAdminEmail(session.user.email)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const ok = await updatePrintProductConfig({
    printsEnabled:
      typeof body.printsEnabled === "boolean"
        ? body.printsEnabled
        : undefined,
    defaultPodPackageId:
      typeof body.defaultPodPackageId === "string"
        ? body.defaultPodPackageId.trim()
        : undefined,
    contactEmail:
      body.contactEmail === null
        ? null
        : typeof body.contactEmail === "string"
          ? body.contactEmail.trim() || null
          : undefined,
    defaultShippingOption:
      typeof body.defaultShippingOption === "string"
        ? (body.defaultShippingOption as LuluShippingOption)
        : undefined,
    allowedShippingOptions: Array.isArray(body.allowedShippingOptions)
      ? (body.allowedShippingOptions as string[]).filter(
          (s) => typeof s === "string"
        ) as LuluShippingOption[]
      : undefined,
  });

  if (!ok) {
    return NextResponse.json({ error: "Update failed" }, { status: 500 });
  }

  const config = await getPrintProductConfig();
  return NextResponse.json(config);
}
