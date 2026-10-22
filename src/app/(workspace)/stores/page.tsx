"use client";

import Link from "next/link";
import { useState } from "react";
import { ArrowUpRight, Plus, Search, Store as StoreIcon } from "lucide-react";
import { Badge, Empty, ErrorState, Loading, PageHeading, Pagination } from "@/components/ui";
import { StoreForm } from "@/components/store-form";
import { useWorkspace } from "@/components/workspace-provider";
import { useQuery } from "@/lib/use-query";
import type { Page, Store } from "@/lib/types";

export default function Stores() {
  const [page, setPage] = useState(0);
  const [search, setSearch] = useState("");
  const [creating, setCreating] = useState(false);
  const { data, loading, error } = useQuery<Page<Store>>(
    `/customer-api/commerce/stores?page=${page}&size=9`,
  );
  const { refresh } = useWorkspace();
  const stores =
    data?.content.filter((store) => store.name.toLowerCase().includes(search.toLowerCase())) ?? [];
  return (
    <>
      <PageHeading
        eyebrow="COMMERCE"
        title="A place for every possibility."
        description="Your stores, products, and orders. Make yourself at home."
      >
        <button className="button primary" onClick={() => setCreating(true)}>
          <Plus size={17} />
          Create store
        </button>
      </PageHeading>
      <div className="list-toolbar">
        <div>
          <strong>All stores</strong>
          <span className="count-pill">{data?.totalElements ?? "—"}</span>
        </div>
        <label className="search-input">
          <Search size={17} />
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search this page…"
            aria-label="Search stores on this page"
          />
        </label>
      </div>
      {loading ? (
        <Loading />
      ) : error ? (
        <ErrorState message={error} retry={refresh} />
      ) : stores.length ? (
        <div className="stores-grid">
          {stores.map((store, i) => (
            <Link className="store-card" href={`/stores/${store.id}`} key={store.id}>
              <div className={`store-cover tone-${i % 3}`}>
                <div className="store-cover-line" />
                <span className="store-cover-icon">
                  <StoreIcon size={34} />
                </span>
                <span className="store-cover-currency">{store.defaultCurrency}</span>
              </div>
              <div className="store-card-content">
                <div className="store-card-title">
                  <h2>{store.name}</h2>
                  <ArrowUpRight size={20} />
                </div>
                <p>{store.description || "Your next great business story starts here."}</p>
                <div className="store-card-footer">
                  <Badge value={store.status} />
                  <span>
                    {store.accessType === "STAFF"
                      ? "Shared store"
                      : store.countryCode || "Online store"}
                  </span>
                </div>
              </div>
            </Link>
          ))}
        </div>
      ) : (
        <Empty
          title={search ? "No stores match your search" : "Your next chapter starts here"}
          description={
            search
              ? "Try another name. Search applies to the current page."
              : "Create your first store and bring your products together."
          }
        >
          {!search && (
            <button className="button primary" onClick={() => setCreating(true)}>
              <Plus size={16} />
              Create store
            </button>
          )}
        </Empty>
      )}
      {data && (
        <Pagination
          page={page}
          pages={data.totalPages}
          total={data.totalElements}
          onChange={(value) => {
            setPage(value);
            setSearch("");
          }}
        />
      )}
      <div className="bottom-callout">
        <StoreIcon size={21} />
        <div>
          <strong>Online, at the counter, everywhere.</strong>
          <p>Use your store catalog in point of sale to keep things connected.</p>
        </div>
        <Link href="/pos" className="text-button">
          Open point of sale <ArrowUpRight size={16} />
        </Link>
      </div>
      {creating && <StoreForm onClose={() => setCreating(false)} />}
    </>
  );
}
