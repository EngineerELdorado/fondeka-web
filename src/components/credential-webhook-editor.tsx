"use client";

import { useEffect, useId, useRef, useState, type FormEvent } from "react";
import { ArrowRight, Save, Webhook } from "lucide-react";
import { useUiText } from "@/lib/use-ui-text";
import { webhookUpdatePayload } from "@/lib/credential-form";
import { credentialMetadata, replaceCredentialMetadata } from "@/lib/credential-metadata";
import { request } from "@/lib/data";
import { invalidateQueryPaths, queryCacheGeneration } from "@/lib/query-cache";
import type { ApiEnvironment, ApiKey } from "@/lib/types";
import { Modal } from "./ui";
import { useWorkspace } from "./workspace-provider";

export function CredentialWebhookEditor({
  credential,
  businessId,
  environment,
  onClose,
  onSaved,
  refresh,
}: {
  credential: ApiKey;
  businessId: number;
  environment: ApiEnvironment;
  onClose: () => void;
  onSaved: () => void;
  refresh: () => void;
}) {
  const uiText = useUiText();
  const { accountKey } = useWorkspace();
  const [url, setUrl] = useState(credential.webhookUrl ?? "");
  const [busy, setBusy] = useState(false);
  const [fieldError, setFieldError] = useState("");
  const [error, setError] = useState("");
  const input = useRef<HTMLInputElement>(null);
  const locked = useRef(false);
  const active = useRef(true);
  const id = useId();
  useEffect(() => {
    active.current = true;
    return () => {
      active.current = false;
    };
  }, []);
  useEffect(() => {
    if (fieldError && !busy) input.current?.focus();
  }, [fieldError, busy]);

  async function save(event: FormEvent) {
    event.preventDefault();
    if (locked.current || !accountKey) return;
    setFieldError("");
    setError("");
    let payload: ReturnType<typeof webhookUpdatePayload>;
    try {
      payload = webhookUpdatePayload(url);
    } catch (failure) {
      setFieldError(uiText((failure as Error).message));
      input.current?.focus();
      return;
    }
    const generation = queryCacheGeneration();
    locked.current = true;
    setBusy(true);
    try {
      const result = credentialMetadata(
        await request(`/customer-api/businesses/${businessId}/api-keys/${credential.id}/webhook`, {
          method: "PATCH",
          body: JSON.stringify(payload),
        }),
        businessId,
        environment,
      );
      if (!active.current || generation !== queryCacheGeneration()) return;
      replaceCredentialMetadata(accountKey, businessId, environment, result, generation);
      onSaved();
    } catch (failure) {
      if (!active.current || generation !== queryCacheGeneration()) return;
      const status = (failure as { status?: number }).status;
      const message =
        failure instanceof Error
          ? uiText(failure.message)
          : uiText("Could not update the webhook URL.");
      if (status === 400) {
        setFieldError(message);
        input.current?.focus();
      } else setError(message);
      if (status === 404) {
        invalidateQueryPaths(["/customer-api/businesses?"]);
        refresh();
      }
    } finally {
      locked.current = false;
      if (active.current) setBusy(false);
    }
  }

  return (
    <Modal
      title={uiText("Edit webhook")}
      description={uiText("Change where this integration receives signed payment events.")}
      onClose={onClose}
      busy={busy}
      className="credential-webhook-dialog"
    >
      <form className="form-stack" onSubmit={save} noValidate aria-busy={busy}>
        <div className="credential-webhook-identity">
          <span className="credential-webhook-icon">
            <Webhook size={22} />
          </span>
          <div>
            <strong>{credential.name}</strong>
            <code className="key-prefix">{credential.keyPrefix}••••</code>
          </div>
          <span className={`environment-tag ${environment.toLowerCase()}`}>{environment}</span>
        </div>
        <label htmlFor={id}>
          {uiText("Webhook URL")}
          <input
            ref={input}
            id={id}
            data-autofocus
            type="url"
            maxLength={2048}
            autoComplete="off"
            spellCheck={false}
            value={url}
            disabled={busy}
            onChange={(event) => setUrl(event.target.value)}
            aria-invalid={!!fieldError}
            aria-describedby={`${id}-help${fieldError ? ` ${id}-error` : ""}`}
          />
        </label>
        <p id={`${id}-help`} className="field-help">
          {uiText("Use a public HTTPS address on port 443, without URL credentials or a fragment.")}
        </p>
        {fieldError && (
          <p id={`${id}-error`} className="form-error" role="alert">
            {fieldError}
          </p>
        )}
        <div className="credential-webhook-transition">
          <ArrowRight size={18} aria-hidden="true" />
          <div>
            <strong>{uiText("Prepare your new receiver first")}</strong>
            <p>
              {uiText(
                "Use the existing signing secret at the new address. Keep the previous receiver available for deliveries already in flight.",
              )}
            </p>
            <p>
              {uiText(
                "New attempts and queued retries use the updated URL. Successful events are not replayed and exhausted deliveries are not restarted.",
              )}
            </p>
          </div>
        </div>
        <p className="muted">
          {uiText(
            "Your API key and signing secret stay the same. No payment is created or replayed.",
          )}
        </p>
        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}
        <div className="modal-actions">
          <button type="button" className="button secondary" disabled={busy} onClick={onClose}>
            {uiText("Cancel")}
          </button>
          <button type="submit" className="button primary" disabled={busy || !url.trim()}>
            <Save size={16} />
            {busy ? uiText("Saving…") : uiText("Save webhook URL")}
          </button>
        </div>
      </form>
    </Modal>
  );
}
