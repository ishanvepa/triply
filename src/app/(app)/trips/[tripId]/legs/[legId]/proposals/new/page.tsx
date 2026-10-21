import { notFound } from "next/navigation";
import { getFlightLegContext } from "@/lib/flights/queries";
import { PageHeader } from "@/components/ui/page-header";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";

export const metadata = { title: "Add a flight" };
export default async function AddFlightPage({ params }: { params: Promise<{ tripId: string; legId: string }> }) {
  const { tripId, legId } = await params;
  const context = await getFlightLegContext(tripId, legId);
  if (!context) notFound();
  const back = `/trips/${tripId}/legs/${legId}`;
  return <div className="max-w-xl space-y-6">
    <PageHeader title="Add a flight" description="Choose one way to add a candidate flight." backHref={back} />
    {context.leg.selected_proposal_id ? <EmptyState title="Proposals are closed" description="A flight has already been selected for this travel leg."
      action={<ButtonLink href={back} variant="outline">Back to flight options</ButtonLink>} /> : <>
      <p className="text-xs font-semibold uppercase text-accent">Only one method is required</p>
      <div className="space-y-4">
        <Card className="space-y-2"><div className="flex flex-wrap items-center justify-between gap-2"><h2 className="font-bold">↗ Paste a booking link</h2><Badge>Coming soon</Badge></div><p className="text-xs leading-5 text-secondary">Import flight details from an airline or travel site.</p></Card>
        <Card className="space-y-2"><div className="flex flex-wrap items-center justify-between gap-2"><h2 className="font-bold">✈ Enter airline + flight number</h2><Badge>Coming soon</Badge></div><p className="text-xs leading-5 text-secondary">Look up a flight by carrier and flight code.</p></Card>
        <Card elevated className="space-y-2"><h2 className="font-bold">✎ Enter details manually</h2><p className="text-xs leading-5 text-secondary">Fill in airports, schedule, and optional price.</p><p className="text-xs font-semibold text-accent">Selected ✓</p></Card>
      </div>
      <ButtonLink href={`${back}/proposals/new/manual`}>Continue →</ButtonLink>
    </>}
  </div>;
}
