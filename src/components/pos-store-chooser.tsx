"use client";
import Link from "next/link";
import { ArrowRight, Plus, RefreshCw, Store as StoreIcon } from "lucide-react";
import { canUseStore } from "@/lib/commerce";
import { useI18n } from "@/lib/i18n";
import { useUrlState } from "@/lib/use-url-state";
import { usePosStoresPage } from "./pos-stores-provider";
import { Empty, ErrorState, Loading, PageHeading, Pagination } from "./ui";

export function PosStoreChooser() {
  const { t } = useI18n();
  const { page, update } = useUrlState();
  const stores = usePosStoresPage(page);
  const list = stores.data?.content.filter((store) => canUseStore(store, "POS"));
  const create = () => update({ new: 1, page: null, state: null });
  const error =
    stores.error?.message === "Unable to load your stores. Please try again."
      ? t(
          "Unable to load your stores. Please try again.",
          "Impossible de charger vos boutiques. Veuillez réessayer.",
        )
      : stores.error?.message;
  return (
    <div className="pos-chooser">
      <PageHeading
        title={t("Select a store", "Sélectionner une boutique")}
        description={t(
          "Choose the store you want to manage with POS.",
          "Choisissez la boutique à gérer avec le POS.",
        )}
      >
        <button className="button secondary" onClick={stores.refresh} disabled={stores.loading}>
          <RefreshCw size={16} />
          {t("Refresh", "Actualiser")}
        </button>
        <button className="button secondary" onClick={create}>
          <Plus size={16} />
          {t("Create a store", "Créer une boutique")}
        </button>
      </PageHeading>
      {error && <ErrorState message={error} retry={stores.refresh} />}
      {!stores.data && !error ? (
        <Loading rows={3} />
      ) : stores.data?.totalElements === 0 ? (
        <Empty
          title={t("Your counter is almost ready", "Votre caisse est presque prête")}
          description={t(
            "Create a store to start using POS.",
            "Créez une boutique pour commencer à utiliser le POS.",
          )}
        >
          <button className="button primary" onClick={create}>
            {t("Create a store", "Créer une boutique")}
          </button>
        </Empty>
      ) : (
        stores.data && (
          <section
            className="panel pos-chooser-list"
            aria-label={t("Stores", "Boutiques")}
            aria-busy={stores.loading}
          >
            {list?.map((store) => (
              <Link className="pos-chooser-row" href={`/stores/${store.id}/pos`} key={store.id}>
                <span className="pos-chooser-icon">
                  <StoreIcon size={22} />
                </span>
                <span>
                  <strong>{store.name}</strong>
                  <small>{store.defaultCurrency}</small>
                </span>
                <ArrowRight size={19} aria-hidden="true" />
              </Link>
            ))}
            {!list?.length && (
              <p className="panel-note">
                {t(
                  "No POS access on this page. Choose another page or ask the store owner for permission.",
                  "Aucun accès POS sur cette page. Changez de page ou demandez l’autorisation au propriétaire.",
                )}
              </p>
            )}
            <Pagination
              page={page}
              pages={stores.data.totalPages}
              total={stores.data.totalElements}
              onChange={(page) => update({ page, state: null })}
            />
          </section>
        )
      )}
    </div>
  );
}
