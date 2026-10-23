"use client";
import { useI18n } from "@/lib/i18n";
import { useQuery } from "@/lib/use-query";
import { normalizeMethods } from "@/lib/business-tools";
import type { PaymentTransaction, PaymentMethod } from "@/lib/business-tools";
import { CryptoPaymentInstructions } from "./crypto-payment-instructions";
/** Safe customer instructions only; no raw provider response is rendered. */
export function TransactionInstructions({
  transaction,
  action,
}: {
  transaction: PaymentTransaction;
  action: string;
}) {
  const { t, language } = useI18n();
  const methods = useQuery<unknown>(
    `/customer-api/payment_methods?${new URLSearchParams({ type: "COLLECTION", action })}`,
    { "X-Client-Version": "1.0.97" },
  );
  let method: PaymentMethod | undefined;
  try {
    if (methods.data)
      method = normalizeMethods(methods.data).paymentMethods.find(
        (m) =>
          m.id === transaction.paymentMethodId &&
          (!m.currency || m.currency === transaction.currency),
      );
  } catch {
    /* Status and a later refresh remain available. */
  }
  return (
    <>
      {transaction.reference && (
        <p className="activation-note">
          {t("Payment reference", "Référence de paiement")}: <code>{transaction.reference}</code>
        </p>
      )}
      {(transaction.displayMessage || transaction.receipt?.humanMessage) && (
        <p className="info-box">
          {transaction.displayMessage || transaction.receipt?.humanMessage}
        </p>
      )}
      {method?.type === "MOBILE_MONEY" && (
        <p className="info-box">
          {t(
            "Approve the payment prompt on your phone, then check status.",
            "Validez la demande de paiement sur votre téléphone, puis vérifiez le statut.",
          )}
        </p>
      )}
      {method?.type === "BANK" && (
        <>
          <h3>{t("Bank transfer instructions", "Instructions de virement bancaire")}</h3>
          <dl className="detail-list">
            {[
              [t("Bank", "Banque"), method.bankName],
              [t("Account name", "Titulaire du compte"), method.bankAccountName],
              [t("Account number", "Numéro de compte"), method.bankAccountNumber],
            ].map(
              ([k, v]) =>
                v && (
                  <div key={k}>
                    <dt>{k}</dt>
                    <dd>{v}</dd>
                  </div>
                ),
            )}
          </dl>
          <p>{method.localizedBankInstructions || method.bankInstructions}</p>
          <p className="muted">
            {t(
              "Use the payment reference for your transfer. Confirmation may take time.",
              "Utilisez la référence du paiement pour votre virement. La confirmation peut prendre du temps.",
            )}
          </p>
        </>
      )}
      {transaction.cryptoDetails ? (
        <CryptoPaymentInstructions details={transaction.cryptoDetails} language={language} />
      ) : method?.type === "CRYPTO" ? (
        <p className="muted">
          {t(
            "The crypto invoice is being prepared. Refresh this payment for instructions.",
            "La facture crypto est en préparation. Actualisez ce paiement pour obtenir les instructions.",
          )}
        </p>
      ) : null}
    </>
  );
}
