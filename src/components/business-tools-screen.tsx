"use client";

import { useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import {
  Banknote,
  Check,
  Code2,
  CreditCard,
  Link2,
  LockKeyhole,
  Monitor,
  RefreshCw,
  ShieldCheck,
  Store,
} from "lucide-react";
import {
  accessDecision,
  billingLabel,
  buildSelection,
  canAfford,
  isFiatCurrency,
  isPositiveId,
  methodKey,
  normalizeMethods,
  parsePurchase,
  parseQuote,
  paymentClientVersion,
  quotePath,
  subscriptionsPath,
  type BusinessToolsAccess,
  type BusinessToolsPurchase,
  type PaymentMethod,
  type PaymentSelection,
  type PaymentTransaction,
  type ReviewedQuote,
} from "@/lib/business-tools";
import { request } from "@/lib/data";
import { label, money } from "@/lib/format";
import { useQuery } from "@/lib/use-query";
import { useBusinessTools } from "./business-tools-provider";
import { CryptoPaymentInstructions } from "./crypto-payment-instructions";
import { useWorkspace } from "./workspace-provider";
import { Badge, ErrorState, Loading, Modal, SubmitButton } from "./ui";

export const businessTools = [
  {
    title: "Collecte",
    description: "Payment links & invoices",
    href: "/payment-requests",
    icon: Link2,
    color: "mint",
  },
  {
    title: "Online Stores",
    description: "Stores, products & orders",
    href: "/stores",
    icon: Store,
    color: "peach",
  },
  {
    title: "POS",
    description: "In-person sales & checkout",
    href: "/pos",
    icon: Monitor,
    color: "blue",
  },
  {
    title: "API",
    description: "Credentials & integrations",
    href: "/developers",
    icon: Code2,
    color: "lilac",
  },
];
export function ActiveAccessPaymentNotice() {
  const { state } = useBusinessTools();
  const [open, setOpen] = useState(false);
  const pending = state.access?.accessGranted ? state.access.pendingPurchase : null;
  if (!pending) return null;
  return (
    <>
      <aside className="info-box active-payment-notice" aria-label="Earlier Business Tools payment">
        <ShieldCheck size={21} />
        <p>
          <strong>Your tools are active.</strong> An earlier activation payment is still processing.
        </p>
        <button className="button secondary small" onClick={() => setOpen(true)}>
          View payment status
        </button>
      </aside>
      {open && (
        <ExistingPaymentDialog key={pending.id} id={pending.id} onClose={() => setOpen(false)} />
      )}
    </>
  );
}

function ExistingPaymentDialog({ id, onClose }: { id: string; onClose: () => void }) {
  const { client } = useBusinessTools();
  const { refresh } = useWorkspace();
  const [attempt, setAttempt] = useState(0);
  const [result, setResult] = useState<{
    attempt: number;
    purchase?: BusinessToolsPurchase;
    error?: string;
  }>();
  useEffect(() => {
    let active = true;
    const abort = new AbortController();
    void request(`${subscriptionsPath}/${id}`, { method: "GET", signal: abort.signal })
      .then(parsePurchase)
      .then(
        (purchase) => {
          if (!active) return;
          setResult({ attempt, purchase });
          if (!purchase.accessGranted || !purchase.access.accessGranted) void client.reload();
          if (purchase.status !== "PENDING") refresh();
        },
        (error) => {
          if (active)
            setResult({
              attempt,
              error: error instanceof Error ? error.message : "Couldn’t check payment status.",
            });
        },
      );
    return () => {
      active = false;
      abort.abort();
    };
  }, [id, attempt, client, refresh]);
  const waiting = result?.attempt !== attempt;
  const purchase = result?.purchase;
  const close = () => {
    onClose();
    if (purchase && purchase.status !== "PENDING") void client.reload();
  };
  return (
    <Modal
      title="Business Tools payment"
      description="Your tools are available. This is an earlier payment, and no new payment will be started here."
      onClose={close}
    >
      {waiting ? (
        <Loading rows={2} />
      ) : result?.error ? (
        <ErrorState message={result.error} retry={() => setAttempt((value) => value + 1)} />
      ) : (
        purchase && (
          <>
            <Badge value={purchase.status} />
            <div className="access-purchase-id">
              <small>Purchase reference</small>
              <code>{id}</code>
            </div>
            <p className="muted">
              {purchase.failureMessage ||
                (purchase.status === "PENDING"
                  ? "This payment is still processing. Closing this window does not cancel it. Contact Fondeka support with your purchase reference if you need help."
                  : `Payment status: ${label(purchase.status).toLowerCase()}.`)}
            </p>
            {purchase.status === "PENDING" && <PaymentInstructions purchase={purchase} />}
            <div className="access-actions">
              <button className="button secondary" onClick={() => setAttempt((value) => value + 1)}>
                <RefreshCw size={16} /> Check status
              </button>
              <button className="button primary" onClick={close}>
                Done
              </button>
            </div>
          </>
        )
      )}
    </Modal>
  );
}

export function BusinessToolsScreen() {
  const { client, state } = useBusinessTools();
  const access = state.access;
  if (!access) return <Loading />;
  const decision = accessDecision(access);
  const purchase = state.purchase;
  const problem = state.error;
  const language = typeof document === "undefined" ? "en" : document.documentElement.lang;
  const fr = language.startsWith("fr");
  const pending = !!access.pendingPurchase || purchase?.status === "PENDING";
  return (
    <section className="business-access panel" aria-label="Business Tools access">
      <div className="business-access-offer">
        <span className="tool-icon mint">
          <LockKeyhole size={24} />
        </span>
        <span className="eyebrow">ONE ACCOUNT · FOUR TOOLS</span>
        <h2>
          Your business toolkit.
          <br />
          One activation.
        </h2>
        <p>
          Activate Collecte, Online Stores, POS and API management for your Fondeka account.
          Additional stores are included.
        </p>
        <div className="business-access-tools">
          {businessTools.map(({ title, icon: Icon }) => (
            <span key={title}>
              <Icon size={19} />
              <strong>{title}</strong>
              <Check size={14} />
            </span>
          ))}
        </div>
        <div className="business-plan-price">
          <span>{access.plan.name}</span>
          <strong>
            {access.pricing.planAmount > 0
              ? money(access.pricing.planAmount, access.pricing.currency)
              : "Pricing unavailable"}
          </strong>
          <small>
            {access.pricing.currency} · {billingLabel(access.plan.billingMode, language)}
          </small>
        </div>
        {access.pricing.planAmount > 0 && (decision !== "review" || purchase) && (
          <div className="business-pricing-summary">
            {(pending || purchase) && <small className="muted">Accepted purchase pricing</small>}
            <PricingSummary access={access} historical={pending || !!purchase} />
          </div>
        )}
        <small className="muted">Payment fees are shown separately before confirmation.</small>
      </div>
      <div className="business-access-payment" aria-busy={state.loading || state.busy}>
        {problem ? (
          <ErrorState
            message={problem}
            retry={() => void (purchase?.id ? client.checkStatus() : client.reload())}
          />
        ) : state.uncertain || state.intent ? (
          <>
            <span className="tool-icon peach">
              <RefreshCw size={23} />
            </span>
            <h3>Checking your payment</h3>
            <p>
              The submission may already have been accepted. Check access or continue the same
              payment; your original payment selection will be kept.
            </p>
            {state.submissionError && <div className="info-box">{state.submissionError}</div>}
            {state.intent && (
              <dl className="detail-list">
                <div>
                  <dt>Payment currency</dt>
                  <dd>{state.intent.paymentMethod.currency}</dd>
                </div>
                <div>
                  <dt>Recovery reference</dt>
                  <dd>{state.intent.idempotencyKey}</dd>
                </div>
              </dl>
            )}
            <div className="access-actions">
              <button
                className="button secondary"
                disabled={state.loading || state.busy}
                onClick={() => void client.reload()}
              >
                Check access
              </button>
              <button
                className="button primary"
                disabled={state.loading || state.busy}
                onClick={() => void client.retryIntent()}
              >
                {state.busy ? "Checking…" : "Continue same payment"}
              </button>
            </div>
          </>
        ) : purchase ? (
          <PurchaseProgress purchase={purchase} />
        ) : decision === "pending" ? (
          <Loading rows={3} />
        ) : decision === "unavailable" ? (
          <>
            <span className="tool-icon peach">
              <LockKeyhole size={24} />
            </span>
            <h3>
              {fr
                ? "Activation temporairement indisponible"
                : "Activation is temporarily unavailable"}
            </h3>
            <p>
              {fr
                ? "L’activation des outils Business est temporairement indisponible. Veuillez réessayer plus tard."
                : "Business Tools activation is temporarily unavailable. Please try again later."}
            </p>
            <div className="access-actions">
              <Link href="/overview" className="button secondary">
                {fr ? "Retour" : "Back to overview"}
              </Link>
              <button
                className="button secondary"
                disabled={state.loading}
                onClick={() => void client.reload()}
              >
                <RefreshCw size={16} />
                {fr ? "Actualiser" : "Refresh"}
              </button>
            </div>
          </>
        ) : decision === "review" ? (
          <>
            <span className="tool-icon peach">
              <ShieldCheck size={24} />
            </span>
            <h3>Access needs review</h3>
            <p>
              Fondeka has not confirmed access or a payable amount for your account. Refresh access
              or contact Fondeka support before continuing.
            </p>
            <div className="access-actions">
              <Link href="/overview" className="button secondary">
                Back to overview
              </Link>
              <button
                className="button secondary"
                disabled={state.loading}
                onClick={() => void client.reload()}
              >
                <RefreshCw size={16} /> Refresh access
              </button>
            </div>
          </>
        ) : (
          <PaymentSelector access={access} />
        )}
        {state.loading && (
          <p className="access-checking" role="status">
            <span className="spinner" />
            Checking current access…
          </p>
        )}
      </div>
    </section>
  );
}

function PricingSummary({
  access,
  historical = false,
}: {
  access: BusinessToolsAccess;
  historical?: boolean;
}) {
  const pricing = access.pricing;
  return (
    <dl className="detail-list">
      <div>
        <dt>Business Tools price ({pricing.currency})</dt>
        <dd>{money(pricing.planAmount, pricing.currency)}</dd>
      </div>
      {historical && pricing.legacyCreditAmount > 0 && (
        <div>
          <dt>Historical store credit</dt>
          <dd>{money(pricing.legacyCreditAmount, pricing.currency)}</dd>
        </div>
      )}
      <div>
        <dt>Amount due before fees</dt>
        <dd>{money(pricing.amountDue, pricing.currency)}</dd>
      </div>
    </dl>
  );
}

function PaymentSelector({ access }: { access: BusinessToolsAccess }) {
  const { client, state } = useBusinessTools();
  const { refresh } = useWorkspace();
  const [country, setCountry] = useState("");
  const [countryDraft, setCountryDraft] = useState("");
  const [selectedKey, setSelectedKey] = useState("");
  const [cryptoCurrency, setCryptoCurrency] = useState(access.plan.currency);
  const [networkId, setNetworkId] = useState("");
  const [phone, setPhone] = useState("");
  const [reviewing, setReviewing] = useState(false);
  const [error, setError] = useState("");
  const [quoteVersion, setQuoteVersion] = useState(0);
  const methods = useQuery<unknown>(
    `/customer-api/payment_methods?${new URLSearchParams({ type: "COLLECTION", action: "BUSINESS_TOOLS_ACCESS", ...(country ? { countryCode: country } : {}) })}`,
    { "X-Client-Version": paymentClientVersion },
  );
  let methodList: PaymentMethod[] = [];
  let methodsError = methods.error;
  let countrySelector = true;
  if (methods.data) {
    try {
      const result = normalizeMethods(methods.data);
      methodList = result.paymentMethods;
      countrySelector = result.ui?.showCountrySelector !== false;
    } catch (failure) {
      methodsError = failure instanceof Error ? failure.message : "Couldn’t read payment methods.";
    }
  }
  const selected = methodList.find((method) => methodKey(method) === selectedKey);
  const currency = selected?.type === "CRYPTO" ? cryptoCurrency : (selected?.currency ?? "");
  const networks = useQuery<{ id: number; name: string; displayName?: string }[]>(
    selected?.type === "CRYPTO"
      ? `/customer-api/crypto-networks/payment-methods/${selected.id}/networks`
      : null,
  );
  let selection: PaymentSelection | undefined;
  let selectionError = "Choose a payment method.";
  try {
    if (selected) {
      if (
        selected.type === "CRYPTO" &&
        !networks.data?.some((network) => String(network.id) === networkId)
      )
        throw new Error("Choose an available crypto network.");
      selection = buildSelection(
        selected,
        currency,
        phone,
        networkId ? Number(networkId) : undefined,
      );
    }
  } catch (failure) {
    selectionError = failure instanceof Error ? failure.message : "Check the payment details.";
  }
  const selectionKey = selection ? JSON.stringify(selection) : "";
  const pricingKey = `${access.pricing.planAmount}:${access.pricing.legacyCreditAmount}:${access.pricing.amountDue}:${access.pricing.currency}`;
  const quoteKey = `${selectionKey}:${access.plan.code}:${access.plan.version}:${access.plan.amount}:${access.plan.currency}:${pricingKey}:${quoteVersion}`;
  const [quoteState, setQuoteState] = useState<{
    key: string;
    quote?: ReviewedQuote;
    error?: string;
  }>({ key: "" });
  useEffect(() => {
    if (!selectionKey) return;
    let active = true;
    const abort = new AbortController();
    const timer = setTimeout(() => {
      const payment = JSON.parse(selectionKey) as PaymentSelection;
      void request(quotePath(payment), { signal: abort.signal })
        .then((body) => {
          if (!active) return;
          const quote = parseQuote(body);
          if (quote.totalToPayCurrency !== payment.currency)
            throw new Error(
              "The quote currency changed. Refresh payment methods and review the payment again.",
            );
          setQuoteState({
            key: quoteKey,
            quote: {
              value: quote,
              selection: selectionKey,
              receivedAt: Date.now(),
              planCode: access.plan.code,
              planVersion: access.plan.version,
              planAmount: access.plan.amount,
              planCurrency: access.plan.currency,
              pricing: { ...access.pricing },
            },
          });
        })
        .catch((failure) => {
          if (active)
            setQuoteState({
              key: quoteKey,
              error: failure instanceof Error ? failure.message : "Couldn’t quote this payment.",
            });
        });
    }, 250);
    return () => {
      active = false;
      clearTimeout(timer);
      abort.abort();
    };
  }, [
    selectionKey,
    quoteKey,
    access.plan.code,
    access.plan.version,
    access.plan.amount,
    access.plan.currency,
    access.pricing,
  ]);
  const quote = quoteState.key === quoteKey ? quoteState.quote : undefined;
  const quoteError = quoteState.key === quoteKey ? quoteState.error : undefined;
  const affordable = !!selected && !!quote && canAfford(selected, quote.value);
  const busy = state.busy || state.loading;
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (busy) return;
    setError("");
    if (!selection || !quote || !affordable) {
      setError(
        !affordable && quote ? "Your wallet must cover the total including fees." : selectionError,
      );
      return;
    }
    if (Date.now() - quote.receivedAt > 60_000) {
      setQuoteVersion((value) => value + 1);
      setReviewing(false);
      void client.reload();
      setError("We’re refreshing the quote. Review the updated total before confirming.");
      return;
    }
    if (!reviewing) {
      setReviewing(true);
      return;
    }
    try {
      await client.purchase(selection, quote);
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "Couldn’t start this payment.");
    }
  }
  return (
    <>
      <h3>{reviewing ? "Confirm your activation" : "Choose how to pay"}</h3>
      <p>
        {reviewing
          ? "Review the payment method, currency, and final total below."
          : "Pay from an eligible wallet or select an available external method."}
      </p>
      <div className="access-mobile-pricing">
        <strong>{access.plan.name}</strong>
        <small>
          {billingLabel(
            access.plan.billingMode,
            typeof document === "undefined" ? "en" : document.documentElement.lang,
          )}
        </small>
        <PricingSummary access={access} />
      </div>
      {methods.loading ? (
        <Loading rows={2} />
      ) : methodsError ? (
        <ErrorState message={methodsError} retry={refresh} />
      ) : (
        <form className="form-stack access-payment-form" onSubmit={(event) => void submit(event)}>
          <fieldset disabled={busy || reviewing}>
            {countrySelector && (
              <div className="access-country">
                <label>
                  Payment country (optional)
                  <input
                    value={countryDraft}
                    onChange={(event) => setCountryDraft(event.target.value.toUpperCase())}
                    maxLength={2}
                    placeholder="e.g. CD"
                    autoCapitalize="characters"
                  />
                </label>
                <button
                  type="button"
                  className="button secondary small"
                  onClick={() => {
                    if (countryDraft && !/^[A-Z]{2}$/.test(countryDraft)) {
                      setError("Use a two-letter country code.");
                      return;
                    }
                    setCountry(countryDraft);
                    setSelectedKey("");
                    setReviewing(false);
                    setError("");
                  }}
                >
                  Update
                </button>
              </div>
            )}
            <label>
              Payment method / wallet
              <select
                value={selectedKey}
                required
                onChange={(event) => {
                  setSelectedKey(event.target.value);
                  setNetworkId("");
                  setReviewing(false);
                  setError("");
                }}
              >
                <option value="">Select a method or wallet</option>
                {methodList.map((method) => (
                  <option
                    key={methodKey(method)}
                    value={methodKey(method)}
                    disabled={
                      method.type === "BALANCE" &&
                      (!isPositiveId(method.fiatWalletId) || method.walletEnabled === false)
                    }
                  >
                    {method.name}
                    {method.currency ? ` · ${method.currency}` : ""}
                    {method.type === "BALANCE" && method.balance != null
                      ? ` · ${money(method.balance, method.currency || undefined)} available`
                      : ""}
                  </option>
                ))}
              </select>
            </label>
            {!methodList.length && (
              <div className="info-box">
                No supported payment methods are available. Try another country or contact Fondeka
                support.
              </div>
            )}
            {selected?.localizedCollectionDisabledMessage && (
              <div className="info-box">{selected.localizedCollectionDisabledMessage}</div>
            )}
            {selected?.type === "MOBILE_MONEY" && (
              <label>
                Payer phone number
                <input
                  type="tel"
                  value={phone}
                  onChange={(event) => setPhone(event.target.value)}
                  required
                  maxLength={254}
                  autoComplete="tel"
                  placeholder="Include your country code"
                />
              </label>
            )}
            {selected?.type === "CRYPTO" && (
              <>
                <label>
                  Fiat settlement currency
                  <select
                    value={cryptoCurrency}
                    onChange={(event) => setCryptoCurrency(event.target.value)}
                  >
                    {Array.from(
                      new Set([
                        access.plan.currency,
                        ...methodList.map((method) => method.currency).filter(isFiatCurrency),
                      ]),
                    ).map((value) => (
                      <option key={value}>{value}</option>
                    ))}
                  </select>
                </label>
                {networks.loading ? (
                  <Loading rows={1} />
                ) : networks.error ? (
                  <ErrorState message={networks.error} retry={refresh} />
                ) : (
                  <label>
                    Crypto network
                    <select
                      required
                      value={networkId}
                      onChange={(event) => setNetworkId(event.target.value)}
                    >
                      <option value="">Select network</option>
                      {networks.data?.map((network) => (
                        <option key={network.id} value={network.id}>
                          {network.displayName || network.name}
                        </option>
                      ))}
                    </select>
                  </label>
                )}
                <small className="muted">
                  The final token amount and invoice will be provided after submitting this payment.
                </small>
              </>
            )}
            {selected?.type === "BANK" && (
              <div className="info-box">
                Bank transfer instructions and the payment reference will appear after you confirm
                this purchase.
              </div>
            )}
          </fieldset>
          {selected && (
            <div className="access-quote">
              <PricingSummary access={access} />
              <dl className="detail-list">
                <div>
                  <dt>Selected payment currency</dt>
                  <dd>{currency || "Unavailable"}</dd>
                </div>
                {quote && (
                  <>
                    <div>
                      <dt>Payment processing fees</dt>
                      <dd>{money(quote.value.fees, quote.value.feesCurrency)}</dd>
                    </div>
                    <div className="access-gross">
                      <dt>Total to pay</dt>
                      <dd>{money(quote.value.totalToPay, quote.value.totalToPayCurrency)}</dd>
                    </div>
                  </>
                )}
              </dl>
              {selection && !quote && !quoteError && (
                <p role="status">
                  <span className="spinner" /> Getting the final quote…
                </p>
              )}
              {quoteError && (
                <ErrorState
                  message={quoteError}
                  retry={() => setQuoteVersion((value) => value + 1)}
                />
              )}
              {quote && !affordable && (
                <p role="alert" className="form-error">
                  This wallet does not cover the gross total including fees. Select another wallet
                  or method.
                </p>
              )}
              {quote && (
                <button
                  type="button"
                  className="text-button"
                  disabled={busy}
                  onClick={() => {
                    setQuoteVersion((value) => value + 1);
                    setReviewing(false);
                    void client.reload();
                  }}
                >
                  <RefreshCw size={14} />
                  Refresh quote
                </button>
              )}
            </div>
          )}
          {(error || state.submissionError) && (
            <p role="alert" className="form-error">
              {error || state.submissionError}
            </p>
          )}
          {!state.loading && (
            <div className="access-actions">
              {reviewing && (
                <button
                  type="button"
                  className="button secondary"
                  disabled={busy}
                  onClick={() => setReviewing(false)}
                >
                  Change payment
                </button>
              )}
              <SubmitButton
                busy={busy}
                disabled={!selection || !quote || !affordable || !!methodsError || !!networks.error}
              >
                <ShieldCheck size={17} />
                {reviewing ? "Confirm payment" : "Review payment"}
              </SubmitButton>
            </div>
          )}
          <button type="button" className="text-button" disabled={busy} onClick={refresh}>
            Refresh available methods and wallets
          </button>
        </form>
      )}
    </>
  );
}

function PurchaseProgress({ purchase }: { purchase: BusinessToolsPurchase }) {
  const { client, state } = useBusinessTools();
  const [automaticStopped, setAutomaticStopped] = useState(false);
  const pending =
    purchase.status === "PENDING" && !purchase.accessGranted && !purchase.access.accessGranted;
  const legacyReview =
    purchase.status === "COMPLETED" &&
    purchase.failureCode === "BUSINESS_TOOLS_LEGACY_CREDIT_UNAVAILABLE";
  useEffect(() => {
    if (!pending || !purchase.id) return;
    let alive = true;
    let running = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const started = Date.now();
    let attempts = 0;
    const schedule = (delay: number) => {
      if (!alive || running || timer || document.visibilityState !== "visible") return;
      if (Date.now() - started >= 180_000) {
        setAutomaticStopped(true);
        return;
      }
      timer = setTimeout(() => void tick(), delay);
    };
    const tick = async () => {
      timer = undefined;
      if (!alive || document.visibilityState !== "visible") return;
      running = true;
      await client.checkStatus();
      running = false;
      attempts++;
      if (client.getSnapshot().purchase?.status === "PENDING" && !client.getSnapshot().error)
        schedule(Math.min(2500 * Math.ceil(attempts / 4), 15_000));
    };
    const resume = () => {
      if (document.visibilityState === "visible") schedule(0);
      else {
        clearTimeout(timer);
        timer = undefined;
      }
    };
    document.addEventListener("visibilitychange", resume);
    window.addEventListener("focus", resume);
    schedule(0);
    return () => {
      alive = false;
      clearTimeout(timer);
      document.removeEventListener("visibilitychange", resume);
      window.removeEventListener("focus", resume);
    };
  }, [client, pending, purchase.id]);
  return (
    <>
      <span className="tool-icon peach">
        {pending ? <RefreshCw size={24} /> : <CreditCard size={24} />}
      </span>
      <h3>
        {legacyReview
          ? "Payment received — access requires review"
          : pending
            ? "Complete your payment"
            : purchase.status === "COMPLETED"
              ? "We’re checking your access"
              : `Payment ${label(purchase.status).toLowerCase()}`}
      </h3>
      <Badge value={purchase.status} />
      <p>
        {legacyReview
          ? purchase.failureMessage ||
            "Your payment was received, but a historical payment needs review before access can be granted. Contact Fondeka support with your purchase reference."
          : pending
            ? "Your payment is being processed. Tools open only when Fondeka confirms access. Closing this screen does not cancel payment."
            : purchase.failureMessage ||
              (purchase.status === "COMPLETED"
                ? "The payment completed, but access has not been granted. Check access again or contact Fondeka support with your purchase reference."
                : purchase.status === "REFUNDED"
                  ? "This payment was refunded and Business Tools access is currently unavailable."
                  : "The payment did not complete. You can review another payment after checking current access.")}
      </p>
      {purchase.id && (
        <div className="access-purchase-id">
          <small>Purchase reference</small>
          <code>{purchase.id}</code>
        </div>
      )}
      {pending && <PaymentInstructions purchase={purchase} />}
      {automaticStopped && (
        <div className="info-box">
          Automatic checking has paused. Use Check status or contact Fondeka support. This does not
          mark the payment as failed.
        </div>
      )}
      <div className="access-actions">
        <button
          className="button secondary"
          disabled={state.busy || state.loading}
          onClick={() => void client.checkStatus()}
        >
          <RefreshCw size={16} />
          Check status
        </button>
        {["FAILED", "CANCELLED", "REFUNDED"].includes(purchase.status) && (
          <button
            className="button primary"
            disabled={state.loading || state.busy || !!state.error}
            onClick={() => void client.startAgain()}
          >
            Choose another payment
          </button>
        )}
      </div>
    </>
  );
}

function PaymentInstructions({ purchase }: { purchase: BusinessToolsPurchase }) {
  const [result, setResult] = useState<{
    transaction?: PaymentTransaction;
    error?: string;
    id?: number;
  }>({});
  const methods = useQuery<unknown>(
    "/customer-api/payment_methods?type=COLLECTION&action=BUSINESS_TOOLS_ACCESS",
    { "X-Client-Version": paymentClientVersion },
  );
  useEffect(() => {
    const id = purchase.paymentTransactionId;
    if (!isPositiveId(id) || document.visibilityState !== "visible") return;
    let active = true;
    const abort = new AbortController();
    void request<PaymentTransaction>(`/customer-api/transactions/${id}`, {
      signal: abort.signal,
    }).then(
      (transaction) => {
        if (active) setResult({ transaction, id });
      },
      (error) => {
        if (active)
          setResult({
            error: error instanceof Error ? error.message : "Couldn’t load payment instructions.",
            id,
          });
      },
    );
    return () => {
      active = false;
      abort.abort();
    };
  }, [purchase]);
  const transaction = result.id === purchase.paymentTransactionId ? result.transaction : undefined;
  if (!purchase.paymentTransactionId)
    return (
      <div className="info-box">
        Payment instructions are being prepared. Check status to continue this same purchase.
      </div>
    );
  if (result.error)
    return (
      <div className="info-box">
        {result.error} Use Check status to refresh instructions for this payment.
      </div>
    );
  if (!transaction) return <Loading rows={2} />;
  let method: PaymentMethod | undefined;
  try {
    method = normalizeMethods(methods.data).paymentMethods.find(
      (item) =>
        item.id === transaction.paymentMethodId &&
        (!item.currency || item.currency === transaction.currency),
    );
  } catch {
    /* Status remains usable even if method discovery is unavailable. */
  }
  const crypto = transaction.cryptoDetails;
  return (
    <div className="access-instructions">
      <dl className="detail-list">
        {transaction.reference && (
          <div>
            <dt>Payment reference</dt>
            <dd>{transaction.reference}</dd>
          </div>
        )}
        {transaction.paymentMethodName && (
          <div>
            <dt>Payment method</dt>
            <dd>{label(transaction.paymentMethodName)}</dd>
          </div>
        )}
        {transaction.grossAmount != null && transaction.currency && (
          <div>
            <dt>Payment total</dt>
            <dd>{money(transaction.grossAmount, transaction.currency)}</dd>
          </div>
        )}
      </dl>
      {(transaction.displayMessage || transaction.receipt?.humanMessage) && (
        <p>{transaction.displayMessage || transaction.receipt?.humanMessage}</p>
      )}
      {method?.type === "MOBILE_MONEY" && (
        <div className="info-box">
          Approve the payment prompt on the payer’s phone. Then check status here.
        </div>
      )}
      {method?.type === "BANK" && (
        <>
          <h4>
            <Banknote size={17} />
            Bank transfer instructions
          </h4>
          <dl className="detail-list">
            {[
              ["Bank", method.bankName],
              ["Account name", method.bankAccountName],
              ["Account number", method.bankAccountNumber],
            ].map(
              ([title, value]) =>
                value && (
                  <div key={title}>
                    <dt>{title}</dt>
                    <dd>{value}</dd>
                  </div>
                ),
            )}
          </dl>
          {(method.localizedBankInstructions || method.bankInstructions) && (
            <p className="info-box">
              {method.localizedBankInstructions || method.bankInstructions}
            </p>
          )}
          <p>
            Use the payment reference above for this transfer. Bank confirmation may take time; a
            transfer receipt alone does not activate access.
          </p>
        </>
      )}
      {crypto ? (
        <>
          <CryptoPaymentInstructions details={crypto} />
          <small className="muted">
            An expired invoice does not automatically mean the purchase failed.
          </small>
        </>
      ) : method?.type === "CRYPTO" ? (
        <div className="info-box">
          Your crypto invoice is being prepared. Check this same payment for the address and token
          amount.
        </div>
      ) : null}
      {methods.error && (
        <div className="info-box">
          Payment-method instructions are currently unavailable. Check status again or contact
          support with your payment reference.
        </div>
      )}
    </div>
  );
}
