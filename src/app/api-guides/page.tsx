import type { Metadata } from "next";
import { PublicApiGuides } from "@/components/public-api-guides";
import { fetchPublicBillPaymentAvailability } from "@/lib/public-api-guide-availability";

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
    return await fetchPublicBillPaymentAvailability(2000);
  } catch {
    return {};
  }
}

export default async function Page() {
  const availability = await publicBillPaymentsAvailability();
  return <PublicApiGuides billPaymentsApiAvailability={availability} />;
}
