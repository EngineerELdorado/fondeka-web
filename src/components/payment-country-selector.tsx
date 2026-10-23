"use client";
import { useMemo, useState } from "react";
import { Check, ChevronDown, Search } from "lucide-react";
import { countryOptions, filterCountries } from "@/lib/payment-country";
import { useI18n } from "@/lib/i18n";
import { Modal } from "./ui";
export function PaymentCountrySelector({
  value,
  onChange,
  disabled = false,
}: {
  value?: string;
  onChange: (country: string) => void;
  disabled?: boolean;
}) {
  const { t, language } = useI18n();
  const options = useMemo(() => countryOptions(language), [language]);
  const selected = options.find((country) => country.code === value);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const filtered = filterCountries(options, query);
  return (
    <>
      <button
        type="button"
        className="payment-country-trigger"
        disabled={disabled || !selected}
        onClick={() => {
          setQuery("");
          setOpen(true);
        }}
        aria-haspopup="dialog"
        aria-expanded={open}
      >
        {selected && (
          <span className="country-flag" aria-hidden="true">
            {selected.flag}
          </span>
        )}
        <span>
          <small>{t("Payment country", "Pays de paiement")}</small>
          <strong>{selected?.name || t("Detecting country…", "Détection du pays…")}</strong>
        </span>
        <span className="payment-country-change">
          {t("Change", "Modifier")}
          <ChevronDown size={15} />
        </span>
      </button>
      {open && (
        <Modal
          title={t("Choose a country", "Choisissez un pays")}
          onClose={() => setOpen(false)}
          className="payment-country-dialog"
        >
          <label className="country-search">
            <span className="sr-only">
              {t("Search by country or calling code", "Rechercher un pays ou un indicatif")}
            </span>
            <Search size={17} aria-hidden="true" />
            <input
              autoFocus
              data-autofocus
              autoComplete="off"
              onKeyDown={(event) => {
                if (event.key === "Enter") event.preventDefault();
              }}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t("Country or calling code", "Pays ou indicatif")}
            />
          </label>
          <div className="payment-country-options" role="group" aria-label={t("Countries", "Pays")}>
            {filtered.map((country) => (
              <button
                type="button"
                className={"payment-country-option" + (value === country.code ? " selected" : "")}
                aria-pressed={value === country.code}
                key={country.code}
                onClick={() => {
                  onChange(country.code);
                  setOpen(false);
                }}
              >
                <span className="country-flag" aria-hidden="true">
                  {country.flag}
                </span>
                <span>
                  <strong>{country.name}</strong>
                  <small>
                    {country.code}
                    {country.callingCode ? ` · +${country.callingCode}` : ""}
                  </small>
                </span>
                {value === country.code && <Check size={18} aria-hidden="true" />}
              </button>
            ))}
            {!filtered.length && (
              <p className="empty-country" role="status">
                {t("No countries found.", "Aucun pays trouvé.")}
              </p>
            )}
          </div>
        </Modal>
      )}
    </>
  );
}
