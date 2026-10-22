"use client";

import { useState, type FormEvent } from "react";
import {
  ArrowDownLeft,
  ArrowUpRight,
  Code2,
  Copy,
  ExternalLink,
  KeyRound,
  RefreshCw,
  Search,
  SlidersHorizontal,
  Webhook,
} from "lucide-react";
import { Badge, MobileRecord, Empty, ErrorState, Loading, Modal, Pagination } from "./ui";
import { ApiCredentials } from "./api-credentials";
import { useWorkspace } from "./workspace-provider";
import { useQuery } from "@/lib/use-query";
import { useMobileLayout } from "@/lib/use-mobile-layout";
import { date, label, money, safeLink } from "@/lib/format";
import {
  emptyFilters,
  portalQuery,
  transactionStatuses,
  type PortalFilters,
} from "@/lib/portal-query";
import type { ApiKey, ApiTransaction, Business, Page } from "@/lib/types";

export function ApiWorkspace({ business }: { business: Business }) {
  const [page, setPage] = useState(0);
  const mobile = useMobileLayout();
  const [draft, setDraft] = useState<PortalFilters>(emptyFilters);
  const [filters, setFilters] = useState<PortalFilters>(emptyFilters);
  const [filterOpen, setFilterOpen] = useState(false);
  const [filterError, setFilterError] = useState("");
  const [selected, setSelected] = useState<string>();
  const { refresh } = useWorkspace();
  const keys = useQuery<ApiKey[]>(`/customer-api/businesses/${business.id}/api-keys`);
  const history = useQuery<Page<ApiTransaction>>(
    `/customer-api/businesses/${business.id}/api-transactions?${portalQuery(filters, page)}`,
  );
  const activeFilters = Object.values(filters).filter(Boolean).length;
  function apply(event: FormEvent) {
    event.preventDefault();
    try {
      portalQuery(draft, 0);
      setFilters({ ...draft });
      setPage(0);
      setFilterError("");
      if (mobile) setFilterOpen(false);
    } catch (error) {
      setFilterError(error instanceof Error ? error.message : "Check your filters.");
    }
  }
  function update(key: keyof PortalFilters, value: string) {
    setDraft((current) => ({ ...current, [key]: value }));
  }
  const filterForm = (
    <form className="filter-form" onSubmit={apply}>
      <div className="filter-grid">
        <label>
          Direction
          <select value={draft.action} onChange={(e) => update("action", e.target.value)}>
            <option value="">Collections & payouts</option>
            <option value="BUSINESS_API_COLLECTION">Collections</option>
            <option value="BUSINESS_API_PAYOUT">Payouts</option>
          </select>
        </label>
        <label>
          Status
          <select value={draft.status} onChange={(e) => update("status", e.target.value)}>
            <option value="">All statuses</option>
            {transactionStatuses.map((status) => (
              <option key={status} value={status}>
                {label(status)}
              </option>
            ))}
          </select>
        </label>
        <label>
          Fiat currency
          <input
            value={draft.currency}
            onChange={(e) => update("currency", e.target.value)}
            maxLength={3}
            placeholder="e.g. USD"
          />
        </label>
        <label>
          Fondeka reference
          <input
            value={draft.reference}
            onChange={(e) => update("reference", e.target.value)}
            maxLength={128}
            placeholder="Exact TX reference"
          />
        </label>
        <label>
          Merchant reference
          <input
            value={draft.clientReference}
            onChange={(e) => update("clientReference", e.target.value)}
            maxLength={128}
            placeholder="Exact client reference"
          />
        </label>
        <label>
          From date
          <input
            type="date"
            min="1970-01-01"
            value={draft.fromDate}
            onChange={(e) => update("fromDate", e.target.value)}
          />
        </label>
        <label>
          To date
          <input
            type="date"
            min="1970-01-01"
            value={draft.toDate}
            onChange={(e) => update("toDate", e.target.value)}
          />
        </label>
      </div>
      {filterError && (
        <p className="form-error" role="alert">
          {filterError}
        </p>
      )}
      <div className="filter-actions">
        <small>Exact references · inclusive dates in your local timezone</small>
        <button
          type="button"
          className="text-button"
          onClick={() => {
            setDraft(emptyFilters);
            setFilters(emptyFilters);
            setPage(0);
            setFilterError("");
          }}
        >
          Clear filters
        </button>
        <button className="button primary small">
          <Search size={14} />
          Apply filters
        </button>
      </div>
    </form>
  );
  return (
    <>
      <div className="business-summary">
        <div>
          <span className="quiet-label">BUSINESS PROFILE</span>
          <h2>{business.legalName || business.name}</h2>
          <span className="muted">
            {business.countryCode || "Country not provided"} · Business #{business.id}
          </span>
        </div>
        <div className="business-status">
          <span>
            <small>Operational status</small>
            <Badge value={business.status} />
          </span>
          <span>
            <small>Verification</small>
            <Badge value={business.kybStatus} />
          </span>
        </div>
      </div>
      <ApiCredentials key={business.id} businessId={business.id} keys={keys} refresh={refresh} />
      <section className="panel history-panel">
        <div className="panel-heading">
          <div>
            <h2>API activity</h2>
            <p className="muted">Collections and payouts for {business.name}.</p>
          </div>
          <div className="heading-actions">
            <button
              className={`button secondary small ${filterOpen ? "selected" : ""}`}
              onClick={() => setFilterOpen(!filterOpen)}
              aria-expanded={filterOpen}
            >
              <SlidersHorizontal size={15} />
              Filters{activeFilters ? <span className="count-pill">{activeFilters}</span> : null}
            </button>
            <button
              className="icon-button bordered"
              aria-label="Refresh API activity"
              onClick={refresh}
            >
              <RefreshCw size={16} />
            </button>
          </div>
        </div>
        {filterOpen &&
          (mobile ? (
            <Modal title="Filter API activity" variant="sheet" onClose={() => setFilterOpen(false)}>
              {filterForm}
            </Modal>
          ) : (
            filterForm
          ))}
        {history.loading ? (
          <Loading />
        ) : history.error ? (
          <ErrorState message={history.error} retry={refresh} />
        ) : !history.data?.content.length ? (
          <Empty
            title={activeFilters ? "No matching transactions" : "Your API story starts here"}
            description={
              activeFilters
                ? "Try changing your filters or widening the date range."
                : "Accepted collections and payouts will appear here when your integration starts sending requests."
            }
          />
        ) : (
          <>
            <div className="table-wrap desktop-table">
              <table>
                <thead>
                  <tr>
                    <th>Transaction</th>
                    <th>Direction</th>
                    <th>Amount</th>
                    <th>Integration</th>
                    <th>Accepted</th>
                    <th>Status</th>
                    <th>
                      <span className="sr-only">Details</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {history.data.content.map(
                    ({ requestId, transaction: tx, apiKeyName, createdAt }) => (
                      <tr key={requestId}>
                        <td>
                          <button
                            className="table-name text-button"
                            onClick={() => setSelected(tx.reference)}
                          >
                            {tx.reference}
                          </button>
                          <small className="table-subtitle">
                            {tx.clientReference || "No merchant reference"}
                          </small>
                        </td>
                        <td>
                          <span className="direction">
                            {tx.action === "BUSINESS_API_PAYOUT" ? (
                              <ArrowUpRight size={16} />
                            ) : (
                              <ArrowDownLeft size={16} />
                            )}{" "}
                            {tx.action === "BUSINESS_API_PAYOUT" ? "Payout" : "Collection"}
                          </span>
                        </td>
                        <td className="amount">{money(tx.amount, tx.currency)}</td>
                        <td>{apiKeyName || "—"}</td>
                        <td>{date(createdAt)}</td>
                        <td>
                          <Badge value={tx.status} />
                        </td>
                        <td>
                          <button
                            className="icon-button"
                            aria-label={`View transaction ${tx.reference}`}
                            onClick={() => setSelected(tx.reference)}
                          >
                            <ArrowUpRight size={16} />
                          </button>
                        </td>
                      </tr>
                    ),
                  )}
                </tbody>
              </table>
            </div>
            <div className="mobile-record-list">
              {history.data.content.map(({ requestId, transaction: tx, createdAt }) => (
                <MobileRecord
                  key={requestId}
                  title={tx.clientReference || tx.reference}
                  subtitle={tx.reference}
                  meta={`${tx.action === "BUSINESS_API_PAYOUT" ? "Payout" : "Collection"} · ${date(createdAt)}`}
                  amount={money(tx.amount, tx.currency)}
                  status={tx.status}
                  icon={
                    tx.action === "BUSINESS_API_PAYOUT" ? (
                      <ArrowUpRight size={20} />
                    ) : (
                      <ArrowDownLeft size={20} />
                    )
                  }
                  onClick={() => setSelected(tx.reference)}
                />
              ))}
            </div>
          </>
        )}
        {history.data && (
          <Pagination
            page={history.data.number}
            pages={history.data.totalPages}
            total={history.data.totalElements}
            onChange={setPage}
          />
        )}
        <div className="panel-note">
          Amounts use each transaction’s fiat currency. Processing and unknown states are not
          confirmed failures.
        </div>
      </section>
      {selected && (
        <TransactionDetail
          businessId={business.id}
          reference={selected}
          onClose={() => setSelected(undefined)}
        />
      )}
    </>
  );
}
function TransactionDetail({
  businessId,
  reference,
  onClose,
}: {
  businessId: number;
  reference: string;
  onClose: () => void;
}) {
  const detail = useQuery<ApiTransaction>(
    `/customer-api/businesses/${businessId}/api-transactions/${encodeURIComponent(reference)}`,
  );
  const { refresh, notify } = useWorkspace();
  const tx = detail.data?.transaction;
  const crypto = tx?.cryptoDetails;
  const invoice = safeLink(crypto?.invoiceUrl);
  async function copy(value: string) {
    try {
      await navigator.clipboard.writeText(value);
      notify("Copied to clipboard.");
    } catch {
      notify("Copy isn’t available in this browser. Select the text to copy it.");
    }
  }
  return (
    <Modal title="Transaction details" description={reference} onClose={onClose}>
      {detail.loading ? (
        <Loading />
      ) : detail.error ? (
        <ErrorState message={detail.error} retry={refresh} />
      ) : (
        tx && (
          <>
            <div className="transaction-hero">
              <strong>{money(tx.amount, tx.currency)}</strong>
              <Badge value={tx.status} />
            </div>
            <dl className="detail-list">
              {[
                ["Direction", tx.action === "BUSINESS_API_PAYOUT" ? "Payout" : "Collection"],
                ["Merchant reference", tx.clientReference || "—"],
                ["Integration", detail.data?.apiKeyName || "—"],
                ["Accepted", date(detail.data?.createdAt)],
                ["Last updated", date(detail.data?.updatedAt)],
                ["Gross amount", money(tx.grossAmount, tx.currency)],
                ["Fees", money(tx.allFees, tx.currency)],
                ["Settlement net", money(tx.settlementNet, tx.currency)],
                ["Refunded", tx.refunded === true ? "Yes" : tx.refunded === false ? "No" : "—"],
              ].map(([key, value]) => (
                <div key={key}>
                  <dt>{key}</dt>
                  <dd>{value}</dd>
                </div>
              ))}
            </dl>
            {["UNKNOWN", "MANUAL_INTERVENTION_REQUIRED"].includes(tx.status) && (
              <div className="info-box">
                This transaction needs investigation. Its status does not confirm failure or a
                refund. Contact Fondeka with the transaction reference.
              </div>
            )}
            {crypto && (
              <div className="crypto-instructions">
                <h3>Crypto payment instructions</h3>
                <p className="muted">
                  Token amounts below are separate from the fiat amounts above.
                </p>
                <dl className="detail-list">
                  <div>
                    <dt>Network</dt>
                    <dd>{crypto.network || "—"}</dd>
                  </div>
                  <div>
                    <dt>Token amount</dt>
                    <dd>
                      {crypto.amountInCrypto ?? "—"} {crypto.cryptoCurrency}
                    </dd>
                  </div>
                  <div>
                    <dt>Expires</dt>
                    <dd>{date(crypto.expiresAt)}</dd>
                  </div>
                </dl>
                {crypto.address && (
                  <div className="copy-field">
                    <code>{crypto.address}</code>
                    <button
                      className="icon-button"
                      aria-label="Copy crypto address"
                      onClick={() => void copy(crypto.address!)}
                    >
                      <Copy size={16} />
                    </button>
                  </div>
                )}
                {invoice && (
                  <a
                    className="text-button"
                    href={invoice}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    Open invoice <ExternalLink size={14} />
                  </a>
                )}
              </div>
            )}
            {!crypto && ["PROCESSING", "INITIATED", "SUBMITTED"].includes(tx.status) && (
              <div className="info-box">
                Payment instructions may still be on their way. Refresh to check the latest status.
              </div>
            )}
            <div className="modal-actions">
              <button className="button secondary" onClick={refresh}>
                <RefreshCw size={15} />
                Refresh status
              </button>
              <button className="button primary" onClick={onClose}>
                Done
              </button>
            </div>
          </>
        )
      )}
    </Modal>
  );
}
export function IntegrationGuide() {
  const [expanded, setExpanded] = useState(false);
  return (
    <div className={`integration-guide-disclosure ${expanded ? "expanded" : ""}`}>
      <button
        type="button"
        className="integration-guide-toggle"
        onClick={() => setExpanded(!expanded)}
        aria-expanded={expanded}
        aria-controls="integration-guide"
      >
        <Code2 size={19} />
        <span>
          Integration guide<small>Connect your backend to Fondeka</small>
        </span>
        <span aria-hidden="true">{expanded ? "−" : "+"}</span>
      </button>
      <section className="integration-guide" id="integration-guide">
        <div>
          <span className="tool-icon lilac">
            <Code2 size={24} />
          </span>
          <h2>Built to work with your business.</h2>
          <p>
            Connect your backend to Fondeka for mobile-money and crypto collections and payouts.
            Monitor accepted requests here.
          </p>
          <div className="guide-facts">
            <span>
              <KeyRound size={16} />
              API keys stay on your server.
            </span>
            <span>
              <Webhook size={16} />
              Verify signed terminal webhooks.
            </span>
            <span>
              <RefreshCw size={16} />
              Keep the same idempotency key on retries.
            </span>
          </div>
          <p className="guide-footnote">
            API access is provisioned by Fondeka. Amounts are fiat-wallet amounts, including when
            using crypto. A 202 response means accepted for processing.
          </p>
        </div>
        <div className="code-window">
          <div>
            <span />
            <span />
            <span />
            <small>YOUR BACKEND · COLLECTION</small>
          </div>
          <pre>
            <code>{`POST /business-api/v1/businesses/{businessId}/collections\nX-API-Key: <server-side API key>\nIdempotency-Key: order-2026-0001\nContent-Type: application/json\n\n{\n  "amount": 10.00,\n  "currency": "USD",\n  "paymentMethodName": "MPESA_KENYA",\n  "accountRef": "+254707371664",\n  "clientReference": "invoice-0001",\n  "feeApplicationMode": "EXCLUSIVE"\n}`}</code>
          </pre>
        </div>
      </section>
    </div>
  );
}
