import { NextRequest, NextResponse } from "next/server";
import { getLuluWebhookSecret } from "@/lib/lulu";
import {
  handleLuluPrintJobWebhookPayload,
  verifyLuluWebhookSignature,
} from "@/lib/print-lulu-webhook";

export async function POST(req: NextRequest) {
  const secret = getLuluWebhookSecret();
  if (!secret) {
    return NextResponse.json(
      { error: "Lulu webhook secret not configured" },
      { status: 500 }
    );
  }

  let rawBody: string;
  try {
    rawBody = await req.text();
  } catch {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  const sig =
    req.headers.get("lulu-hmac-sha256") ??
    req.headers.get("Lulu-HMAC-SHA256");

  if (!verifyLuluWebhookSignature(rawBody, sig, secret)) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  const result = await handleLuluPrintJobWebhookPayload(rawBody);
  if (!result.ok) {
    console.warn("[Lulu webhook]", result.error, rawBody.slice(0, 200));
    return NextResponse.json({ error: result.error }, { status: 400 });
  }

  return NextResponse.json({ received: true });
}
