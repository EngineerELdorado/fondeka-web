import { headers } from "next/headers";
import { countryFromHeaders } from "@/lib/payment-country";
import { PaymentCountryProvider } from "@/components/payment-country-provider";
import { AppShell } from "@/components/app-shell";
import { BusinessToolsProvider, OwnerArea } from "@/components/business-tools-provider";
import { WorkspaceProvider } from "@/components/workspace-provider";
export default async function WorkspaceLayout({ children }: { children: React.ReactNode }) {
  const country = countryFromHeaders(await headers());
  return (
    <WorkspaceProvider>
      <PaymentCountryProvider country={country}>
        <BusinessToolsProvider>
          <AppShell>
            <OwnerArea>{children}</OwnerArea>
          </AppShell>
        </BusinessToolsProvider>
      </PaymentCountryProvider>
    </WorkspaceProvider>
  );
}
