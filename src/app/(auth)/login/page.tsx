import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AuthForm } from "@/components/auth/auth-form";
import { ErrorMessage } from "@/components/ui/error-message";
import { PageHeader } from "@/components/ui/page-header";
import { getCurrentUser } from "@/lib/auth/session";
import { getSafeNextPath } from "@/lib/auth/redirect";
import { isGoogleAuthEnabled } from "@/lib/auth/config";

export const metadata: Metadata = { title: "Sign in" };
export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string; error?: string; message?: string }> }) {
  const params = await searchParams;
  const next = getSafeNextPath(params.next);
  if (await getCurrentUser()) redirect(next);
  const error = params.error === "invalid-link"
    ? "This sign-in link is invalid or has expired. Sign in with your email and password, or create an account."
    : params.error === "oauth-cancelled" ? "Google sign-in was cancelled. You can try again or use email." : null;
  return <>
    <PageHeader title="Welcome back" description="Sign in to plan your next adventure together." />
    {error && <ErrorMessage className="mb-6">{error}</ErrorMessage>}
    {params.message === "signed-out" && <p role="status" className="mb-6 text-sm text-accent">You&apos;ve been signed out.</p>}
    <AuthForm mode="login" next={next} googleEnabled={isGoogleAuthEnabled()} />
  </>;
}
