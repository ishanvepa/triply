import { PageHeader } from "@/components/ui/page-header";
import { LoadingState } from "@/components/ui/loading-state";
import { Card } from "@/components/ui/card";

export default function TripsLoading() {
  return <div>
    <PageHeader title="Your trips" description="Plan together. Decide together." />
    <LoadingState label="Loading your trips…" />
    <div aria-hidden="true" className="grid gap-5 sm:grid-cols-2">
      {[0, 1].map(index => <Card key={index} className="space-y-5 motion-safe:animate-pulse">
        <div className="h-5 w-2/3 rounded bg-elevated" /><div className="h-4 w-1/2 rounded bg-elevated" />
      </Card>)}
    </div>
  </div>;
}
