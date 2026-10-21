import type { Metadata } from "next";
import { PageHeader } from "@/components/ui/page-header";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { ButtonLink } from "@/components/ui/button";
import { requireUser } from "@/lib/auth/session";
import { isInvitationToken, unavailableInvitation } from "@/lib/invitations";
import { JoinTripForm } from "@/components/trips/join-trip-form";

export const metadata: Metadata = { title: "Group invitations", robots: { index: false, follow: false }, referrer: "no-referrer" };
export default async function InvitationPage({ params }: { params: Promise<{ token: string }> }) {
  await requireUser();
  const { token } = await params;
  return <div className="max-w-lg">
    <PageHeader title="Group invitations" description="Good trips are better together." />
    {isInvitationToken(token) ? <Card className="space-y-5">
      <h2 className="text-lg font-bold">Join your friends</h2>
      <p className="text-sm leading-6 text-secondary">Accept this invitation to join the trip and start planning together.</p>
      <JoinTripForm token={token} />
    </Card> : <EmptyState title="Invitation unavailable" description={unavailableInvitation}
      action={<ButtonLink href="/trips" variant="outline">Back to trips</ButtonLink>} />}
  </div>;
}
