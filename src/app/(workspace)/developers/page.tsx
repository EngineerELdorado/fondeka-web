"use client";

import { useState } from "react";
import { Building2, ChevronDown, RefreshCw } from "lucide-react";
import { ApiWorkspace, IntegrationGuide } from "@/components/api-workspace";
import { Empty, ErrorState, Loading, PageHeading, Pagination } from "@/components/ui";
import { useWorkspace } from "@/components/workspace-provider";
import { useQuery } from "@/lib/use-query";
import type { Business, Page } from "@/lib/types";

export default function Developers() {
  const [businessPage, setBusinessPage] = useState(0);
  const [selectedId, setSelectedId] = useState("");
  const { data, loading, error } = useQuery<Page<Business>>(
    `/customer-api/businesses?page=${businessPage}&size=20`,
  );
  const { refresh } = useWorkspace();
  const selected =
    data?.content.find((business) => String(business.id) === selectedId) ||
    data?.content.find((business) => business.defaultBusiness) ||
    data?.content[0];
  return (
    <>
      <PageHeading
        mobileTitle="API & developers"
        eyebrow="DEVELOPER WORKSPACE"
        title="Good connections go a long way."
        description="Your API integrations and activity, with your business in view."
      >
        <button className="button secondary" aria-label="Refresh businesses" onClick={refresh}>
          <RefreshCw size={16} />
          Refresh
        </button>
      </PageHeading>
      <div className="list-toolbar">
        <div>
          <Building2 size={18} />
          <strong>Business</strong>
        </div>
        {selected && (
          <label className="business-select">
            <span className="sr-only">Select business</span>
            <select value={selected.id} onChange={(event) => setSelectedId(event.target.value)}>
              {data?.content.map((business) => (
                <option value={business.id} key={business.id}>
                  {business.name || business.legalName || `Business #${business.id}`}
                  {business.defaultBusiness ? " · Default" : ""}
                </option>
              ))}
            </select>
            <ChevronDown size={15} />
          </label>
        )}
      </div>
      {loading ? (
        <Loading />
      ) : error ? (
        <ErrorState
          message={`${error} If this backend has not been updated, deploy the customer Business Portal routes before enabling this screen.`}
          retry={refresh}
        />
      ) : !selected ? (
        <Empty
          title="Your business will feel at home here"
          description="You don’t have a business profile yet. Business profiles appear here once set up through a Fondeka business product."
        />
      ) : (
        <ApiWorkspace key={selected.id} business={selected} />
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
      <IntegrationGuide />
    </>
  );
}
