"use client";
import { useQuery } from "./use-query";
import { currencyChoices } from "./currency-choices";
export function useCurrencies(existing: string[] = []) {
  const result = useQuery<unknown>("/customer-api/fiat-wallets/currencies");
  return { ...result, currencies: currencyChoices(result.data, existing) };
}
