"use client";
import { useUiText } from "@/lib/use-ui-text";

import { useEffect, useRef, useState } from "react";
import { Copy, KeyRound, Pencil, Plus, ShieldAlert, Trash2, Webhook } from "lucide-react";
import { api } from "@/lib/api";
import { demoMode } from "@/lib/auth";
import {
  credentialPayload,
  credentialCreationNeedsReview,
  parseIssuedCredentials,
  type IssuedCredentials,
} from "@/lib/credential-form";
import type { ApiEnvironment, ApiKey } from "@/lib/types";
import { date } from "@/lib/format";
import { Badge, Empty, ErrorState, Loading, Modal } from "./ui";

import { CredentialCreateFlow } from "./credential-create-flow";
import { useUrlState } from "@/lib/use-url-state";
import { CredentialWebhookEditor } from "./credential-webhook-editor";
import { invalidateQueryPaths } from "@/lib/query-cache";
export function ApiCredentials({
  businessId,
  environment,
  keys,
  refresh,
}: {
  businessId: number;
  environment: ApiEnvironment;
  keys: { data?: ApiKey[]; loading: boolean; error?: string };
  refresh: () => void;
}) {
  const uiText = useUiText();

  const { values, update } = useUrlState();
  const open = values.get("createKey") === "1" && !demoMode;
  const setOpen = (open: boolean) => update({ createKey: open ? 1 : null, flow: null, step: null });
  const closeRequest = useRef<(() => void) | null>(null);
  const [uncertain, setUncertain] = useState(false);
  const [issued, setIssued] = useState<IssuedCredentials>();
  const [revoke, setRevoke] = useState<ApiKey>();
  const [editing, setEditing] = useState<ApiKey>();
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const locked = useRef(false);
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  const [error, setError] = useState("");
  const [copyStatus, setCopyStatus] = useState("");
  useEffect(() => {
    if (!issued) return;
    const route = window.location.pathname;
    const pop = (event: PopStateEvent) => {
      if (
        window.location.pathname !== route ||
        new URLSearchParams(window.location.search).get("createKey") === "1"
      )
        return;
      if (
        !window.confirm(uiText("Have you saved both secrets securely? They cannot be shown again."))
      ) {
        event.stopImmediatePropagation();
        window.history.forward();
      } else {
        setIssued(undefined);
        setCopyStatus("");
      }
    };
    window.addEventListener("popstate", pop, true);
    return () => window.removeEventListener("popstate", pop, true);
  }, [issued, uiText]);

  const path = "/customer-api/businesses/" + businessId + "/api-keys";
  const activeKeys = keys.data?.filter((key) => key.enabled);

  function editWebhook(key: ApiKey) {
    setNotice("");
    setEditing(key);
  }

  function close() {
    if (locked.current) return;
    if (
      issued &&
      !window.confirm(uiText("Have you saved both secrets securely? They cannot be shown again."))
    )
      return;
    setIssued(undefined);
    setOpen(false);
    setRevoke(undefined);
    setUncertain(false);
    setError("");
    setCopyStatus("");
  }
  async function create(name: string, webhookUrl: string) {
    if (locked.current || demoMode) return;
    setError("");
    const payload = credentialPayload(name, webhookUrl, environment);
    locked.current = true;
    setBusy(true);
    try {
      const result = parseIssuedCredentials(
        await api<unknown>(path, { method: "POST", body: JSON.stringify(payload) }),
        environment,
      );
      if (!mounted.current) return;
      setIssued(result); // Memory only. Never put secrets into query caches, storage, URLs, notifications or logs.
      refresh();
    } catch (failure) {
      if (!mounted.current) return;
      if (!credentialCreationNeedsReview(failure)) throw failure;
      setError(
        (failure instanceof Error
          ? uiText(failure.message)
          : uiText("Could not generate credentials.")) +
          uiText(
            " If the result is uncertain, refresh the key list and revoke any unexpected key before trying again.",
          ),
      );
      setUncertain(true);
      refresh(); // Do not automatically retry a credential-creation POST.
    } finally {
      locked.current = false;
      if (mounted.current) setBusy(false);
    }
  }
  async function revokeKey() {
    if (!revoke || locked.current || demoMode) return;
    locked.current = true;
    setBusy(true);
    setError("");
    try {
      await api<void>(path + "/" + revoke.id, { method: "DELETE" });
      if (!mounted.current) return;
      setRevoke(undefined);
      refresh();
    } catch (failure) {
      if (!mounted.current) return;
      if ((failure as { status?: number }).status === 404) {
        invalidateQueryPaths(["/customer-api/businesses?"]);
        refresh();
      }
      setError(
        failure instanceof Error ? uiText(failure.message) : uiText("Could not revoke the key."),
      );
    } finally {
      locked.current = false;
      if (mounted.current) setBusy(false);
    }
  }
  async function copy(value: string, label: string) {
    try {
      await navigator.clipboard.writeText(value);
      setCopyStatus(label + uiText(" copied. Store it securely on your backend."));
    } catch {
      setCopyStatus(uiText("Copy failed. Select the value and copy it manually."));
    }
  }

  return (
    <>
      <section className="panel api-keys-panel">
        <div className="panel-heading">
          <div>
            <h2>
              <KeyRound size={18} />
              {uiText("API credentials")}
            </h2>
            <p className="muted">
              {environment} {uiText("credentials for your backend integrations.")}
            </p>
          </div>
          <button
            className="button primary small"
            disabled={demoMode || keys.loading || !!keys.error}
            onClick={() => {
              setOpen(true);
              setError("");
            }}
          >
            <Plus size={16} />
            {uiText("Generate API credentials")}
          </button>
        </div>
        {keys.loading ? (
          <Loading rows={2} />
        ) : keys.error ? (
          <ErrorState message={keys.error} retry={refresh} />
        ) : !activeKeys?.length ? (
          <Empty
            icon={KeyRound}
            title={uiText("No API credentials yet")}
            description={uiText(
              "Generate your first key and configure where Fondeka should deliver signed webhooks.",
            )}
          />
        ) : (
          <>
            <div className="table-wrap desktop-table">
              <table>
                <thead>
                  <tr>
                    <th>{uiText("Integration")}</th>
                    <th>{uiText("Key prefix")}</th>
                    <th>{uiText("Environment")}</th>
                    <th>{uiText("Webhook destination")}</th>
                    <th>{uiText("Created")}</th>
                    <th>{uiText("Status")}</th>
                    <th>{uiText("Actions")}</th>
                  </tr>
                </thead>
                <tbody>
                  {activeKeys.map((key) => (
                    <tr key={key.id}>
                      <td className="table-name">{key.name}</td>
                      <td>
                        <code className="key-prefix">{key.keyPrefix}••••</code>
                      </td>
                      <td>
                        <span className={`environment-tag ${environment.toLowerCase()}`}>
                          {environment}
                        </span>
                      </td>
                      <td>
                        <span className="webhook-url">
                          <Webhook size={14} />
                          {key.webhookUrl || uiText("Not configured")}
                        </span>
                      </td>
                      <td>{date(key.createdAt)}</td>
                      <td>
                        <Badge value={key.enabled ? "ENABLED" : "REVOKED"} />
                      </td>
                      <td>
                        <div className="credential-actions">
                          <button
                            className="button secondary small"
                            disabled={busy}
                            onClick={() => editWebhook(key)}
                            aria-label={uiText("Edit webhook for ") + key.name}
                          >
                            <Pencil size={14} />
                            {uiText("Edit webhook")}
                          </button>
                          <button
                            className="button ghost small"
                            disabled={demoMode || busy}
                            onClick={() => {
                              setRevoke(key);
                              setError("");
                            }}
                            aria-label={uiText("Revoke ") + key.name}
                          >
                            <Trash2 size={14} />
                            {uiText("Revoke")}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="mobile-credentials-list">
              {activeKeys.map((key) => (
                <article className="mobile-credential" key={key.id}>
                  <div className="mobile-credential-heading">
                    <span className="mobile-record-icon">
                      <KeyRound size={20} />
                    </span>
                    <strong>{key.name}</strong>
                    <Badge value={key.enabled ? "ENABLED" : "REVOKED"} />
                  </div>
                  <code className="key-prefix">{key.keyPrefix}••••</code>
                  <span className={`environment-tag ${environment.toLowerCase()}`}>
                    {environment}
                  </span>
                  <details>
                    <summary>{uiText("Integration details")}</summary>
                    <dl className="detail-list">
                      <div>
                        <dt>{uiText("Created")}</dt>
                        <dd>{date(key.createdAt)}</dd>
                      </div>
                      <div>
                        <dt>{uiText("Webhook")}</dt>
                        <dd>{key.webhookUrl || uiText("Not configured")}</dd>
                      </div>
                    </dl>
                    <div className="credential-actions">
                      <button
                        className="button secondary small"
                        disabled={busy}
                        onClick={() => editWebhook(key)}
                        aria-label={uiText("Edit webhook for ") + key.name}
                      >
                        <Pencil size={16} />
                        {uiText("Edit webhook")}
                      </button>
                      <button
                        className="button danger small"
                        disabled={demoMode || busy}
                        onClick={() => {
                          setRevoke(key);
                          setError("");
                        }}
                        aria-label={uiText("Revoke ") + key.name}
                      >
                        <Trash2 size={16} />
                        {uiText("Revoke key")}
                      </button>
                    </div>
                  </details>
                </article>
              ))}
            </div>
          </>
        )}
        {notice && (
          <p className="info-box" role="status">
            {notice}
          </p>
        )}
        <div className="panel-note">
          <KeyRound size={14} />
          {demoMode
            ? uiText(
                "Credential generation and revocation require a real authenticated customer account.",
              )
            : uiText(
                "Only you receive the full credentials, once at generation. Store them securely on your backend.",
              )}
        </div>
      </section>
      {editing && (
        <CredentialWebhookEditor
          credential={editing}
          businessId={businessId}
          environment={environment}
          onClose={() => setEditing(undefined)}
          onSaved={() => {
            setEditing(undefined);
            setNotice(uiText("Webhook URL updated."));
          }}
          refresh={refresh}
        />
      )}
      {open && (
        <Modal
          title={
            (issued ? uiText("Save your credentials") : uiText("Generate credentials")) +
            " · " +
            environment
          }
          description={
            issued
              ? uiText("This is the only time both secrets will be displayed.")
              : uiText("Choose an integration name and a public HTTPS webhook URL.")
          }
          onClose={() => (issued || uncertain ? close() : closeRequest.current?.())}
          busy={busy}
          hideHeader={!issued && !uncertain}
          className={!issued && !uncertain ? "guided-dialog" : undefined}
        >
          {issued ? (
            <div>
              <p className="panel-note">
                <ShieldAlert size={18} />
                {uiText(
                  "Never embed these secrets in browser or mobile code, or share them in support messages.",
                )}
              </p>
              <label>
                {uiText("API key")}
                <div className="copy-field">
                  <input
                    style={{ flex: 1, minWidth: 0 }}
                    value={issued.apiKey}
                    readOnly
                    autoComplete="off"
                    spellCheck={false}
                    aria-label={uiText("New API key")}
                  />
                  <button
                    className="icon-button"
                    aria-label={uiText("Copy API key")}
                    onClick={() => void copy(issued.apiKey, uiText("API key"))}
                  >
                    <Copy size={16} />
                  </button>
                </div>
              </label>
              <label>
                {uiText("Webhook signing secret")}
                <div className="copy-field">
                  <input
                    style={{ flex: 1, minWidth: 0 }}
                    value={issued.webhookSecret}
                    readOnly
                    autoComplete="off"
                    spellCheck={false}
                    aria-label={uiText("New webhook signing secret")}
                  />
                  <button
                    className="icon-button"
                    aria-label={uiText("Copy webhook signing secret")}
                    onClick={() => void copy(issued.webhookSecret, uiText("Webhook secret"))}
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
                  {uiText("I have saved both secrets")}
                </button>
              </div>
            </div>
          ) : uncertain ? (
            <div className="form-stack">
              <p role="alert" className="form-error">
                {error}
              </p>
              <button
                className="button primary"
                onClick={() => {
                  refresh();
                  close();
                }}
              >
                {uiText("Review API credentials")}
              </button>
            </div>
          ) : (
            <CredentialCreateFlow
              environment={environment}
              onClose={close}
              onCreate={create}
              closeRequest={closeRequest}
            />
          )}
        </Modal>
      )}
      {revoke && (
        <Modal
          title={uiText("Revoke ") + revoke.name + "?"}
          onClose={close}
          busy={busy}
          description={uiText(
            "This key will stop accepting new API requests. Accepted payments, their webhooks and transaction history remain intact.",
          )}
        >
          <p className="panel-note">
            {environment}{" "}
            {uiText(
              "credential · Retain its last webhook destination and signing secret until accepted requests and pending deliveries are settled.",
            )}
          </p>
          {error && (
            <p className="form-error" role="alert">
              {error}
            </p>
          )}
          <div className="modal-actions">
            <button className="button secondary" disabled={busy} onClick={close}>
              {uiText("Cancel")}
            </button>
            <button className="button primary" disabled={busy} onClick={() => void revokeKey()}>
              {busy ? uiText("Revoking…") : uiText("Revoke API key")}
            </button>
          </div>
        </Modal>
      )}
    </>
  );
}
