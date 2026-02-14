import { redirect } from "next/navigation";
import { LandingPage } from "@/components/landing/landing-page";

export default function Home() {
  if (process.env["NEXT_PUBLIC_DEMO_MODE"] === "true") {
    return <LandingPage />;
  }

  redirect("/dashboard");
}
