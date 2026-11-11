import type { Metadata } from "next";
import { PublicApiGuides } from "@/components/public-api-guides";
import release from "../../../public/docs/business-api/release.json";

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

export default async function Page() {
  return <PublicApiGuides billPaymentsApiReady={await publicBillPaymentsReady()} />;
}
