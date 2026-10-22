import { LoadingState } from "@/components/ui/loading-state";
import { Card } from "@/components/ui/card";

export default function SelectedFlightLoading() {
  return <div className="space-y-5"><LoadingState label="Loading selected flight…" />
    <Card elevated className="h-72 motion-safe:animate-pulse" /><Card className="h-44 motion-safe:animate-pulse" /></div>;
}
