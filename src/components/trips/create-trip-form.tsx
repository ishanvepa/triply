"use client";

import { useActionState, useEffect, useRef } from "react";
import { createTrip } from "@/app/(app)/trips/new/actions";
import { Button, ButtonLink } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { ErrorMessage } from "@/components/ui/error-message";

export function CreateTripForm() {
  const [state, action, pending] = useActionState(createTrip, {});
  const ref = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (state.fields) ref.current?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus();
  }, [state]);

  return <form ref={ref} action={action} aria-label="Create trip" className="space-y-6">
    {(state.error || state.fields) && <ErrorMessage>{state.error || "Check the highlighted fields and try again."}</ErrorMessage>}
    <fieldset disabled={pending} className="min-w-0 space-y-5">
      <legend className="sr-only">Trip details</legend>
      <Input id="trip-name" name="name" label="Trip name" placeholder="Europe winter trip" required maxLength={120}
        autoComplete="off" defaultValue={state.values?.name} error={state.fields?.name} />
      <div className="grid min-w-0 grid-cols-1 gap-5 sm:grid-cols-2">
        <Input id="trip-start" name="startDate" label="Start date" type="date" min="0001-01-01" max="9999-12-31" required
          defaultValue={state.values?.startDate} error={state.fields?.startDate} />
        <Input id="trip-end" name="endDate" label="End date" type="date" min="0001-01-01" max="9999-12-31" required
          defaultValue={state.values?.endDate} error={state.fields?.endDate} hint="On or after your start date." />
      </div>
      <Textarea id="trip-description" name="description" label="Description (optional)" rows={4} maxLength={5000}
        placeholder="A few ideas for the adventure…" defaultValue={state.values?.description} error={state.fields?.description}
        hint="Share a little about the plan. Up to 5,000 characters." />
    </fieldset>
    <div className="flex flex-col gap-3 sm:flex-row">
      <Button type="submit" loading={pending} className="w-full sm:w-auto">{pending ? "Creating trip…" : "Create trip"}</Button>
      {pending ? <Button variant="ghost" disabled>Cancel</Button> : <ButtonLink href="/trips" variant="ghost">Cancel</ButtonLink>}
    </div>
  </form>;
}
