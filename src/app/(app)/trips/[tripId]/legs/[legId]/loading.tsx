import { LoadingState } from "@/components/ui/loading-state";
import { Card } from "@/components/ui/card";

export default function FlightLoading() {
  return <div className="space-y-5"><LoadingState label="Loading flight options…" /><Card elevated className="h-24 motion-safe:animate-pulse" /><Card className="h-40 motion-safe:animate-pulse" /></div>;
}
