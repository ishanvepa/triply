import { requireUser } from "@/lib/auth/session";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { ButtonLink } from "@/components/ui/button";

export const metadata = { title: "New trip" };
// Protected navigation destination; the creation form is Step 2.2.
export default async function NewTripPage() {
  await requireUser();
  return <div>
    <PageHeader title="New trip" backHref="/trips" description="Make room for the next adventure." />
    <EmptyState title="More adventures ahead" description="Trip creation is coming soon."
      action={<ButtonLink href="/trips" variant="outline">Back to trips</ButtonLink>} />
  </div>;
}
