"use client";

import { useRef, useState, type FormEvent } from "react";
import { Copy, KeyRound, Plus, ShieldAlert, Trash2, Webhook } from "lucide-react";
import { api } from "@/lib/api";
import { demoMode } from "@/lib/auth";
import {
  credentialPayload,
  parseIssuedCredentials,
  type IssuedCredentials,
} from "@/lib/credential-form";
import type { ApiKey } from "@/lib/types";
import { date } from "@/lib/format";
import { Badge, Empty, ErrorState, Loading, Modal, SubmitButton } from "./ui";

export function ApiCredentials({
  businessId,
  keys,
  refresh,
}: {
  businessId: number;
  keys: { data?: ApiKey[]; loading: boolean; error?: string };
  refresh: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [webhookUrl, setWebhookUrl] = useState("");
  const [issued, setIssued] = useState<IssuedCredentials>();
  const [revoke, setRevoke] = useState<ApiKey>();
  const [busy, setBusy] = useState(false);
  const locked = useRef(false);
  const [error, setError] = useState("");
  const [copyStatus, setCopyStatus] = useState("");
  const path = "/customer-api/businesses/" + businessId + "/api-keys";

  function close() {
    if (locked.current) return;
    if (
      issued &&
      !window.confirm("Have you saved both secrets securely? They cannot be shown again.")
    )
      return;
    setIssued(undefined);
    setOpen(false);
    setRevoke(undefined);
    setName("");
    setWebhookUrl("");
    setError("");
    setCopyStatus("");
  }
  async function create(event: FormEvent) {
    event.preventDefault();
    if (locked.current || demoMode) return;
    setError("");
    let payload: ReturnType<typeof credentialPayload>;
    try {
      payload = credentialPayload(name, webhookUrl);
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "Check the integration details.");
      return;
    }
    locked.current = true;
    setBusy(true);
    try {
      const result = parseIssuedCredentials(
        await api<unknown>(path, { method: "POST", body: JSON.stringify(payload) }),
      );
      setIssued(result); // Memory only. Never put secrets into query caches, storage, URLs, notifications or logs.
      refresh();
    } catch (failure) {
      setError(
        (failure instanceof Error ? failure.message : "Could not generate credentials.") +
          " If the result is uncertain, refresh the key list and revoke any unexpected key before trying again.",
      );
      refresh(); // Do not automatically retry a credential-creation POST.
    } finally {
      locked.current = false;
      setBusy(false);
    }
  }
  async function revokeKey() {
    if (!revoke || locked.current || demoMode) return;
    locked.current = true;
    setBusy(true);
    setError("");
    try {
      await api<void>(path + "/" + revoke.id, { method: "DELETE" });
      setRevoke(undefined);
      refresh();
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "Could not revoke the key.");
    } finally {
      locked.current = false;
      setBusy(false);
    }
  }
  async function copy(value: string, label: string) {
    try {
      await navigator.clipboard.writeText(value);
      setCopyStatus(label + " copied. Store it securely on your backend.");
    } catch {
      setCopyStatus("Copy failed. Select the value and copy it manually.");
    }
  }

  return (
    <>
      <section className="panel api-keys-panel">
        <div className="panel-heading">
          <div>
            <h2>
              <KeyRound size={18} /> API credentials
            </h2>
            <p className="muted">Generate credentials for your backend integrations.</p>
          </div>
          <button
            className="button primary small"
            disabled={demoMode || keys.loading || !!keys.error}
            onClick={() => {
              setOpen(true);
              setError("");
            }}
          >
            <Plus size={16} /> Generate API credentials
          </button>
        </div>
        {keys.loading ? (
          <Loading rows={2} />
        ) : keys.error ? (
          <ErrorState message={keys.error} retry={refresh} />
        ) : !keys.data?.length ? (
          <Empty
            title="No API credentials yet"
            description="Generate your first key and configure where Fondeka should deliver signed webhooks."
          />
        ) : (
          <>
            <div className="table-wrap desktop-table">
              <table>
                <thead>
                  <tr>
                    <th>Integration</th>
                    <th>Key prefix</th>
                    <th>Webhook destination</th>
                    <th>Created</th>
                    <th>Status</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {keys.data.map((key) => (
                    <tr key={key.id}>
                      <td className="table-name">{key.name}</td>
                      <td>
                        <code className="key-prefix">{key.keyPrefix}••••</code>
                      </td>
                      <td>
                        <span className="webhook-url">
                          <Webhook size={14} />
                          {key.webhookUrl || "Not configured"}
                        </span>
                      </td>
                      <td>{date(key.createdAt)}</td>
                      <td>
                        <Badge value={key.enabled ? "ENABLED" : "REVOKED"} />
                      </td>
                      <td>
                        {key.enabled && (
                          <button
                            className="button secondary small"
                            disabled={demoMode || busy}
                            onClick={() => {
                              setRevoke(key);
                              setError("");
                            }}
                            aria-label={"Revoke " + key.name}
                          >
                            <Trash2 size={14} /> Revoke
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="mobile-credentials-list">
              {keys.data.map((key) => (
                <article className="mobile-credential" key={key.id}>
                  <div className="mobile-credential-heading">
                    <span className="mobile-record-icon">
                      <KeyRound size={20} />
                    </span>
                    <strong>{key.name}</strong>
                    <Badge value={key.enabled ? "ENABLED" : "REVOKED"} />
                  </div>
                  <code className="key-prefix">{key.keyPrefix}••••</code>
                  <details>
                    <summary>Integration details</summary>
                    <dl className="detail-list">
                      <div>
                        <dt>Created</dt>
                        <dd>{date(key.createdAt)}</dd>
                      </div>
                      <div>
                        <dt>Webhook</dt>
                        <dd>{key.webhookUrl || "Not configured"}</dd>
                      </div>
                    </dl>
                    {key.enabled && (
                      <button
                        className="button danger small"
                        disabled={demoMode || busy}
                        onClick={() => {
                          setRevoke(key);
                          setError("");
                        }}
                        aria-label={`Revoke ${key.name}`}
                      >
                        <Trash2 size={16} />
                        Revoke key
                      </button>
                    )}
                  </details>
                </article>
              ))}
            </div>
          </>
        )}
        <div className="panel-note">
          <KeyRound size={14} />
          {demoMode
            ? "Credential generation and revocation require a signed-in live account."
            : "Secrets are shown once at generation. Store them on your backend. Admins can still manage your credentials."}
        </div>
      </section>
      {open && (
        <Modal
          title={issued ? "Save your credentials now" : "Generate API credentials"}
          description={
            issued
              ? "This is the only time both secrets will be displayed."
              : "Choose an integration name and a public HTTPS webhook URL."
          }
          onClose={close}
          busy={busy}
        >
          {issued ? (
            <div>
              <p className="panel-note">
                <ShieldAlert size={18} />
                Never embed these secrets in browser or mobile code, or share them in support
                messages.
              </p>
              <label>
                API key
                <div className="copy-field">
                  <input
                    style={{ flex: 1, minWidth: 0 }}
                    value={issued.apiKey}
                    readOnly
                    autoComplete="off"
                    spellCheck={false}
                    aria-label="New API key"
                  />
                  <button
                    className="icon-button"
                    aria-label="Copy API key"
                    onClick={() => void copy(issued.apiKey, "API key")}
                  >
                    <Copy size={16} />
                  </button>
                </div>
              </label>
              <label>
                Webhook signing secret
                <div className="copy-field">
                  <input
                    style={{ flex: 1, minWidth: 0 }}
                    value={issued.webhookSecret}
                    readOnly
                    autoComplete="off"
                    spellCheck={false}
                    aria-label="New webhook signing secret"
                  />
                  <button
                    className="icon-button"
                    aria-label="Copy webhook signing secret"
                    onClick={() => void copy(issued.webhookSecret, "Webhook secret")}
                  >
                    <Copy size={16} />
                  </button>
                </div>
              </label>
              <p className="muted" role="status">
                {copyStatus}
              </p>
              <div className="modal-actions">
                <button className="button primary" onClick={close}>
                  I have saved both secrets
                </button>
              </div>
            </div>
          ) : (
            <form className="form-stack" onSubmit={(event) => void create(event)}>
              <label>
                Integration name
                <input
                  required
                  maxLength={100}
                  value={name}
                  autoComplete="off"
                  onChange={(event) => setName(event.target.value)}
                  placeholder="e.g. Production checkout"
                />
              </label>
              <label>
                Webhook URL
                <input
                  required
                  type="url"
                  maxLength={2048}
                  value={webhookUrl}
                  autoComplete="off"
                  onChange={(event) => setWebhookUrl(event.target.value)}
                  placeholder="https://your-backend.example/webhooks/fondeka"
                />
              </label>
              {error && (
                <p className="form-error" role="alert">
                  {error}
                </p>
              )}
              <div className="modal-actions">
                <button className="button secondary" type="button" disabled={busy} onClick={close}>
                  Cancel
                </button>
                <SubmitButton busy={busy}>Generate credentials</SubmitButton>
              </div>
            </form>
          )}
        </Modal>
      )}
      {revoke && (
        <Modal
          title={"Revoke " + revoke.name + "?"}
          onClose={close}
          busy={busy}
          description="This key will stop accepting new API requests. Accepted payments, their webhooks and transaction history remain intact."
        >
          {error && (
            <p className="form-error" role="alert">
              {error}
            </p>
          )}
          <div className="modal-actions">
            <button className="button secondary" disabled={busy} onClick={close}>
              Cancel
            </button>
            <button className="button primary" disabled={busy} onClick={() => void revokeKey()}>
              {busy ? "Revoking…" : "Revoke API key"}
            </button>
          </div>
        </Modal>
      )}
    </>
  );
}
