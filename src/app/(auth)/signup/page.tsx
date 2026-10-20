import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AuthForm } from "@/components/auth/auth-form";
import { PageHeader } from "@/components/ui/page-header";
import { getCurrentUser } from "@/lib/auth/session";
import { getSafeNextPath } from "@/lib/auth/redirect";
import { isGoogleAuthEnabled } from "@/lib/auth/config";

export const metadata: Metadata = { title: "Create an account" };
export default async function SignupPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const next = getSafeNextPath((await searchParams).next);
  if (await getCurrentUser()) redirect(next);
  return <>
    <PageHeader title="Good trips start here." description="Create your account and bring everyone along." />
    <AuthForm mode="signup" next={next} googleEnabled={isGoogleAuthEnabled()} />
  </>;
}
