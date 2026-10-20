"use client";

import { useActionState } from "react";
import { logout } from "@/app/(auth)/actions";
import { Button } from "@/components/ui/button";
import { ErrorMessage } from "@/components/ui/error-message";

export function LogoutButton() {
  const [state, action, pending] = useActionState(logout, {});
  return <form action={action}>
    <Button type="submit" loading={pending} variant="ghost">{pending ? "Signing out…" : "Sign out"}</Button>
    {state.error && <ErrorMessage className="mt-2 max-w-xs">{state.error}</ErrorMessage>}
  </form>;
}
