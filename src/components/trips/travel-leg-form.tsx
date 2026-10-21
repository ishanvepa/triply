"use client";

import { useActionState, useEffect, useId, useRef } from "react";
import { createTravelLeg, updateTravelLeg } from "@/app/(app)/trips/[tripId]/legs/actions";
import { Button, ButtonLink } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ErrorMessage } from "@/components/ui/error-message";
import { airportOptions } from "@/lib/airports";
import type { TravelLegValues } from "@/lib/trips/validation";

export function TravelLegForm({ tripId, initialValues, leg, locked = false }: {
  tripId: string; initialValues: TravelLegValues; leg?: { id: string; updatedAt: string }; locked?: boolean;
}) {
  const submit = leg ? updateTravelLeg.bind(null, tripId, leg.id, leg.updatedAt) : createTravelLeg.bind(null, tripId);
  const [state, action, pending] = useActionState(submit, {});
  const ref = useRef<HTMLFormElement>(null);
  const airportList = useId();
  const backHref = leg ? `/trips/${tripId}/legs/${leg.id}` : `/trips/${tripId}`;
  const values = state.values ?? initialValues;
  useEffect(() => {
    if (state.fields) ref.current?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus();
  }, [state]);
  return <form ref={ref} action={action} aria-label={leg ? "Edit travel leg" : "Add travel leg"} className="space-y-6">
    {locked && <p className="text-sm leading-6 text-secondary">This leg has flight proposals. Its route and date are locked to keep those proposals consistent. You can still reorder it on the trip dashboard.</p>}
    {(state.error || state.fields) && <ErrorMessage>{state.error || "Check the highlighted fields and try again."}</ErrorMessage>}
    <fieldset disabled={pending || locked} className="min-w-0 space-y-5">
      <legend className="sr-only">Travel leg details</legend>
      <Input id="leg-origin" name="originAirport" label="Origin airport" placeholder="BCN" required maxLength={3} pattern="[A-Za-z]{3}"
        autoComplete="off" autoCapitalize="characters" list={airportList} defaultValue={values.originAirport}
        error={state.fields?.originAirport} hint="Use a three-letter airport code, such as BCN." />
      <Input id="leg-destination" name="destinationAirport" label="Destination airport" placeholder="LIS" required maxLength={3} pattern="[A-Za-z]{3}"
        autoComplete="off" autoCapitalize="characters" list={airportList} defaultValue={values.destinationAirport}
        error={state.fields?.destinationAirport} hint="Choose a different airport from your origin." />
      <datalist id={airportList}>{airportOptions.map(airport => <option key={airport.code} value={airport.code}>{airport.city}</option>)}</datalist>
      <Input id="leg-date" name="travelDate" label="Travel date" type="date" required min="0001-01-01" max="9999-12-31"
        defaultValue={values.travelDate} error={state.fields?.travelDate} hint="The departure date at your origin airport." />
    </fieldset>
    <div className="flex flex-col gap-3 sm:flex-row">
      {!locked && <Button type="submit" loading={pending}>{pending ? "Saving travel leg…" : leg ? "Save changes" : "Add travel leg"}</Button>}
      {pending ? <Button variant="ghost" disabled>Cancel</Button> : <ButtonLink href={backHref} variant="ghost">{locked ? "Back to proposals" : "Cancel"}</ButtonLink>}
    </div>
  </form>;
}
