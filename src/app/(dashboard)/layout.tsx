import { getSession } from "@/lib/auth/session";
import { redirect } from "next/navigation";
import { ThemeToggle } from "@/components/theme-toggle";
import { SidebarNav } from "@/components/navigation/sidebar-nav";
import { MobileNav } from "@/components/navigation/mobile-nav";
import { RefreshButton } from "@/components/navigation/refresh-button";

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
    <div className="flex min-h-screen bg-background">
      {/* Sidebar */}
      <aside className="hidden w-56 shrink-0 border-r border-border bg-card md:block">
        <div className="flex h-14 items-center justify-between border-b border-border px-4">
          <span className="font-mono text-lg font-bold text-foreground">
            safam
          </span>
          <ThemeToggle />
        </div>
        <SidebarNav />
      </aside>

      {/* Mobile header + content */}
      <div className="flex flex-1 flex-col">
        <header className="flex h-14 items-center justify-between border-b border-border px-4 md:hidden">
          <span className="font-mono text-lg font-bold text-foreground">
            safam
          </span>
          <div className="flex items-center gap-2">
            <RefreshButton />
            <ThemeToggle />
          </div>
        </header>

        {/* Main content — pb-20 for mobile bottom nav clearance */}
        <main className="flex-1 p-4 pb-20 md:p-6 md:pb-6">{children}</main>
      </div>

      {/* Bottom tab bar (mobile only) */}
      <MobileNav />
    </div>
  );
}
