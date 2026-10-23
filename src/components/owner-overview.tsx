"use client";
import { useUiText } from "@/lib/use-ui-text";
import { BusinessToolLink as Link } from "@/components/business-tool-link";
import { ArrowRight, ArrowUpRight, Building2, Link2, Store } from "lucide-react";
import { Badge, MobileRecord, ErrorState, Loading } from "@/components/ui";
import { useWorkspace } from "@/components/workspace-provider";
import { useQuery } from "@/lib/use-query";
import type { Business, Page, PaymentRequest, Store as StoreType } from "@/lib/types";
import { money, label } from "@/lib/format";

export function OwnerOverview() {
  const uiText = useUiText();

  const stores = useQuery<Page<StoreType>>("/customer-api/commerce/stores?page=0&size=3");
  const payments = useQuery<Page<PaymentRequest>>("/customer-api/payment_requests?page=0&size=5");
  const businesses = useQuery<Page<Business>>("/customer-api/businesses?page=0&size=1");
  const { refresh } = useWorkspace();
  return (
    <>
      <div className="stats-grid">
        {[
          {
            title: uiText("Your stores"),
            value: stores.data?.totalElements,
            icon: Store,
            detail: uiText("Online and in person"),
            href: "/stores",
          },
          {
            title: uiText("Payment links"),
            value: payments.data?.totalElements,
            icon: Link2,
            detail: uiText("Simple links. Easier payments."),
            href: "/payment-requests",
          },
          {
            title: uiText("Business profiles"),
            value: businesses.data?.totalElements,
            icon: Building2,
            detail: uiText("Your registered businesses"),
            href: "/developers",
          },
        ].map(({ title, value, icon: Icon, detail, href }) => (
          <Link href={href} className="stat-card" key={title}>
            <div className="stat-top">
              <span>{title}</span>
              <Icon size={18} />
            </div>
            <strong>
              {value ?? "—"}
              <ArrowUpRight size={18} />
            </strong>
            <p>{detail}</p>
          </Link>
        ))}
      </div>
      <div className="overview-bottom">
        <section className="panel">
          <div className="panel-heading">
            <h2>{uiText("Recent payment requests")}</h2>
            <Link href="/payment-requests" className="text-button">
              {uiText("View all")}
              <ArrowRight size={15} />
            </Link>
          </div>
          {payments.loading ? (
            <Loading />
          ) : payments.error ? (
            <ErrorState message={payments.error} retry={refresh} />
          ) : payments.data?.content.length ? (
            <>
              <div className="table-wrap desktop-table">
                <table>
                  <thead>
                    <tr>
                      <th>{uiText("Request")}</th>
                      <th>{uiText("Amount")}</th>
                      <th>{uiText("Status")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {payments.data.content.map((item) => (
                      <tr key={item.id}>
                        <td>
                          <Link
                            href={"/payment-requests?request=" + item.id}
                            className="table-name"
                          >
                            {item.title || uiText("Untitled request")}
                          </Link>
                          <small className="table-subtitle">
                            {item.type === "INVOICE"
                              ? uiText("Invoice")
                              : item.type === "DONATION"
                                ? uiText("Donation")
                                : uiText("Payment link")}
                          </small>
                        </td>
                        <td className="amount">
                          {item.amount == null
                            ? uiText("Variable amount")
                            : money(item.amount, item.currency)}
                        </td>
                        <td>
                          <Badge value={item.lifecycle} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="mobile-record-list">
                {payments.data.content.map((item) => (
                  <MobileRecord
                    key={item.id}
                    title={item.title || uiText("Untitled request")}
                    subtitle={label(item.type)}
                    amount={
                      item.amount == null
                        ? uiText("Variable amount")
                        : money(item.amount, item.currency)
                    }
                    status={item.lifecycle}
                    href={"/payment-requests?request=" + item.id}
                  />
                ))}
              </div>
            </>
          ) : (
            <div className="inline-empty">
              {uiText("Your payment requests will appear here.")}{" "}
              <Link href="/payment-requests?new=1">
                {uiText("Create your first request")}
                <ArrowRight size={14} />
              </Link>
            </div>
          )}
        </section>
        <section className="panel">
          <div className="panel-heading">
            <h2>{uiText("Your stores")}</h2>
            <Link href="/stores" className="text-button">
              {uiText("Manage")}
              <ArrowRight size={15} />
            </Link>
          </div>
          {stores.loading ? (
            <Loading rows={3} />
          ) : stores.error ? (
            <ErrorState message={stores.error} retry={refresh} />
          ) : stores.data?.content.length ? (
            <div className="store-mini-list">
              {stores.data.content.map((store, i) => (
                <Link key={store.id} href={`/stores/${store.id}`} className="store-mini">
                  <span className={`store-monogram tone-${i % 3}`}>{store.name.slice(0, 1)}</span>
                  <span>
                    <strong>{store.name}</strong>
                    <small>
                      {store.defaultCurrency} · {store.countryCode || uiText("Online store")}
                    </small>
                  </span>
                  <Badge value={store.status} />
                </Link>
              ))}
            </div>
          ) : (
            <div className="inline-empty">
              {uiText("A home for your products.")}
              <Link href="/stores">
                {uiText("Create a store")}
                <ArrowRight size={14} />
              </Link>
            </div>
          )}
          <div className="panel-note">
            <span className="status-dot" />
            {uiText("Your tools work with your existing Fondeka account.")}
          </div>
        </section>
      </div>
    </>
  );
}
