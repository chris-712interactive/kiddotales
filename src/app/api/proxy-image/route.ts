import { NextRequest, NextResponse } from "next/server";

/**
 * Proxies external images for PDF generation.
 * react-pdf cannot fetch cross-origin images in the browser (CORS).
 * This route fetches server-side and returns the image.
 */
export async function GET(request: NextRequest) {
  const url = request.nextUrl.searchParams.get("url");
  if (!url) {
    return NextResponse.json({ error: "Missing url param" }, { status: 400 });
  }

  try {
    const parsed = new URL(url);
    const allowed =
      parsed.hostname.endsWith("replicate.delivery") ||
      parsed.hostname.endsWith("replicate.com");
    if (!allowed) {
      return NextResponse.json({ error: "URL not allowed" }, { status: 403 });
    }
  } catch {
    return NextResponse.json({ error: "Invalid url" }, { status: 400 });
  }

  try {
    const res = await fetch(url, {
      headers: { "User-Agent": "KiddoTales/1.0" },
    });
    if (!res.ok) throw new Error(`Fetch failed: ${res.status}`);
    const blob = await res.blob();
    const contentType = res.headers.get("content-type") || "image/png";
    return new NextResponse(blob, {
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "public, max-age=86400",
      },
    });
  } catch (err) {
    console.error("Proxy image error:", err);
    return NextResponse.json({ error: "Failed to fetch image" }, { status: 502 });
  }
}
