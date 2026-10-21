"use client";

import { useActionState, useEffect, useRef } from "react";
import { moveTravelLeg } from "@/app/(app)/trips/[tripId]/legs/actions";
import { Button } from "@/components/ui/button";
import { ErrorMessage } from "@/components/ui/error-message";
import { TravelLegCard } from "./travel-leg-card";
import type { LegSummary } from "@/lib/trips/dashboard";

export function TravelLegList({ tripId, legs, organizer }: { tripId: string; legs: LegSummary[]; organizer: boolean }) {
  const [state, action, pending] = useActionState(moveTravelLeg.bind(null, tripId, legs.map(leg => leg.id)), {});
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!pending && state.movedLegId) ref.current?.querySelector<HTMLAnchorElement>(`a[href="/trips/${tripId}/legs/${state.movedLegId}"]`)?.focus();
  }, [pending, state, tripId]);
  return <div ref={ref} className="space-y-4">
    {!pending && state.error && <ErrorMessage>{state.error}</ErrorMessage>}
    {(pending || state.success) && <p role="status" className="text-sm text-success">{pending ? "Moving travel leg…" : state.success}</p>}
    <ol aria-label="Travel legs" className="space-y-4">
      {legs.map((leg, index) => <li key={leg.id} className="space-y-2">
        <TravelLegCard tripId={tripId} leg={leg} index={index} />
        {organizer && legs.length > 1 && <form action={action} aria-label={`Reorder leg ${index + 1}`} className="flex justify-end gap-2">
          <input type="hidden" name="legId" value={leg.id} />
          <Button type="submit" variant="ghost" name="direction" value="up" disabled={pending || index === 0}
            aria-label={`Move leg ${index + 1} up`}>↑ Up</Button>
          <Button type="submit" variant="ghost" name="direction" value="down" disabled={pending || index === legs.length - 1}
            aria-label={`Move leg ${index + 1} down`}>↓ Down</Button>
        </form>}
      </li>)}
    </ol>
  </div>;
}
