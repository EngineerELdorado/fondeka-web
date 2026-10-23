"use client";
import { useRef, useState, type FormEvent } from "react";
import { useI18n } from "@/lib/i18n";
import { useUrlState } from "@/lib/use-url-state";
import { useQuery } from "@/lib/use-query";
import { request } from "@/lib/data";
import { invalidateQueryPaths } from "@/lib/query-cache";
import { staffPermissions } from "@/lib/commerce";
import { label, date } from "@/lib/format";
import type { Customer, Staff, Page } from "@/lib/types";
import { useWorkspace } from "./workspace-provider";
import { Loading, ErrorState, Empty, Modal, Pagination, SubmitButton } from "./ui";
import { SalesPanel } from "./store-sales";
import { CustomerCreateFlow, StaffCreateFlow } from "./people-create-flow";
type CustomerFormProps = {
  storeId: number;
  customer?: Customer;
  onClose: () => void;
  onSaved: (customer: Customer) => void;
};
export function CustomerForm(props: CustomerFormProps) {
  return props.customer ? <CustomerEditor {...props} /> : <CustomerCreateFlow {...props} />;
}
function CustomerEditor({
  storeId,
  customer,
  onClose,
  onSaved,
}: {
  storeId: number;
  customer?: Customer;
  onClose: () => void;
  onSaved: (c: Customer) => void;
}) {
  const { t } = useI18n();
  const [busy, setBusy] = useState(false);
  const lock = useRef(false);
  const [error, setError] = useState("");
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (lock.current) return;
    const f = new FormData(e.currentTarget);
    const body = Object.fromEntries(
      ["name", "email", "phone", "note"].map((k) => [k, String(f.get(k) || "").trim()]),
    );
    if (!body.name && !body.email && !body.phone) {
      setError(
        t(
          "Enter a name, email or phone number.",
          "Saisissez un nom, une adresse e-mail ou un numéro de téléphone.",
        ),
      );
      return;
    }
    lock.current = true;
    setBusy(true);
    setError("");
    try {
      const c = await request<Customer>(
        `/customer-api/commerce/stores/${storeId}/customers${customer ? `/${customer.id}` : ""}`,
        { method: customer ? "PATCH" : "POST", body: JSON.stringify(body) },
      );
      invalidateQueryPaths(["/customer-api/commerce/stores/" + storeId + "/customers"]);
      onSaved(c);
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : t("Unable to save customer.", "Impossible d’enregistrer le client."),
      );
    } finally {
      setBusy(false);
      lock.current = false;
    }
  }
  return (
    <Modal
      title={t(
        customer ? "Edit customer" : "Create customer",
        customer ? "Modifier le client" : "Créer un client",
      )}
      onClose={onClose}
      busy={busy}
    >
      <form className="form-stack" onSubmit={submit}>
        {[
          ["name", t("Name", "Nom"), "text", 180],
          ["email", t("Email", "E-mail"), "email", 180],
          ["phone", t("Phone", "Téléphone"), "tel", 64],
        ].map(([name, title, type, max]) => (
          <label key={name}>
            {title}
            <input
              name={String(name)}
              type={String(type)}
              maxLength={Number(max)}
              defaultValue={customer?.[name as "name" | "email" | "phone"]}
            />
          </label>
        ))}
        <label>
          {t("Notes", "Notes")}
          <textarea name="note" defaultValue={customer?.note} />
        </label>
        {error && (
          <p role="alert" className="form-error">
            {error}
          </p>
        )}
        <div className="modal-actions">
          <button type="button" className="button secondary" disabled={busy} onClick={onClose}>
            {t("Cancel", "Annuler")}
          </button>
          <SubmitButton busy={busy}>{t("Save", "Enregistrer")}</SubmitButton>
        </div>
      </form>
    </Modal>
  );
}
export function CustomersPanel({ storeId }: { storeId: number }) {
  const { t } = useI18n();
  const { values, update, page } = useUrlState();
  const { refresh } = useWorkspace();
  const customers = useQuery<Page<Customer>>(
    `/customer-api/commerce/stores/${storeId}/customers?page=${page}&size=20`,
  );
  const selectedId = values.get("customer");
  const selected = useQuery<Customer>(
    selectedId && /^\d+$/.test(selectedId)
      ? `/customer-api/commerce/stores/${storeId}/customers/${selectedId}`
      : null,
  );
  const creating = values.get("newCustomer") === "1";
  const setCreating = (open: boolean) =>
    update({ newCustomer: open ? 1 : null, flow: null, step: null });
  const [editing, setEditing] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function remove() {
    if (busy || !selected.data) return;
    setBusy(true);
    try {
      await request(`/customer-api/commerce/stores/${storeId}/customers/${selected.data.id}`, {
        method: "DELETE",
      });
      setDeleting(false);
      update({ customer: null });
      invalidateQueryPaths(["/customer-api/commerce/stores/" + storeId + "/customers"]);
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : t("Unable to delete customer.", "Impossible de supprimer le client."),
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <div className="panel-heading">
        <h2>{t("Customers", "Clients")}</h2>
        <button className="button primary small" onClick={() => setCreating(true)}>
          {t("Create customer", "Créer un client")}
        </button>
      </div>
      {customers.loading ? (
        <Loading />
      ) : customers.error ? (
        <ErrorState message={customers.error} retry={refresh} />
      ) : !customers.data?.content.length ? (
        <Empty
          title={t("Your customers", "Vos clients")}
          description={t(
            "Create a customer to keep their details and related sales together.",
            "Créez un client pour retrouver ses coordonnées et ses ventes.",
          )}
        >
          <button className="button primary" onClick={() => setCreating(true)}>
            {t("Create customer", "Créer un client")}
          </button>
        </Empty>
      ) : (
        customers.data.content.map((c) => (
          <button className="detail-row" key={c.id} onClick={() => update({ customer: c.id })}>
            <span>
              <strong>{c.name || c.email || c.phone}</strong>
              <small>{[c.email, c.phone].filter(Boolean).join(" · ")}</small>
            </span>
            <span>→</span>
          </button>
        ))
      )}
      {customers.data && (
        <Pagination
          page={page}
          pages={customers.data.totalPages}
          total={customers.data.totalElements}
          onChange={(v) => update({ page: v })}
        />
      )}
      {(creating || (editing && selected.data)) && (
        <CustomerForm
          storeId={storeId}
          customer={editing ? selected.data : undefined}
          onClose={() => {
            setCreating(false);
            setEditing(false);
          }}
          onSaved={(c) => {
            setCreating(false);
            setEditing(false);
            update({ customer: c.id, newCustomer: null, flow: null, step: null });
          }}
        />
      )}
      {selectedId && !editing && (
        <Modal
          title={selected.data?.name || t("Customer", "Client")}
          onClose={() => {
            update({ customer: null });
            setDeleting(false);
            setError("");
          }}
          busy={busy}
          className="owner-detail-dialog"
        >
          {selected.loading ? (
            <Loading />
          ) : selected.error ? (
            <ErrorState message={selected.error} retry={refresh} />
          ) : (
            selected.data && (
              <>
                <dl className="detail-list">
                  {[
                    [t("Email", "E-mail"), selected.data.email],
                    [t("Phone", "Téléphone"), selected.data.phone],
                    [t("Notes", "Notes"), selected.data.note],
                  ].map(([k, v]) => (
                    <div key={k}>
                      <dt>{k}</dt>
                      <dd>{v || "—"}</dd>
                    </div>
                  ))}
                </dl>
                <div className="parity-actions">
                  <button className="button secondary" onClick={() => setEditing(true)}>
                    {t("Edit", "Modifier")}
                  </button>
                  <button className="text-button danger-text" onClick={() => setDeleting(true)}>
                    {t("Delete", "Supprimer")}
                  </button>
                </div>
                {deleting && (
                  <div className="confirmation-box">
                    <p>
                      {t(
                        "Delete this customer from your store?",
                        "Supprimer ce client de votre boutique ?",
                      )}
                    </p>
                    <button className="button danger" disabled={busy} onClick={() => void remove()}>
                      {t("Confirm deletion", "Confirmer la suppression")}
                    </button>
                  </div>
                )}
                {error && (
                  <p role="alert" className="form-error">
                    {error}
                  </p>
                )}
                <SalesPanel storeId={storeId} customerId={selected.data.id} />
              </>
            )
          )}
        </Modal>
      )}
    </>
  );
}
export function StaffPanel({ storeId }: { storeId: number }) {
  const { t } = useI18n();
  const { page, update, values } = useUrlState();
  const { refresh } = useWorkspace();
  const list = useQuery<Page<Staff>>(
    `/customer-api/commerce/stores/${storeId}/staff?page=${page}&size=20`,
  );
  const [selected, setSelected] = useState<Staff>();
  const adding = values.get("invite") === "1";
  const setAdding = (open: boolean) => update({ invite: open ? 1 : null, flow: null, step: null });
  const [permissions, setPermissions] = useState<string[]>([]);
  const [deleting, setDeleting] = useState(false);
  const [busy, setBusy] = useState(false);
  const lock = useRef(false);
  const [error, setError] = useState("");
  async function save(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    setError("");
    const email = String(new FormData(e.currentTarget).get("email") || "").trim();
    try {
      await request(
        `/customer-api/commerce/stores/${storeId}/staff${selected ? `/${selected.id}` : ""}`,
        {
          method: deleting ? "DELETE" : selected ? "PATCH" : "POST",
          ...(deleting ? {} : { body: JSON.stringify({ email, permissions }) }),
        },
      );
      invalidateQueryPaths(["/customer-api/commerce/stores/" + storeId + "/staff"]);
      setAdding(false);
      setSelected(undefined);
      setDeleting(false);
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : t("Unable to update team.", "Impossible de modifier l’équipe."),
      );
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }
  return (
    <>
      <div className="panel-heading">
        <h2>{t("Team", "Équipe")}</h2>
        <button
          className="button primary small"
          onClick={() => {
            setAdding(true);
            setPermissions([]);
            setError("");
          }}
        >
          {t("Add staff", "Ajouter un membre")}
        </button>
      </div>
      {list.loading ? (
        <Loading />
      ) : list.error ? (
        <ErrorState message={list.error} retry={refresh} />
      ) : !list.data?.content.length ? (
        <Empty
          title={t("Build your team", "Constituez votre équipe")}
          description={t(
            "Add staff with only the permissions they need.",
            "Ajoutez des membres avec les autorisations nécessaires.",
          )}
        />
      ) : (
        list.data.content.map((member) => (
          <button
            key={member.id}
            className="detail-row"
            onClick={() => {
              setSelected(member);
              setPermissions(member.permissions.map((p) => p.toUpperCase()));
              setError("");
            }}
          >
            <span>
              <strong>{member.name || member.email}</strong>
              <small>{member.permissions.map(label).join(" · ")}</small>
            </span>
            <small>{date(member.createdAt)}</small>
          </button>
        ))
      )}
      {list.data && (
        <Pagination
          page={page}
          pages={list.data.totalPages}
          total={list.data.totalElements}
          onChange={(v) => update({ page: v })}
        />
      )}
      {adding && <StaffCreateFlow storeId={storeId} onClose={() => setAdding(false)} />}
      {selected && (
        <Modal
          title={t(
            selected ? "Edit staff permissions" : "Add staff",
            selected ? "Modifier les autorisations" : "Ajouter un membre",
          )}
          onClose={() => {
            setAdding(false);
            setSelected(undefined);
            setDeleting(false);
          }}
          busy={busy}
        >
          <form className="form-stack" onSubmit={save}>
            <label>
              {t("Staff email", "E-mail du membre")}
              <input
                name="email"
                type="email"
                required
                defaultValue={selected?.email}
                readOnly={!!selected}
              />
            </label>
            <fieldset>
              <legend>{t("Permissions", "Autorisations")}</legend>
              {staffPermissions.map((p) => (
                <label key={p} className="checkbox-label">
                  <input
                    type="checkbox"
                    checked={permissions.includes(p)}
                    onChange={(e) =>
                      setPermissions((v) =>
                        e.target.checked ? [...v, p] : v.filter((x) => x !== p),
                      )
                    }
                  />
                  {label(p)}
                </label>
              ))}
            </fieldset>
            {deleting && (
              <p className="confirmation-box">
                {t(
                  "Remove this team member? Their store access will end.",
                  "Retirer ce membre ? Il n’aura plus accès à la boutique.",
                )}
              </p>
            )}
            {error && (
              <p className="form-error" role="alert">
                {error}
              </p>
            )}
            <div className="modal-actions">
              {selected && !deleting && (
                <button type="button" className="button danger" onClick={() => setDeleting(true)}>
                  {t("Remove", "Retirer")}
                </button>
              )}
              <SubmitButton busy={busy}>
                {deleting ? t("Confirm removal", "Confirmer le retrait") : t("Save", "Enregistrer")}
              </SubmitButton>
            </div>
          </form>
        </Modal>
      )}
    </>
  );
}
