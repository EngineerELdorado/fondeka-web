import { AppShell } from "@/components/app-shell";
import { BusinessToolsProvider, OwnerArea } from "@/components/business-tools-provider";
export default function WorkspaceLayout({ children }: { children: React.ReactNode }) {
  return (
    <BusinessToolsProvider>
      <AppShell>
        <OwnerArea>{children}</OwnerArea>
      </AppShell>
    </BusinessToolsProvider>
  );
}
