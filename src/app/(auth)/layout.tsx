import { getSession } from "@/lib/auth/session";
import { redirect } from "next/navigation";
import { SafamLogo } from "@/components/safam-logo";

export default async function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getSession();
  if (session) {
    redirect("/dashboard");
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex flex-col items-center text-center">
          <SafamLogo size={32} textClassName="font-mono text-2xl font-bold text-foreground" />
          <p className="mt-1 text-sm text-muted-foreground">
            Family budget manager
          </p>
        </div>
        {children}
      </div>
    </div>
  );
}
