"use client";
import { useUiText } from "@/lib/use-ui-text";

import { useEffect } from "react";
import { Building2, ChevronDown, RefreshCw } from "lucide-react";
import { ApiWorkspace, IntegrationGuide } from "@/components/api-workspace";
import { Empty, ErrorState, Loading, PageHeading, Pagination } from "@/components/ui";
import { useWorkspace } from "@/components/workspace-provider";
import { useUrlState } from "@/lib/use-url-state";
import { useQuery } from "@/lib/use-query";
import type { ApiEnvironment, Business, Page } from "@/lib/types";

export default function Developers() {
  const uiText = useUiText();

  const { values, update } = useUrlState();
  const businessPage = Math.max(0, Number(values.get("businessPage")) || 0);
  const selectedId = values.get("business") || "";
  const setBusinessPage = (v: number) =>
    update({ businessPage: v, business: null, apiReference: null, apiPage: null });
  const setSelectedId = (v: string) =>
    update({ business: v || null, apiReference: null, apiPage: null });
  const { data, loading, error } = useQuery<Page<Business>>(
    `/customer-api/businesses?page=${businessPage}&size=20`,
  );
  const {
    refresh,
    apiEnvironment: environment,
    selectApiEnvironment: setEnvironment,
  } = useWorkspace();
  const routeEnvironment = values.get("environment");
  useEffect(() => {
    if (
      (routeEnvironment === "LIVE" || routeEnvironment === "SANDBOX") &&
      routeEnvironment !== environment
    )
      setEnvironment(routeEnvironment);
  }, [routeEnvironment, setEnvironment, environment]);
  const selected =
    data?.content.find((business) => String(business.id) === selectedId) ||
    data?.content.find((business) => business.defaultBusiness) ||
    data?.content[0];
  return (
    <>
      <PageHeading
        mobileTitle={uiText("API & developers")}
        title={uiText("API & developers")}
        description={uiText("Manage your credentials and API activity.")}
      >
        <button
          className="button secondary"
          aria-label={uiText("Refresh businesses")}
          onClick={refresh}
        >
          <RefreshCw size={16} />
          {uiText("Refresh")}
        </button>
      </PageHeading>
      <div className="list-toolbar">
        <div>
          <Building2 size={18} />
          <strong>{uiText("Business")}</strong>
        </div>
        {selected && (
          <label className="business-select">
            <span className="sr-only">{uiText("Select business")}</span>
            <select value={selected.id} onChange={(event) => setSelectedId(event.target.value)}>
              {data?.content.map((business) => (
                <option value={business.id} key={business.id}>
                  {business.name || business.legalName || `Business #${business.id}`}
                  {business.defaultBusiness ? uiText(" · Default") : ""}
                </option>
              ))}
            </select>
            <ChevronDown size={15} />
          </label>
        )}
      </div>
      <section
        className={`api-environment ${environment === "SANDBOX" ? "sandbox" : ""}`}
        aria-label={uiText("API environment")}
      >
        <label>
          <span>{uiText("Environment")}</span>
          <select
            value={environment}
            onChange={(event) => {
              setEnvironment(event.target.value as ApiEnvironment);
              update({ environment: event.target.value, apiReference: null, apiPage: null });
            }}
          >
            <option value="LIVE">{uiText("LIVE · Real payments")}</option>
            <option value="SANDBOX">{uiText("SANDBOX · Simulated payments")}</option>
          </select>
        </label>
        <p>
          {environment === "SANDBOX"
            ? uiText("Test credentials and simulated history. No real funds or provider payments.")
            : uiText("Production credentials and real payment history.")}
        </p>
      </section>
      {loading ? (
        <Loading />
      ) : error ? (
        <ErrorState message={error} retry={refresh} />
      ) : !selected ? (
        <Empty
          title={uiText("Your business will feel at home here")}
          description={uiText(
            "You don’t have a business profile yet. Business profiles appear here once set up through a Fondeka business product.",
          )}
        />
      ) : (
        <ApiWorkspace
          key={`${selected.id}:${environment}`}
          business={selected}
          environment={environment}
        />
      )}{" "}
      {!!data && data.totalPages > 1 && (
        <Pagination
          page={businessPage}
          pages={data.totalPages}
          total={data.totalElements}
          onChange={(page) => {
            setBusinessPage(page);
            setSelectedId("");
          }}
        />
      )}
      <IntegrationGuide environment={environment} />
    </>
  );
}
