import Link from "next/link";
import { getSession } from "@/lib/auth/session";
import { redirect } from "next/navigation";
import { ThemeToggle } from "@/components/theme-toggle";

const NAV_ITEMS = [
  { href: "/dashboard", label: "Dashboard", icon: "~" },
  { href: "/transactions", label: "Transactions", icon: "$" },
  { href: "/categories", label: "Categories", icon: "#" },
  { href: "/accounts", label: "Accounts", icon: ">" },
  { href: "/recurring", label: "Recurring", icon: "@" },
  { href: "/forecast", label: "Forecast", icon: "%" },
];

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
        <nav className="flex flex-col gap-0.5 p-2">
          {NAV_ITEMS.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="flex items-center gap-3 rounded-md px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
            >
              <span className="font-mono text-xs opacity-50">{item.icon}</span>
              {item.label}
            </Link>
          ))}
        </nav>
      </aside>

      {/* Mobile header */}
      <div className="flex flex-1 flex-col">
        <header className="flex h-14 items-center justify-between border-b border-border px-4 md:hidden">
          <span className="font-mono text-lg font-bold text-foreground">
            safam
          </span>
          <ThemeToggle />
        </header>

        {/* Mobile nav */}
        <nav className="flex gap-1 overflow-x-auto border-b border-border px-2 py-1.5 md:hidden">
          {NAV_ITEMS.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="shrink-0 rounded-md px-3 py-1.5 text-xs text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
            >
              {item.label}
            </Link>
          ))}
        </nav>

        {/* Main content */}
        <main className="flex-1 p-4 md:p-6">{children}</main>
      </div>
    </div>
  );
}
