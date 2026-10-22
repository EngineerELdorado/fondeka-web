"use client";

import { useState, type FormEvent } from "react";
import { currencies, parseAmount } from "@/lib/format";
import { request } from "@/lib/data";
import type { PaymentRequest } from "@/lib/types";
import { Modal, SubmitButton } from "./ui";
import { useWorkspace } from "./workspace-provider";

export function PaymentForm({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: (payment: PaymentRequest) => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [currency, setCurrency] = useState("USD");
  const { refresh, notify } = useWorkspace();
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    const form = new FormData(event.currentTarget);
    setBusy(true);
    setError("");
    try {
      const amount = parseAmount(String(form.get("amount")), currency);
      const payment = await request<PaymentRequest>("/customer-api/payment_requests", {
        method: "POST",
        body: JSON.stringify({
          type: String(form.get("type")),
          title: String(form.get("title")).trim(),
          description: String(form.get("description")).trim(),
          amount,
          currency,
          feeInclusion: String(form.get("feeInclusion")),
        }),
      });
      refresh();
      notify("Payment request created.");
      onCreated(payment);
    } catch (error) {
      setError(error instanceof Error ? error.message : "Couldn’t create the payment request.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <Modal
      title="Good business starts with a request."
      description="Give your customers a simple way to pay."
      onClose={onClose}
      busy={busy}
    >
      <form className="form-stack" onSubmit={submit}>
        <label>
          What’s the payment for?
          <input
            name="title"
            required
            maxLength={180}
            placeholder="e.g. Wholesale order #1049"
            autoFocus
          />
        </label>
        <label>
          Request type
          <select name="type">
            <option value="QUICK_CHARGE">Payment link</option>
            <option value="INVOICE">Invoice</option>
          </select>
        </label>
        <div className="form-grid">
          <label>
            Amount
            <input name="amount" inputMode="decimal" required placeholder="0.00" />
          </label>
          <label>
            Currency
            <select value={currency} onChange={(e) => setCurrency(e.target.value)}>
              {currencies.map((item) => (
                <option key={item}>{item}</option>
              ))}
            </select>
          </label>
        </div>
        <label>
          Description
          <textarea
            name="description"
            rows={3}
            maxLength={2000}
            placeholder="A little context for your customer (optional)."
          />
        </label>
        <label>
          Processing fees
          <select name="feeInclusion">
            <option value="ABSORBED">I cover the fees</option>
            <option value="ON_TOP">Add fees to the customer’s total</option>
          </select>
        </label>
        <div className="info-box">
          Requests settle to your existing Fondeka account. Availability follows your account’s
          payment request settings.
        </div>
        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}
        <div className="modal-actions">
          <button type="button" className="button secondary" disabled={busy} onClick={onClose}>
            Cancel
          </button>
          <SubmitButton busy={busy}>Create request</SubmitButton>
        </div>
      </form>
    </Modal>
  );
}
