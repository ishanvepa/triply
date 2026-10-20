"use client";

import { useActionState } from "react";
import { updateProfile } from "@/app/(app)/settings/actions";
import { TextField } from "./text-field";
import { Button } from "@/components/ui/button";
import { ErrorMessage } from "@/components/ui/error-message";

export function ProfileForm({ displayName }: { displayName: string }) {
  const [state, action, pending] = useActionState(updateProfile, {});
  return <form action={action} className="space-y-5">
    <TextField id="fullName" name="fullName" label="Your name" autoComplete="name" required maxLength={80}
      defaultValue={state.values?.fullName ?? displayName} error={state.fields?.fullName} disabled={pending}
      hint="The name your travel group will see." />
    {state.error && <ErrorMessage>{state.error}</ErrorMessage>}
    {state.success && <p role="status" className="text-sm text-accent">{state.success}</p>}
    <Button className="w-full sm:w-auto" type="submit" loading={pending}>{pending ? "Saving…" : "Save changes"}</Button>
  </form>;
}
