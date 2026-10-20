"use client";

import Link from "next/link";
import { useActionState } from "react";
import { login, signup, signInWithGoogle } from "@/app/(auth)/actions";
import { TextField } from "./text-field";
import { Button } from "@/components/ui/button";
import { ErrorMessage } from "@/components/ui/error-message";

export function AuthForm({ mode, next, googleEnabled }: {
  mode: "login" | "signup"; next: string; googleEnabled: boolean;
}) {
  const isSignup = mode === "signup";
  const [state, action, pending] = useActionState(isSignup ? signup : login, {});
  const [googleState, googleAction, googlePending] = useActionState(signInWithGoogle, {});
  const otherPage = `${isSignup ? "/login" : "/signup"}?${new URLSearchParams({ next })}`;
  if (state.confirmationEmail) return (
    <div className="space-y-5">
      <div role="status" className="rounded-xl border border-accent/30 bg-elevated p-5">
        <h2 className="text-lg font-semibold">Check your email</h2>
        <p className="mt-2 break-words text-sm leading-6 text-secondary">
          If this address can be registered, you&apos;ll receive a confirmation link at{" "}
          <strong className="font-medium text-foreground">{state.confirmationEmail}</strong>.
          Open it to finish creating your account.
        </p>
      </div>
      <p className="text-sm leading-6 text-secondary">Already confirmed? <Link className="ui-link" href={otherPage}>Sign in</Link></p>
    </div>
  );
  return (
    <div className="space-y-6">
      <form action={action} className="space-y-5">
        <input type="hidden" name="next" value={next} />
        {isSignup && <TextField id="fullName" name="fullName" label="Your name" autoComplete="name"
          defaultValue={state.values?.fullName} error={state.fields?.fullName} required maxLength={80} disabled={pending} />}
        <TextField id="email" name="email" type="email" label="Email address" autoComplete="email"
          defaultValue={state.values?.email} error={state.fields?.email} required maxLength={254}
          autoCapitalize="none" spellCheck={false} disabled={pending} />
        <TextField id="password" name="password" type="password" label="Password"
          autoComplete={isSignup ? "new-password" : "current-password"}
          error={state.fields?.password} required minLength={isSignup ? 8 : 1} maxLength={128}
          hint={isSignup ? "Use at least 8 characters." : undefined} disabled={pending} />
        {state.error && <ErrorMessage>{state.error}</ErrorMessage>}
        <Button className="w-full" type="submit" loading={pending} disabled={googlePending}>
          {pending ? (isSignup ? "Creating account…" : "Signing in…") : (isSignup ? "Create account" : "Sign in")}
        </Button>
      </form>
      {googleEnabled && <div className="space-y-4">
        <div className="flex items-center gap-4 text-xs text-secondary"><span className="h-px flex-1 bg-border" />or<span className="h-px flex-1 bg-border" /></div>
        <form action={googleAction}>
          <input type="hidden" name="next" value={next} />
          <Button type="submit" disabled={pending} loading={googlePending} variant="outline" className="w-full">
            {googlePending ? "Connecting…" : "Continue with Google"}
          </Button>
        </form>
        {googleState.error && <ErrorMessage>{googleState.error}</ErrorMessage>}
      </div>}
      <p className="text-center text-sm text-secondary">
        {isSignup ? "Already have an account? " : "New here? "}
        <Link href={otherPage} className="ui-link">{isSignup ? "Sign in" : "Create an account"}</Link>
      </p>
    </div>
  );
}
