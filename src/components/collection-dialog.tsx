"use client";
import { useEffect, useRef, useState } from "react";
import { useI18n } from "@/lib/i18n";
import { request } from "@/lib/data";
import { money, parseAmount } from "@/lib/format";
import type { PaymentSelection, PaymentTransaction } from "@/lib/business-tools";
import type { Order, PaymentRequest, Store } from "@/lib/types";
import { posOrderPath, posOrderTransaction, posPaymentBody } from "@/lib/pos-payment";
import { useWorkspace } from "./workspace-provider";
import { Modal, Badge } from "./ui";
import { PaymentMethodWidget } from "./payment-method-widget";
import { TransactionInstructions } from "./transaction-instructions";
export function CollectionDialog({
  payment,
  order,
  store,
  onClose,
  onDone,
}: {
  payment?: PaymentRequest;
  order?: Order;
  store?: Store;
  onClose: () => void;
  onDone: () => void;
}) {
  const { t } = useI18n();
  const { accountKey } = useWorkspace();
  const scopedPos = store?.accessType === "STAFF" && order?.channel === "POS";
  const posStoreId = scopedPos ? store.id : undefined;
  const orderReference = order?.reference;
  const variable =
    !!payment && (payment.type === "DONATION" || payment.allowPartial || payment.amount == null);
  const currency = payment?.currency || order?.paymentCurrency || order?.totalCurrency || "USD";
  const [amountText, setAmountText] = useState("");
  const [payerName, setPayerName] = useState("");
  const [payerReference, setPayerReference] = useState("");
  const [payerFields, setPayerFields] = useState<Record<string, string>>({});
  let amount = payment?.amount ?? order?.paymentAmount ?? order?.totalAmount ?? 0;
  if (variable) {
    try {
      amount = parseAmount(amountText, currency);
    } catch {
      amount = 0;
    }
  }
  const [intent, setIntent] = useState<{ path: string; body: string }>();
  const [transactionId, setTransactionId] = useState<number | undefined>(() =>
    Number.isSafeInteger(order?.paymentTransactionId) && order!.paymentTransactionId! > 0
      ? order!.paymentTransactionId!
      : undefined,
  );
  const [transaction, setTransaction] = useState<PaymentTransaction>();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [uncertain, setUncertain] = useState(false);
  const lock = useRef(false);
  const [checks, setChecks] = useState(0);
  const storageKey = `fondeka-collection:${accountKey}:${payment ? `request-${payment.id}` : `order-${order?.storeId}-${order?.reference}`}`;
  useEffect(() => {
    try {
      const saved = JSON.parse(sessionStorage.getItem(storageKey) || "null");
      const expectedPath = payment ? `/customer-api/payment_requests/${payment.id}/collect` : null;
      const body = typeof saved?.body === "string" ? JSON.parse(saved.body) : null;
      if (
        expectedPath &&
        saved?.path === expectedPath &&
        body &&
        /^[A-Za-z0-9_.:-]{1,128}$/.test(body.idempotencyKey) &&
        Number.isSafeInteger(body.paymentMethodId) &&
        body.paymentMethodId > 0 &&
        Number.isFinite(body.amount) &&
        body.amount > 0
      ) {
        setIntent(saved);
        const id =
          Number.isSafeInteger(saved.transactionId) && saved.transactionId > 0
            ? saved.transactionId
            : undefined;
        setTransactionId(id);
        setUncertain(!id);
      }
    } catch {
      /* Recovery is optional until the first submission. */
    }
  }, [storageKey, payment]);
  async function send(original: { path: string; body: string }) {
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    setError("");
    try {
      const response = await request<
        Order & { transactionId?: number; paymentTransactionId?: number }
      >(original.path, { method: "POST", body: original.body });
      const id = response.transactionId ?? response.paymentTransactionId;
      if (scopedPos) setTransaction(posOrderTransaction(response, store!.id, order!.reference));
      if (!Number.isSafeInteger(id) || id! <= 0)
        throw new Error(
          t(
            "Payment accepted. Check this request’s history before starting another.",
            "Paiement accepté. Vérifiez l’historique avant d’en créer un autre.",
          ),
        );
      setTransactionId(id);
      if (payment) {
        try {
          sessionStorage.setItem(storageKey, JSON.stringify({ ...original, transactionId: id }));
        } catch {
          /* The original persisted intent can still recover this accepted payment. */
        }
      }
      setUncertain(false);
      onDone();
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : t("Unable to submit payment.", "Impossible d’envoyer le paiement."),
      );
      setUncertain(true);
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }
  async function submit(selection: PaymentSelection) {
    if (intent || lock.current) return;
    if (payment?.payerFields?.some((f) => f.required && !payerFields[f.key]?.trim()))
      throw new Error(
        t("Complete the required payer fields.", "Complétez les champs obligatoires du payeur."),
      );
    if (
      (payment?.minAmount != null && amount < payment.minAmount) ||
      (payment?.maxAmount != null && amount > payment.maxAmount)
    )
      throw new Error(
        t(
          "The amount is outside the request’s allowed range.",
          "Le montant est en dehors de la plage autorisée.",
        ),
      );
    const key = `collect_${crypto.randomUUID()}`;
    const body = payment
      ? {
          paymentMethodId: selection.id,
          accountNumber: selection.accountRef,
          networkId: selection.networkId,
          fiatWalletId: selection.fiatWalletId,
          amount,
          payerDisplayName: payerName,
          payerReference,
          payerFields,
          idempotencyKey: key,
          paymentMethod: {
            ...selection,
            feeApplicationMode: payment.feeInclusion === "ABSORBED" ? "INCLUSIVE" : "EXCLUSIVE",
          },
          feeApplicationMode: payment.feeInclusion === "ABSORBED" ? "INCLUSIVE" : "EXCLUSIVE",
        }
      : scopedPos
        ? posPaymentBody(selection, key)
        : { paymentMethod: selection, idempotencyKey: key };
    const path = payment
      ? `/customer-api/payment_requests/${payment.id}/collect`
      : scopedPos
        ? `${posOrderPath(store!.id, order!.reference)}/payments/start`
        : `/customer-api/commerce/orders/${encodeURIComponent(order!.reference)}/payments/start?${new URLSearchParams({ accessToken: order?.accessToken || "" })}`;
    const original = { path, body: JSON.stringify(body) };
    // Order access tokens remain in memory. Only a request's scoped retry selection is persisted.
    if (payment) {
      try {
        sessionStorage.setItem(storageKey, JSON.stringify(original));
      } catch {
        throw new Error(
          t(
            "Payment recovery is unavailable. Enable session storage before continuing.",
            "La récupération du paiement est indisponible. Autorisez le stockage de session.",
          ),
        );
      }
    }
    setIntent(original);
    await send(original);
  }
  useEffect(() => {
    if (!transactionId) return;
    let active = true;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let running = false;
    let attempts = 0;
    const start = Date.now();
    const tick = async () => {
      if (!active || running || document.visibilityState !== "visible") return;
      running = true;
      try {
        const tx = scopedPos
          ? posOrderTransaction(
              await request<Order>(posOrderPath(posStoreId!, orderReference!)),
              posStoreId!,
              orderReference!,
            )
          : await request<PaymentTransaction>(`/customer-api/transactions/${transactionId}`);
        if (!active) return;
        setTransaction(tx);
        if (
          ["COMPLETED", "SUCCESS", "SUCCESSFUL", "FAILED", "CANCELED", "CANCELLED"].includes(
            tx.status || "",
          )
        ) {
          sessionStorage.removeItem(storageKey);
          onDone();
          return;
        }
        if (Date.now() - start < 180000)
          timer = setTimeout(() => void tick(), Math.min(3000 + attempts++ * 1000, 15000));
      } catch (e) {
        if (active)
          setError(
            e instanceof Error
              ? e.message
              : t("Unable to check payment.", "Impossible de vérifier le paiement."),
          );
      } finally {
        running = false;
      }
    };
    const resume = () => {
      clearTimeout(timer);
      if (document.visibilityState === "visible") void tick();
    };
    void tick();
    window.addEventListener("focus", resume);
    document.addEventListener("visibilitychange", resume);
    return () => {
      active = false;
      clearTimeout(timer);
      window.removeEventListener("focus", resume);
      document.removeEventListener("visibilitychange", resume);
    };
  }, [transactionId, checks, storageKey, t, onDone, scopedPos, posStoreId, orderReference]);
  const terminal = [
    "COMPLETED",
    "SUCCESS",
    "SUCCESSFUL",
    "FAILED",
    "CANCELED",
    "CANCELLED",
  ].includes(transaction?.status || "");
  return (
    <Modal
      title={
        transactionId
          ? t("Payment status", "Statut du paiement")
          : uncertain
            ? t("Checking your payment", "Vérification du paiement")
            : t("Collect payment", "Encaisser")
      }
      className="activation-dialog"
      onClose={onClose}
      busy={busy}
    >
      {transactionId ? (
        <>
          <div className="transaction-hero">
            <strong>
              {money(transaction?.grossAmount ?? amount, transaction?.currency || currency)}
            </strong>
            <Badge value={transaction?.status || "PROCESSING"} />
          </div>
          <p className="muted">
            {t(
              "You may leave and return later. Do not start another payment while this one is processing.",
              "Vous pouvez quitter et revenir. Ne créez pas un autre paiement pendant son traitement.",
            )}
          </p>
          {transaction && (
            <TransactionInstructions
              transaction={transaction}
              action={payment ? "PAY_REQUEST" : "COMMERCE_CHECKOUT_PAYMENT"}
            />
          )}
          <div className="modal-actions">
            <button className="button secondary" onClick={() => setChecks((v) => v + 1)}>
              {t("Check status", "Vérifier le statut")}
            </button>
            <button className="button primary" onClick={onClose}>
              {terminal ? t("Done", "Terminé") : t("Back", "Retour")}
            </button>
          </div>
        </>
      ) : uncertain && intent ? (
        <>
          <p>
            {t(
              "The original payment result is unconfirmed. Continue only with the same payment.",
              "Le résultat du paiement initial est incertain. Continuez uniquement avec le même paiement.",
            )}
          </p>
          <button disabled={busy} className="button primary" onClick={() => void send(intent)}>
            {t("Continue same payment", "Continuer le même paiement")}
          </button>
        </>
      ) : (
        <>
          {variable && (
            <label>
              {t("Amount", "Montant")} ({currency})
              <input
                inputMode="decimal"
                value={amountText}
                onChange={(e) => setAmountText(e.target.value)}
              />
            </label>
          )}
          {payment && (
            <details className="payer-collection-fields" open={!!payment.payerFields?.length}>
              <summary>{t("Payer details", "Informations du payeur")}</summary>
              <label>
                {t("Payer name", "Nom du payeur")}
                <input
                  value={payerName}
                  maxLength={180}
                  onChange={(e) => setPayerName(e.target.value)}
                />
              </label>
              <label>
                {t("Payer reference", "Référence du payeur")}
                <input
                  value={payerReference}
                  maxLength={180}
                  onChange={(e) => setPayerReference(e.target.value)}
                />
              </label>
              {payment.payerFields?.map((f) => (
                <label key={f.key}>
                  {f.label}
                  {f.required ? " *" : ""}
                  <input
                    required={f.required}
                    value={payerFields[f.key] || ""}
                    onChange={(e) => setPayerFields((v) => ({ ...v, [f.key]: e.target.value }))}
                  />
                </label>
              ))}
            </details>
          )}
          {amount > 0 && (
            <PaymentMethodWidget
              paymentRequestId={payment?.id}
              paymentRequestCode={payment?.linkCode}
              action={payment ? "PAY_REQUEST" : "COMMERCE_CHECKOUT_PAYMENT"}
              amount={amount}
              baseAmount={amount}
              baseCurrency={currency}
              confirmLabel={t("Confirm", "Confirmer")}
              feeMode={payment?.feeInclusion === "ABSORBED" ? "INCLUSIVE" : "EXCLUSIVE"}
              onClose={onClose}
              onConfirm={submit}
              busy={busy}
            />
          )}
        </>
      )}
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
    </Modal>
  );
}
