"use client";
import Link from "next/link";
import { Calculator } from "lucide-react";
import { useQuery } from "@/lib/use-query";
import { useI18n } from "@/lib/i18n";
import { canUseStore } from "@/lib/commerce";
import type { Store } from "@/lib/types";
import { PosRegister } from "./pos-register";
import { Empty, ErrorState, Loading, PageHeading } from "./ui";
import { useWorkspace } from "./workspace-provider";

export function StorePos({ id }: { id: string }) {
  const { t } = useI18n();
  const { refresh } = useWorkspace();
  const store = useQuery<Store>(`/customer-api/commerce/stores/${id}`);
  return (
    <>
      <PageHeading
        icon={Calculator}
        title="POS"
        description={store.data?.name || t("Your point of sale", "Votre point de vente")}
      >
        <Link href="/stores?mode=pos" className="button secondary">
          {t("Change store", "Changer de boutique")}
        </Link>
      </PageHeading>
      {!store.data && store.loading ? (
        <Loading />
      ) : store.error ? (
        <ErrorState message={store.error} retry={refresh} />
      ) : store.data && canUseStore(store.data, "POS") ? (
        <PosRegister key={store.data.id} store={store.data} />
      ) : (
        <Empty
          icon={Calculator}
          title={t("POS access required", "Accès POS requis")}
          description={t(
            "Ask the store owner for POS permission, or choose another store.",
            "Demandez l’autorisation POS au propriétaire ou choisissez une autre boutique.",
          )}
        />
      )}
    </>
  );
}
