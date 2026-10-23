import { headers } from "next/headers";
import { countryFromHeaders } from "@/lib/payment-country";
import { PaymentCountryProvider } from "@/components/payment-country-provider";
import { AppShell } from "@/components/app-shell";
import { BusinessToolsProvider, OwnerArea } from "@/components/business-tools-provider";
export default async function WorkspaceLayout({ children }: { children: React.ReactNode }) {
  const country = countryFromHeaders(await headers());
  return (
    <PaymentCountryProvider country={country}>
      <BusinessToolsProvider>
        <AppShell>
          <OwnerArea>{children}</OwnerArea>
        </AppShell>
      </BusinessToolsProvider>
    </PaymentCountryProvider>
  );
}
