"use client";
import { useId, useState } from "react";
import { Wallet, Bitcoin, Smartphone, Landmark, ChevronDown, RefreshCw } from "lucide-react";
import { isPositiveId, methodKey, type PaymentMethod } from "@/lib/business-tools";
import { groupPaymentMethods, type PaymentGroupType } from "@/lib/payment-method-groups";
import { paymentCopy, paymentMoney } from "@/lib/business-tools-ui";
import { usePaymentLanguage } from "@/lib/use-payment-language";
import { PaymentMethodIcon } from "./payment-method-icon";
import { CurrencyBadge } from "./currency-identity";
const icons = { BALANCE: Wallet, CRYPTO: Bitcoin, MOBILE_MONEY: Smartphone, BANK: Landmark };
export function PaymentMethodPicker({
  methods,
  selectedKey,
  onSelect,
  wallets,
}: {
  methods: PaymentMethod[];
  selectedKey: string;
  onSelect: (key: string) => void;
  wallets?: { checking: boolean; unavailable: boolean; retry: () => void };
}) {
  const language = usePaymentLanguage();
  const t = paymentCopy(language);
  const groups = groupPaymentMethods(methods);
  if (wallets && !groups.some((group) => group.type === "BALANCE"))
    groups.unshift({ type: "BALANCE", methods: [] });
  const [open, setOpen] = useState<PaymentGroupType | null>("BALANCE");
  const expanded =
    open === null ? null : groups.find((group) => group.type === open)?.type || groups[0]?.type;
  const prefix = useId();
  const labels = {
    BALANCE: t.fondekaWallets,
    CRYPTO: t.cryptos,
    MOBILE_MONEY: t.mobileMoney,
    BANK: language === "fr" ? "Banque" : "Bank",
  };
  const descriptions = {
    BALANCE: language === "fr" ? "Depuis votre solde Fondeka" : "From your Fondeka balance",
    CRYPTO: language === "fr" ? "Choisissez une crypto et un réseau" : "Choose a coin and network",
    MOBILE_MONEY: language === "fr" ? "Confirmez sur votre téléphone" : "Confirm on your phone",
    BANK: language === "fr" ? "Effectuez un virement" : "Use a bank transfer",
  };
  return (
    <div className="payment-method-groups">
      {groups.map((group) => {
        const Icon = icons[group.type];
        const isOpen = expanded === group.type;
        const heading = prefix + "-" + group.type;
        const panel = heading + "-methods";
        return (
          <section
            className={"payment-method-group" + (isOpen ? " expanded" : "")}
            key={group.type}
            data-payment-group={group.type}
          >
            <h3>
              <button
                id={heading}
                type="button"
                className="payment-group-toggle"
                aria-expanded={isOpen}
                aria-controls={panel}
                onClick={() => {
                  setOpen(isOpen ? null : group.type);
                  onSelect("");
                }}
              >
                <span className="payment-group-icon">
                  <Icon size={21} aria-hidden="true" />
                </span>
                <span className="payment-group-copy">
                  <strong>{labels[group.type]}</strong>
                  <small>{descriptions[group.type]}</small>
                </span>
                <small className="payment-group-count">
                  {group.type === "BALANCE" && wallets?.checking ? "…" : group.methods.length}
                </small>
                <span className="payment-group-chevron" aria-hidden="true">
                  <ChevronDown size={17} strokeWidth={2.6} />
                </span>
              </button>
            </h3>
            <div id={panel} hidden={!isOpen} role="group" aria-labelledby={heading}>
              {group.type === "BALANCE" &&
                wallets &&
                (wallets.checking || wallets.unavailable || !group.methods.length) && (
                  <div className="payment-wallet-status" role="status">
                    {wallets.checking ? (
                      <>
                        <span className="spinner" />
                        {language === "fr"
                          ? "Vérification des soldes et des frais…"
                          : "Checking balances and fees…"}
                      </>
                    ) : (
                      <>
                        <p>
                          {wallets.unavailable
                            ? language === "fr"
                              ? "Certains portefeuilles n’ont pas pu être vérifiés. Réessayez ou choisissez un autre moyen."
                              : "Some wallets could not be checked. Retry or choose another method."
                            : language === "fr"
                              ? "Aucun portefeuille ne couvre le total avec les frais. Choisissez un autre moyen."
                              : "No wallet covers the total including fees. Choose another method."}
                        </p>
                        <button type="button" className="text-button" onClick={wallets.retry}>
                          <RefreshCw size={14} />
                          {t.refresh}
                        </button>
                      </>
                    )}
                  </div>
                )}
              <div
                className={
                  "payment-method-grid" +
                  (group.type === "MOBILE_MONEY" && group.methods.length > 2
                    ? " payment-method-grid-adaptive"
                    : "")
                }
                role="radiogroup"
                aria-labelledby={heading}
              >
                {group.methods.map((method) => {
                  const key = methodKey(method);
                  const disabled =
                    method.type === "BALANCE" &&
                    (!isPositiveId(method.fiatWalletId) || method.walletEnabled === false);
                  return (
                    <label
                      key={key}
                      className={
                        "activation-method payment-method-tile" +
                        (selectedKey === key ? " selected" : "") +
                        (disabled ? " disabled" : "")
                      }
                    >
                      <input
                        type="radio"
                        name={prefix + "-method"}
                        checked={selectedKey === key}
                        disabled={disabled}
                        value={key}
                        onChange={() => onSelect(key)}
                      />
                      <span className="activation-method-icon">
                        <PaymentMethodIcon method={method} />
                      </span>
                      <span className="activation-method-copy">
                        <strong>
                          {method.type === "BALANCE" ? method.currency || t.wallet : method.name}
                        </strong>
                        {method.type === "BALANCE" && method.balance != null && method.currency ? (
                          <small>
                            {paymentMoney(method.balance, method.currency, language)} {t.available}
                          </small>
                        ) : method.type === "MOBILE_MONEY" && method.currency ? (
                          <CurrencyBadge currency={method.currency} />
                        ) : method.currency ? (
                          <small>{method.currency}</small>
                        ) : null}
                      </span>
                    </label>
                  );
                })}
              </div>
            </div>
          </section>
        );
      })}
      {!groups.length && <p className="activation-note">{t.noMethods}</p>}
    </div>
  );
}
