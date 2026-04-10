import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { isAdminEmail } from "@/lib/admin";
import {
  createLuluWebhook,
  isLuluConfigured,
  isLuluLiveMode,
  listLuluWebhooks,
  type LuluWebhookTopic,
} from "@/lib/lulu";

function ensureAdminEmail(email: string | null | undefined) {
  if (!email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!isAdminEmail(email)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  return null;
}

export async function GET() {
  const session = await auth();
  const err = ensureAdminEmail(session?.user?.email);
  if (err) return err;

  if (!isLuluConfigured()) {
    return NextResponse.json(
      { error: "Lulu is not configured in this environment" },
      { status: 503 }
    );
  }

  try {
    const webhooks = await listLuluWebhooks();
    return NextResponse.json({
      mode: isLuluLiveMode() ? "production" : "sandbox",
      webhooks,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed to load webhooks";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}

export async function POST(req: NextRequest) {
  const session = await auth();
  const err = ensureAdminEmail(session?.user?.email);
  if (err) return err;

  if (!isLuluConfigured()) {
    return NextResponse.json(
      { error: "Lulu is not configured in this environment" },
      { status: 503 }
    );
  }

  let body: { url?: string; topics?: LuluWebhookTopic[] } = {};
  try {
    body = (await req.json()) as { url?: string; topics?: LuluWebhookTopic[] };
  } catch {
    // body is optional
  }

  const fallbackBase = process.env.NEXT_PUBLIC_APP_URL || req.nextUrl.origin;
  const webhookUrl = (body.url || `${fallbackBase}/api/lulu/webhook`).trim();

  if (!/^https?:\/\//i.test(webhookUrl)) {
    return NextResponse.json(
      { error: "Webhook URL must be absolute (https://...)" },
      { status: 400 }
    );
  }

  try {
    const created = await createLuluWebhook({
      url: webhookUrl,
      topics: body.topics?.length ? body.topics : ["PRINT_JOB_STATUS_CHANGED"],
    });
    return NextResponse.json({
      mode: isLuluLiveMode() ? "production" : "sandbox",
      webhook: created,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed to register webhook";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}

