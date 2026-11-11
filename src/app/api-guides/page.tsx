import type { Metadata } from "next";
import { PublicApiGuides } from "@/components/public-api-guides";
import release from "../../../public/docs/business-api/release.json";

export const metadata: Metadata = {
  title: "API guides",
  description:
    "Explore the Fondeka Business API, with interactive integration guides and sandbox examples.",
  alternates: { canonical: "https://www.fondeka.com/docs" },
};

async function publicBillPaymentsReady() {
  try {
    const base = process.env.FONDEKA_API_BASE_URL || release.baseUrl;
    const response = await fetch(
      `${base.replace(/\/$/, "")}/public/business-api/guide-availability`,
      {
        next: { revalidate: 60 },
        signal: AbortSignal.timeout(2000),
      },
    );
    if (!response.ok) return false;
    const status = await response.json();
    return status?.billPaymentsApiReady === true;
  } catch {
    return false;
  }
}

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ embed?: string }>;
}) {
  const [{ embed }, billPaymentsApiReady] = await Promise.all([
    searchParams,
    publicBillPaymentsReady(),
  ]);
  return <PublicApiGuides embedded={embed === "1"} billPaymentsApiReady={billPaymentsApiReady} />;
}
