"use client";

import { useState, type FormEvent } from "react";
import {
  ArrowDownLeft,
  ArrowUpRight,
  Code2,
  KeyRound,
  RefreshCw,
  Search,
  SlidersHorizontal,
  Webhook,
} from "lucide-react";
import { Badge, MobileRecord, Empty, ErrorState, Loading, Modal, Pagination } from "./ui";
import { ApiCredentials } from "./api-credentials";
import { CryptoPaymentInstructions } from "./crypto-payment-instructions";
import { useQuery } from "@/lib/use-query";
import { useMobileLayout } from "@/lib/use-mobile-layout";
import { date, label, money } from "@/lib/format";
import {
  emptyFilters,
  portalQuery,
  transactionStatuses,
  type PortalFilters,
} from "@/lib/portal-query";
import type { ApiEnvironment, ApiKey, ApiTransaction, Business, Page } from "@/lib/types";
import {
  apiKeysPath,
  apiTransactionPath,
  assertKeyEnvironment,
  assertTransactionEnvironment,
} from "@/lib/api-environment";

export function ApiWorkspace({
  business,
  environment,
}: {
  business: Business;
  environment: ApiEnvironment;
}) {
  const [page, setPage] = useState(0);
  const mobile = useMobileLayout();
  const [draft, setDraft] = useState<PortalFilters>(emptyFilters);
  const [filters, setFilters] = useState<PortalFilters>(emptyFilters);
  const [filterOpen, setFilterOpen] = useState(false);
  const [filterError, setFilterError] = useState("");
  const [selected, setSelected] = useState<string>();
  const [revision, setRevision] = useState(0);
  const refresh = () => setRevision((value) => value + 1);
  const keys = useQuery<ApiKey[]>(apiKeysPath(business.id, environment), undefined, revision);
  const history = useQuery<Page<ApiTransaction>>(
    `/customer-api/businesses/${business.id}/api-transactions?${portalQuery(filters, page, environment)}`,
    undefined,
    revision,
  );
  let keysError = keys.error;
  let historyError = history.error;
  try {
    if (keys.data) assertKeyEnvironment(keys.data, environment);
  } catch (error) {
    keysError =
      error instanceof Error ? error.message : "Couldn’t read credentials for this environment.";
  }
  try {
    history.data?.content.forEach((row) =>
      assertTransactionEnvironment(row.transaction, environment),
    );
  } catch (error) {
    historyError =
      error instanceof Error ? error.message : "Couldn’t read activity for this environment.";
  }
  const activeFilters = Object.values(filters).filter(Boolean).length;
  function apply(event: FormEvent) {
    event.preventDefault();
    try {
      portalQuery(draft, 0, environment);
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
            placeholder={environment === "SANDBOX" ? "Exact SBX reference" : "Exact TX reference"}
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
      <ApiCredentials
        key={`${business.id}:${environment}`}
        businessId={business.id}
        environment={environment}
        keys={{ ...keys, error: keysError }}
        refresh={refresh}
      />
      <section className="panel history-panel">
        <div className="panel-heading">
          <div>
            <h2>{environment === "SANDBOX" ? "Sandbox API activity" : "Live API activity"}</h2>
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
        ) : historyError ? (
          <ErrorState message={historyError} retry={refresh} />
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
                    <th>{environment === "SANDBOX" ? "Test amount" : "Amount"}</th>
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
        {history.data && !historyError && (
          <Pagination
            page={history.data.number}
            pages={history.data.totalPages}
            total={history.data.totalElements}
            onChange={setPage}
          />
        )}
        <div className="panel-note">
          {environment === "SANDBOX"
            ? "Simulated amounts only. Sandbox activity is separate from real transactions and financial reporting."
            : "Amounts use each transaction’s fiat currency. Processing and unknown states are not confirmed failures."}
        </div>
      </section>
      {selected && (
        <TransactionDetail
          businessId={business.id}
          environment={environment}
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
  environment,
  onClose,
}: {
  businessId: number;
  reference: string;
  environment: ApiEnvironment;
  onClose: () => void;
}) {
  const [revision, setRevision] = useState(0);
  const refresh = () => setRevision((value) => value + 1);
  const detail = useQuery<ApiTransaction>(
    apiTransactionPath(businessId, reference, environment),
    undefined,
    revision,
  );
  const tx = detail.data?.transaction;
  let error = detail.error;
  try {
    if (tx) assertTransactionEnvironment(tx, environment);
  } catch (failure) {
    error = failure instanceof Error ? failure.message : "Couldn’t read transaction environment.";
  }
  const crypto = tx?.cryptoDetails;
  return (
    <Modal
      title={environment === "SANDBOX" ? "Sandbox payment details" : "Transaction details"}
      description={reference}
      onClose={onClose}
    >
      {detail.loading ? (
        <Loading />
      ) : error ? (
        <ErrorState message={error} retry={refresh} />
      ) : (
        tx && (
          <>
            {environment === "SANDBOX" && (
              <div className="info-box">
                SANDBOX · Simulated payment. No real wallet debit, credit or provider payment
                occurred. Do not fulfill real orders from this record.
              </div>
            )}
            <div className="transaction-hero">
              <strong>{money(tx.amount, tx.currency)}</strong>
              <Badge value={tx.status} />
            </div>
            <dl className="detail-list">
              {[
                ["Environment", environment],
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
            {tx.failureMessage && <p className="info-box">{tx.failureMessage}</p>}
            {["UNKNOWN", "MANUAL_INTERVENTION_REQUIRED"].includes(tx.status) && (
              <div className="info-box">
                This transaction needs investigation. Its status does not confirm failure or a
                refund. Contact Fondeka with the transaction reference.
              </div>
            )}
            {crypto && <CryptoPaymentInstructions details={crypto} environment={environment} />}
            {!crypto &&
              environment === "LIVE" &&
              ["PROCESSING", "INITIATED", "SUBMITTED"].includes(tx.status) && (
                <div className="info-box">
                  Payment instructions may still be on their way. Refresh to check the latest
                  status.
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
export function IntegrationGuide({ environment = "LIVE" }: { environment?: ApiEnvironment }) {
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
            Generate credentials for the selected environment above and store them on your backend.
            Amounts are fiat-wallet amounts, including crypto. A 202 response means accepted for
            processing.
          </p>
          {environment === "SANDBOX" && (
            <details className="sandbox-guide">
              <summary>Sandbox scenarios and webhooks</summary>
              <p>
                Use the same collection/payout routes with an fdk_biz_test_ key.
                X-Fondeka-Test-Scenario defaults to SUCCESS; the header must never be sent with a
                LIVE key.
              </p>
              <ul>
                <li>SUCCESS → completed</li>
                <li>INVALID_DESTINATION, INSUFFICIENT_FUNDS, PAYMENT_NOT_APPROVED → failed</li>
                <li>CANCELED, EXPIRED → canceled</li>
                <li>PENDING → keeps processing, without a terminal webhook</li>
              </ul>
              <p>
                Completion is asynchronous. There is no force-complete or cancel endpoint. Use a new
                idempotency key for a new test intent. Sandbox keys and signing secrets are separate
                from LIVE; validate the webhook environment and signature before fulfilling orders.
                Test events must never fulfill real orders.
              </p>
            </details>
          )}
        </div>
        <div className="code-window">
          <div>
            <span />
            <span />
            <span />
            <small>YOUR BACKEND · {environment} COLLECTION</small>
          </div>
          <pre>
            <code>{`POST /business-api/v1/businesses/{businessId}/collections\nX-API-Key: <${environment === "SANDBOX" ? "fdk_biz_test_ sandbox" : "server-side LIVE"} key>\nIdempotency-Key: ${environment === "SANDBOX" ? "sandbox-order-001\nX-Fondeka-Test-Scenario: SUCCESS" : "order-2026-0001"}\nContent-Type: application/json\n\n{\n  "amount": 10.00,\n  "currency": "USD",\n  "paymentMethodName": "MPESA_KENYA",\n  "accountRef": "${environment === "SANDBOX" ? "+254700000000" : "+254707371664"}",\n  "clientReference": "invoice-0001",\n  "feeApplicationMode": "EXCLUSIVE"\n}`}</code>
          </pre>
        </div>
      </section>
    </div>
  );
}
