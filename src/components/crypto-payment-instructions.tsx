"use client";

import { Copy, ExternalLink } from "lucide-react";
import { date, safeLink } from "@/lib/format";
import type { PaymentTransaction } from "@/lib/business-tools";
import type { ApiEnvironment } from "@/lib/types";
import { useWorkspace } from "./workspace-provider";

export function CryptoPaymentInstructions({
  details,
  environment = "LIVE",
}: {
  details: NonNullable<PaymentTransaction["cryptoDetails"]>;
  environment?: ApiEnvironment;
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
            <dd>{details.exchangeRate ?? "—"}</dd>
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
  return <PayableCryptoInstructions details={details} />;
}
function PayableCryptoInstructions({
  details,
}: {
  details: NonNullable<PaymentTransaction["cryptoDetails"]>;
}) {
  const crypto = details;
  const invoice = safeLink(crypto.invoiceUrl);
  const { notify } = useWorkspace();
  async function copy(value: string) {
    try {
      await navigator.clipboard.writeText(value);
      notify("Copied to clipboard.");
    } catch {
      notify("Copy isn’t available in this browser. Select the text to copy it.");
    }
  }
  return (
    <div className="crypto-instructions">
      <h3>Crypto payment instructions</h3>
      <p className="muted">Token amounts below are separate from the fiat amounts above.</p>
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
        <a className="text-button" href={invoice} target="_blank" rel="noopener noreferrer">
          Open invoice <ExternalLink size={14} />
        </a>
      )}
    </div>
  );
}
