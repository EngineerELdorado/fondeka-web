import { NextRequest, NextResponse } from "next/server";
import { defaultCatalogCurrency } from "@/lib/api-catalog";
import release from "../../../../../../public/docs/business-api/release.json";

export async function GET(request: NextRequest) {
  const currency = (request.nextUrl.searchParams.get("currency") ?? defaultCatalogCurrency)
    .trim()
    .toUpperCase();
  if (!/^[A-Z]{3}$/.test(currency)) {
    return NextResponse.json(
      { message: "Use a three-letter fiat currency code." },
      { status: 400 },
    );
  }

  try {
    const base = process.env.FONDEKA_API_BASE_URL || release.baseUrl;
    const url = new URL(`${base.replace(/\/$/, "")}/public/business-api/payment-methods`);
    url.searchParams.set("currency", currency);
    const upstream = await fetch(url, {
      headers: { Accept: "application/json" },
      next: { revalidate: 60 },
      redirect: "error",
      signal: AbortSignal.timeout(8000),
    });
    if (upstream.ok) {
      return NextResponse.json(await upstream.json(), {
        headers: { "Cache-Control": "public, max-age=60" },
      });
    }
    if (upstream.status === 400)
      return NextResponse.json({ message: "Invalid fiat currency." }, { status: 400 });
  } catch {
    // Return the same recoverable error for unavailable or invalid upstream responses.
  }
  return NextResponse.json({ message: "Payment methods are unavailable." }, { status: 502 });
}
