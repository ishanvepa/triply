"use client";

import { useActionState, useEffect, useRef } from "react";
import { createFlightProposal } from "@/app/(app)/trips/[tripId]/legs/[legId]/proposals/actions";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Button, ButtonLink } from "@/components/ui/button";
import { ErrorMessage } from "@/components/ui/error-message";
import type { FlightValues } from "@/lib/flights";

export function FlightForm({ tripId, legId, initialValues, knownDepartureZone, knownArrivalZone, zones }: {
  tripId: string; legId: string; initialValues: FlightValues; knownDepartureZone: boolean; knownArrivalZone: boolean; zones: string[];
}) {
  const [state, action, pending] = useActionState(createFlightProposal.bind(null, tripId, legId), {});
  const ref = useRef<HTMLFormElement>(null);
  const values = state.values ?? initialValues;
  useEffect(() => {
    if (state.fields) ref.current?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus();
  }, [state]);
  return <form action={action} ref={ref} aria-label="Propose flight" className="space-y-6">
    {(state.error || state.fields) && <ErrorMessage>{state.error || "Check the highlighted fields and try again."}</ErrorMessage>}
    <fieldset disabled={pending} className="min-w-0 space-y-5">
      <legend className="sr-only">Flight details</legend>
      <Card className="space-y-5">
        <h2 className="text-base font-bold">Route</h2>
        <div className="grid gap-5 sm:grid-cols-2">
          <Input id="flight-origin" name="originAirport" label="Origin airport" required readOnly defaultValue={values.originAirport} error={state.fields?.originAirport} hint="Matches this travel leg." />
          <Input id="flight-destination" name="destinationAirport" label="Destination airport" required readOnly defaultValue={values.destinationAirport} error={state.fields?.destinationAirport} hint="Matches this travel leg." />
        </div>
      </Card>
      {(["departure", "arrival"] as const).map(side => {
        const label = side === "departure" ? "Departure" : "Arrival";
        const dateKey = `${side}Date` as const;
        const timeKey = `${side}Time` as const;
        const zoneKey = `${side}Timezone` as const;
        const occurrenceKey = `${side}Occurrence` as const;
        const knownZone = side === "departure" ? knownDepartureZone : knownArrivalZone;
        return <Card key={side} className="space-y-5">
          <h2 className="text-base font-bold">{label}</h2>
          <div className="grid gap-5 sm:grid-cols-2">
            <Input id={`flight-${side}-date`} name={dateKey} label={`${label} date`} type="date" required min="0001-01-01" max="9999-12-31"
              readOnly={side === "departure"} defaultValue={values[dateKey]} error={state.fields?.[dateKey]} hint={side === "departure" ? "Matches the leg's departure date." : "Use the arrival airport's local date, including overnight arrivals."} />
            <Input id={`flight-${side}-time`} name={timeKey} label={`${label} time (24-hour)`} required inputMode="numeric" placeholder="09:30" maxLength={5}
              pattern="([01][0-9]|2[0-3]):[0-5][0-9]" defaultValue={values[timeKey]} error={state.fields?.[timeKey]} hint="HH:mm in the airport's local time." />
          </div>
          <Input id={`flight-${side}-zone`} name={zoneKey} label={`${label} time zone`} required readOnly={knownZone}
            list="flight-time-zones" placeholder="Europe/Lisbon" defaultValue={values[zoneKey]} error={state.fields?.[zoneKey]}
            hint={knownZone ? "Airport time zone." : "Enter the airport's IANA time zone; choose a suggestion or enter its full name."} />
          {(state.fields?.[occurrenceKey] || values[occurrenceKey]) && <Select id={`flight-${side}-occurrence`} name={occurrenceKey}
            label={`${label} clock occurrence`} defaultValue={values[occurrenceKey]} error={state.fields?.[occurrenceKey]}>
            <option value="">Choose which occurrence</option><option value="earlier">Earlier occurrence</option><option value="later">Later occurrence</option>
          </Select>}
        </Card>;
      })}
      <datalist id="flight-time-zones">{zones.map(zone => <option key={zone} value={zone} />)}</datalist>
      <Card className="space-y-5">
        <h2 className="text-base font-bold">Airline and flight</h2>
        <Input id="flight-airline" name="airline" label="Airline" required maxLength={120} autoComplete="off" placeholder="Vueling" defaultValue={values.airline} error={state.fields?.airline} />
        <Input id="flight-number" name="flightNumber" label="Flight number (optional)" maxLength={20} autoComplete="off" placeholder="VY123" defaultValue={values.flightNumber} error={state.fields?.flightNumber} />
      </Card>
      <Card className="space-y-5">
        <h2 className="text-base font-bold">Price and booking</h2>
        <div className="grid gap-5 sm:grid-cols-2">
          <Input id="flight-price" name="price" label="Price per person (optional)" inputMode="decimal" placeholder="89.00" defaultValue={values.price} error={state.fields?.price} hint="Up to two decimal places." />
          <Input id="flight-currency" name="currency" label="Currency" required maxLength={3} autoCapitalize="characters" defaultValue={values.currency} error={state.fields?.currency} hint="Three-letter code, such as EUR or USD." />
        </div>
        <Input id="flight-url" name="bookingUrl" label="Booking URL (optional)" type="url" maxLength={2048} placeholder="https://airline.example/flight" defaultValue={values.bookingUrl} error={state.fields?.bookingUrl} />
        <Textarea id="flight-notes" name="notes" label="Notes (optional)" rows={3} maxLength={5000} defaultValue={values.notes} error={state.fields?.notes} />
      </Card>
    </fieldset>
    <div className="flex flex-col gap-3 sm:flex-row">
      <Button type="submit" loading={pending}>{pending ? "Saving proposal…" : "Propose flight →"}</Button>
      {pending ? <Button variant="ghost" disabled>Cancel</Button> : <ButtonLink href={`/trips/${tripId}/legs/${legId}`} variant="ghost">Cancel</ButtonLink>}
    </div>
  </form>;
}
