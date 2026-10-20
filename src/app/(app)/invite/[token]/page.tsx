import type { Metadata } from "next";
import { PageHeader } from "@/components/ui/page-header";

export const metadata: Metadata = { title: "Group invitations" };
// Authenticated return destination only. Token validation and accepting the
// invitation are implemented with the group workflow in Step 2.3.
export default function InvitationPage() {
  return <div className="max-w-lg">
    <PageHeader title="Group invitations" description="You’re signed in. Joining trips by invitation is coming soon." />
  </div>;
}
