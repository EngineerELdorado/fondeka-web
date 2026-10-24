"use client";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { Plus, Minus, ScanLine, Search, Banknote, Smartphone } from "lucide-react";
import { uiText } from "@/lib/ui-copy";
import { useCurrencies } from "@/lib/use-currencies";
import { useI18n } from "@/lib/i18n";
import { useQuery } from "@/lib/use-query";
import { useUrlState } from "@/lib/use-url-state";
import { invalidateQueryPaths } from "@/lib/query-cache";
import { ApiError } from "@/lib/api";
import { request } from "@/lib/data";
import { canUseStore, validateCashSale } from "@/lib/commerce";
import { money } from "@/lib/format";
import type { Store, Product, Page, Customer, Order, Quote, PosInput } from "@/lib/types";
import { Loading, ErrorState, Empty, Modal, Pagination } from "@/components/ui";
import { useWorkspace } from "@/components/workspace-provider";
import {
  GuidedFlow,
  FlowField,
  FlowChoices,
  FlowReview,
  FlowError,
  type GuidedStep,
} from "@/components/guided-flow";
import { CustomerForm } from "@/components/store-people";
import { CollectionDialog } from "@/components/collection-dialog";
import { SaleDetail } from "@/components/store-sales";
import { BarcodeScanner } from "@/components/barcode-scanner";
import { PosCatalog } from "./pos-catalog";
export function PosRegister({ store }: { store: Store }) {
  const { t } = useI18n();
  const { refresh, notify } = useWorkspace();
  const { update } = useUrlState();
  const closeRequest = useRef<(() => void) | null>(null);
  const [paymentMode, setPaymentMode] = useState<"CASH" | "FONDEKA">("CASH");
  const [page, setPage] = useState(0);
  const [search, setSearch] = useState("");
  const [query, setQuery] = useState("");
  const [cart, setCart] = useState<{ product: Product; quantity: number }[]>([]);
  const [customer, setCustomer] = useState<Customer>();
  const [customerPage, setCustomerPage] = useState(0);
  const [creatingCustomer, setCreatingCustomer] = useState(false);
  const [billing, setBilling] = useState(store.defaultCurrency);
  const [currency, setCurrency] = useState(store.defaultCurrency);
  const { currencies } = useCurrencies([billing, currency]);
  const [quote, setQuote] = useState<Quote>();
  const [busy, setBusy] = useState(false);
  const [uncertain, setUncertain] = useState(false);
  const [error, setError] = useState("");
  const [review, setReview] = useState(false);
  const [cartOpen, setCartOpen] = useState(false);
  const [cashStatus, setCashStatus] = useState<PosInput["paymentStatus"]>("PAID");
  const [paid, setPaid] = useState("");
  const [due, setDue] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  const [receipt, setReceipt] = useState<Order>();
  const [external, setExternal] = useState<Order>();
  const [scanning, setScanning] = useState(false);
  const lock = useRef(false);
  const products = useQuery<Page<Product>>(
    `/customer-api/commerce/stores/${store.id}/pos/products/search?${new URLSearchParams({ page: String(page), size: "20", query })}`,
  );
  const customers = useQuery<Page<Customer>>(
    review && canUseStore(store, "CUSTOMERS")
      ? `/customer-api/commerce/stores/${store.id}/customers?page=${customerPage}&size=20`
      : null,
  );
  useEffect(() => {
    const timer = setTimeout(() => {
      setQuery(search);
      setPage(0);
    }, 250);
    return () => clearTimeout(timer);
  }, [search]);
  const quantity = cart.reduce((s, i) => s + i.quantity, 0);
  const sameCurrency = cart.every((i) => i.product.priceCurrency === billing);
  const estimate = sameCurrency
    ? cart.reduce((s, i) => s + i.product.priceAmount * i.quantity, 0)
    : undefined;
  function invalidate() {
    setQuote(undefined);
    setConfirmed(false);
  }
  function add(p: Product) {
    if (busy || uncertain) return;
    const current = cart.find((i) => i.product.id === p.id)?.quantity || 0;
    if (
      p.status !== "ACTIVE" ||
      (p.type === "TRAINING" && current >= 1) ||
      (p.inventoryPolicy === "TRACKED" && current >= Number(p.inventoryQuantity ?? 0))
    ) {
      notify(
        t("Product unavailable or out of stock.", "Produit indisponible ou en rupture de stock."),
      );
      return;
    }
    invalidate();
    setCart((rows) =>
      current
        ? rows.map((i) => (i.product.id === p.id ? { ...i, quantity: i.quantity + 1 } : i))
        : [...rows, { product: p, quantity: 1 }],
    );
  }
  function decrease(id: number) {
    if (busy || uncertain) return;
    invalidate();
    setCart((rows) =>
      rows
        .map((i) => (i.product.id === id ? { ...i, quantity: i.quantity - 1 } : i))
        .filter((i) => i.quantity > 0),
    );
  }
  const scan = async (value: string) => {
    setScanning(false);
    try {
      const found = await request<Page<Product>>(
        `/customer-api/commerce/stores/${store.id}/pos/products/search?${new URLSearchParams({ query: value, page: "0", size: "20" })}`,
      );
      const exact =
        found.content.find(
          (p) => p.barcodeOrQrCode === value || p.sku === value || p.productUrl === value,
        ) || (found.content.length === 1 ? found.content[0] : undefined);
      if (!exact) {
        notify(
          t(
            "This barcode does not match a product in this store.",
            "Ce code ne correspond à aucun produit de cette boutique.",
          ),
        );
        return;
      }
      add(exact);
    } catch (e) {
      notify(
        e instanceof Error ? uiText(e.message) : t("Product not found.", "Produit introuvable."),
      );
    }
  };
  function payload(mode: "CASH" | "FONDEKA" = "CASH"): PosInput {
    return {
      items: cart.map((i) => ({ productId: i.product.id, quantity: i.quantity })),
      billingCurrency: billing,
      paymentCurrency: currency,
      paymentMode: mode,
      paymentStatus: mode === "FONDEKA" ? "PAID" : cashStatus,
      ...(customer
        ? {
            customerId: customer.id,
            buyerName: customer.name,
            buyerEmail: customer.email,
            buyerPhone: customer.phone,
          }
        : {}),
      ...(quote && mode === "CASH"
        ? {
            amountPaid:
              cashStatus === "PAID"
                ? quote.totalAmount
                : cashStatus === "ON_CREDIT"
                  ? 0
                  : Number(paid),
            amountPaidCurrency: quote.totalCurrency,
            ...(cashStatus !== "PAID" ? { paymentDueDate: due } : {}),
          }
        : {}),
    };
  }
  async function calculate(mode: "CASH" | "FONDEKA" = paymentMode) {
    if (lock.current || !cart.length || uncertain) return;
    lock.current = true;
    setBusy(true);
    setError("");
    try {
      const q = await request<Quote>(`/customer-api/commerce/stores/${store.id}/pos/orders/quote`, {
        method: "POST",
        body: JSON.stringify({
          ...payload(mode),
          paymentStatus: "PAID",
          amountPaid: undefined,
          amountPaidCurrency: undefined,
          paymentDueDate: undefined,
        }),
      });
      setQuote(q);
      setConfirmed(false);
    } catch (e) {
      setError(
        e instanceof Error
          ? uiText(e.message)
          : t("Unable to quote sale.", "Impossible de calculer la vente."),
      );
      throw e;
    } finally {
      setBusy(false);
      lock.current = false;
    }
  }
  async function create(mode: "CASH" | "FONDEKA") {
    if (lock.current || !quote || uncertain) return;
    setError("");
    try {
      if (quote.expiresAt && Date.parse(quote.expiresAt) <= Date.now())
        throw new Error(
          t("Quote expired. Calculate the sale again.", "Le devis a expiré. Recalculez la vente."),
        );
      const body = payload(mode);
      if (mode === "CASH") {
        if (!confirmed) return;
        validateCashSale(body, quote.totalAmount);
      }
      lock.current = true;
      setBusy(true);
      const order = await request<Order>(`/customer-api/commerce/stores/${store.id}/pos/orders`, {
        method: "POST",
        body: JSON.stringify(body),
      });
      setReview(false);
      update({ flow: null, step: null });
      setCart([]);
      setQuote(undefined);
      setCustomer(undefined);
      invalidateQueryPaths([
        `/customer-api/commerce/stores/${store.id}/products`,
        `/customer-api/commerce/stores/${store.id}/pos/products/search`,
        `/customer-api/commerce/stores/${store.id}/orders`,
        `/customer-api/commerce/stores/${store.id}/reports`,
        "/customer-api/commerce/orders",
        ...(customer
          ? [`/customer-api/commerce/stores/${store.id}/customers/${customer.id}/orders`]
          : []),
      ]);
      if (mode === "FONDEKA") setExternal(order);
      else setReceipt(order);
    } catch (e) {
      setError(
        e instanceof Error
          ? uiText(e.message)
          : t("Unable to record sale.", "Impossible d’enregistrer la vente."),
      );
      if (
        lock.current &&
        !(e instanceof ApiError && e.status >= 400 && e.status < 500 && e.status !== 408)
      )
        setUncertain(true);
    } finally {
      setBusy(false);
      lock.current = false;
    }
  }
  type SaleDecision = {
    customerId: number;
    billing: string;
    currency: string;
    mode: "CASH" | "FONDEKA";
    status: PosInput["paymentStatus"];
    paid: string;
    due: string;
  };
  const decision: SaleDecision = {
    customerId: customer?.id || 0,
    billing,
    currency,
    mode: paymentMode,
    status: cashStatus,
    paid,
    due,
  };
  function setDecision(patch: Partial<SaleDecision>) {
    if (patch.mode) {
      setPaymentMode(patch.mode);
      setConfirmed(false);
    }
    if (patch.status) {
      setCashStatus(patch.status);
      setConfirmed(false);
    }
    if (patch.paid !== undefined) {
      setPaid(patch.paid);
      setConfirmed(false);
    }
    if (patch.due !== undefined) {
      setDue(patch.due);
      setConfirmed(false);
    }
  }
  const saleSteps: GuidedStep<SaleDecision>[] = [
    {
      id: "identity",
      title: t("Customer and currencies", "Client et devises"),
      helper: t(
        "Attach a customer, or continue with a walk-in sale.",
        "Associez un client, ou continuez avec une vente de passage.",
      ),
      prepare: () => calculate(),
      render: () => (
        <div className="form-stack">
          <label>
            {t("Customer", "Client")}
            <select
              value={customer?.id || ""}
              disabled={busy || uncertain || !canUseStore(store, "CUSTOMERS")}
              onChange={(e) => {
                setCustomer(customers.data?.content.find((c) => String(c.id) === e.target.value));
                invalidate();
              }}
            >
              <option value="">{t("Walk-in customer", "Client de passage")}</option>
              {customer && !customers.data?.content.some((c) => c.id === customer.id) && (
                <option value={customer.id}>
                  {customer.name || customer.email || customer.phone}
                </option>
              )}
              {customers.data?.content.map((c) => (
                <option value={c.id} key={c.id}>
                  {c.name || c.email || c.phone}
                </option>
              ))}
            </select>
          </label>
          {customers.data && customers.data.totalPages > 1 && (
            <Pagination
              page={customerPage}
              pages={customers.data.totalPages}
              total={customers.data.totalElements}
              onChange={setCustomerPage}
            />
          )}
          {customers.error && <p role="alert">{customers.error}</p>}
          {!canUseStore(store, "CUSTOMERS") && (
            <p className="muted">
              {t(
                "Customer management requires the store owner’s permission.",
                "La gestion des clients nécessite l’autorisation du propriétaire.",
              )}
            </p>
          )}
          <button
            className="text-button"
            disabled={busy || uncertain || !canUseStore(store, "CUSTOMERS")}
            onClick={() => setCreatingCustomer(true)}
          >
            {t("Create customer", "Créer un client")}
          </button>
          <div className="form-grid">
            <label>
              {t("Billing currency", "Devise de facturation")}
              <select
                value={billing}
                disabled={busy || uncertain}
                onChange={(e) => {
                  setBilling(e.target.value);
                  invalidate();
                }}
              >
                {currencies.map((c) => (
                  <option key={c}>{c}</option>
                ))}
              </select>
            </label>
            <label>
              {t("Payment currency", "Devise du paiement")}
              <select
                value={currency}
                disabled={busy || uncertain}
                onChange={(e) => {
                  setCurrency(e.target.value);
                  invalidate();
                }}
              >
                {currencies.map((c) => (
                  <option key={c}>{c}</option>
                ))}
              </select>
            </label>
          </div>
        </div>
      ),
    },
    {
      id: "review",
      title: t("Review sale", "Vérifiez la vente"),
      helper: t(
        "These totals come from the backend quote.",
        "Ces totaux proviennent du devis du serveur.",
      ),
      render: ({ go }) => (
        <>
          <p className="flow-price">
            {quote ? money(quote.totalAmount, quote.totalCurrency) : "—"}
          </p>
          <FlowReview title={t("Items", "Articles")}>
            {cart.map((item) => (
              <div className="flow-row" key={item.product.id}>
                <span>{item.product.name}</span>
                <strong>× {item.quantity}</strong>
              </div>
            ))}
          </FlowReview>
          <FlowReview title={t("Customer", "Client")} edit={() => go("identity")}>
            <p>
              {customer?.name ||
                customer?.email ||
                customer?.phone ||
                t("Walk-in customer", "Client de passage")}
            </p>
          </FlowReview>
          <FlowReview title={t("Fees", "Frais")}>
            <p>{quote ? money(quote.feeAmount, quote.feeCurrency || quote.totalCurrency) : "—"}</p>
          </FlowReview>
        </>
      ),
    },
    {
      id: "payment",
      title: t("How will the customer pay?", "Comment le client paiera-t-il ?"),
      helper: t(
        "Choose cash or collect through Fondeka.",
        "Choisissez les espèces ou un encaissement via Fondeka.",
      ),
      validate: (v) => {
        if (v.mode !== "CASH" || !quote) return {};
        try {
          validateCashSale(payload("CASH"), quote.totalAmount);
          return {};
        } catch (failure) {
          return {
            [v.status === "PARTIALLY_PAID" ? "paid" : "due"]:
              failure instanceof Error
                ? uiText(failure.message)
                : t("Review the cash details.", "Vérifiez le paiement en espèces."),
          };
        }
      },
      prepare: () => calculate(paymentMode),
      render: ({ value, set }) => (
        <>
          <FlowChoices
            name="mode"
            value={value.mode}
            onChange={(mode) => set({ mode: mode as SaleDecision["mode"] })}
            choices={[
              {
                value: "CASH",
                title: t("Cash", "Espèces"),
                description: t("Record the amount received.", "Enregistrez le montant reçu."),
                icon: <Banknote size={22} />,
              },
              {
                value: "FONDEKA",
                title: t("Fondeka collection", "Encaissement Fondeka"),
                description: t(
                  "Choose the payment method after confirming the order.",
                  "Choisissez le moyen de paiement après confirmation de la commande.",
                ),
                icon: <Smartphone size={22} />,
              },
            ]}
          />
          {value.mode === "CASH" && (
            <>
              <FlowField name="status" label={t("Payment status", "Statut du paiement")}>
                <select
                  value={value.status}
                  onChange={(e) => set({ status: e.target.value as SaleDecision["status"] })}
                >
                  {["PAID", "PARTIALLY_PAID", "ON_CREDIT"].map((status) => (
                    <option key={status} value={status}>
                      {status === "PAID"
                        ? t("Paid", "Payé")
                        : status === "PARTIALLY_PAID"
                          ? t("Partially paid", "Partiellement payé")
                          : t("On credit", "À crédit")}
                    </option>
                  ))}
                </select>
              </FlowField>
              {value.status === "PARTIALLY_PAID" && (
                <FlowField
                  name="paid"
                  label={
                    t("Amount received", "Montant reçu") +
                    " (" +
                    (quote?.totalCurrency || currency) +
                    ")"
                  }
                >
                  <input
                    inputMode="decimal"
                    value={value.paid}
                    onChange={(e) => set({ paid: e.target.value })}
                  />
                </FlowField>
              )}
              {value.status !== "PAID" && (
                <>
                  <FlowField name="due" label={t("Payment due date", "Date d’échéance")}>
                    <input
                      type="date"
                      value={value.due}
                      min={new Date().toISOString().slice(0, 10)}
                      onChange={(e) => set({ due: e.target.value })}
                    />
                  </FlowField>
                  <p className="muted">
                    {t(
                      "A customer and due date are required for unpaid balances.",
                      "Un client et une échéance sont requis pour les soldes impayés.",
                    )}
                  </p>
                </>
              )}
            </>
          )}
        </>
      ),
    },
    {
      id: "confirmation",
      title: t("Confirm sale", "Confirmez la vente"),
      validate: () =>
        paymentMode === "CASH" && !confirmed
          ? {
              confirmation: t(
                "Confirm the cash amount before completing the sale.",
                "Confirmez le montant reçu avant de terminer la vente.",
              ),
            }
          : {},
      render: ({ go }) => (
        <>
          <p className="flow-price">
            {quote ? money(quote.totalAmount, quote.totalCurrency) : "—"}
          </p>
          <FlowReview title={t("Customer", "Client")} edit={() => go("identity")}>
            <p>
              {customer?.name ||
                customer?.email ||
                customer?.phone ||
                t("Walk-in customer", "Client de passage")}
            </p>
          </FlowReview>
          <FlowReview title={t("Payment", "Paiement")} edit={() => go("payment")}>
            <p>
              {paymentMode === "FONDEKA"
                ? t("Collect with Fondeka", "Encaisser avec Fondeka")
                : cashStatus === "PAID"
                  ? t("Cash · Paid", "Espèces · Payé")
                  : cashStatus === "PARTIALLY_PAID"
                    ? t("Cash · Partially paid", "Espèces · Partiellement payé")
                    : t("Cash · On credit", "Espèces · À crédit")}
            </p>
            {cashStatus !== "PAID" && paymentMode === "CASH" && (
              <p>
                {money(
                  cashStatus === "ON_CREDIT" ? 0 : Number(paid),
                  quote?.totalCurrency || currency,
                )}{" "}
                · {due}
              </p>
            )}
          </FlowReview>
          {paymentMode === "CASH" && (
            <div data-flow-field="confirmation" tabIndex={-1}>
              <label className="checkbox-label">
                <input
                  type="checkbox"
                  checked={confirmed}
                  onChange={(e) => setConfirmed(e.target.checked)}
                />
                {t(
                  "I confirm the cash amount received and the remaining balance.",
                  "Je confirme le montant reçu en espèces et le solde restant.",
                )}
              </label>
            </div>
          )}
          <FlowError name="confirmation" />
          {error && (
            <p role="alert" className="form-error">
              {error}
            </p>
          )}
          {uncertain && (
            <p className="info-box">
              {t(
                "The result is uncertain. Check sales before creating another order.",
                "Le résultat est incertain. Vérifiez les ventes avant de créer une autre commande.",
              )}{" "}
              <Link href={"/stores/" + store.id + "?tab=sales"}>
                {t("View sales", "Voir les ventes")}
              </Link>
            </p>
          )}
        </>
      ),
    },
  ];
  const cartContent = (
    <>
      <div className="panel-heading">
        <h2>{t("Sale", "Vente")}</h2>
        <span className="count-pill">{quantity}</span>
      </div>
      <div className="cart-items">
        {!cart.length ? (
          <p className="cart-empty">
            {t("Add products to start a sale.", "Ajoutez des produits pour commencer une vente.")}
          </p>
        ) : (
          cart.map((i) => (
            <div className="cart-item" key={i.product.id}>
              <span>
                <strong>{i.product.name}</strong>
                <small>{money(i.product.priceAmount, i.product.priceCurrency)}</small>
              </span>
              <div className="quantity-control">
                <button
                  type="button"
                  disabled={busy || uncertain}
                  aria-label={t("Decrease quantity", "Diminuer la quantité")}
                  onClick={() => decrease(i.product.id)}
                >
                  <Minus size={14} />
                </button>
                <span>{i.quantity}</span>
                <button
                  type="button"
                  disabled={busy || uncertain || i.product.type === "TRAINING"}
                  aria-label={t("Increase quantity", "Augmenter la quantité")}
                  onClick={() => add(i.product)}
                >
                  <Plus size={14} />
                </button>
              </div>
            </div>
          ))
        )}
      </div>
      <div className="cart-bottom">
        <div className="cart-subtotal">
          <span>{t("Subtotal", "Sous-total")}</span>
          <strong>
            {estimate === undefined ? t("Calculate", "Calculer") : money(estimate, billing)}
          </strong>
        </div>
        <button
          className="button primary checkout-button"
          disabled={!cart.length || busy || uncertain}
          onClick={() => {
            setReview(true);
            setCartOpen(false);
            update({ flow: "sale", step: "identity" });
          }}
        >
          {busy ? t("Calculating…", "Calcul en cours…") : t("Next", "Suivant")}
        </button>
        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}
        {uncertain && (
          <p className="info-box">
            {t(
              "The result is uncertain. Check sales before creating another order.",
              "Le résultat est incertain. Vérifiez les ventes avant de créer une autre commande.",
            )}{" "}
            <Link href={`/stores/${store.id}?tab=sales`}>{t("View sales", "Voir les ventes")}</Link>
          </p>
        )}
      </div>
    </>
  );
  return (
    <>
      <div className="pos-layout">
        <section className="panel catalog-panel">
          <div className="panel-heading">
            <h2>{t("Products", "Produits")}</h2>
            {canUseStore(store, "PRODUCTS") && (
              <Link className="text-button" href={`/stores/${store.id}?tab=products`}>
                {t("Manage products", "Gérer les produits")}
              </Link>
            )}
          </div>
          <div className="catalog-search">
            <label className="search-input">
              <Search size={17} />
              <input
                aria-label={t("Search products", "Rechercher des produits")}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && search.trim()) {
                    e.preventDefault();
                    void scan(search.trim());
                  }
                }}
              />
            </label>
            <button
              className="icon-button"
              aria-label={t("Scan product barcode", "Scanner le code du produit")}
              onClick={() => setScanning(true)}
            >
              <ScanLine size={20} />
            </button>
          </div>
          {products.loading ? (
            <Loading />
          ) : products.error ? (
            <ErrorState message={products.error} retry={refresh} />
          ) : !products.data?.content.length ? (
            <Empty
              title={t("No products found", "Aucun produit trouvé")}
              description={t(
                "Add a product or try another search.",
                "Ajoutez un produit ou essayez une autre recherche.",
              )}
            />
          ) : (
            <PosCatalog
              products={products.data.content}
              cart={cart}
              disabled={busy || uncertain}
              onAdd={add}
            />
          )}
          {products.data && (
            <Pagination
              page={page}
              pages={products.data.totalPages}
              total={products.data.totalElements}
              onChange={setPage}
            />
          )}
        </section>
        <aside className="panel cart-panel">{cartContent}</aside>
      </div>
      <div className="mobile-cart-dock">
        <button className="button primary" onClick={() => setCartOpen(true)}>
          {t("View sale", "Voir la vente")} · {quantity}
          <strong>
            {quote
              ? money(quote.totalAmount, quote.totalCurrency)
              : estimate === undefined
                ? "—"
                : money(estimate, billing)}
          </strong>
        </button>
      </div>
      {cartOpen && (
        <Modal
          title={t("Sale", "Vente")}
          variant="sheet"
          onClose={() => setCartOpen(false)}
          busy={busy}
        >
          <div className="mobile-sale-content">{cartContent}</div>
        </Modal>
      )}
      {review && !creatingCustomer && (
        <Modal
          title={t("Complete sale", "Terminer la vente")}
          hideHeader
          className="guided-dialog"
          onClose={() => closeRequest.current?.()}
          busy={busy}
        >
          <GuidedFlow
            compact
            id="sale"
            title={store.name}
            steps={saleSteps}
            value={decision}
            set={setDecision}
            dirty={false}
            onDiscard={() => {}}
            closeRequest={closeRequest}
            onClose={() => {
              setReview(false);
              update({ flow: null, step: null });
            }}
            finalLabel={
              paymentMode === "CASH"
                ? t("Complete sale", "Terminer la vente")
                : t("Collect payment", "Encaisser le paiement")
            }
            finishDisabled={uncertain}
            onFinish={() => create(paymentMode)}
          />
        </Modal>
      )}
      {creatingCustomer && (
        <CustomerForm
          storeId={store.id}
          onClose={() => {
            setCreatingCustomer(false);
            update({ flow: "sale", step: "identity" }, true);
          }}
          onSaved={(c) => {
            setCustomer(c);
            setCreatingCustomer(false);
            update({ flow: "sale", step: "identity" }, true);
            invalidate();
          }}
        />
      )}
      {external && (
        <CollectionDialog
          order={external}
          onDone={refresh}
          onClose={() => {
            setReceipt(external);
            setExternal(undefined);
          }}
        />
      )}
      {receipt && (
        <SaleDetail
          order={receipt}
          onClose={() => setReceipt(undefined)}
          onNewSale={() => {
            setReceipt(undefined);
            setCashStatus("PAID");
            setPaid("");
            setDue("");
            setPaymentMode("CASH");
            setConfirmed(false);
          }}
        />
      )}
      {scanning && (
        <BarcodeScanner onScan={(v) => void scan(v)} onClose={() => setScanning(false)} />
      )}
    </>
  );
}
