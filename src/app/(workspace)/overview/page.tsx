"use client";

import Link from "next/link";
import {
  ArrowRight,
  ArrowUpRight,
  Building2,
  Code2,
  Link2,
  Monitor,
  Plus,
  Store,
  Zap,
} from "lucide-react";
import { Badge, MobileRecord, ErrorState, Loading, PageHeading } from "@/components/ui";
import { useWorkspace } from "@/components/workspace-provider";
import { useQuery } from "@/lib/use-query";
import type { Business, Page, PaymentRequest, Store as StoreType } from "@/lib/types";
import { money } from "@/lib/format";
import { PlatformGraphic } from "@/components/platform-graphic";

export default function Overview() {
  const stores = useQuery<Page<StoreType>>("/customer-api/commerce/stores?page=0&size=3");
  const payments = useQuery<Page<PaymentRequest>>("/customer-api/payment_requests?page=0&size=5");
  const businesses = useQuery<Page<Business>>("/customer-api/businesses?page=0&size=1");
  const { refresh } = useWorkspace();
  return (
    <>
      <PageHeading
        mobileTitle="Overview"
        eyebrow="YOUR WORKSPACE"
        title="Business, without boundaries."
        description="Manage your commerce, payments, and integrations in one place."
      >
        <Link
          className="button primary"
          href="/payment-requests?new=1"
          aria-label="Create payment request"
        >
          <Plus size={17} />
          Request a payment
        </Link>
      </PageHeading>
      <div className="welcome-banner">
        <div className="welcome-copy">
          <span className="welcome-kicker">
            <span /> THE FONDEKA BUSINESS PLATFORM
          </span>
          <h2>
            Your business.
            <br />
            Fully connected.
          </h2>
          <p>
            From your storefront to your next integration,
            <br />
            bring every part of your business together.
          </p>
          <div className="welcome-actions">
            <Link href="/pos" className="button cream">
              Open point of sale <ArrowRight size={16} />
            </Link>
            <Link href="/developers" className="welcome-secondary">
              Explore the API <ArrowUpRight size={15} />
            </Link>
          </div>
        </div>
        <PlatformGraphic />
      </div>
      <div className="stats-grid">
        {[
          {
            title: "Your stores",
            value: stores.data?.totalElements,
            icon: Store,
            detail: "Online and in person",
            href: "/stores",
          },
          {
            title: "Payment requests",
            value: payments.data?.totalElements,
            icon: Link2,
            detail: "Simple links. Easier payments.",
            href: "/payment-requests",
          },
          {
            title: "Business profiles",
            value: businesses.data?.totalElements,
            icon: Building2,
            detail: "Your registered businesses",
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
      <div className="section-heading">
        <div>
          <h2>Your business toolkit</h2>
          <p className="muted">One platform. More possibilities.</p>
        </div>
        <span className="quiet-label">
          <Zap size={14} />
          Made for business
        </span>
      </div>
      <div className="tools-grid">
        {[
          {
            icon: Store,
            title: "Set up shop",
            description: "Manage your storefronts, products, and orders.",
            href: "/stores",
            color: "mint",
          },
          {
            icon: Monitor,
            title: "Make a sale",
            description: "Your counter, your catalog, one simple checkout.",
            href: "/pos",
            color: "peach",
          },
          {
            icon: Code2,
            title: "Build with Fondeka",
            description: "Keep an eye on your API integrations and activity.",
            href: "/developers",
            color: "lilac",
          },
        ].map(({ icon: Icon, title, description, href, color }) => (
          <Link href={href} key={title} className="tool-card">
            <span className={`tool-icon ${color}`}>
              <Icon size={23} />
            </span>
            <h3>{title}</h3>
            <p>{description}</p>
            <ArrowUpRight className="tool-arrow" size={20} />
          </Link>
        ))}
      </div>
      <div className="overview-bottom">
        <section className="panel">
          <div className="panel-heading">
            <h2>Recent payment requests</h2>
            <Link href="/payment-requests" className="text-button">
              View all <ArrowRight size={15} />
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
                      <th>Request</th>
                      <th>Amount</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {payments.data.content.map((item) => (
                      <tr key={item.id}>
                        <td>
                          <Link href="/payment-requests" className="table-name">
                            {item.title || "Untitled request"}
                          </Link>
                          <small className="table-subtitle">
                            {item.type === "INVOICE"
                              ? "Invoice"
                              : item.type === "DONATION"
                                ? "Donation"
                                : "Payment link"}
                          </small>
                        </td>
                        <td className="amount">{money(item.amount, item.currency)}</td>
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
                    title={item.title || "Untitled request"}
                    subtitle={item.type === "INVOICE" ? "Invoice" : "Payment link"}
                    amount={money(item.amount, item.currency)}
                    status={item.lifecycle}
                    href="/payment-requests"
                  />
                ))}
              </div>
            </>
          ) : (
            <div className="inline-empty">
              Your payment requests will appear here.{" "}
              <Link href="/payment-requests?new=1">
                Create your first request <ArrowRight size={14} />
              </Link>
            </div>
          )}
        </section>
        <section className="panel">
          <div className="panel-heading">
            <h2>Your stores</h2>
            <Link href="/stores" className="text-button">
              Manage <ArrowRight size={15} />
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
                      {store.defaultCurrency} · {store.countryCode || "Online store"}
                    </small>
                  </span>
                  <Badge value={store.status} />
                </Link>
              ))}
            </div>
          ) : (
            <div className="inline-empty">
              A home for your products.
              <Link href="/stores">
                Create a store <ArrowRight size={14} />
              </Link>
            </div>
          )}
          <div className="panel-note">
            <span className="status-dot" />
            Your tools work with your existing Fondeka account.
          </div>
        </section>
      </div>
    </>
  );
}
