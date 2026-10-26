"use client";
import { useUiText } from "@/lib/use-ui-text";
import { currencyPresentations } from "@/lib/currency-choices";
import { CurrencyIdentity } from "./currency-identity";

import { useEffect, useState, useSyncExternalStore } from "react";
import { ArrowDownLeft, ArrowUpRight, ArrowRightLeft, Plus, RefreshCw, Wallet } from "lucide-react";
import { useWorkspace } from "./workspace-provider";
import { Empty, ErrorState, Loading, Modal, Pagination } from "./ui";
import { useQuery } from "@/lib/use-query";
import { request } from "@/lib/data";
import { date, label, money } from "@/lib/format";
import { SandboxFundingClient } from "@/lib/sandbox-funding";
import { SandboxConversionClient } from "@/lib/sandbox-conversion";
import { ConversionRecovery, SandboxConversionDialog } from "./sandbox-conversion";
import {
  apiWalletsPath,
  parseApiWallets,
  parseSandboxEntries,
  sandboxEntriesPath,
} from "@/lib/api-wallets";
import type { ApiEnvironment, ApiWallet } from "@/lib/types";

type OpenPayment = (businessId: number, reference: string) => void;
export function ApiWallets({
  businessId,
  environment,
  revision,
  refresh,
  onOpenPayment,
}: {
  businessId: number;
  environment: ApiEnvironment;
  revision: number;
  refresh: () => void;
  onOpenPayment: OpenPayment;
}) {
  const uiText = useUiText();

  const { accountKey } = useWorkspace();
  const currencyProducts = useQuery<unknown>("/customer-api/fiat-wallets/currencies");
  const currencyMedia = currencyPresentations(currencyProducts.data);
  const [ledger, setLedger] = useState<string>();
  const [fundingOpen, setFundingOpen] = useState(false);
  const [funding, setFunding] = useState<SandboxFundingClient>();
  const [conversion, setConversion] = useState<SandboxConversionClient>();
  const [conversionOpen, setConversionOpen] = useState(false);
  const query = useQuery<unknown>(apiWalletsPath(businessId, environment), undefined, revision);
  let error = query.error;
  let wallets: ApiWallet[] | undefined;
  try {
    if (!query.loading && !query.error) wallets = parseApiWallets(query.data, environment);
  } catch (failure) {
    error =
      failure instanceof Error ? failure.message : uiText("Wallet balances could not be read.");
  }
  useEffect(() => {
    if (environment !== "SANDBOX" || !accountKey) return;
    const client = new SandboxFundingClient({
      accountKey,
      businessId,
      storage: {
        getItem: (key) => sessionStorage.getItem(key),
        setItem: (key, value) => sessionStorage.setItem(key, value),
        removeItem: (key) => sessionStorage.removeItem(key),
      },
      request,
      onSettled: refresh,
    });
    setFunding(client);
    const conversions = new SandboxConversionClient({
      accountKey,
      businessId,
      request,
      onSettled: refresh,
      storage: {
        getItem: (key) => sessionStorage.getItem(key),
        setItem: (key, value) => sessionStorage.setItem(key, value),
        removeItem: (key) => sessionStorage.removeItem(key),
      },
    });
    setConversion(conversions);
    return () => {
      client.dispose();
      conversions.dispose();
    };
  }, [accountKey, businessId, environment, refresh]);
  return (
    <section
      className={`panel api-wallet-panel ${environment === "SANDBOX" ? "sandbox" : ""}`}
      aria-label={
        environment === "SANDBOX"
          ? uiText("Sandbox account wallets")
          : uiText("Live account wallets")
      }
    >
      <div className="panel-heading">
        <div>
          <h2>
            <Wallet size={18} />{" "}
            {environment === "SANDBOX" ? uiText("Sandbox wallets") : uiText("Account wallets")}
          </h2>
          <p className="muted">
            {environment === "SANDBOX"
              ? uiText("Test funds shared across your Businesses, by fiat currency.")
              : uiText("Your account’s fiat balances, shared across its Businesses.")}
          </p>
        </div>
        <div className="heading-actions wallet-actions">
          {environment === "SANDBOX" && funding && (
            <button
              className="button secondary small"
              disabled={query.loading || !!error}
              onClick={() => {
                funding.resetCompleted();
                setFundingOpen(true);
              }}
            >
              <Plus size={15} />
              {uiText("Add test funds")}
            </button>
          )}
          {environment === "SANDBOX" && conversion && (
            <button
              className="button secondary small"
              disabled={query.loading || !!error}
              onClick={() => {
                conversion.resetCompleted();
                setConversionOpen(true);
              }}
            >
              <ArrowRightLeft size={15} />
              {uiText("Convert")}
            </button>
          )}
          <button
            className="icon-button bordered"
            aria-label={uiText("Refresh wallet balances")}
            onClick={refresh}
          >
            <RefreshCw size={16} />
          </button>
        </div>
      </div>
      {query.refreshError && (
        <div className="wallet-recovery" role="status">
          <span>{uiText("Couldn’t refresh balances. Showing the last loaded balances.")}</span>
          <button type="button" className="text-button" onClick={refresh}>
            {uiText("Refresh")}
          </button>
        </div>
      )}
      {environment === "SANDBOX" && funding && (
        <FundingRecovery client={funding} onOpen={() => setFundingOpen(true)} />
      )}
      {environment === "SANDBOX" && conversion && (
        <ConversionRecovery client={conversion} onOpen={() => setConversionOpen(true)} />
      )}
      {query.loading ? (
        <Loading rows={2} />
      ) : error ? (
        <ErrorState message={error} retry={refresh} />
      ) : wallets?.length ? (
        <div className="api-wallet-grid">
          {wallets.map((wallet) => (
            <div className="api-wallet-card" key={wallet.currency}>
              <div className="api-wallet-card-heading">
                <CurrencyIdentity
                  currency={wallet.currency}
                  metadata={currencyMedia.get(wallet.currency)}
                />
                <span className={`environment-tag ${environment === "SANDBOX" ? "sandbox" : ""}`}>
                  {environment === "SANDBOX" ? uiText("Test funds") : "LIVE"}
                </span>
              </div>
              <strong>{money(wallet.balance, wallet.currency)}</strong>
              {environment === "SANDBOX" ? (
                <button className="text-button" onClick={() => setLedger(wallet.currency)}>
                  {uiText("View movements")}
                  <ArrowUpRight size={15} />
                </button>
              ) : (
                <small>{uiText("Account balance")}</small>
              )}
            </div>
          ))}
        </div>
      ) : (
        <Empty
          icon={Wallet}
          title={
            environment === "SANDBOX"
              ? uiText("No sandbox wallets yet")
              : uiText("No account wallets to display")
          }
          description={
            environment === "SANDBOX"
              ? uiText("Start with a simulated collection or add test funds.")
              : uiText("Your fiat wallets will appear here.")
          }
        />
      )}
      <div className="panel-note">
        {environment === "SANDBOX"
          ? uiText(
              "Virtual money only. It cannot fund LIVE payments, real wallets or Business Tools activation.",
            )
          : uiText(
              "These are account balances, not separate balances for this Business. Currencies are shown individually.",
            )}
      </div>
      {ledger && (
        <WalletLedger
          key={ledger}
          businessId={businessId}
          currency={ledger}
          revision={revision}
          refresh={refresh}
          onClose={() => setLedger(undefined)}
          onOpenPayment={(id, reference) => {
            setLedger(undefined);
            onOpenPayment(id, reference);
          }}
        />
      )}
      {fundingOpen && funding && (
        <FundingDialog
          client={funding}
          initialCurrency={wallets?.[0]?.currency || ""}
          onClose={() => setFundingOpen(false)}
        />
      )}
      {conversionOpen && conversion && (
        <SandboxConversionDialog
          client={conversion}
          initialCurrency={wallets?.[0]?.currency || ""}
          onClose={() => setConversionOpen(false)}
        />
      )}
    </section>
  );
}
function FundingRecovery({ client, onOpen }: { client: SandboxFundingClient; onOpen: () => void }) {
  const uiText = useUiText();

  const state = useSyncExternalStore(client.subscribe, client.getSnapshot, client.getSnapshot);
  if (!state.intent) return null;
  return (
    <div className="wallet-recovery" role="status">
      <span>
        {state.busy
          ? uiText("Adding test funds…")
          : uiText("A test-funding request needs confirmation.")}{" "}
        {money(state.intent.body.amount, state.intent.body.currency)}
        {uiText("· Business #")}
        {state.intent.businessId}
      </span>
      <button className="text-button" onClick={onOpen}>
        {uiText("View request")}
      </button>
    </div>
  );
}
function FundingDialog({
  client,
  initialCurrency,
  onClose,
}: {
  client: SandboxFundingClient;
  initialCurrency: string;
  onClose: () => void;
}) {
  const uiText = useUiText();

  const state = useSyncExternalStore(client.subscribe, client.getSnapshot, client.getSnapshot);
  const [currency, setCurrency] = useState(state.intent?.body.currency || initialCurrency);
  const [amount, setAmount] = useState(state.intent ? String(state.intent.body.amount) : "");
  const fixed = state.busy || !!state.intent || state.blocked;
  const shownCurrency = state.intent?.body.currency || currency;
  const shownAmount = state.intent ? String(state.intent.body.amount) : amount;
  return (
    <Modal
      title={state.result ? uiText("Test funds added") : uiText("Add sandbox test funds")}
      description={uiText("SANDBOX · No real money is added or charged.")}
      onClose={onClose}
      busy={state.busy}
    >
      {state.result ? (
        <>
          <div className="transaction-hero">
            <strong>{money(state.result.amount, state.result.currency)}</strong>
            <span className="environment-tag sandbox">{uiText("TEST FUNDS")}</span>
          </div>
          <dl className="detail-list">
            <div>
              <dt>{uiText("Movement")}</dt>
              <dd>#{state.result.sequence}</dd>
            </div>
            <div>
              <dt>{uiText("Initiating Business")}</dt>
              <dd>#{state.result.businessId}</dd>
            </div>
            <div>
              <dt>{uiText("Balance after this movement")}</dt>
              <dd>{money(state.result.balanceAfter, state.result.currency)}</dd>
            </div>
          </dl>
          <p className="info-box">
            {uiText(
              "This is the saved movement snapshot. Wallet balances have been refreshed separately for the current balance.",
            )}
          </p>
          <div className="modal-actions">
            <button className="button primary" onClick={onClose}>
              {uiText("Done")}
            </button>
          </div>
        </>
      ) : (
        <form
          className="form-stack"
          onSubmit={(event) => {
            event.preventDefault();
            void client.submit(currency, amount);
          }}
        >
          <div className="info-box">
            {uiText(
              "Test funds are shared by your account’s Businesses in this currency. They cannot be withdrawn, used for real payments or used to activate Business Tools.",
            )}
          </div>
          <label>
            {uiText("Fiat currency")}
            <input
              value={shownCurrency}
              onChange={(event) => setCurrency(event.target.value.toUpperCase())}
              disabled={fixed}
              placeholder={uiText("e.g. USD")}
              maxLength={3}
              required
            />
          </label>
          <label>
            {uiText("Test amount")}
            <input
              value={shownAmount}
              onChange={(event) => setAmount(event.target.value)}
              disabled={fixed}
              inputMode="decimal"
              placeholder="0.00"
              required
            />
          </label>
          <small className="muted">
            {uiText(
              "Between 0.01 and 1,000,000 units per request. Funding and wallet limits also apply.",
            )}
          </small>
          {state.intent && (
            <p className="info-box">
              {state.busy
                ? uiText("Confirming this funding request.")
                : uiText(
                    "The previous result is unconfirmed. Retry this same funding request to recover its result.",
                  )}{" "}
              {uiText(
                "Its currency, amount and request key stay unchanged. This does not start another top-up.",
              )}
            </p>
          )}
          {state.error && (
            <p className="form-error" role="alert">
              {state.error}
            </p>
          )}
          <div className="modal-actions">
            <button
              type="button"
              className="button secondary"
              disabled={state.busy}
              onClick={onClose}
            >
              {uiText("Back")}
            </button>
            <button className="button primary" disabled={state.busy || state.blocked}>
              {state.busy ? (
                <>
                  <span className="spinner" />
                  {uiText("Confirming…")}
                </>
              ) : state.intent ? (
                uiText("Retry same test funding")
              ) : (
                uiText("Add test funds")
              )}
            </button>
          </div>
        </form>
      )}
    </Modal>
  );
}
function WalletLedger({
  businessId,
  currency,
  revision,
  refresh,
  onClose,
  onOpenPayment,
}: {
  businessId: number;
  currency: string;
  revision: number;
  refresh: () => void;
  onClose: () => void;
  onOpenPayment: OpenPayment;
}) {
  const uiText = useUiText();

  const [page, setPage] = useState(0);
  const query = useQuery<unknown>(
    sandboxEntriesPath(businessId, currency, page),
    undefined,
    revision,
  );
  let error = query.error;
  let history;
  try {
    if (!query.loading && !query.error) history = parseSandboxEntries(query.data, currency);
  } catch (failure) {
    error =
      failure instanceof Error ? failure.message : uiText("Wallet history could not be read.");
  }
  return (
    <Modal
      title={currency + " · " + uiText("Sandbox movements")}
      description={uiText("Account-wide test ledger · Newest movement first")}
      onClose={onClose}
    >
      <p className="info-box">
        {uiText(
          "Includes movements from all your Businesses sharing this currency. Amounts are virtual. Each balance is the snapshot after that movement.",
        )}
      </p>
      {query.loading ? (
        <Loading />
      ) : error ? (
        <ErrorState message={error} retry={refresh} />
      ) : !history?.content.length ? (
        <Empty
          title={uiText("No movements yet")}
          description={uiText(
            "Read-only balance checks do not create ledger entries. A completed collection or test funding can add virtual funds.",
          )}
        />
      ) : (
        <>
          <div className="wallet-movements">
            {history.content.map((entry) => (
              <article className="wallet-movement" key={entry.id}>
                <div className="wallet-movement-heading">
                  <span className="wallet-movement-icon">
                    {entry.amount < 0 ? <ArrowUpRight size={19} /> : <ArrowDownLeft size={19} />}
                  </span>
                  <div>
                    <strong>{label(entry.kind)}</strong>
                    <small>
                      #{entry.sequence} · {date(entry.createdAt)}
                    </small>
                  </div>
                  <strong className={entry.amount > 0 ? "wallet-credit" : ""}>
                    {entry.amount > 0 ? "+" : ""}
                    {money(entry.amount, entry.currency)}
                  </strong>
                </div>
                <dl className="detail-list">
                  <div>
                    <dt>{uiText("Balance after")}</dt>
                    <dd>{money(entry.balanceAfter, entry.currency)}</dd>
                  </div>
                  <div>
                    <dt>{uiText("Initiating Business")}</dt>
                    <dd>#{entry.businessId}</dd>
                  </div>
                  {entry.paymentReference && (
                    <div>
                      <dt>{uiText("Sandbox payment")}</dt>
                      <dd>
                        <button
                          className="text-button mono wallet-payment-link"
                          onClick={() => onOpenPayment(entry.businessId, entry.paymentReference!)}
                        >
                          {entry.paymentReference}
                          <ArrowUpRight size={14} />
                        </button>
                      </dd>
                    </div>
                  )}
                  {entry.conversionId && (
                    <div className="conversion-correlation">
                      <dt>{uiText("Conversion ID")}</dt>
                      <dd className="mono">{entry.conversionId}</dd>
                    </div>
                  )}
                </dl>
              </article>
            ))}
          </div>
          <Pagination
            page={history.number}
            pages={history.totalPages}
            total={history.totalElements}
            onChange={setPage}
          />
        </>
      )}
      <div className="modal-actions">
        <button className="button secondary" onClick={refresh}>
          <RefreshCw size={15} />
          {uiText("Refresh movements")}
        </button>
        <button className="button primary" onClick={onClose}>
          {uiText("Done")}
        </button>
      </div>
    </Modal>
  );
}
