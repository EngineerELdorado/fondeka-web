import type { Metadata } from "next";
import { PublicApiGuides } from "@/components/public-api-guides";
import release from "../../../public/docs/business-api/release.json";
import { normalizeBillPaymentAvailability } from "@/lib/api-guide-availability";

const guidesUrl = "https://web.fondeka.com/api-guides";

export async function generateMetadata({
  searchParams,
}: {
  searchParams: Promise<{ lang?: string | string[] }>;
}): Promise<Metadata> {
  const french = (await searchParams).lang === "fr";
  return {
    title: french ? "Guides API" : "API guides",
    description: french
      ? "Découvrez l’API Business Fondeka avec des guides interactifs et des exemples Sandbox."
      : "Explore the Fondeka Business API, with interactive integration guides and sandbox examples.",
    robots: { index: true, follow: true },
    alternates: {
      canonical: french ? `${guidesUrl}?lang=fr` : guidesUrl,
      languages: { en: guidesUrl, fr: `${guidesUrl}?lang=fr`, "x-default": guidesUrl },
    },
  };
}

async function publicBillPaymentsAvailability() {
  try {
    const base = process.env.FONDEKA_API_BASE_URL || release.baseUrl;
    const response = await fetch(
      `${base.replace(/\/$/, "")}/public/business-api/guide-availability`,
      {
        next: { revalidate: 60 },
        signal: AbortSignal.timeout(2000),
      },
    );
    if (!response.ok) return {};
    const status = await response.json();
    return normalizeBillPaymentAvailability(
      status?.billPaymentsApiReady,
      status?.billPaymentsApiAvailability,
    );
  } catch {
    return {};
  }
}

export default async function Page() {
  const availability = await publicBillPaymentsAvailability();
  return <PublicApiGuides billPaymentsApiAvailability={availability} />;
}
