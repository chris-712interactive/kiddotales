import { NextResponse } from "next/server";
import { getStripe } from "@/lib/stripe";

/** Health check endpoint for load balancers and monitoring. */
export async function GET() {
  const checks: Record<string, boolean> = {
    app: true,
    openai: !!process.env.OPENAI_API_KEY,
    replicate: !!process.env.REPLICATE_API_TOKEN,
    supabase: !!(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY),
    stripe: !!getStripe(),
  };

  const healthy = checks.app;
  const status = healthy ? 200 : 503;

  return NextResponse.json(
    {
      status: healthy ? "ok" : "degraded",
      checks,
      timestamp: new Date().toISOString(),
    },
    { status }
  );
}
