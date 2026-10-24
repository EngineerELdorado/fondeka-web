"use client";
import { useEffect, useState } from "react";
import { useWorkspace } from "@/components/workspace-provider";
import { methodKey, type PaymentContext, type PaymentMethod } from "./business-tools";
import { checkWalletEligibility, type WalletEligibility } from "./wallet-eligibility";
import { usePaymentLanguage } from "./use-payment-language";
import { request } from "./data";

export function useAffordableWallets(
  methods: PaymentMethod[],
  context: PaymentContext,
  baseAmount: number,
  country?: string,
) {
  const { accountKey, version } = useWorkspace();
  const language = usePaymentLanguage();
  const [revision, setRevision] = useState(0);
  const [state, setState] = useState<{ key: string; results: WalletEligibility[] }>();
  const enabled = context.action === "BUSINESS_TOOLS_ACCESS";
  const wallets = methods.filter((method) => method.type === "BALANCE");
  const input = JSON.stringify({
    accountKey,
    version,
    revision,
    language,
    country,
    baseAmount,
    context,
    wallets: wallets.map(({ id, name, type, currency, fiatWalletId, balance, walletEnabled }) => ({
      id,
      name,
      type,
      currency,
      fiatWalletId,
      balance,
      walletEnabled,
    })),
  });
  useEffect(() => {
    if (!enabled || !accountKey) return;
    const value = JSON.parse(input) as {
      wallets: PaymentMethod[];
      context: PaymentContext;
      language: string;
    };
    if (!value.wallets.length) return;
    let active = true;
    const abort = new AbortController();
    const timer = setTimeout(() => {
      void checkWalletEligibility(
        value.wallets,
        value.context,
        (path, signal) => request(path, { signal, headers: { "Accept-Language": value.language } }),
        abort.signal,
      )
        .then((results) => {
          if (active) setState({ key: input, results });
        })
        .catch(() => {
          if (active)
            setState({
              key: input,
              results: value.wallets.map((method) => ({
                key: methodKey(method),
                status: "unavailable",
              })),
            });
        });
    }, 0);
    return () => {
      active = false;
      clearTimeout(timer);
      abort.abort();
    };
  }, [input, enabled, accountKey]);
  const results = state?.key === input ? state.results : undefined;
  return {
    methods: enabled
      ? methods.filter(
          (method) =>
            method.type !== "BALANCE" ||
            results?.some(
              (result) => result.key === methodKey(method) && result.status === "eligible",
            ),
        )
      : methods,
    checking: enabled && wallets.length > 0 && !results,
    unavailable: enabled && !!results?.some((result) => result.status === "unavailable"),
    showWallets: enabled && wallets.length > 0,
    retry: () => setRevision((value) => value + 1),
  };
}
