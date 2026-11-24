import { NextRequest, NextResponse } from "next/server";
import { billCatalogQuery, parseBillCatalog } from "@/lib/api-bill-catalog";
import release from "../../../../../../public/docs/business-api/release.json";

export async function GET(request: NextRequest) {
  const headers = { "Cache-Control": "no-store" };
  let query;
  try {
    query = billCatalogQuery(
      request.nextUrl.searchParams.get("amount") ?? undefined,
      request.nextUrl.searchParams.get("currency") ?? "USD",
      request.nextUrl.searchParams.get("countryCode") ?? "",
    );
  } catch {
    return NextResponse.json(
      { message: "Invalid preview amount, currency or country." },
      { status: 400, headers },
    );
  }
  try {
    const base = process.env.FONDEKA_API_BASE_URL || release.baseUrl;
    const url = `${base.replace(/\/$/, "")}/public/business-api/bill-products?${new URLSearchParams(query)}`;
    const upstream = await fetch(url, {
      cache: "no-store",
      redirect: "error",
      signal: AbortSignal.timeout(15000),
      headers: {
        Accept: "application/json",
        "Accept-Language": request.headers.get("accept-language") === "fr" ? "fr" : "en",
      },
    });
    if (upstream.ok)
      return NextResponse.json(parseBillCatalog(await upstream.json(), query, true), { headers });
    if (upstream.status === 400)
      return NextResponse.json(
        { message: "Invalid preview parameters." },
        { status: 400, headers },
      );
  } catch {
    // Recoverable discovery failure; never substitute sample prices for live data.
  }
  return NextResponse.json(
    { message: "Bill products are temporarily unavailable." },
    { status: 502, headers },
  );
}
