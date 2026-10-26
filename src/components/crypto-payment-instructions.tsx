"use client";

import { Copy, ExternalLink } from "lucide-react";
import { date, safeLink } from "@/lib/format";
import type { ApiEnvironment, ApiTransaction } from "@/lib/types";
import { useWorkspace } from "./workspace-provider";
import type { PaymentLanguage } from "@/lib/business-tools-ui";

export function CryptoPaymentInstructions({
  details,
  environment = "LIVE",
  language = "en",
}: {
  details: NonNullable<ApiTransaction["transaction"]["cryptoDetails"]>;
  environment?: ApiEnvironment;
  language?: PaymentLanguage;
}) {
  if (environment === "SANDBOX")
    return (
      <div className="crypto-instructions sandbox-crypto">
        <h3>Simulated crypto details</h3>
        <p className="info-box">
          SANDBOX · Not payable. The token amount and exchange rate are synthetic fixtures. No
          blockchain deposit or confirmation is needed. Never send crypto to the fixture identifier.
        </p>
        <dl className="detail-list">
          <div>
            <dt>Network</dt>
            <dd>{details.network || "—"}</dd>
          </div>
          <div>
            <dt>Simulated token amount</dt>
            <dd>
              {details.amountInCrypto ?? "—"} {details.cryptoCurrency}
            </dd>
          </div>
          <div>
            <dt>Synthetic exchange rate</dt>
            <dd>
              {details.exchangeRate ?? "—"} {details.exchangeRateCurrency}
            </dd>
          </div>
          {details.address && (
            <div>
              <dt>Fixture identifier</dt>
              <dd>
                <code>{details.address}</code>
              </dd>
            </div>
          )}
        </dl>
      </div>
    );
  return <PayableCryptoInstructions details={details} language={language} />;
}
function PayableCryptoInstructions({
  details,
  language,
}: {
  details: NonNullable<ApiTransaction["transaction"]["cryptoDetails"]>;
  language: PaymentLanguage;
}) {
  const crypto = details;
  const invoice = safeLink(crypto.invoiceUrl ?? undefined);
  const { notify } = useWorkspace();
  const fr = language === "fr";
  async function copy(value: string) {
    try {
      await navigator.clipboard.writeText(value);
      notify(fr ? "Copié dans le presse-papiers." : "Copied to clipboard.");
    } catch {
      notify(
        fr
          ? "Sélectionnez le texte pour le copier."
          : "Copy isn’t available in this browser. Select the text to copy it.",
      );
    }
  }
  return (
    <div className="crypto-instructions">
      <h3>{fr ? "Instructions de paiement crypto" : "Crypto payment instructions"}</h3>
      <p className="muted">
        {fr
          ? "Le montant ci-dessous est exprimé en crypto."
          : "The amount below is in crypto units."}
      </p>
      <dl className="detail-list">
        <div>
          <dt>{fr ? "Réseau" : "Network"}</dt>
          <dd>{crypto.network || "—"}</dd>
        </div>
        <div>
          <dt>{fr ? "Montant crypto" : "Token amount"}</dt>
          <dd>
            {crypto.amountInCrypto ?? "—"} {crypto.cryptoCurrency}
          </dd>
        </div>
        <div>
          <dt>{fr ? "Expiration" : "Expires"}</dt>
          <dd>{date(crypto.expiresAt, fr ? "fr" : undefined)}</dd>
        </div>
        {crypto.exchangeRate != null && (
          <div>
            <dt>{fr ? "Taux de change" : "Exchange rate"}</dt>
            <dd>
              {crypto.exchangeRate} {crypto.exchangeRateCurrency || "—"} /{" "}
              {crypto.cryptoCurrency || (fr ? "jeton" : "token")}
            </dd>
          </div>
        )}
      </dl>
      {crypto.address && (
        <div className="copy-field">
          <code>{crypto.address}</code>
          <button
            className="icon-button"
            aria-label={fr ? "Copier l’adresse crypto" : "Copy crypto address"}
            onClick={() => void copy(crypto.address!)}
          >
            <Copy size={16} />
          </button>
        </div>
      )}
      {invoice && (
        <a className="text-button" href={invoice} target="_blank" rel="noopener noreferrer">
          {fr ? "Ouvrir la facture" : "Open invoice"} <ExternalLink size={14} />
        </a>
      )}
    </div>
  );
}
