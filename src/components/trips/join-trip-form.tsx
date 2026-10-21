"use client";
import { useActionState } from "react";
import { acceptInvitation } from "@/app/(app)/invite/actions";
import { Button, ButtonLink } from "@/components/ui/button";
import { ErrorMessage } from "@/components/ui/error-message";

export function JoinTripForm({ token }: { token: string }) {
  const [state, action, pending] = useActionState(acceptInvitation.bind(null, token), {});
  return <form action={action} className="space-y-5">
    {state.error && <ErrorMessage>{state.error}</ErrorMessage>}
    <div className="flex flex-col gap-3 sm:flex-row">
      <Button type="submit" loading={pending}>{pending ? "Joining trip…" : "Join trip"}</Button>
      <ButtonLink href="/trips" variant="ghost">Back to trips</ButtonLink>
    </div>
  </form>;
}
