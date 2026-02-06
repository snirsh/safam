import { getSession } from "@/lib/auth/session";
import { redirect } from "next/navigation";

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
        <div className="mb-8 text-center">
          <h1 className="font-mono text-2xl font-bold text-foreground">
            safam
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Family budget manager
          </p>
        </div>
        {children}
      </div>
    </div>
  );
}
