"use client";

import { useEffect, useState } from "react";
import { Code2, Link2, LockKeyhole, Calculator, RefreshCw, ShieldCheck, Store } from "lucide-react";
import {
  accessDecision,
  businessToolsPurchaseCopy,
  billingLabel,
  isPositiveId,
  normalizeMethods,
  parsePurchase,
  paymentClientVersion,
  subscriptionsPath,
  effectivePurchaseAction,
  purchaseScopeGranted,
  type BusinessToolsAccess,
  type BusinessToolsPurchase,
  type PaymentMethod,
  type PaymentTransaction,
} from "@/lib/business-tools";
import { paymentCopy, paymentError, paymentMoney } from "@/lib/business-tools-ui";
import { usePaymentLanguage } from "@/lib/use-payment-language";
import { useMobileLayout } from "@/lib/use-mobile-layout";
import { request } from "@/lib/data";
import { useQuery } from "@/lib/use-query";
import { paymentOffer, resourceAccessUnavailable } from "@/lib/business-tools-client";
import { useBusinessTools } from "./business-tools-provider";
import { CryptoPaymentInstructions } from "./crypto-payment-instructions";
import { useWorkspace } from "./workspace-provider";
import { Modal } from "./ui";
import { PaymentMethodWidget } from "./payment-method-widget";

export const businessTools = [
  {
    title: "Payment links",
    description: "Quick collections, crowdfunding and invoices",
    titleFr: "Liens de paiement",
    descriptionFr: "Encaissements rapides, financement participatif et factures",
    href: "/payment-requests",
    icon: Link2,
    color: "mint",
  },
  {
    title: "Online Stores",
    description: "Create a store, share its link and sell products, services and trainings",
    titleFr: "Boutiques en ligne",
    descriptionFr:
      "Créez une boutique, partagez son lien et vendez des produits, des services et des formations",
    href: "/stores",
    icon: Store,
    color: "lilac",
  },
  {
    title: "POS",
    description: "Manage store sales, customers and reports",
    titleFr: "POS",
    descriptionFr: "Gérez les ventes, les clients et les rapports de la boutique",
    href: "/pos",
    icon: Calculator,
    color: "peach",
  },
  {
    title: "Payments API",
    description: "Integrate Fondeka payments into an application or website",
    titleFr: "API de paiement",
    descriptionFr: "Intégrez les paiements Fondeka dans une application ou un site web",
    href: "/developers",
    icon: Code2,
    color: "blue",
  },
];
function PaymentLoading({ message }: { message?: string }) {
  const t = paymentCopy(usePaymentLanguage());
  return (
    <div className="activation-loading" role="status">
      <span className="spinner" />
      {message || t.loading}
    </div>
  );
}
function PaymentError({ message, retry }: { message?: string; retry?: () => void }) {
  const language = usePaymentLanguage();
  const t = paymentCopy(language);
  return (
    <div className="activation-error" role="alert">
      <p>{paymentError(message, language, t.errorBody)}</p>
      {retry && (
        <button type="button" className="text-button" onClick={retry}>
          {t.retry}
        </button>
      )}
    </div>
  );
}
export function LockedToolPreview({
  destination,
  checking,
  error = false,
  label: hint,
  onOpen,
}: {
  destination: string;
  checking: boolean;
  error?: boolean;
  label: string;
  onOpen: () => void;
}) {
  const t = paymentCopy(usePaymentLanguage());
  const name = destination.startsWith("/payment-requests")
    ? t.paymentLinks
    : destination.startsWith("/stores")
      ? t.stores
      : destination.startsWith("/pos")
        ? t.pos
        : destination.startsWith("/developers")
          ? t.api
          : t.activity;
  return (
    <section className="locked-tool-preview" aria-label={name}>
      <div className="locked-preview-layout" inert aria-hidden="true">
        <div className="locked-preview-heading">
          <h2>{name}</h2>
          <span className="locked-preview-chip">
            <LockKeyhole size={14} />
            {t.allTools}
          </span>
        </div>
        <div className="locked-preview-stats">
          {[0, 1, 2].map((index) => (
            <div key={index}>
              <i />
              <i />
              <i />
            </div>
          ))}
        </div>
        <div className="locked-preview-table">
          <h3>{t.recentActivity}</h3>
          {[0, 1, 2, 3].map((index) => (
            <div key={index}>
              <span />
              <i />
              <i />
              <i />
            </div>
          ))}
        </div>
      </div>
      <div className="locked-preview-caption">
        <LockKeyhole size={16} />
        <span>{checking ? t.checking : hint}</span>
        <button className="text-button" onClick={onOpen} disabled={checking}>
          {error ? t.retry : t.activate}
        </button>
      </div>
    </section>
  );
}
export function BusinessToolsScreen({ onClose }: { onClose: () => void }) {
  const { client, state } = useBusinessTools();
  const language = usePaymentLanguage();
  const t = paymentCopy(language);
  const mobile = useMobileLayout();
  const access = state.access;
  const purchase = state.purchase;
  const [paymentView, setPaymentView] = useState<"selection" | "instructions">("selection");
  const offer = paymentOffer(state);
  const canChoose = !!offer && accessDecision(offer) === "purchase";
  const choosingMethod = canChoose && (!purchase || paymentView === "selection");
  const decision = access ? accessDecision(access) : undefined;
  const resourceUnavailable = resourceAccessUnavailable(state, state.destination || "");
  const title =
    resourceUnavailable && access?.accessGranted
      ? t.resourceTitle
      : state.error
        ? t.errorTitle
        : state.uncertain || state.intent
          ? t.checkingPayment
          : choosingMethod
            ? access?.plan.name || t.title
            : purchase?.status === "PENDING" || decision === "pending"
              ? t.processing
              : purchase
                ? purchase.status === "COMPLETED"
                  ? purchase.failureCode === "BUSINESS_TOOLS_LEGACY_CREDIT_UNAVAILABLE"
                    ? t.legacyReviewTitle
                    : t.completedTitle
                  : purchase.status === "REFUNDED"
                    ? t.refundedTitle
                    : t.failedTitle
                : decision === "unavailable"
                  ? t.unavailable
                  : decision === "review"
                    ? t.reviewTitle
                    : access?.plan.name || t.title;
  return (
    <Modal
      title={title}
      onClose={onClose}
      busy={state.busy}
      variant={mobile ? "sheet" : "dialog"}
      className="activation-dialog"
      closeLabel={t.close}
    >
      <div className="activation-content" aria-busy={state.loading || state.busy}>
        {state.loading ? (
          <PaymentLoading message={t.checking} />
        ) : state.error ? (
          <>
            <PaymentError message={state.error} />
            <StateActions
              onClose={onClose}
              onRefresh={() => void (purchase?.id ? client.checkStatus() : client.reload())}
            />
          </>
        ) : resourceUnavailable && access?.accessGranted ? (
          <>
            <p className="activation-state-copy">{t.resourceBody}</p>
            <StateActions onClose={onClose} onRefresh={() => void client.retryResource()} />
          </>
        ) : state.uncertain || state.intent ? (
          <>
            <p className="activation-state-copy">{t.uncertainBody}</p>
            {state.submissionError && <PaymentError message={state.submissionError} />}
            {state.intent && (
              <details className="activation-reference">
                <summary>{t.reference}</summary>
                <code>{state.intent.idempotencyKey}</code>
              </details>
            )}
            <div className="activation-footer">
              <button className="button secondary" disabled={state.busy} onClick={onClose}>
                {t.back}
              </button>
              <button
                className="button primary"
                disabled={state.busy}
                onClick={() => void client.retryIntent()}
              >
                {state.busy ? t.wait : t.continuePayment}
              </button>
            </div>
          </>
        ) : purchase ? (
          <div hidden={choosingMethod}>
            <PurchaseProgress
              purchase={purchase}
              onClose={canChoose ? () => setPaymentView("selection") : onClose}
            />
          </div>
        ) : decision === "pending" ? (
          <PaymentLoading />
        ) : decision === "unavailable" ? (
          <>
            <p className="activation-state-copy">{t.unavailableBody}</p>
            <StateActions onClose={onClose} onRefresh={() => void client.reload()} />
          </>
        ) : decision === "review" ? (
          <>
            <p className="activation-state-copy">{t.reviewBody}</p>
            <StateActions onClose={onClose} onRefresh={() => void client.reload()} />
          </>
        ) : decision === "purchase" ? null : (
          <PaymentLoading />
        )}
        {offer &&
          choosingMethod &&
          !state.intent &&
          !state.uncertain &&
          !state.error &&
          !resourceUnavailable && (
            <div hidden={state.loading}>
              <div className="activation-price">
                <span>{t.activationPrice}</span>
                <strong>
                  {paymentMoney(offer.pricing.amountDue, offer.pricing.currency, language)}
                </strong>
                <small>
                  {offer.pricing.currency}{" "}
                  <span>{billingLabel(offer.plan.billingMode, language)}</span>
                </small>
              </div>
              <p className="activation-explanation" style={{ whiteSpace: "pre-wrap" }}>
                {businessToolsPurchaseCopy(
                  offer,
                  offer.pricingMode === "PER_TOOL" && offer.tool !== "BUNDLE"
                    ? language === "fr"
                      ? `Cet achat active uniquement ${offer.plan.name}. Les autres outils Business nécessitent un accès distinct.`
                      : `This purchase unlocks ${offer.plan.name} only. Other Business Tools require separate access.`
                    : t.explanation,
                )}
              </p>
              {state.submissionError && <PaymentError message={state.submissionError} />}
              {purchase?.status === "PENDING" && (
                <div className="activation-note">
                  <p>{t.pendingBankChoice}</p>
                  <button
                    type="button"
                    className="text-button"
                    onClick={() => setPaymentView("instructions")}
                  >
                    {t.viewBankTransfer}
                  </button>
                </div>
              )}
              <PaymentSelector
                access={offer}
                onClose={onClose}
                onSubmitted={() => setPaymentView("instructions")}
              />
            </div>
          )}
      </div>
    </Modal>
  );
}
function StateActions({ onClose, onRefresh }: { onClose: () => void; onRefresh: () => void }) {
  const { state } = useBusinessTools();
  const t = paymentCopy(usePaymentLanguage());
  return (
    <div className="activation-footer">
      <button className="button secondary" onClick={onClose}>
        {t.back}
      </button>
      <button className="button primary" disabled={state.loading || state.busy} onClick={onRefresh}>
        <RefreshCw size={15} />
        {t.refresh}
      </button>
    </div>
  );
}
function PaymentSelector({
  access,
  onClose,
  onSubmitted,
}: {
  access: BusinessToolsAccess;
  onClose: () => void;
  onSubmitted: () => void;
}) {
  const { client, state } = useBusinessTools();
  const t = paymentCopy(usePaymentLanguage());
  return (
    <PaymentMethodWidget
      key={JSON.stringify([
        access.pricingMode,
        access.plan.code,
        access.plan.version,
        access.purchaseAction,
        access.pricing,
      ])}
      action={access.purchaseAction || "BUSINESS_TOOLS_ACCESS"}
      amount={0}
      baseAmount={access.pricing.amountDue}
      baseCurrency={access.pricing.currency}
      busy={state.busy || state.loading}
      confirmLabel={t.activate}
      onClose={onClose}
      onConfirm={async (selection, value, receivedAt) => {
        const previousId = state.purchase?.id;
        await client.purchase(selection, {
          value,
          receivedAt,
          selection: JSON.stringify(selection),
          planCode: access.plan.code,
          planVersion: access.plan.version,
          planAmount: access.plan.amount,
          planCurrency: access.plan.currency,
          pricing: { ...access.pricing },
        });
        const current = client.getSnapshot();
        if (
          current.purchase &&
          current.purchase.id !== previousId &&
          !current.uncertain &&
          !current.intent
        )
          onSubmitted();
      }}
    />
  );
}

function PurchaseProgress({
  purchase,
  onClose,
}: {
  purchase: BusinessToolsPurchase;
  onClose: () => void;
}) {
  const { client, state } = useBusinessTools();
  const language = usePaymentLanguage();
  const t = paymentCopy(language);
  const [automaticStopped, setAutomaticStopped] = useState(false);
  const pending = purchase.status === "PENDING";
  const legacyReview =
    purchase.status === "COMPLETED" &&
    purchase.failureCode === "BUSINESS_TOOLS_LEGACY_CREDIT_UNAVAILABLE";
  const otherToolActive =
    purchase.status === "COMPLETED" &&
    !state.access?.accessGranted &&
    purchaseScopeGranted(state.accountAccess, purchase);
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
      <p className="activation-state-copy">
        {purchase.failureMessage ||
          (otherToolActive
            ? t.otherToolActive
            : legacyReview
              ? t.legacyReviewBody
              : pending
                ? t.processingBody
                : purchase.status === "COMPLETED"
                  ? t.completedBody
                  : purchase.status === "REFUNDED"
                    ? t.refundedBody
                    : t.failedBody)}
      </p>
      {pending && <PaymentInstructions purchase={purchase} />}
      {automaticStopped && (
        <p className="activation-note" role="status">
          {t.pollingStopped}
        </p>
      )}
      <details className="activation-reference">
        <summary>{t.paymentDetails}</summary>
        {purchase.id && (
          <>
            <small>{t.purchaseReference}</small>
            <code>{purchase.id}</code>
          </>
        )}
        <p>{t.support}</p>
        {purchase.access.pricing.legacyCreditAmount > 0 && (
          <dl className="detail-list">
            <div>
              <dt>{t.historicalPricing}</dt>
              <dd>
                {paymentMoney(
                  purchase.access.pricing.planAmount,
                  purchase.access.pricing.currency,
                  language,
                )}
              </dd>
            </div>
            <div>
              <dt>{t.historicalCredit}</dt>
              <dd>
                {paymentMoney(
                  purchase.access.pricing.legacyCreditAmount,
                  purchase.access.pricing.currency,
                  language,
                )}
              </dd>
            </div>
          </dl>
        )}
      </details>
      <div className="activation-footer">
        <button className="button secondary" onClick={onClose}>
          {t.back}
        </button>
        <button
          className="button primary"
          disabled={state.busy || state.loading}
          onClick={() => void client.checkStatus()}
        >
          <RefreshCw size={15} />
          {t.checkStatus}
        </button>
      </div>
      {(["FAILED", "CANCELLED", "REFUNDED"].includes(purchase.status) || otherToolActive) && (
        <button
          className="text-button activation-retry-method"
          disabled={state.loading || state.busy || !!state.error}
          onClick={() => void client.startAgain()}
        >
          {purchase.status === "COMPLETED" ? t.reviewOffer : t.anotherMethod}
        </button>
      )}
    </>
  );
}
function PaymentInstructions({ purchase }: { purchase: BusinessToolsPurchase }) {
  const language = usePaymentLanguage();
  const t = paymentCopy(language);
  const [result, setResult] = useState<{
    transaction?: PaymentTransaction;
    error?: string;
    id?: number;
  }>({});
  const action = effectivePurchaseAction(purchase);
  const methods = useQuery<unknown>(
    action ? `/customer-api/payment_methods?type=COLLECTION&action=${action}` : null,
    { "X-Client-Version": paymentClientVersion, "Accept-Language": language },
  );
  useEffect(() => {
    const id = purchase.paymentTransactionId;
    if (!isPositiveId(id) || document.visibilityState !== "visible") return;
    let active = true;
    const abort = new AbortController();
    void request<PaymentTransaction>(`/customer-api/transactions/${id}`, {
      headers: { "Accept-Language": language },
      signal: abort.signal,
    }).then(
      (transaction) => {
        if (active) setResult({ transaction, id });
      },
      () => {
        if (active) setResult({ error: t.instructionsError, id });
      },
    );
    return () => {
      active = false;
      abort.abort();
    };
  }, [purchase, language, t.instructionsError]);
  const transaction = result.id === purchase.paymentTransactionId ? result.transaction : undefined;
  if (!purchase.paymentTransactionId)
    return <p className="activation-note">{t.instructionsPending}</p>;
  if (result.error) return <p className="activation-note">{result.error}</p>;
  if (!transaction) return <PaymentLoading />;
  let method: PaymentMethod | undefined;
  try {
    method = normalizeMethods(methods.data).paymentMethods.find(
      (item) =>
        item.id === transaction.paymentMethodId &&
        (!item.currency || item.currency === transaction.currency),
    );
  } catch {
    /* Payment status remains usable if discovery is unavailable. */
  }
  const crypto = transaction.cryptoDetails;
  return (
    <div className="activation-instructions">
      {transaction.reference && (
        <div className="activation-transfer-reference">
          <small>{t.reference}</small>
          <code>{transaction.reference}</code>
        </div>
      )}
      {transaction.grossAmount != null && transaction.currency && (
        <p className="activation-instruction-total">
          {t.paymentTotal}
          <strong>
            {paymentMoney(transaction.grossAmount, transaction.currency, language)}{" "}
            <small>{transaction.currency}</small>
          </strong>
        </p>
      )}
      {(transaction.displayMessage || transaction.receipt?.humanMessage) && (
        <p className="activation-note">
          {transaction.displayMessage || transaction.receipt?.humanMessage}
        </p>
      )}
      {method?.type === "MOBILE_MONEY" && <p className="activation-note">{t.approvePhone}</p>}
      {method?.type === "BANK" && (
        <>
          <h4>{t.bankInstructions}</h4>
          <dl className="detail-list">
            {[
              [t.bankName, method.bankName],
              [t.accountName, method.bankAccountName],
              [t.accountNumber, method.bankAccountNumber],
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
            <p className="activation-note">
              {method.localizedBankInstructions || method.bankInstructions}
            </p>
          )}
          <p className="activation-note">{t.bankReference}</p>
        </>
      )}
      {crypto ? (
        <>
          <CryptoPaymentInstructions details={crypto} language={language} />
          <small className="activation-note">{t.invoiceExpiry}</small>
        </>
      ) : method?.type === "CRYPTO" ? (
        <p className="activation-note">{t.cryptoPreparing}</p>
      ) : null}
      {methods.error && <p className="activation-note">{t.instructionsError}</p>}
    </div>
  );
}
export function ActiveAccessPaymentNotice() {
  const { state } = useBusinessTools();
  const t = paymentCopy(usePaymentLanguage());
  const [open, setOpen] = useState(false);
  const pending = state.access?.accessGranted ? state.access.pendingPurchase : null;
  if (!pending) return null;
  return (
    <>
      <aside className="info-box active-payment-notice" aria-label={t.earlierPayment}>
        <ShieldCheck size={20} />
        <p>
          <strong>{state.accountAccess?.accessGranted ? t.active : t.toolActive}</strong>{" "}
          {t.earlierPending}
        </p>
        <button className="button secondary small" onClick={() => setOpen(true)}>
          {t.viewPayment}
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
  const language = usePaymentLanguage();
  const t = paymentCopy(language);
  const mobile = useMobileLayout();
  const [attempt, setAttempt] = useState(0);
  const [result, setResult] = useState<{
    attempt: number;
    purchase?: BusinessToolsPurchase;
    error?: string;
  }>();
  useEffect(() => {
    let active = true;
    const abort = new AbortController();
    void request(`${subscriptionsPath}/${id}`, {
      method: "GET",
      headers: { "Accept-Language": language },
      signal: abort.signal,
    })
      .then(parsePurchase)
      .then(
        (purchase) => {
          if (!active) return;
          setResult({ attempt, purchase });
          if (
            purchase.status !== "PENDING" ||
            !purchase.accessGranted ||
            !purchase.access.accessGranted
          )
            void client.reload(false, { background: true });
          if (purchase.status !== "PENDING") refresh();
        },
        (failure) => {
          if (active)
            setResult({ attempt, error: failure instanceof Error ? failure.message : t.errorBody });
        },
      );
    return () => {
      active = false;
      abort.abort();
    };
  }, [id, attempt, client, refresh, language, t.errorBody]);
  const purchase = result?.purchase;
  const close = () => {
    onClose();
    if (purchase && purchase.status !== "PENDING") void client.reload();
  };
  return (
    <Modal
      title={purchase?.status === "PENDING" ? t.processing : t.earlierPayment}
      className="activation-dialog"
      variant={mobile ? "sheet" : "dialog"}
      closeLabel={t.close}
      onClose={close}
    >
      {result?.attempt !== attempt ? (
        <PaymentLoading />
      ) : result.error ? (
        <PaymentError message={result.error} retry={() => setAttempt((value) => value + 1)} />
      ) : (
        purchase && (
          <>
            <p className="activation-state-copy">
              {purchase.failureMessage ||
                (purchase.status === "PENDING" ? t.processingBody : t.active)}
            </p>
            {purchase.status === "PENDING" && <PaymentInstructions purchase={purchase} />}
            <details className="activation-reference">
              <summary>{t.purchaseReference}</summary>
              <code>{id}</code>
              <p>{t.support}</p>
            </details>
            <div className="activation-footer">
              <button className="button secondary" onClick={() => setAttempt((value) => value + 1)}>
                {t.checkStatus}
              </button>
              <button className="button primary" onClick={close}>
                {t.done}
              </button>
            </div>
          </>
        )
      )}
    </Modal>
  );
}
