"use client";
import { useRef } from "react";
import { useI18n } from "@/lib/i18n";
import { request } from "@/lib/data";
import { invalidateQueryPaths } from "@/lib/query-cache";
import type { Customer } from "@/lib/types";
import { GuidedFlow, FlowField, FlowReview, useFlowDraft, type GuidedStep } from "./guided-flow";
import { Modal } from "./ui";
import { useWorkspace } from "./workspace-provider";
type Identity = { name: string; phone: string; email: string; note: string };
const emailValid = (email: string) =>
  !email.trim() || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
export function CustomerCreateFlow({
  storeId,
  onClose,
  onSaved,
}: {
  storeId: number;
  onClose: () => void;
  onSaved: (customer: Customer) => void;
}) {
  const { t } = useI18n();
  const closeRequest = useRef<(() => void) | null>(null);
  // Contact information stays in component memory, including when opened from POS.
  const draft = useFlowDraft<Identity>("customer:" + storeId, {
    name: "",
    phone: "",
    email: "",
    note: "",
  });
  const steps: GuidedStep<Identity>[] = [
    {
      id: "identity",
      title: t("Customer identity", "Identité du client"),
      helper: t(
        "Enter at least a name, phone number or email address.",
        "Saisissez au moins un nom, un téléphone ou une adresse e-mail.",
      ),
      validate: (v) => ({
        name:
          !v.name.trim() && !v.phone.trim() && !v.email.trim()
            ? t(
                "Enter at least one identity field.",
                "Renseignez au moins une information d’identité.",
              )
            : undefined,
        email: !emailValid(v.email)
          ? t("Enter a valid email address.", "Saisissez une adresse e-mail valide.")
          : undefined,
      }),
      render: ({ value, set }) => (
        <>
          <FlowField name="name" label={t("Name", "Nom")}>
            <input
              maxLength={180}
              autoComplete="name"
              value={value.name}
              onChange={(e) => set({ name: e.target.value })}
            />
          </FlowField>
          <FlowField name="phone" label={t("Phone", "Téléphone")}>
            <input
              type="tel"
              maxLength={64}
              autoComplete="tel"
              value={value.phone}
              onChange={(e) => set({ phone: e.target.value })}
            />
          </FlowField>
          <FlowField name="email" label={t("Email", "E-mail")}>
            <input
              type="email"
              maxLength={180}
              autoComplete="email"
              value={value.email}
              onChange={(e) => set({ email: e.target.value })}
            />
          </FlowField>
        </>
      ),
    },
    {
      id: "note",
      title: t("Note and review", "Note et vérification"),
      helper: t(
        "Add a useful note, then check the customer’s details.",
        "Ajoutez une note utile, puis vérifiez les coordonnées du client.",
      ),
      render: ({ value, set, go }) => (
        <>
          <FlowField name="note" label={t("Note (optional)", "Note (facultatif)")}>
            <textarea value={value.note} onChange={(e) => set({ note: e.target.value })} />
          </FlowField>
          <FlowReview title={t("Customer", "Client")} edit={() => go("identity")}>
            {[value.name, value.phone, value.email].filter(Boolean).map((line, i) => (
              <p key={i}>{line}</p>
            ))}
          </FlowReview>
        </>
      ),
    },
  ];
  return (
    <Modal
      title={t("Add customer", "Ajouter un client")}
      onClose={() => closeRequest.current?.()}
      hideHeader
      className="guided-dialog"
    >
      <GuidedFlow
        compact
        closeRequest={closeRequest}
        id="customer"
        title={t("Add customer", "Ajouter un client")}
        steps={steps}
        value={draft.value}
        set={draft.set}
        dirty={draft.dirty}
        onDiscard={draft.clear}
        onClose={onClose}
        finalLabel={t("Add customer", "Ajouter le client")}
        onFinish={async () => {
          const saved = await request<Customer>(
            `/customer-api/commerce/stores/${storeId}/customers`,
            {
              method: "POST",
              body: JSON.stringify(
                Object.fromEntries(
                  Object.entries(draft.value).map(([key, value]) => [key, value.trim()]),
                ),
              ),
            },
          );
          draft.clear();
          invalidateQueryPaths([`/customer-api/commerce/stores/${storeId}/customers`]);
          onSaved(saved);
        }}
      />
    </Modal>
  );
}
type Invitation = { email: string; permissions: string[] };
export function StaffCreateFlow({ storeId, onClose }: { storeId: number; onClose: () => void }) {
  const { t } = useI18n();
  const closeRequest = useRef<(() => void) | null>(null);
  const { notify } = useWorkspace();
  const draft = useFlowDraft<Invitation>("staff:" + storeId, { email: "", permissions: [] });
  const options = [
    [
      "pos",
      "POS",
      "POS",
      "Make sales in the point of sale.",
      "Effectuer des ventes au point de vente.",
    ],
    [
      "reports",
      "Reports",
      "Rapports",
      "View store totals and reports.",
      "Consulter les totaux et rapports de la boutique.",
    ],
    [
      "products",
      "Products",
      "Produits",
      "Manage the product catalog.",
      "Gérer le catalogue de produits.",
    ],
    ["sales", "Sales", "Ventes", "View sales and receipts.", "Consulter les ventes et reçus."],
    [
      "customers",
      "Customers",
      "Clients",
      "Manage customer details.",
      "Gérer les coordonnées des clients.",
    ],
  ];
  const steps: GuidedStep<Invitation>[] = [
    {
      id: "identity",
      title: t("Staff identity", "Identité du membre"),
      helper: t(
        "Enter the email address used for their Fondeka account.",
        "Saisissez l’e-mail utilisé pour son compte Fondeka.",
      ),
      validate: (v) =>
        !v.email.trim() || !emailValid(v.email)
          ? { email: t("Enter a valid email address.", "Saisissez une adresse e-mail valide.") }
          : {},
      render: ({ value, set }) => (
        <FlowField name="email" label={t("Staff email", "E-mail du membre")}>
          <input
            type="email"
            maxLength={180}
            value={value.email}
            onChange={(e) => set({ email: e.target.value })}
          />
        </FlowField>
      ),
    },
    {
      id: "permissions",
      title: t("Choose permissions", "Choisissez les autorisations"),
      helper: t(
        "Give access only to the tools this person needs.",
        "Donnez accès uniquement aux outils nécessaires à cette personne.",
      ),
      render: ({ value, set }) => (
        <div className="flow-choices">
          {options.map(([key, en, fr, helpEn, helpFr]) => (
            <label className="flow-choice permission-choice" key={key}>
              <input
                type="checkbox"
                checked={value.permissions.includes(key)}
                onChange={(e) =>
                  set({
                    permissions: e.target.checked
                      ? [...value.permissions, key]
                      : value.permissions.filter((p) => p !== key),
                  })
                }
              />
              <span>
                <strong>{t(en, fr)}</strong>
                <small>{t(helpEn, helpFr)}</small>
              </span>
            </label>
          ))}
        </div>
      ),
    },
    {
      id: "review",
      title: t("Review invitation", "Vérifiez l’invitation"),
      render: ({ value, go }) => (
        <>
          <FlowReview title={t("Staff member", "Membre de l’équipe")} edit={() => go("identity")}>
            <p>{value.email}</p>
          </FlowReview>
          <FlowReview title={t("Permissions", "Autorisations")} edit={() => go("permissions")}>
            <p>
              {options
                .filter(([key]) => value.permissions.includes(key))
                .map(([, en, fr]) => t(en, fr))
                .join(" · ") || t("No permissions selected", "Aucune autorisation sélectionnée")}
            </p>
          </FlowReview>
        </>
      ),
    },
  ];
  return (
    <Modal
      title={t("Invite staff member", "Inviter un membre")}
      onClose={() => closeRequest.current?.()}
      hideHeader
      className="guided-dialog"
    >
      <GuidedFlow
        compact
        closeRequest={closeRequest}
        id="staff"
        title={t("Invite staff member", "Inviter un membre")}
        steps={steps}
        value={draft.value}
        set={draft.set}
        dirty={draft.dirty}
        onDiscard={draft.clear}
        onClose={onClose}
        finalLabel={t("Invite staff member", "Inviter le membre")}
        onFinish={async () => {
          await request(`/customer-api/commerce/stores/${storeId}/staff`, {
            method: "POST",
            body: JSON.stringify({
              email: draft.value.email.trim(),
              permissions: draft.value.permissions,
            }),
          });
          draft.clear();
          invalidateQueryPaths([`/customer-api/commerce/stores/${storeId}/staff`]);
          notify(t("Team updated", "Équipe mise à jour"));
          onClose();
        }}
      />
    </Modal>
  );
}
