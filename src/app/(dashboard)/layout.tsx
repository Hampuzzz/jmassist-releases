import { Sidebar } from "@/components/layout/Sidebar";
import { Header } from "@/components/layout/Header";
import { SWRProvider } from "@/lib/swr/config";
import { EnrichmentProvider } from "@/components/layout/EnrichmentProvider";
import { EnrichmentBar } from "@/components/layout/EnrichmentBar";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <SWRProvider>
      <EnrichmentProvider>
        <div className="flex h-screen overflow-hidden bg-workshop-bg">
          <Sidebar />
          <div className="flex flex-col flex-1 overflow-hidden">
            <Header />
            <main className="flex-1 overflow-y-auto p-4 md:p-6 pb-20">
              {children}
            </main>
          </div>
        </div>
        <EnrichmentBar />
      </EnrichmentProvider>
    </SWRProvider>
  );
}
