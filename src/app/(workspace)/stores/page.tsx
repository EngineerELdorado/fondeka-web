"use client";
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
export default function Stores() {
  const { values, update } = useUrlState();
  const forPos = values.get("mode") === "pos";
  if (values.get("new") === "1")
    return (
      <StoreForm forPos={forPos} onClose={() => update({ new: null, step: null, flow: null })} />
    );
  return forPos ? <PosStoreChooser /> : <StoreList />;
}
function StoreList() {
  const { t } = useI18n();
  const { values, update, page } = useUrlState();
  const search = values.get("search") || "";
  const { refresh } = useWorkspace();
  const stores = useQuery<Page<Store>>(`/customer-api/commerce/stores?page=${page}&size=12`);
  const list = stores.data?.content.filter((s) =>
    s.name.toLowerCase().includes(search.toLowerCase()),
  );
  return (
    <>
      <PageHeading
        icon={StoreIcon}
        title={t("Online Stores", "Boutiques en ligne")}
        description={t(
          "Create an online store, share its link and sell products, services and trainings.",
          "Créez une boutique en ligne, partagez son lien et vendez des produits, des services et des formations.",
        )}
      >
        <button className="button secondary" onClick={refresh}>
          <RefreshCw size={16} />
          {t("Refresh", "Actualiser")}
        </button>
        <button className="button primary" onClick={() => update({ new: 1 })}>
          <Plus size={17} />
          {t("Create store", "Créer une boutique")}
        </button>
      </PageHeading>
      <div className="list-toolbar">
        <strong>
          {t("All stores", "Toutes les boutiques")}{" "}
          <span className="count-pill">{stores.data?.totalElements ?? "—"}</span>
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
      ) : stores.error ? (
        <ErrorState message={stores.error} retry={refresh} />
      ) : !list?.length ? (
        <Empty
          icon={StoreIcon}
          title={t("Your online stores", "Vos boutiques en ligne")}
          description={t(
            "Create your first store and bring your products together, or try a different search.",
            "Créez votre première boutique et rassemblez vos produits, ou essayez une autre recherche.",
          )}
        >
          <button className="button primary" onClick={() => update({ new: 1 })}>
            {t("Create store", "Créer une boutique")}
          </button>
        </Empty>
      ) : (
        <div className="stores-grid">
          {list.map((s, i) => (
            <Link className="store-card" key={s.id} href={`/stores/${s.id}`}>
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
          total={stores.data.totalElements}
          onChange={(p) => update({ page: p })}
        />
      )}{" "}
    </>
  );
}
