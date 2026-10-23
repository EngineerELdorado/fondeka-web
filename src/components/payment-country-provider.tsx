"use client";
import { createContext, useContext, type ReactNode } from "react";
const Context = createContext<string | undefined>(undefined);
export function PaymentCountryProvider({
  country,
  children,
}: {
  country?: string;
  children: ReactNode;
}) {
  return <Context.Provider value={country}>{children}</Context.Provider>;
}
export function useDetectedPaymentCountry() {
  return useContext(Context);
}
