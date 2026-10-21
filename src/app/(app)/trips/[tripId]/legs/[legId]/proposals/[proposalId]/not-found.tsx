import { EmptyState } from "@/components/ui/empty-state";
import { ButtonLink } from "@/components/ui/button";

export default function ProposalNotFound() {
  return <EmptyState title="Proposal unavailable" description="This proposal may no longer exist, or you may not have access to this trip."
    action={<ButtonLink href="/trips" variant="outline">Back to trips</ButtonLink>} />;
}
