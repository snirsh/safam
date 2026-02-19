import { getSession } from "@/lib/auth/session";
import { redirect } from "next/navigation";
import { ThemeToggle } from "@/components/theme-toggle";
import { SidebarNav } from "@/components/navigation/sidebar-nav";
import { MobileNav } from "@/components/navigation/mobile-nav";
import { RefreshButton } from "@/components/navigation/refresh-button";
import { DemoBanner } from "@/components/demo-banner";
import { SafamLogo } from "@/components/safam-logo";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getSession();
  if (!session) {
    redirect("/login");
  }

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <DemoBanner />
      <div className="flex flex-1">
      {/* Sidebar */}
      <aside className="hidden w-56 shrink-0 border-r border-border bg-card md:block">
        <div className="flex h-14 items-center justify-between border-b border-border px-4">
          <SafamLogo size={22} />
          <ThemeToggle />
        </div>
        <SidebarNav />
      </aside>

      {/* Mobile header + content */}
      <div className="flex flex-1 flex-col">
        <header className="flex h-14 items-center justify-between border-b border-border px-4 md:hidden">
          <SafamLogo size={22} />
          <div className="flex items-center gap-2">
            <RefreshButton />
            <ThemeToggle />
          </div>
        </header>

        {/* Main content — pb-20 for mobile bottom nav clearance */}
        <main className="min-w-0 flex-1 overflow-x-hidden p-4 pb-20 md:p-6 md:pb-6">{children}</main>
      </div>

      {/* Bottom tab bar (mobile only) */}
      <MobileNav />
      </div>
    </div>
  );
}
