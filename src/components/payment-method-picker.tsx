"use client";
import { useId, useState } from "react";
import { Wallet, Bitcoin, Smartphone, Landmark, ChevronDown } from "lucide-react";
import { isPositiveId, methodKey, type PaymentMethod } from "@/lib/business-tools";
import { groupPaymentMethods, type PaymentGroupType } from "@/lib/payment-method-groups";
import { paymentCopy, paymentMoney } from "@/lib/business-tools-ui";
import { usePaymentLanguage } from "@/lib/use-payment-language";
const icons = { BALANCE: Wallet, CRYPTO: Bitcoin, MOBILE_MONEY: Smartphone, BANK: Landmark };
export function PaymentMethodPicker({
  methods,
  selectedKey,
  onSelect,
}: {
  methods: PaymentMethod[];
  selectedKey: string;
  onSelect: (key: string) => void;
}) {
  const language = usePaymentLanguage();
  const t = paymentCopy(language);
  const groups = groupPaymentMethods(methods);
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
                <Icon size={18} aria-hidden="true" />
                <span>{labels[group.type]}</span>
                <small>{group.methods.length}</small>
                <ChevronDown size={17} aria-hidden="true" />
              </button>
            </h3>
            <div id={panel} hidden={!isOpen} role="group" aria-labelledby={heading}>
              <div className="payment-method-grid" role="radiogroup" aria-labelledby={heading}>
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
                        <Icon size={22} aria-hidden="true" />
                      </span>
                      <span className="activation-method-copy">
                        <strong>
                          {method.type === "BALANCE" ? method.currency || t.wallet : method.name}
                        </strong>
                        {method.type === "BALANCE" && method.balance != null && method.currency ? (
                          <small>
                            {paymentMoney(method.balance, method.currency, language)} {t.available}
                          </small>
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
