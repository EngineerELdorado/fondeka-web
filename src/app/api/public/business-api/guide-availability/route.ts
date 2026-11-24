import { NextResponse } from "next/server";
import { fetchPublicBillPaymentAvailability } from "@/lib/public-api-guide-availability";

export async function GET() {
  const headers = { "Cache-Control": "no-store" };
  try {
    const availability = await fetchPublicBillPaymentAvailability();
    return NextResponse.json(
      {
        billPaymentsApiReady: Object.values(availability).some((ready) => ready === true),
        billPaymentsApiAvailability: availability,
      },
      { headers },
    );
  } catch {
    return NextResponse.json(
      { message: "Guide availability is temporarily unavailable." },
      { status: 502, headers },
    );
  }
}
