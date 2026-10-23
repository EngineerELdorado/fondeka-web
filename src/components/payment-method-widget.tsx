"use client";
import { useEffect, useState, useRef, type FormEvent } from "react";
import { PaymentMethodPicker } from "./payment-method-picker";
import { PaymentCountrySelector } from "./payment-country-selector";
import { useDetectedPaymentCountry } from "./payment-country-provider";
import { resolvePaymentCountry } from "@/lib/payment-country";
import {
  buildSelection,
  canAfford,
  isFiatCurrency,
  methodKey,
  normalizeMethods,
  paymentMethodsPath,
  collectionMethods,
  quotePath,
  parseQuote,
  paymentClientVersion,
  type AccessQuote,
  type PaymentMethod,
  type PaymentSelection,
} from "@/lib/business-tools";
import { paymentCopy, paymentError, paymentMoney } from "@/lib/business-tools-ui";
import { usePaymentLanguage } from "@/lib/use-payment-language";
import { request } from "@/lib/data";
import { useQuery } from "@/lib/use-query";
import { useWorkspace } from "./workspace-provider";
function PaymentLoading({ message }: { message?: string }) {
  const t = paymentCopy(usePaymentLanguage());
  return (
    <div className="activation-loading" role="status">
      <span className="spinner" />
      {message || t.loading}
    </div>
  );
}
function PaymentError({ message, retry }: { message?: string; retry?: () => void }) {
  const l = usePaymentLanguage();
  const t = paymentCopy(l);
  return (
    <div className="activation-error" role="alert">
      <p>{paymentError(message, l, t.errorBody)}</p>
      {retry && (
        <button type="button" className="text-button" onClick={retry}>
          {t.retry}
        </button>
      )}
    </div>
  );
}
export function PaymentMethodWidget({
  action,
  amount,
  baseAmount,
  baseCurrency,
  onConfirm,
  onClose,
  confirmLabel,
  busy: parentBusy = false,
  feeMode = "EXCLUSIVE",
  paymentRequestId,
  paymentRequestCode,
}: {
  action: string;
  amount: number;
  baseAmount: number;
  baseCurrency: string;
  onConfirm: (selection: PaymentSelection, quote: AccessQuote, receivedAt: number) => Promise<void>;
  onClose: () => void;
  confirmLabel: string;
  busy?: boolean;
  feeMode?: "INCLUSIVE" | "EXCLUSIVE";
  paymentRequestId?: number;
  paymentRequestCode?: string;
}) {
  const submitting = useRef(false);
  const [ownBusy, setOwnBusy] = useState(false);
  const { refresh } = useWorkspace();
  const language = usePaymentLanguage();
  const t = paymentCopy(language);
  const account = useQuery<{ countryCode?: string }>("/customer-api/accounts/my-account");
  const [country, setCountry] = useState("");
  const detectedCountry = useDetectedPaymentCountry();
  const paymentCountry = resolvePaymentCountry({
    selected: country,
    detected: detectedCountry,
    accountCountry: account.data?.countryCode,
    accountLoading: account.loading,
  });
  const [selectedKey, setSelectedKey] = useState("");
  const [cryptoCurrency, setCryptoCurrency] = useState(baseCurrency);
  const [networkId, setNetworkId] = useState("");
  const [phone, setPhone] = useState("");
  const [error, setError] = useState("");
  const [quoteVersion, setQuoteVersion] = useState(0);
  // Resolve the initial country before discovery; never briefly show an unfiltered method list.
  const methods = useQuery<unknown>(
    paymentCountry
      ? paymentMethodsPath({ action, paymentRequestId, paymentRequestCode }, paymentCountry)
      : null,
    { "X-Client-Version": paymentClientVersion, "Accept-Language": language },
  );
  let methodList: PaymentMethod[] = [];
  let methodsError = methods.error;
  if (methods.data) {
    try {
      const result = normalizeMethods(methods.data);
      methodList = collectionMethods(result.paymentMethods, action);
    } catch (failure) {
      methodsError = failure instanceof Error ? failure.message : t.methodsError;
    }
  }
  const selected = methodList.find((method) => methodKey(method) === selectedKey);
  const currency = selected?.type === "CRYPTO" ? cryptoCurrency : (selected?.currency ?? "");
  const networks = useQuery<{ id: number; name: string; displayName?: string }[]>(
    selected?.type === "CRYPTO"
      ? `/customer-api/crypto-networks/payment-methods/${selected.id}/networks`
      : null,
    { "Accept-Language": language },
  );
  let selection: PaymentSelection | undefined;
  let selectionError = t.selectionError;
  try {
    if (selected) {
      if (
        selected.type === "CRYPTO" &&
        !networks.data?.some((network) => String(network.id) === networkId)
      )
        throw new Error(t.networkError);
      selection = buildSelection(
        selected,
        currency,
        phone,
        networkId ? Number(networkId) : undefined,
      );
    }
  } catch (failure) {
    selectionError = paymentError(
      failure instanceof Error ? failure.message : undefined,
      language,
      t.selectionError,
    );
  }
  const selectionKey = selection ? JSON.stringify(selection) : "";
  const quoteKey = `${paymentCountry}:${selectionKey}:${action}:${amount}:${baseAmount}:${baseCurrency}:${feeMode}:${quoteVersion}:${language}:${paymentRequestId}:${paymentRequestCode}`;
  const [quoteState, setQuoteState] = useState<{
    key: string;
    quote?: { value: AccessQuote; receivedAt: number };
    error?: string;
  }>({ key: "" });
  useEffect(() => {
    if (!selectionKey) return;
    let active = true;
    const abort = new AbortController();
    const timer = setTimeout(() => {
      const payment = JSON.parse(selectionKey) as PaymentSelection;
      void request(
        quotePath(payment, {
          action,
          amount,
          currency: baseCurrency,
          feeMode,
          paymentRequestId,
          paymentRequestCode,
        }),
        {
          headers: { "Accept-Language": language },
          signal: abort.signal,
        },
      )
        .then((body) => {
          if (!active) return;
          const quote = parseQuote(body);
          if (quote.totalToPayCurrency !== payment.currency) throw new Error(t.quoteChanged);
          setQuoteState({
            key: quoteKey,
            quote: {
              value: quote,
              receivedAt: Date.now(),
            },
          });
        })
        .catch((failure) => {
          if (active)
            setQuoteState({
              key: quoteKey,
              error: paymentError(
                failure instanceof Error ? failure.message : undefined,
                language,
                t.quoteError,
              ),
            });
        });
    }, 250);
    return () => {
      active = false;
      clearTimeout(timer);
      abort.abort();
    };
  }, [
    selectionKey,
    quoteKey,
    action,
    amount,
    baseAmount,
    baseCurrency,
    feeMode,
    paymentRequestId,
    paymentRequestCode,
    language,
    t.quoteChanged,
    t.quoteError,
  ]);
  const quote = quoteState.key === quoteKey ? quoteState.quote : undefined;
  const quoteError = quoteState.key === quoteKey ? quoteState.error : undefined;
  const affordable = !!selected && !!quote && canAfford(selected, quote.value);
  const busy = parentBusy || ownBusy;
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (busy || submitting.current) return;
    setError("");
    if (!selection || !quote || !affordable) {
      setError(quote && !affordable ? t.insufficient : selectionError);
      return;
    }
    if (Date.now() - quote.receivedAt > 60_000) {
      setQuoteVersion((value) => value + 1);
      setError(t.quoteRefreshing);
      return;
    }
    submitting.current = true;
    setOwnBusy(true);
    try {
      await onConfirm(selection, quote.value, quote.receivedAt);
    } catch (failure) {
      setError(
        paymentError(failure instanceof Error ? failure.message : undefined, language, t.errorBody),
      );
    } finally {
      submitting.current = false;
      setOwnBusy(false);
    }
  }
  return (
    <form className="activation-widget" onSubmit={(event) => void submit(event)}>
      <fieldset disabled={busy}>
        <legend>{t.payWith}</legend>
        <PaymentCountrySelector
          value={paymentCountry}
          disabled={busy}
          onChange={(code) => {
            setCountry(code);
            setSelectedKey("");
            setNetworkId("");
            setPhone("");
            setCryptoCurrency(baseCurrency);
            setError("");
          }}
        />
        {!paymentCountry || methods.loading ? (
          <PaymentLoading />
        ) : methodsError ? (
          <PaymentError message={methodsError} retry={refresh} />
        ) : (
          <PaymentMethodPicker
            key={paymentCountry}
            methods={methodList}
            selectedKey={selectedKey}
            onSelect={(key) => {
              setSelectedKey(key);
              setNetworkId("");
              setError("");
            }}
          />
        )}
        {selected?.localizedCollectionDisabledMessage && (
          <p className="activation-note">{selected.localizedCollectionDisabledMessage}</p>
        )}
        {selected?.type === "MOBILE_MONEY" && (
          <label className="activation-method-details">
            {t.phone}
            <input
              type="tel"
              value={phone}
              onChange={(event) => {
                setPhone(event.target.value);
                setError("");
              }}
              required
              maxLength={254}
              autoComplete="tel"
              placeholder={t.phoneHint}
            />
          </label>
        )}
        {selected?.type === "CRYPTO" && (
          <div className="activation-method-details">
            <div className="form-grid">
              <label>
                {t.settlementCurrency}
                <select
                  value={cryptoCurrency}
                  onChange={(event) => setCryptoCurrency(event.target.value)}
                >
                  {Array.from(
                    new Set([
                      baseCurrency,
                      baseCurrency,
                      ...methodList.map((method) => method.currency).filter(isFiatCurrency),
                    ]),
                  ).map((value) => (
                    <option key={value}>{value}</option>
                  ))}
                </select>
              </label>
              {networks.loading ? (
                <PaymentLoading />
              ) : networks.error ? (
                <PaymentError message={networks.error} retry={refresh} />
              ) : (
                <label>
                  {t.network}
                  <select
                    required
                    value={networkId}
                    onChange={(event) => setNetworkId(event.target.value)}
                  >
                    <option value="">{t.selectNetwork}</option>
                    {networks.data?.map((network) => (
                      <option key={network.id} value={network.id}>
                        {network.displayName || network.name}
                      </option>
                    ))}
                  </select>
                </label>
              )}
            </div>
            <small className="activation-note">{t.cryptoHint}</small>
          </div>
        )}
        {selected?.type === "BANK" && <p className="activation-note">{t.bankHint}</p>}
      </fieldset>
      <div className="activation-confirmation">
        {selected && (
          <div className="activation-summary">
            <dl>
              <div>
                <dt>
                  {action === "BUSINESS_TOOLS_ACCESS"
                    ? t.baseAmount
                    : language === "fr"
                      ? "Montant"
                      : "Amount"}
                </dt>
                <dd>
                  {paymentMoney(baseAmount, baseCurrency, language)} <small>{baseCurrency}</small>
                </dd>
              </div>
              {quote && (
                <>
                  <div>
                    <dt>{t.fees}</dt>
                    <dd>
                      {paymentMoney(quote.value.fees, quote.value.feesCurrency, language)}{" "}
                      <small>{quote.value.feesCurrency}</small>
                    </dd>
                  </div>
                  <div className="activation-total">
                    <dt>{t.total}</dt>
                    <dd>
                      {paymentMoney(
                        quote.value.totalToPay,
                        quote.value.totalToPayCurrency,
                        language,
                      )}{" "}
                      <small>{quote.value.totalToPayCurrency}</small>
                    </dd>
                  </div>
                </>
              )}
            </dl>
            {selection && !quote && !quoteError && <PaymentLoading message={t.gettingQuote} />}
            {quoteError && (
              <PaymentError
                message={quoteError}
                retry={() => setQuoteVersion((value) => value + 1)}
              />
            )}
            {quote && !affordable && <PaymentError message={t.insufficient} />}
          </div>
        )}
        {error && <PaymentError message={error} />}
        <div className="activation-footer">
          <button type="button" className="button secondary" disabled={busy} onClick={onClose}>
            {t.back}
          </button>
          <button
            className="button primary"
            disabled={
              busy || !selection || !quote || !affordable || !!methodsError || !!networks.error
            }
          >
            {busy ? (
              <>
                <span className="spinner" />
                {t.wait}
              </>
            ) : (
              confirmLabel
            )}
          </button>
        </div>
      </div>
    </form>
  );
}
