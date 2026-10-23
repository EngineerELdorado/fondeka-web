"use client";

import { useState } from "react";
import { Code2, FlaskConical, RotateCcw, Settings2, ShieldCheck } from "lucide-react";
import { Modal, PageHeading } from "@/components/ui";
import { useWorkspace } from "@/components/workspace-provider";
import { authConfigured, demoMode } from "@/lib/auth";
import { resetDemo } from "@/lib/demo";

export default function Settings() {
  const [confirming, setConfirming] = useState(false);
  const { refresh, notify } = useWorkspace();
  return (
    <>
      <PageHeading
        icon={Settings2}
        mobileTitle="Settings"
        eyebrow="WORKSPACE"
        title="Make yourself at home."
        description="A few details about your Fondeka Business workspace."
      />
      <div className="settings-grid">
        <section className="panel settings-panel">
          <span className="tool-icon mint">
            <ShieldCheck size={24} />
          </span>
          <h2>One account. Your business tools.</h2>
          <p>
            Fondeka Business uses your existing customer account, fiat wallets, and permissions.
            Each business has its own API credentials and history. Wallets belong to your account.
          </p>
          <dl className="detail-list">
            <div>
              <dt>Environment</dt>
              <dd>{demoMode ? "Demo workspace" : "Live workspace"}</dd>
            </div>
            <div>
              <dt>Authentication</dt>
              <dd>{authConfigured ? "Customer Cognito" : "Not configured"}</dd>
            </div>
            <div>
              <dt>API key management</dt>
              <dd>Managed by Fondeka</dd>
            </div>
          </dl>
        </section>
        <section className="panel settings-panel">
          <span className={`tool-icon ${demoMode ? "peach" : "lilac"}`}>
            {demoMode ? <FlaskConical size={24} /> : <Code2 size={24} />}
          </span>
          <h2>{demoMode ? "A little room to explore." : "Your workspace is connected."}</h2>
          <p>
            {demoMode
              ? "All stores, requests, products, and sales in this workspace use fictional data. Changes stay in this browser. Reset the demo to start fresh."
              : "Your workspace reads and updates your Fondeka account through the existing customer APIs. API keys and webhook signing secrets stay on your backend."}
          </p>
          {demoMode && (
            <button className="button secondary" onClick={() => setConfirming(true)}>
              <RotateCcw size={16} />
              Reset demo data
            </button>
          )}
        </section>
      </div>
      {confirming && (
        <Modal
          title="Start fresh?"
          description="This resets fictional stores, products, payment requests, and sales saved in this browser."
          onClose={() => setConfirming(false)}
        >
          <div className="modal-actions">
            <button className="button secondary" onClick={() => setConfirming(false)}>
              Keep exploring
            </button>
            <button
              className="button primary"
              onClick={() => {
                resetDemo();
                refresh();
                notify("Demo workspace reset.");
                setConfirming(false);
              }}
            >
              Reset demo
            </button>
          </div>
        </Modal>
      )}
    </>
  );
}
