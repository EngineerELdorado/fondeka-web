"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { currencies } from "@/lib/format";
import { request } from "@/lib/data";
import type { Store, StoreInput } from "@/lib/types";
import { useWorkspace } from "./workspace-provider";
import { Modal, SubmitButton } from "./ui";

export function StoreForm({ store, onClose }: { store?: Store; onClose: () => void }) {
  const [currency, setCurrency] = useState(store?.defaultCurrency || "USD");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const { refresh, notify } = useWorkspace();
  const router = useRouter();
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    const form = new FormData(event.currentTarget);
    setBusy(true);
    setError("");
    try {
      const input: StoreInput = {
        name: String(form.get("name")).trim(),
        description: String(form.get("description")).trim(),
        defaultCurrency: currency,
        countryCode: String(form.get("countryCode")).trim().toUpperCase(),
        contactEmail: String(form.get("email") || "").trim(),
        ...(store ? { status: String(form.get("status")) } : {}),
      };
      const saved = await request<Store>(
        `/customer-api/commerce/stores${store ? `/${store.id}` : ""}`,
        { method: store ? "PATCH" : "POST", body: JSON.stringify(input) },
      );
      refresh();
      notify(store ? "Store updated." : "Your store is ready.");
      onClose();
      if (!store) router.push(`/stores/${saved.id}`);
    } catch (error) {
      setError(error instanceof Error ? error.message : "Couldn’t save your store.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <Modal
      title={store ? "Edit store" : "A new home for your business"}
      description={
        store ? "Update your store’s details." : "Bring your products and customers together."
      }
      onClose={onClose}
      busy={busy}
    >
      <form onSubmit={submit} className="form-stack">
        <label>
          Store name
          <input
            name="name"
            defaultValue={store?.name}
            required
            maxLength={160}
            placeholder="e.g. Atelier Kin"
            autoFocus
          />
        </label>
        <label>
          Description
          <textarea
            name="description"
            defaultValue={store?.description}
            maxLength={2000}
            placeholder="Tell customers a little about your store."
            rows={3}
          />
        </label>
        <div className="form-grid">
          <label>
            Default currency
            <select value={currency} onChange={(e) => setCurrency(e.target.value)}>
              {currencies.map((item) => (
                <option key={item}>{item}</option>
              ))}
            </select>
          </label>
          <label>
            Country code
            <input
              name="countryCode"
              defaultValue={store?.countryCode || "CD"}
              required
              pattern="[A-Za-z]{2}"
              maxLength={2}
              placeholder="CD"
            />
          </label>
        </div>
        <label>
          Contact email
          <input
            type="email"
            name="email"
            defaultValue={store?.contactEmail}
            maxLength={254}
            placeholder="hello@yourbusiness.com"
          />
        </label>
        {store && (
          <label>
            Store status
            <select name="status" defaultValue={store.status}>
              {["DRAFT", "ACTIVE", "SUSPENDED", "ARCHIVED"].map((value) => (
                <option key={value}>{value}</option>
              ))}
            </select>
          </label>
        )}
        {!store && (
          <div className="info-box">
            Additional stores are included with your account’s Business Tools access.
          </div>
        )}
        {error && (
          <p role="alert" className="form-error">
            {error}
          </p>
        )}
        <div className="modal-actions">
          <button type="button" className="button secondary" onClick={onClose} disabled={busy}>
            Cancel
          </button>
          <SubmitButton busy={busy}>{store ? "Save changes" : "Create store"}</SubmitButton>
        </div>
      </form>
    </Modal>
  );
}
