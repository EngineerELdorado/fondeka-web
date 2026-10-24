"use client";
import { useCallback, useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import {
  Activity,
  BookOpen,
  Building2,
  ChevronDown,
  KeyRound,
  Pencil,
  WalletCards,
} from "lucide-react";
import { useUiText } from "@/lib/use-ui-text";
import { useUrlState } from "@/lib/use-url-state";
import { useQuery } from "@/lib/use-query";
import {
  developerHref,
  legacyDeveloperDestination,
  type DeveloperSection,
} from "@/lib/developer-navigation";
import { apiKeysPath, assertKeyEnvironment, resolveApiEnvironment } from "@/lib/api-environment";
import type { ApiEnvironment, ApiKey, Business, Page } from "@/lib/types";
import { BusinessToolLink as Link } from "./business-tool-link";
import { ApiCredentials } from "./api-credentials";
import { ApiTransactions, TransactionDetail } from "./api-workspace";
import { ApiWallets } from "./api-wallets";
import { IntegrationGuide } from "./integration-guide";
import { DeveloperSectionLinks } from "./developer-section-links";
import { Badge, Empty, ErrorState, Loading, PageHeading } from "./ui";
import { useWorkspace } from "./workspace-provider";
import { businessDisplayName } from "@/lib/business-profile";

export function DeveloperWorkspace({ section }: { section: DeveloperSection }) {
  const uiText = useUiText();
  const pathname = usePathname();
  const router = useRouter();
  const { values } = useUrlState();
  const search = values.toString();
  const { apiEnvironment: sharedEnvironment, selectApiEnvironment } = useWorkspace();
  const routeEnvironment = values.get("environment");
  const environment = resolveApiEnvironment(routeEnvironment, sharedEnvironment);
  useEffect(() => {
    if (
      (routeEnvironment === "LIVE" || routeEnvironment === "SANDBOX") &&
      routeEnvironment !== sharedEnvironment
    )
      selectApiEnvironment(routeEnvironment);
  }, [routeEnvironment, sharedEnvironment, selectApiEnvironment]);
  useEffect(() => {
    if (section !== "credentials") return;
    const destination = legacyDeveloperDestination(
      new URLSearchParams(search),
      window.location.hash,
    );
    if (destination) router.replace(destination);
  }, [section, search, router]);
  const [revision, setRevision] = useState(0);
  const refresh = useCallback(() => setRevision((value) => value + 1), []);
  const businessPage = Math.max(0, Number(values.get("businessPage")) || 0);
  const businesses = useQuery<Page<Business>>(
    `/customer-api/businesses?page=${businessPage}&size=20`,
    undefined,
    revision,
  );
  const selected =
    businesses.data?.content.find((business) => String(business.id) === values.get("business")) ||
    businesses.data?.content.find((business) => business.defaultBusiness) ||
    businesses.data?.content[0];
  const title =
    section === "credentials"
      ? "API"
      : section === "guides"
        ? "API guides"
        : section === "wallets"
          ? "Wallets"
          : "Transactions";
  const description =
    section === "credentials"
      ? "Manage API keys and webhook destinations."
      : section === "guides"
        ? "Build your integration with Fondeka."
        : undefined;
  return (
    <>
      <PageHeading
        icon={
          section === "wallets"
            ? WalletCards
            : section === "transactions"
              ? Activity
              : section === "guides"
                ? BookOpen
                : KeyRound
        }
        title={uiText(title)}
        mobileTitle={uiText(title)}
        description={description ? uiText(description) : undefined}
      >
        {section !== "credentials" && (
          <Link className="button secondary" href={developerHref("credentials", values)}>
            <KeyRound size={16} />
            {uiText("API keys")}
          </Link>
        )}
      </PageHeading>
      <nav className="developer-mobile-navigation" aria-label={uiText("API sections")}>
        <DeveloperSectionLinks pathname={pathname} />
      </nav>
      {section === "guides" ? (
        <IntegrationGuide
          setup={{
            business: selected,
            environment,
            loading: businesses.loading,
            error: businesses.error,
            refresh,
          }}
        />
      ) : (
        <>
          {section === "credentials" && selected && (
            <details className="developer-business-details">
              <summary>
                <span className="developer-business-icon" aria-hidden="true">
                  <Building2 size={20} />
                </span>
                <span>{uiText("Business details")}</span>
                <span className="developer-nav-chevron" aria-hidden="true">
                  <ChevronDown size={16} strokeWidth={2.5} />
                </span>
              </summary>
              <dl className="detail-list">
                <div>
                  <dt>{uiText("Business")}</dt>
                  <dd>
                    {businessDisplayName(selected) || "—"} · #{selected.id}
                  </dd>
                </div>
                <div>
                  <dt>{uiText("Country")}</dt>
                  <dd>{selected.countryCode || uiText("Country not provided")}</dd>
                </div>
                <div>
                  <dt>{uiText("Operational status")}</dt>
                  <dd>
                    <Badge value={selected.status} />
                  </dd>
                </div>
                <div>
                  <dt>{uiText("Verification")}</dt>
                  <dd>
                    <Badge value={selected.kybStatus} />
                  </dd>
                </div>
              </dl>
              <Link className="text-button developer-business-edit" href="/settings">
                <Pencil size={14} />
                {uiText("Edit Business details")}
              </Link>
            </details>
          )}
          {businesses.loading ? (
            <Loading />
          ) : businesses.error ? (
            <ErrorState message={businesses.error} retry={refresh} />
          ) : !selected ? (
            <Empty
              title={uiText("Your business will feel at home here")}
              description={uiText(
                "You don’t have a business profile yet. Business profiles appear here once set up through a Fondeka business product.",
              )}
            />
          ) : (
            <div key={`${selected.id}:${environment}:${section}`}>
              {section === "wallets" ? (
                <WalletWorkspace businessId={selected.id} environment={environment} />
              ) : section === "transactions" ? (
                <ApiTransactions business={selected} environment={environment} />
              ) : (
                <CredentialWorkspace businessId={selected.id} environment={environment} />
              )}
            </div>
          )}
        </>
      )}
    </>
  );
}

function CredentialWorkspace({
  businessId,
  environment,
}: {
  businessId: number;
  environment: ApiEnvironment;
}) {
  const uiText = useUiText();
  const [revision, setRevision] = useState(0);
  const refresh = useCallback(() => setRevision((value) => value + 1), []);
  const keys = useQuery<ApiKey[]>(apiKeysPath(businessId, environment), undefined, revision);
  let error = keys.error;
  try {
    if (keys.data) assertKeyEnvironment(keys.data, environment);
  } catch (failure) {
    error =
      failure instanceof Error
        ? failure.message
        : uiText("Couldn’t read credentials for this environment.");
  }
  return (
    <ApiCredentials
      businessId={businessId}
      environment={environment}
      keys={{ ...keys, error }}
      refresh={refresh}
    />
  );
}

function WalletWorkspace({
  businessId,
  environment,
}: {
  businessId: number;
  environment: ApiEnvironment;
}) {
  const [revision, setRevision] = useState(0);
  const refresh = useCallback(() => setRevision((value) => value + 1), []);
  const [payment, setPayment] = useState<{ businessId: number; reference: string }>();
  return (
    <>
      <ApiWallets
        businessId={businessId}
        environment={environment}
        revision={revision}
        refresh={refresh}
        onOpenPayment={(businessId, reference) => setPayment({ businessId, reference })}
      />
      {payment && (
        <TransactionDetail
          businessId={payment.businessId}
          reference={payment.reference}
          environment={environment}
          onClose={() => setPayment(undefined)}
          onTerminal={refresh}
        />
      )}
    </>
  );
}
