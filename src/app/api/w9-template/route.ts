import { NextResponse } from "next/server";

const IRS_W9_URL = "https://www.irs.gov/pub/irs-pdf/fw9.pdf";

export async function GET() {
  try {
    const res = await fetch(IRS_W9_URL, {
      headers: {
        "User-Agent": "KiddoTales/1.0 (W-9 template fetch)",
        Accept: "application/pdf",
      },
      next: { revalidate: 86400 }, // cache 24h
    });
    if (!res.ok) {
      return NextResponse.json(
        { error: "Could not fetch W-9 template" },
        { status: 502 }
      );
    }
    const buf = await res.arrayBuffer();
    return new NextResponse(buf, {
      headers: {
        "Content-Type": "application/pdf",
        "Cache-Control": "public, max-age=86400, s-maxage=86400",
      },
    });
  } catch (e) {
    console.error("W-9 template fetch error:", e);
    return NextResponse.json(
      { error: "Could not fetch W-9 template" },
      { status: 502 }
    );
  }
}
