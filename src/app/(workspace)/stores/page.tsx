"use client";
import { useEffect } from "react";
import Link from "next/link";
import { ArrowUpRight, Plus, Search, RefreshCw, Store as StoreIcon } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { useUrlState } from "@/lib/use-url-state";
import { useQuery } from "@/lib/use-query";
import { label } from "@/lib/format";
import type { Page, Store } from "@/lib/types";
import { useWorkspace } from "@/components/workspace-provider";
import { Badge, PageHeading, Loading, ErrorState, Empty, Pagination } from "@/components/ui";
import { StoreForm } from "@/components/store-form";
import { PosStoreChooser } from "@/components/pos-store-chooser";
import { StoreMedia } from "@/components/store-media";
import { BusinessToolsGate, useBusinessTools } from "@/components/business-tools-provider";
import { sharedStoresPath } from "@/lib/shared-stores";
import { hasToolAccess } from "@/lib/business-tools";
import { isStoreOwner, canUseStore, storeTabAllowed } from "@/lib/commerce";
export default function Stores() {
  const { t } = useI18n();
  const { values, update } = useUrlState();
  const { client, state } = useBusinessTools();
  useEffect(() => {
    void client.ensureAccess();
  }, [client]);
  const forPos = values.get("mode") === "pos";
  const access = state.accountAccess;
  const shared =
    values.get("view") === "shared" ||
    (!values.has("view") &&
      !!access &&
      !hasToolAccess(access, forPos ? "POS" : "ONLINE_STORES") &&
      access.commerceAccess?.hasSharedStores === true);
  const destination = `/stores?view=owned${forPos ? "&mode=pos" : ""}`;
  if (values.get("new") === "1")
    return (
      <BusinessToolsGate destination={`${destination}&new=1`}>
        <StoreForm forPos={forPos} onClose={() => update({ new: null, step: null, flow: null })} />
      </BusinessToolsGate>
    );
  return (
    <>
      <nav className="tabs" aria-label={t("Store access", "Accès aux boutiques")}>
        <button
          type="button"
          className={!shared ? "active" : ""}
          aria-pressed={!shared}
          onClick={() => update({ view: "owned", page: null, search: null, state: null })}
        >
          {t("My stores", "Mes boutiques")}
        </button>
        <button
          type="button"
          className={shared ? "active" : ""}
          aria-pressed={shared}
          onClick={() => update({ view: "shared", page: null, search: null, state: null })}
        >
          {t("Stores shared with me", "Boutiques partagées avec moi")}
        </button>
      </nav>
      {shared ? (
        <StoreList shared forPos={forPos} />
      ) : (
        <BusinessToolsGate destination={destination} passive>
          {forPos ? <PosStoreChooser /> : <StoreList />}
        </BusinessToolsGate>
      )}
    </>
  );
}
function StoreList({ shared = false, forPos = false }: { shared?: boolean; forPos?: boolean }) {
  const { t } = useI18n();
  const { values, update, page } = useUrlState();
  const search = values.get("search") || "";
  const { refresh } = useWorkspace();
  const stores = useQuery<Page<Store>>(
    shared
      ? sharedStoresPath(page, forPos ? "POS" : undefined)
      : `/customer-api/commerce/stores?page=${page}&size=12`,
  );
  const { refetch } = stores;
  useEffect(() => {
    if (!shared) return;
    const check = () => {
      if (document.visibilityState === "visible") void refetch();
    };
    check();
    window.addEventListener("focus", check);
    document.addEventListener("visibilitychange", check);
    return () => {
      window.removeEventListener("focus", check);
      document.removeEventListener("visibilitychange", check);
    };
  }, [shared, refetch, page, forPos]);
  const list = stores.data?.content.filter(
    (s) =>
      (shared ? s.accessType === "STAFF" : isStoreOwner(s)) &&
      s.name.toLowerCase().includes(search.toLowerCase()),
  );
  const create = () => update({ new: 1, view: "owned", page: null });
  return (
    <>
      <PageHeading
        icon={StoreIcon}
        title={
          shared
            ? t("Stores shared with me", "Boutiques partagées avec moi")
            : t("My stores", "Mes boutiques")
        }
        description={
          shared
            ? t(
                "Access the stores you have been assigned to. The store owner manages subscription access.",
                "Accédez aux boutiques auxquelles vous êtes affecté. Leur propriétaire gère l’accès à l’abonnement.",
              )
            : t(
                "Create an online store, share its link and sell products, services and trainings.",
                "Créez une boutique en ligne, partagez son lien et vendez des produits, des services et des formations.",
              )
        }
      >
        <button className="button secondary" onClick={refresh}>
          <RefreshCw size={16} />
          {t("Refresh", "Actualiser")}
        </button>
        <button className="button primary" onClick={create}>
          <Plus size={17} />
          {t("Create store", "Créer une boutique")}
        </button>
      </PageHeading>
      <div className="list-toolbar">
        <strong>
          {shared
            ? t("Assigned stores", "Boutiques attribuées")
            : t("Owned stores on this page", "Vos boutiques sur cette page")}{" "}
          {shared && <span className="count-pill">{stores.data?.totalElements ?? "—"}</span>}
        </strong>
        <label className="search-input">
          <Search size={16} />
          <input
            aria-label={t("Search this page", "Rechercher sur cette page")}
            value={search}
            onChange={(e) => update({ search: e.target.value }, true)}
          />
        </label>
      </div>
      {stores.loading ? (
        <Loading />
      ) : stores.error || stores.refreshError ? (
        <ErrorState message={stores.error || stores.refreshError!} retry={() => void refetch()} />
      ) : !list?.length ? (
        <Empty
          icon={StoreIcon}
          title={
            shared
              ? t("No shared stores found", "Aucune boutique partagée trouvée")
              : t("Your online stores", "Vos boutiques en ligne")
          }
          description={
            shared
              ? t(
                  "Ask a store owner to assign you the permissions you need, or try another page or search.",
                  "Demandez au propriétaire d’une boutique de vous attribuer les autorisations nécessaires, ou essayez une autre page ou recherche.",
                )
              : t(
                  "Create your first store and bring your products together, or try a different search.",
                  "Créez votre première boutique et rassemblez vos produits, ou essayez une autre recherche.",
                )
          }
        >
          <button className="button primary" onClick={create}>
            {t("Create store", "Créer une boutique")}
          </button>
        </Empty>
      ) : (
        <div className="stores-grid">
          {list.map((s, i) => (
            <Link
              className="store-card"
              key={s.id}
              href={
                forPos ||
                (shared &&
                  canUseStore(s, "POS") &&
                  !["products", "sales", "customers", "reports"].some((tab) =>
                    storeTabAllowed(s, tab),
                  ))
                  ? `/stores/${s.id}/pos`
                  : `/stores/${s.id}${shared ? `?tab=${["products", "sales", "customers", "reports"].find((tab) => storeTabAllowed(s, tab)) || "products"}` : ""}`
              }
            >
              <StoreMedia store={s} tone={i} />
              <div className="store-card-content">
                <div className="store-card-title">
                  <h2>{s.name}</h2>
                  <span className="store-card-open" aria-hidden="true">
                    <ArrowUpRight size={17} />
                  </span>
                </div>
                {s.description && <p>{s.description}</p>}
                <div className="store-card-footer">
                  <Badge value={s.status} />
                  <span>
                    {label(s.visibility)} · {label(s.accessType)}
                  </span>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
      {stores.data && (
        <Pagination
          page={page}
          pages={stores.data.totalPages}
          total={shared ? stores.data.totalElements : undefined}
          onChange={(p) => update({ page: p })}
        />
      )}{" "}
    </>
  );
}
