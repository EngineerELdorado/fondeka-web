"use client";

import { useEffect, useState } from "react";
import { Copy, ExternalLink, Link2, Plus, Search } from "lucide-react";
import {
  Badge,
  MobileRecord,
  Empty,
  ErrorState,
  Loading,
  Modal,
  PageHeading,
  Pagination,
} from "@/components/ui";
import { PaymentForm } from "@/components/payment-form";
import { useWorkspace } from "@/components/workspace-provider";
import { useQuery } from "@/lib/use-query";
import { request } from "@/lib/data";
import { demoMode } from "@/lib/auth";
import { label, money, safeLink } from "@/lib/format";
import type { Page, PaymentRequest } from "@/lib/types";

export default function PaymentRequests() {
  const [page, setPage] = useState(0);
  const [search, setSearch] = useState("");
  const [creating, setCreating] = useState(false);
  const [selected, setSelected] = useState<PaymentRequest>();
  const [cancel, setCancel] = useState(false);
  const [busy, setBusy] = useState(false);
  const [mutationError, setMutationError] = useState("");
  const payments = useQuery<Page<PaymentRequest>>(
    `/customer-api/payment_requests?page=${page}&size=10`,
  );
  const { refresh, notify } = useWorkspace();
  useEffect(() => {
    if (new URLSearchParams(window.location.search).get("new") === "1") {
      setCreating(true);
      window.history.replaceState(null, "", "/payment-requests");
    }
  }, []);
  const items =
    payments.data?.content.filter((item) =>
      `${item.title} ${item.linkCode}`.toLowerCase().includes(search.toLowerCase()),
    ) ?? [];
  const link = safeLink(selected?.paymentLink);
  async function copy() {
    if (!link) return;
    try {
      await navigator.clipboard.writeText(link);
      notify("Payment link copied.");
    } catch {
      notify("Select the payment link to copy it manually.");
    }
  }
  async function cancelRequest() {
    if (!selected || busy) return;
    setBusy(true);
    setMutationError("");
    try {
      await request(`/customer-api/payment_requests/${selected.id}/cancel`, { method: "PATCH" });
      refresh();
      notify("Payment request cancelled.");
      setSelected(undefined);
      setCancel(false);
    } catch (error) {
      setMutationError(error instanceof Error ? error.message : "Couldn’t cancel this request.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <PageHeading
        mobileTitle="Payment requests"
        eyebrow="PAYMENTS"
        title="Send a link. Get things moving."
        description="Create payment requests and give every payment a clear place to land."
      >
        <button
          className="button primary"
          aria-label="Create payment request"
          onClick={() => setCreating(true)}
        >
          <Plus size={17} />
          Create request
        </button>
      </PageHeading>
      <div className="payment-intro">
        <span className="tool-icon mint">
          <Link2 size={25} />
        </span>
        <div>
          <h2>A simpler way to get paid.</h2>
          <p>Payment links for quick collections. Invoices for the bigger picture.</p>
        </div>
        <span className="intro-decoration" aria-hidden="true">
          ↗
        </span>
      </div>
      <section className="panel">
        <div className="list-toolbar inset">
          <div>
            <strong>Payment requests</strong>
            <span className="count-pill">{payments.data?.totalElements ?? "—"}</span>
          </div>
          <label className="search-input">
            <Search size={16} />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search this page…"
              aria-label="Search payment requests on this page"
            />
          </label>
        </div>
        {payments.loading ? (
          <Loading />
        ) : payments.error ? (
          <ErrorState message={payments.error} retry={refresh} />
        ) : !items.length ? (
          <Empty
            title={search ? "No matching requests" : "Make your first request"}
            description={
              search
                ? "Try a different title or code. Search applies to the current page."
                : "Your payment links and invoices will live here."
            }
          />
        ) : (
          <>
            <div className="table-wrap desktop-table">
              <table>
                <thead>
                  <tr>
                    <th>Request</th>
                    <th>Type</th>
                    <th>Amount</th>
                    <th>Collected</th>
                    <th>Status</th>
                    <th>
                      <span className="sr-only">Open request</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((item) => (
                    <tr key={item.id}>
                      <td>
                        <button
                          className="text-button table-name"
                          onClick={() => {
                            setSelected(item);
                            setCancel(false);
                            setMutationError("");
                          }}
                        >
                          {item.title || "Untitled request"}
                        </button>
                        <small className="table-subtitle">{item.linkCode}</small>
                      </td>
                      <td>{item.type === "QUICK_CHARGE" ? "Payment link" : label(item.type)}</td>
                      <td className="amount">{money(item.amount, item.currency)}</td>
                      <td className="amount">{money(item.totalCollected, item.currency)}</td>
                      <td>
                        <Badge value={item.lifecycle} />
                      </td>
                      <td>
                        <button
                          className="icon-button"
                          aria-label={`View request ${item.title}`}
                          onClick={() => {
                            setSelected(item);
                            setCancel(false);
                            setMutationError("");
                          }}
                        >
                          <ExternalLink size={16} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="mobile-record-list">
              {items.map((item) => (
                <MobileRecord
                  key={item.id}
                  title={item.title || "Untitled request"}
                  subtitle={item.type === "QUICK_CHARGE" ? "Payment link" : label(item.type)}
                  meta={
                    Number(item.totalCollected) > 0
                      ? `${money(item.totalCollected, item.currency)} collected`
                      : undefined
                  }
                  amount={money(item.amount, item.currency)}
                  status={item.lifecycle}
                  icon={<Link2 size={19} />}
                  onClick={() => {
                    setSelected(item);
                    setCancel(false);
                    setMutationError("");
                  }}
                />
              ))}
            </div>
          </>
        )}
        {payments.data && (
          <Pagination
            page={page}
            pages={payments.data.totalPages}
            total={payments.data.totalElements}
            onChange={(value) => {
              setPage(value);
              setSearch("");
            }}
          />
        )}
      </section>
      {creating && (
        <PaymentForm
          onClose={() => setCreating(false)}
          onCreated={(payment) => {
            setCreating(false);
            setSelected(payment);
            setCancel(false);
          }}
        />
      )}{" "}
      {selected && (
        <Modal
          title={selected.title || "Payment request"}
          description={selected.linkCode}
          onClose={() => setSelected(undefined)}
          busy={busy}
        >
          <div className="transaction-hero">
            <strong>{money(selected.amount, selected.currency)}</strong>
            <Badge value={selected.lifecycle} />
          </div>
          <dl className="detail-list">
            <div>
              <dt>Collected</dt>
              <dd>{money(selected.totalCollected, selected.currency)}</dd>
            </div>
            <div>
              <dt>Approval</dt>
              <dd>
                <Badge value={selected.approvalStatus} />
              </dd>
            </div>
            <div>
              <dt>Type</dt>
              <dd>{label(selected.type)}</dd>
            </div>
          </dl>
          {selected.description && <p className="muted">{selected.description}</p>}
          {link ? (
            <>
              <div className="copy-field">
                <code>{link}</code>
                <button
                  className="icon-button"
                  aria-label="Copy payment link"
                  onClick={() => void copy()}
                >
                  <Copy size={16} />
                </button>
              </div>
              <a className="text-button" href={link} target="_blank" rel="noopener noreferrer">
                Open payment page <ExternalLink size={14} />
              </a>
            </>
          ) : (
            <div className="info-box">
              {demoMode
                ? "This is a demo request. No public payment link or real payment is created."
                : "A payment link is not available yet. Its availability follows the request’s approval and lifecycle status."}
            </div>
          )}
          {cancel && (
            <div className="info-box">
              Cancel this request? Customers will no longer be able to use it to make new payments.
            </div>
          )}
          {mutationError && (
            <p role="alert" className="form-error">
              {mutationError}
            </p>
          )}
          <div className="modal-actions">
            {selected.lifecycle === "ACTIVE" && (
              <button
                className="button danger"
                disabled={busy}
                onClick={() => (cancel ? void cancelRequest() : setCancel(true))}
              >
                {busy ? "Cancelling…" : cancel ? "Confirm cancellation" : "Cancel request"}
              </button>
            )}
            <button
              className="button secondary"
              disabled={busy}
              onClick={() => setSelected(undefined)}
            >
              Close
            </button>
          </div>
        </Modal>
      )}
    </>
  );
}
