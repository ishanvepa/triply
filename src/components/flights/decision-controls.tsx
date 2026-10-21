"use client";

import { useActionState, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { submitDecision } from "@/app/(app)/trips/[tripId]/legs/[legId]/decision/actions";
import { Button } from "@/components/ui/button";

export function RefreshDecision() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  return <Button variant="ghost" loading={pending} onClick={() => startTransition(() => router.refresh())}>Refresh results</Button>;
}

export function DecisionControls({ tripId, legId, proposalId, updatedAt, airline, ownVote, organizer, closed }: {
  tripId: string; legId: string; proposalId: string; updatedAt: string; airline: string;
  ownVote: string | null; organizer: boolean; closed: boolean;
}) {
  const [reviewing, setReviewing] = useState(false);
  const [state, action, pending] = useActionState(submitDecision.bind(null, tripId, legId, proposalId, updatedAt), {});
  return <div className="space-y-3">
    {closed ? <p className="text-sm text-secondary">Voting closed{ownVote === proposalId ? " · Your vote" : ""}</p> : <>
      <form action={action} aria-label={`Vote for ${airline}`}>
        <Button type="submit" name="intent" value="vote" variant="outline" loading={pending} disabled={ownVote === proposalId} className="w-full">
          {ownVote === proposalId ? "Your vote" : ownVote ? "Change vote to this flight" : "Vote for this flight"}
        </Button>
      </form>
      {organizer && (!reviewing ? <Button variant="ghost" onClick={() => setReviewing(true)} disabled={pending} className="w-full">Review decision →</Button>
        : <div className="space-y-3 rounded-card border border-accent p-4" role="region" aria-label={`Confirm ${airline} selection`}>
          <h3 className="font-bold">Select {airline}?</h3>
          <p className="text-sm leading-6 text-secondary">This selects the flight shown above for everyone and closes voting for this leg. The organizer may choose any option, regardless of votes.</p>
          <form action={action} className="space-y-2">
            <input type="hidden" name="confirmed" value="yes" />
            <Button type="submit" name="intent" value="select" loading={pending} className="w-full">Confirm selection</Button>
            <Button variant="ghost" onClick={() => setReviewing(false)} disabled={pending} className="w-full">Cancel</Button>
          </form>
        </div>)}
    </>}
    {state.error && <p role="alert" className="text-sm text-danger">{state.error}</p>}
    {state.success && <p role="status" className="text-sm text-success">{state.success}</p>}
  </div>;
}
