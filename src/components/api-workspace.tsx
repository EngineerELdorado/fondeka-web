"use client";
import { useUiText } from "@/lib/use-ui-text";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import {
  Activity,
  ArrowDownLeft,
  ArrowUpRight,
  RefreshCw,
  Search,
  SlidersHorizontal,
} from "lucide-react";
import { Badge, MobileRecord, Empty, ErrorState, Loading, Modal, Pagination } from "./ui";
import { CryptoPaymentInstructions } from "./crypto-payment-instructions";
import { useUrlState } from "@/lib/use-url-state";
import { useQuery } from "@/lib/use-query";
import { useMobileLayout } from "@/lib/use-mobile-layout";
import { date, label, money } from "@/lib/format";
import {
  emptyFilters,
  portalQuery,
  transactionStatuses,
  type PortalFilters,
} from "@/lib/portal-query";
import type { ApiEnvironment, ApiTransaction, Business, Page } from "@/lib/types";
import { apiTransactionPath, assertTransactionEnvironment } from "@/lib/api-environment";
import { isTerminalBusinessApiPayment } from "@/lib/business-api-status";

export function ApiTransactions({
  business,
  environment,
}: {
  business: Business;
  environment: ApiEnvironment;
}) {
  const uiText = useUiText();

  const navigation = useUrlState();
  const page = Math.max(0, Number(navigation.values.get("apiPage")) || 0);
  const setPage = (v: number) => navigation.update({ apiPage: v });
  const filters: PortalFilters = Object.fromEntries(
    Object.keys(emptyFilters).map((key) => [key, navigation.values.get(`api_${key}`) || ""]),
  ) as unknown as PortalFilters;
  const filterKey = JSON.stringify(filters);
  const setFilters = (v: PortalFilters) =>
    navigation.update({
      ...Object.fromEntries(Object.entries(v).map(([key, value]) => [`api_${key}`, value || null])),
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
          {uiText("Direction")}
          <select value={draft.action} onChange={(e) => update("action", e.target.value)}>
            <option value="">{uiText("Collections & payouts")}</option>
            <option value="BUSINESS_API_COLLECTION">{uiText("Collections")}</option>
            <option value="BUSINESS_API_PAYOUT">{uiText("Payouts")}</option>
          </select>
        </label>
        <label>
          {uiText("Status")}
          <select value={draft.status} onChange={(e) => update("status", e.target.value)}>
            <option value="">{uiText("All statuses")}</option>
            {transactionStatuses.map((status) => (
              <option key={status} value={status}>
                {label(status)}
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
            placeholder={
              environment === "SANDBOX"
                ? uiText("Exact SBX reference")
                : uiText("Exact TX reference")
            }
          />
        </label>
        <label>
          {uiText("Merchant reference")}
          <input
            value={draft.clientReference}
            onChange={(e) => update("clientReference", e.target.value)}
            maxLength={128}
            placeholder={uiText("Exact client reference")}
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
                    "Accepted collections and payouts will appear here when your integration starts sending requests.",
                  )
            }
          />
        ) : (
          <>
            <div className="table-wrap desktop-table">
              <table>
                <thead>
                  <tr>
                    <th>{uiText("Transaction")}</th>
                    <th>{uiText("Direction")}</th>
                    <th>{environment === "SANDBOX" ? uiText("Test amount") : uiText("Amount")}</th>
                    <th>{uiText("Integration")}</th>
                    <th>{uiText("Accepted")}</th>
                    <th>{uiText("Status")}</th>
                    <th>
                      <span className="sr-only">{uiText("Details")}</span>
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
                            onClick={() =>
                              setSelected({ businessId: business.id, reference: tx.reference })
                            }
                          >
                            {tx.reference}
                          </button>
                          <small className="table-subtitle">
                            {tx.clientReference || uiText("No merchant reference")}
                          </small>
                        </td>
                        <td>
                          <span className="direction">
                            {tx.action === "BUSINESS_API_PAYOUT" ? (
                              <ArrowUpRight size={16} />
                            ) : (
                              <ArrowDownLeft size={16} />
                            )}{" "}
                            {tx.action === "BUSINESS_API_PAYOUT"
                              ? uiText("Payout")
                              : uiText("Collection")}
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
                            aria-label={uiText("View transaction") + " " + tx.reference}
                            onClick={() =>
                              setSelected({ businessId: business.id, reference: tx.reference })
                            }
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
                  meta={`${tx.action === "BUSINESS_API_PAYOUT" ? uiText("Payout") : uiText("Collection")} · ${date(createdAt)}`}
                  amount={money(tx.amount, tx.currency)}
                  status={tx.status}
                  icon={
                    tx.action === "BUSINESS_API_PAYOUT" ? (
                      <ArrowUpRight size={20} />
                    ) : (
                      <ArrowDownLeft size={20} />
                    )
                  }
                  onClick={() => setSelected({ businessId: business.id, reference: tx.reference })}
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
            ? uiText(
                "Simulated amounts only. Sandbox activity is separate from real transactions and financial reporting.",
              )
            : uiText(
                "Amounts use each transaction’s fiat currency. Processing and unknown states are not confirmed failures.",
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
  useEffect(() => {
    if (status && isTerminalBusinessApiPayment(status)) onTerminal();
  }, [status, onTerminal]);
  useEffect(() => {
    if (status !== "PROCESSING" || error) return;
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
        if (latest && latest.transaction?.status !== "PROCESSING") {
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
  }, [businessId, reference, environment, status, error, refresh]);
  const crypto = tx?.cryptoDetails;
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
              <Badge value={tx.status} />
            </div>
            <dl className="detail-list">
              {[
                [uiText("Environment"), environment],
                [
                  uiText("Direction"),
                  tx.action === "BUSINESS_API_PAYOUT" ? uiText("Payout") : uiText("Collection"),
                ],
                [uiText("Merchant reference"), tx.clientReference || "—"],
                [uiText("Integration"), detail.data?.apiKeyName || "—"],
                [uiText("Accepted"), date(detail.data?.createdAt)],
                [uiText("Last updated"), date(detail.data?.updatedAt)],
                [uiText("Gross amount"), money(tx.grossAmount, tx.currency)],
                [uiText("Fees"), money(tx.allFees, tx.currency)],
                [uiText("Settlement net"), money(tx.settlementNet, tx.currency)],
                [
                  environment === "SANDBOX" ? uiText("Virtual refund posted") : uiText("Refunded"),
                  tx.refunded === true ? uiText("Yes") : tx.refunded === false ? uiText("No") : "—",
                ],
              ].map(([key, value]) => (
                <div key={key}>
                  <dt>{key}</dt>
                  <dd>{value}</dd>
                </div>
              ))}
            </dl>
            {tx.status === "FAILED" && (tx.failureMessage || tx.failureCode) && (
              <p className="info-box">{tx.failureMessage || tx.failureCode}</p>
            )}
            {tx.status === "PROCESSING" && (
              <div className="info-box">
                {uiText(
                  "Payment processing. Long-running payments may need provider or manual reconciliation. Keep this reference and investigate before creating a replacement payment.",
                )}
              </div>
            )}
            {crypto && <CryptoPaymentInstructions details={crypto} environment={environment} />}
            {!crypto && environment === "LIVE" && tx.status === "PROCESSING" && (
              <div className="info-box">
                {uiText(
                  "Payment instructions may still be on their way. Refresh to check the latest status.",
                )}
              </div>
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
