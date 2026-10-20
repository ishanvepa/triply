import type { Metadata } from "next";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/empty-state";

export const metadata: Metadata = { title: "Trips" };
// Only the authenticated route boundary; trip workflows are Phase 2.
export default function TripsPage() {
  return <div className="max-w-lg">
    <PageHeader title="Your next adventure" description="Plan together. Decide together." />
    <EmptyState title="A shared space for your people" description="Trip planning is coming soon." />
  </div>;
}
