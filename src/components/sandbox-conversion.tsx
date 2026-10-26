"use client";
import { useUiText } from "@/lib/use-ui-text";

import { useState, useSyncExternalStore } from "react";
import { ArrowRight, RefreshCw } from "lucide-react";
import { Modal } from "./ui";
import { date, money } from "@/lib/format";
import { SandboxConversionClient } from "@/lib/sandbox-conversion";
import type { SandboxConversion } from "@/lib/types";

export function ConversionRecovery({
  client,
  onOpen,
}: {
  client: SandboxConversionClient;
  onOpen: () => void;
}) {
  const uiText = useUiText();

  const state = useSyncExternalStore(client.subscribe, client.getSnapshot, client.getSnapshot);
  if (!state.intent) return null;
  return (
    <div className="wallet-recovery" role="status">
      <span>
        {state.busy === "execute"
          ? uiText("Confirming sandbox conversion…")
          : uiText("A sandbox conversion needs confirmation.")}{" "}
        {money(state.intent.body.amount, state.intent.body.sourceCurrency)} →{" "}
        {state.intent.body.targetCurrency}
      </span>
      <button className="text-button" onClick={onOpen}>
        {uiText("View conversion")}
      </button>
    </div>
  );
}
export function SandboxConversionDialog({
  client,
  initialCurrency,
  onClose,
}: {
  client: SandboxConversionClient;
  initialCurrency: string;
  onClose: () => void;
}) {
  const uiText = useUiText();

  const state = useSyncExternalStore(client.subscribe, client.getSnapshot, client.getSnapshot);
  const initial = state.intent?.body || state.body;
  const [source, setSource] = useState(initial?.sourceCurrency || initialCurrency);
  const [target, setTarget] = useState(initial?.targetCurrency || "");
  const [amount, setAmount] = useState(initial ? String(initial.amount) : "");
  const busy = state.busy === "execute";
  const fixed = busy || !!state.intent || !!state.blocked;
  function edit(set: (value: string) => void, value: string) {
    client.edit();
    set(value);
  }
  return (
    <Modal
      title={state.result ? uiText("Sandbox conversion complete") : uiText("Convert sandbox funds")}
      description={uiText("SANDBOX · Synthetic rates and virtual money only")}
      onClose={() => {
        client.edit();
        onClose();
      }}
      busy={busy}
    >
      {state.result ? (
        <>
          <ConversionSummary value={state.result} />
          <p className="info-box">
            {uiText(
              "These are the original conversion and balance snapshots. Current sandbox balances and both currency histories have been refreshed separately. No real currency was exchanged.",
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
            if (!state.intent) void client.preview(source, target, amount);
          }}
        >
          <div className="info-box">
            {uiText(
              "Convert test funds between your account’s sandbox wallets. Rates are synthetic test fixtures, not market rates. Unsupported pairs are checked by Fondeka.",
            )}
          </div>
          <div className="form-grid conversion-currencies">
            <label>
              {uiText("From currency")}
              <input
                value={state.intent?.body.sourceCurrency || source}
                maxLength={3}
                placeholder={uiText("e.g. USD")}
                disabled={fixed}
                required
                onChange={(event) => edit(setSource, event.target.value.toUpperCase())}
              />
            </label>
            <label>
              {uiText("To currency")}
              <input
                value={state.intent?.body.targetCurrency || target}
                maxLength={3}
                placeholder={uiText("e.g. EUR")}
                disabled={fixed}
                required
                onChange={(event) => edit(setTarget, event.target.value.toUpperCase())}
              />
            </label>
          </div>
          <label>
            {uiText("Source amount")}
            <input
              value={state.intent ? String(state.intent.body.amount) : amount}
              inputMode="decimal"
              placeholder="0.00"
              disabled={fixed}
              required
              onChange={(event) => edit(setAmount, event.target.value)}
            />
          </label>
          <small className="muted">
            {uiText(
              "0.01–1,000,000 source units, up to two decimals. A preview does not create or fund wallets.",
            )}
          </small>
          {state.quote && (
            <>
              <ConversionSummary value={state.quote} />
              <p className="info-box">
                {uiText(
                  "This preview is not a locked rate or a reservation. On confirmation, Fondeka recalculates using the current test fixtures. The completed conversion’s returned amount is final.",
                )}
              </p>
            </>
          )}
          {state.intent && (
            <p className="info-box">
              {busy
                ? uiText("Checking this conversion.")
                : uiText(
                    "Its result is unconfirmed. Retry the same conversion to recover its result.",
                  )}{" "}
              {uiText(
                "The currencies, amount and request key remain unchanged. No new conversion is started.",
              )}
            </p>
          )}
          {state.error && (
            <p className="form-error" role="alert">
              {state.error}
            </p>
          )}
          <div className="modal-actions conversion-actions">
            <button
              type="button"
              className="button secondary"
              disabled={busy}
              onClick={() => {
                client.edit();
                onClose();
              }}
            >
              {uiText("Back")}
            </button>
            {!state.intent && (
              <button
                type="submit"
                className="button secondary"
                disabled={!!state.busy || state.blocked}
              >
                {state.busy === "quote" ? (
                  <>
                    <span className="spinner" />
                    {uiText("Loading quote…")}
                  </>
                ) : state.quote ? (
                  <>
                    <RefreshCw size={15} />
                    {uiText("Refresh quote")}
                  </>
                ) : (
                  uiText("Preview conversion")
                )}
              </button>
            )}
            {(state.quote || state.intent) && (
              <button
                type="button"
                className="button primary"
                disabled={!!state.busy || state.blocked}
                onClick={() => void client.confirm()}
              >
                {busy ? (
                  <>
                    <span className="spinner" />
                    {uiText("Confirming…")}
                  </>
                ) : state.intent ? (
                  uiText("Retry same conversion")
                ) : (
                  <>
                    {uiText("Confirm conversion")}
                    <ArrowRight size={15} />
                  </>
                )}
              </button>
            )}
          </div>
        </form>
      )}
    </Modal>
  );
}
function ConversionSummary({ value }: { value: SandboxConversion }) {
  const uiText = useUiText();

  const completed = value.status === "COMPLETED";
  return (
    <section
      className="conversion-summary"
      aria-label={
        completed ? uiText("Completed sandbox conversion") : uiText("Sandbox conversion preview")
      }
    >
      <span className="environment-tag sandbox">
        {completed ? "COMPLETED · TEST FUNDS" : "PREVIEW · TEST FUNDS"}
      </span>
      <p className="muted">
        {completed ? uiText("Received") : uiText("Estimated to receive")} · {value.targetCurrency}
      </p>
      <strong className="conversion-target">
        {money(value.targetAmount, value.targetCurrency)}
      </strong>
      <dl className="detail-list">
        <div>
          <dt>
            {uiText("Source debit (")}
            {value.sourceCurrency})
          </dt>
          <dd>{money(value.sourceAmount, value.sourceCurrency)}</dd>
        </div>
        <div>
          <dt>
            {uiText("Conversion fee (")}
            {value.sourceCurrency})
          </dt>
          <dd>{money(value.feeAmount, value.sourceCurrency)}</dd>
        </div>
        <div>
          <dt>{uiText("Net source amount")}</dt>
          <dd>{money(value.netSourceAmount, value.sourceCurrency)}</dd>
        </div>
        <div className="conversion-rate">
          <dt>{uiText("Synthetic cross rate")}</dt>
          <dd>
            1 {value.sourceCurrency} = {value.rate.toFixed(12)} {value.targetCurrency}
          </dd>
        </div>
        <div>
          <dt>
            {value.sourceCurrency}
            {uiText("balance")}
            {completed ? "after" : "at preview"}
          </dt>
          <dd>{money(value.sourceWallet.balance, value.sourceCurrency)}</dd>
        </div>
        <div>
          <dt>
            {value.targetCurrency}
            {uiText("balance")}
            {completed ? "after" : "at preview"}
          </dt>
          <dd>{money(value.targetWallet.balance, value.targetCurrency)}</dd>
        </div>
        {value.id && (
          <div className="conversion-correlation">
            <dt>{uiText("Conversion ID")}</dt>
            <dd className="mono">{value.id}</dd>
          </div>
        )}
        {value.createdAt && (
          <div>
            <dt>{uiText("Completed")}</dt>
            <dd>{date(value.createdAt)}</dd>
          </div>
        )}
      </dl>
    </section>
  );
}
