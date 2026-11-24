"use client";
import { useUiText } from "@/lib/use-ui-text";
import { useI18n } from "@/lib/i18n";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import {
  Activity,
  ArrowDownLeft,
  ArrowUpRight,
  RefreshCw,
  ReceiptText,
  Copy,
  Check,
  Search,
  SlidersHorizontal,
} from "lucide-react";
import { MobileRecord, Empty, ErrorState, Loading, Modal, Pagination } from "./ui";
import { ApiPaymentBadge } from "./api-payment-badge";
import { CryptoPaymentInstructions } from "./crypto-payment-instructions";
import { useUrlState } from "@/lib/use-url-state";
import { useQuery } from "@/lib/use-query";
import { useMobileLayout } from "@/lib/use-mobile-layout";
import { date, money } from "@/lib/format";
import {
  emptyFilters,
  portalQuery,
  transactionStatuses,
  type PortalFilters,
} from "@/lib/portal-query";
import type { ApiEnvironment, ApiTransaction, Business, Page } from "@/lib/types";
import {
  apiTransactionContext,
  apiTransactionKind,
  apiReceiptFields,
} from "@/lib/api-transaction-display";
import { apiTransactionPath, assertTransactionEnvironment } from "@/lib/api-environment";
import {
  isPendingBusinessApiPayment,
  isTerminalBusinessApiPayment,
} from "@/lib/business-api-status";

function transactionIcon(action: string) {
  return action === "BUSINESS_API_BILL_PAYMENT"
    ? ReceiptText
    : action === "BUSINESS_API_PAYOUT"
      ? ArrowUpRight
      : action === "BUSINESS_API_COLLECTION"
        ? ArrowDownLeft
        : Activity;
}
function TransactionType({ action }: { action: string }) {
  const uiText = useUiText();
  const Icon = transactionIcon(action);
  return (
    <span className="direction api-transaction-type" data-kind={action}>
      <Icon size={16} aria-hidden="true" />
      {uiText(apiTransactionKind(action))}
    </span>
  );
}
function TransactionEnvironmentBadge({ environment }: { environment: ApiEnvironment }) {
  return <span className={`environment-tag ${environment.toLowerCase()}`}>{environment}</span>;
}
function TransactionContext({ row }: { row: ApiTransaction }) {
  const uiText = useUiText();
  const context = apiTransactionContext(row);
  return (
    <div className="api-transaction-context">
      <span>{context.title || "—"}</span>
      {context.account && (
        <small>
          {uiText(context.accountLabel)} · {context.account}
        </small>
      )}
      {context.operation && <small>{uiText(context.operation)}</small>}
    </div>
  );
}
function TransactionReceipt({
  receipt,
  bill,
}: {
  receipt: ApiTransaction["receipt"];
  bill: boolean;
}) {
  const uiText = useUiText();
  const fields = apiReceiptFields(receipt);
  const [copied, setCopied] = useState<number>();
  const [copyFailed, setCopyFailed] = useState(false);
  if (!fields.length)
    return bill ? <p className="muted small">{uiText("No receipt details available.")}</p> : null;
  return (
    <section className="api-transaction-receipt">
      <h3>{uiText("Receipt details")}</h3>
      <dl className="detail-list">
        {fields.map((field, index) => (
          <div key={`${field.label}:${index}`}>
            <dt>{uiText(field.label)}</dt>
            <dd>
              <span className={field.copyable ? "receipt-token" : undefined}>
                {field.format === "date"
                  ? date(field.value)
                  : field.format === "money"
                    ? money(field.value, field.currency)
                    : field.value}
              </span>
              {field.copyable && (
                <button
                  type="button"
                  className="icon-button"
                  aria-label={uiText(copied === index ? "Copied" : "Copy token")}
                  onClick={async () => {
                    try {
                      await navigator.clipboard.writeText(field.value);
                      setCopied(index);
                      setCopyFailed(false);
                    } catch {
                      setCopyFailed(true);
                    }
                  }}
                >
                  {copied === index ? (
                    <Check size={15} aria-hidden="true" />
                  ) : (
                    <Copy size={15} aria-hidden="true" />
                  )}
                </button>
              )}
            </dd>
          </div>
        ))}
      </dl>
      {copyFailed && (
        <p className="muted small" role="status">
          {uiText("Select the token text to copy it.")}
        </p>
      )}
    </section>
  );
}

export function ApiTransactions({
  business,
  environment,
}: {
  business: Business;
  environment: ApiEnvironment;
}) {
  const uiText = useUiText();
  const { language } = useI18n();
  const acceptedDate = (value: string) => {
    const instant = new Date(value);
    return Number.isFinite(instant.getTime())
      ? new Intl.DateTimeFormat(language, {
          dateStyle: "medium",
          timeStyle: "short",
        }).format(instant)
      : "—";
  };

  const navigation = useUrlState();
  const page = Math.max(0, Number(navigation.values.get("apiPage")) || 0);
  const setPage = (v: number) => navigation.update({ apiPage: v });
  const filters: PortalFilters = Object.fromEntries(
    Object.keys(emptyFilters).map((key) => [
      key,
      navigation.values.get(`api_${key}`) ??
        (key === "orderReference" ? navigation.values.get("api_clientReference") : null) ??
        "",
    ]),
  ) as unknown as PortalFilters;
  const filterKey = JSON.stringify(filters);
  const setFilters = (v: PortalFilters) =>
    navigation.update({
      ...Object.fromEntries(Object.entries(v).map(([key, value]) => [`api_${key}`, value || null])),
      api_clientReference: null,
      apiPage: 0,
    });
  const mobile = useMobileLayout();
  const [draft, setDraft] = useState<PortalFilters>(emptyFilters);
  useEffect(() => {
    setDraft(JSON.parse(filterKey));
  }, [filterKey]);
  const [filterOpen, setFilterOpen] = useState(false);
  const [filterError, setFilterError] = useState("");
  const reference = navigation.values.get("apiReference");
  const selected = reference
    ? { businessId: Number(navigation.values.get("apiDetailBusiness")) || business.id, reference }
    : undefined;
  const setSelected = (value?: { businessId: number; reference: string }) =>
    navigation.update({
      apiDetailBusiness: value?.businessId ?? null,
      apiReference: value?.reference ?? null,
    });
  const [revision, setRevision] = useState(0);
  const refresh = useCallback(() => setRevision((value) => value + 1), []);
  let historyPath: string | null = null;
  let routeFilterError = "";
  try {
    historyPath = `/customer-api/businesses/${business.id}/api-transactions?${portalQuery(filters, page, environment)}`;
  } catch (e) {
    routeFilterError = uiText(e instanceof Error ? e.message : "Check your filters.");
  }
  const history = useQuery<Page<ApiTransaction>>(historyPath, undefined, revision);
  let historyError = routeFilterError || history.error;
  try {
    history.data?.content.forEach((row) =>
      assertTransactionEnvironment(row.transaction, environment),
    );
  } catch (error) {
    historyError =
      error instanceof Error
        ? error.message
        : uiText("Couldn’t read activity for this environment.");
  }
  const activeFilters = Object.values(filters).filter(Boolean).length;
  function apply(event: FormEvent) {
    event.preventDefault();
    try {
      portalQuery(draft, 0, environment);
      setFilters({ ...draft });
      setFilterError("");
      if (mobile) setFilterOpen(false);
    } catch (error) {
      setFilterError(error instanceof Error ? error.message : uiText("Check your filters."));
    }
  }
  function update(key: keyof PortalFilters, value: string) {
    setDraft((current) => ({ ...current, [key]: value }));
  }
  const filterForm = (
    <form className="filter-form" onSubmit={apply}>
      <div className="filter-grid">
        <label>
          {uiText("Transaction type")}
          <select value={draft.action} onChange={(e) => update("action", e.target.value)}>
            <option value="">{uiText("All transaction types")}</option>
            <option value="BUSINESS_API_COLLECTION">{uiText("Collections")}</option>
            <option value="BUSINESS_API_PAYOUT">{uiText("Payouts")}</option>
            <option value="BUSINESS_API_BILL_PAYMENT">{uiText("Bill payments")}</option>
          </select>
        </label>
        <label>
          {uiText("Status")}
          <select value={draft.status} onChange={(e) => update("status", e.target.value)}>
            <option value="">{uiText("All statuses")}</option>
            {transactionStatuses.map((status) => (
              <option key={status} value={status}>
                {status}
              </option>
            ))}
          </select>
        </label>
        <label>
          {uiText("Fiat currency")}
          <input
            value={draft.currency}
            onChange={(e) => update("currency", e.target.value)}
            maxLength={3}
            placeholder={uiText("e.g. USD")}
          />
        </label>
        <label>
          {uiText("Fondeka reference")}
          <input
            value={draft.reference}
            onChange={(e) => update("reference", e.target.value)}
            maxLength={128}
            placeholder="fondekaReference"
          />
        </label>
        <label>
          {uiText("Merchant reference")}
          <input
            value={draft.orderReference}
            onChange={(e) => update("orderReference", e.target.value)}
            maxLength={128}
            placeholder={uiText("Exact order reference")}
          />
        </label>
        <label>
          {uiText("From date")}
          <input
            type="date"
            min="1970-01-01"
            value={draft.fromDate}
            onChange={(e) => update("fromDate", e.target.value)}
          />
        </label>
        <label>
          {uiText("To date")}
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
        <small>{uiText("Exact references · inclusive dates in your local timezone")}</small>
        <button
          type="button"
          className="text-button"
          onClick={() => {
            setDraft(emptyFilters);
            setFilters(emptyFilters);
            setFilterError("");
          }}
        >
          {uiText("Clear filters")}
        </button>
        <button className="button primary small">
          <Search size={14} />
          {uiText("Apply filters")}
        </button>
      </div>
    </form>
  );
  return (
    <>
      <section className="panel history-panel">
        <div className="panel-heading">
          <div>
            <h2>
              {environment === "SANDBOX"
                ? uiText("Sandbox API activity")
                : uiText("Live API activity")}
            </h2>
          </div>
          <div className="heading-actions">
            <button
              className={`button secondary small ${filterOpen ? "selected" : ""}`}
              onClick={() => setFilterOpen(!filterOpen)}
              aria-expanded={filterOpen}
            >
              <SlidersHorizontal size={15} />
              {uiText("Filters")}
              {activeFilters ? <span className="count-pill">{activeFilters}</span> : null}
            </button>
            <button
              className="icon-button bordered"
              aria-label={uiText("Refresh API activity")}
              onClick={refresh}
            >
              <RefreshCw size={16} />
            </button>
          </div>
        </div>
        {filterOpen &&
          (mobile ? (
            <Modal
              title={uiText("Filter API activity")}
              variant="sheet"
              onClose={() => setFilterOpen(false)}
            >
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
            icon={Activity}
            title={
              activeFilters
                ? uiText("No matching transactions")
                : uiText("Your API story starts here")
            }
            description={
              activeFilters
                ? uiText("Try changing your filters or widening the date range.")
                : uiText(
                    "Accepted collections, payouts and bill payments will appear here when your integration starts sending requests.",
                  )
            }
          />
        ) : (
          <>
            <div className="table-wrap desktop-table">
              <table className="api-history-table">
                <thead>
                  <tr>
                    <th>{uiText("Transaction")}</th>
                    <th>{uiText("Type")}</th>
                    <th>{uiText("Details")}</th>
                    <th>{environment === "SANDBOX" ? uiText("Test amount") : uiText("Amount")}</th>
                    <th>{uiText("Environment")}</th>
                    <th>{uiText("Accepted")}</th>
                    <th>{uiText("Status")}</th>
                    <th>
                      <span className="sr-only">{uiText("Details")}</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {history.data.content.map((row) => {
                    const { requestId, transaction: tx, createdAt } = row;
                    return (
                      <tr key={requestId}>
                        <td>
                          <button
                            className="table-name text-button"
                            onClick={() =>
                              setSelected({
                                businessId: business.id,
                                reference: tx.fondekaReference,
                              })
                            }
                          >
                            {tx.fondekaReference}
                          </button>
                          <small className="table-subtitle">
                            {tx.orderReference || uiText("No merchant reference")}
                          </small>
                        </td>
                        <td>
                          <TransactionType action={tx.action} />
                        </td>
                        <td>
                          <TransactionContext row={row} />
                        </td>
                        <td className="amount">{money(tx.amount, tx.currency)}</td>
                        <td>
                          <TransactionEnvironmentBadge environment={tx.environment} />
                        </td>
                        <td>
                          <time dateTime={createdAt} title={date(createdAt)}>
                            {acceptedDate(createdAt)}
                          </time>
                        </td>
                        <td>
                          <ApiPaymentBadge status={tx.status} />
                        </td>
                        <td>
                          <button
                            className="icon-button"
                            aria-label={uiText("View transaction") + " " + tx.fondekaReference}
                            onClick={() =>
                              setSelected({
                                businessId: business.id,
                                reference: tx.fondekaReference,
                              })
                            }
                          >
                            <ArrowUpRight size={16} />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <div className="mobile-record-list">
              {history.data.content.map((row) => {
                const { requestId, transaction: tx, createdAt } = row;
                const context = apiTransactionContext(row);
                const Icon = transactionIcon(tx.action);
                return (
                  <MobileRecord
                    key={requestId}
                    title={context.title || tx.orderReference || tx.fondekaReference}
                    subtitle={[context.account, tx.orderReference, tx.fondekaReference]
                      .filter(Boolean)
                      .join(" · ")}
                    meta={
                      <>
                        {uiText(apiTransactionKind(tx.action))} ·{" "}
                        <TransactionEnvironmentBadge environment={tx.environment} /> ·{" "}
                        {date(createdAt)}
                      </>
                    }
                    amount={money(tx.amount, tx.currency)}
                    badge={<ApiPaymentBadge status={tx.status} />}
                    icon={<Icon size={20} />}
                    onClick={() =>
                      setSelected({ businessId: business.id, reference: tx.fondekaReference })
                    }
                  />
                );
              })}
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
            ? uiText(
                "Simulated amounts only. Sandbox activity is separate from real transactions and financial reporting.",
              )
            : uiText(
                "Amounts use each transaction’s fiat currency. ACCEPTED and PROCESSING are awaiting an outcome; neither confirms success or failure.",
              )}
        </div>
      </section>
      {selected && (
        <TransactionDetail
          businessId={selected.businessId}
          environment={environment}
          reference={selected.reference}
          onClose={() => setSelected(undefined)}
          onTerminal={refresh}
        />
      )}
    </>
  );
}
export function TransactionDetail({
  businessId,
  reference,
  environment,
  onClose,
  onTerminal,
}: {
  businessId: number;
  reference: string;
  environment: ApiEnvironment;
  onClose: () => void;
  onTerminal: () => void;
}) {
  const uiText = useUiText();

  const detail = useQuery<ApiTransaction>(apiTransactionPath(businessId, reference, environment));
  const refresh = detail.refetch;
  const tx = detail.data?.transaction;
  let error = detail.error;
  try {
    if (detail.data) assertTransactionEnvironment(detail.data.transaction, environment);
  } catch (failure) {
    error =
      failure instanceof Error ? failure.message : uiText("Couldn’t read transaction environment.");
  }
  const status = !error ? tx?.status : undefined;
  const pending = isPendingBusinessApiPayment(status);
  useEffect(() => {
    // Refresh the current payment snapshot when reopening or returning to the page.
    const revalidate = () => {
      if (document.visibilityState === "visible") void refresh();
    };
    revalidate();
    window.addEventListener("focus", revalidate);
    document.addEventListener("visibilitychange", revalidate);
    return () => {
      window.removeEventListener("focus", revalidate);
      document.removeEventListener("visibilitychange", revalidate);
    };
  }, [businessId, reference, environment, refresh]);
  useEffect(() => {
    if (status && isTerminalBusinessApiPayment(status)) onTerminal();
  }, [status, onTerminal]);
  useEffect(() => {
    if (!pending || error) return;
    let active = true;
    let running = false;
    let delay = 3000;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const started = Date.now();
    const schedule = () => {
      if (
        !active ||
        running ||
        timer ||
        document.visibilityState !== "visible" ||
        Date.now() - started >= 300_000
      )
        return;
      timer = setTimeout(() => {
        timer = undefined;
        void check();
      }, delay);
    };
    const check = async () => {
      if (
        !active ||
        running ||
        document.visibilityState !== "visible" ||
        Date.now() - started >= 300_000
      )
        return;
      running = true;
      try {
        const latest = await refresh();
        if (latest && isTerminalBusinessApiPayment(latest.transaction?.status)) {
          active = false;
          return;
        }
      } finally {
        running = false;
        delay = Math.min(30_000, Math.round(delay * 1.5));
        schedule();
      }
    };
    const resume = () => {
      if (timer) clearTimeout(timer);
      timer = undefined;
      if (document.visibilityState === "visible") schedule();
    };
    schedule();
    window.addEventListener("focus", resume);
    document.addEventListener("visibilitychange", resume);
    return () => {
      active = false;
      if (timer) clearTimeout(timer);
      window.removeEventListener("focus", resume);
      document.removeEventListener("visibilitychange", resume);
    };
  }, [businessId, reference, environment, pending, error, refresh]);
  const bill = tx?.action === "BUSINESS_API_BILL_PAYMENT";
  const crypto = !bill ? tx?.cryptoDetails : undefined;
  const context = detail.data ? apiTransactionContext(detail.data) : undefined;
  const specificFields = bill
    ? [
        [uiText("Bill product"), context?.title],
        [uiText("Product code"), detail.data?.details?.billProductCode],
        [uiText("Bill account"), context?.account],
        [uiText("Operation"), context?.operation ? uiText(context.operation) : undefined],
        [
          uiText("Refund status"),
          typeof detail.data?.details?.refunded === "boolean"
            ? uiText(detail.data.details.refunded ? "Refunded" : "Not refunded")
            : undefined,
        ],
      ]
    : [
        [uiText("Payment method"), context?.title],
        [uiText(context?.accountLabel || "Account"), context?.account],
      ];
  return (
    <Modal
      title={
        environment === "SANDBOX"
          ? uiText("Sandbox payment details")
          : uiText("Transaction details")
      }
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
                {uiText(
                  "SANDBOX · Simulated payment. No real wallet debit, credit or provider payment occurred. Fees, debits, credits and refunds shown here apply only to virtual funds. Do not fulfill real orders from this record.",
                )}
              </div>
            )}
            <div className="transaction-hero">
              <strong>{money(tx.amount, tx.currency)}</strong>
              <ApiPaymentBadge status={tx.status} />
            </div>
            <TransactionReceipt receipt={detail.data?.receipt} bill={bill} />
            <dl className="detail-list">
              {[
                [uiText("Environment"), environment],
                [uiText("Type"), uiText(apiTransactionKind(tx.action))],
                ...specificFields.filter(([, value]) => value != null && value !== ""),
                [uiText("Fondeka reference"), tx.fondekaReference],
                [uiText("Merchant reference"), tx.orderReference || "—"],
                [uiText("Integration"), detail.data?.apiKeyName || "—"],
                [uiText("Accepted"), date(detail.data?.createdAt)],
                [uiText("Last updated"), date(detail.data?.updatedAt)],
                [uiText(bill ? "Bill amount" : "Net amount"), money(tx.amount, tx.currency)],
                [uiText("Fee"), money(tx.fee, tx.currency)],
                [uiText("Gross amount"), money(tx.grossAmount, tx.currency)],
              ].map(([key, value]) => (
                <div key={key}>
                  <dt>{key}</dt>
                  <dd>{value}</dd>
                </div>
              ))}
            </dl>
            {tx.status === "FAILED" && (
              <p className="info-box">
                {tx.failureMessage ||
                  tx.failureCode ||
                  uiText("Payment unsuccessful. No failure details are available.")}
              </p>
            )}
            {tx.status === "ACCEPTED" && (
              <div className="info-box">
                {uiText(
                  "Payment queued for execution. Keep this reference while we check for updates. A payout or bill payment may already reserve or debit funds at this stage.",
                )}
              </div>
            )}
            {tx.status === "PROCESSING" && (
              <div className="info-box">
                {uiText(
                  "Payment processing. Long-running payments may need provider or manual reconciliation. Keep this reference and investigate before creating a replacement payment.",
                )}
              </div>
            )}
            {crypto && <CryptoPaymentInstructions details={crypto} environment={environment} />}
            {!bill && !crypto && environment === "LIVE" && pending && (
              <div className="info-box">
                {uiText(
                  "Payment instructions may still be on their way. Refresh to check the latest status.",
                )}
              </div>
            )}
            {detail.refreshError && (
              <p className="info-box" role="status">
                {uiText(
                  "Couldn’t refresh the payment. Showing its last known status; this does not mean the payment failed.",
                )}
              </p>
            )}
            <div className="modal-actions">
              <button className="button secondary" onClick={refresh}>
                <RefreshCw size={15} />
                {uiText("Refresh status")}
              </button>
              <button className="button primary" onClick={onClose}>
                {uiText("Done")}
              </button>
            </div>
          </>
        )
      )}
    </Modal>
  );
}
