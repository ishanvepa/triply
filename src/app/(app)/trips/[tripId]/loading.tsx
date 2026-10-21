import { Card } from "@/components/ui/card";
import { LoadingState } from "@/components/ui/loading-state";

export default function DashboardLoading() {
  return <div className="space-y-6">
    <LoadingState label="Loading trip planning…" />
    <div aria-hidden="true" className="space-y-4 motion-safe:animate-pulse">
      <Card elevated><div className="h-16 rounded bg-border" /></Card>
      {[0, 1, 2].map(index => <Card key={index}><div className="h-20 rounded bg-elevated" /></Card>)}
    </div>
  </div>;
}
