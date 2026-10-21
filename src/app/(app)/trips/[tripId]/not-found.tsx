import { EmptyState } from "@/components/ui/empty-state";
import { ButtonLink } from "@/components/ui/button";

export default function TripNotFound() {
  return <EmptyState title="Trip unavailable" description="This trip may no longer exist, or you may not be a member."
    action={<ButtonLink href="/trips" variant="outline">Back to trips</ButtonLink>} />;
}
