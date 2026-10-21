import { Card } from "@/components/ui/card";

function Progress({ label, completed, total, description }: { label: string; completed: number; total: number; description: string }) {
  return <div className="space-y-3">
    <h2 className="text-sm font-bold">{label}</h2>
    <p className="text-xs leading-5 text-secondary">{description}</p>
    <div role="progressbar" aria-label={label} aria-valuemin={0} aria-valuemax={total || 1}
      aria-valuenow={completed} aria-valuetext={description} className="h-2 overflow-hidden rounded-full bg-border">
      <div className="h-full rounded-full bg-accent" style={{ width: `${total ? completed / total * 100 : 0}%` }} />
    </div>
  </div>;
}

export function PlanningProgress({ totalLegs, selectedLegs, booked, participating }: {
  totalLegs: number; selectedLegs: number; booked: number; participating: number;
}) {
  return <Card elevated className="grid gap-6 sm:grid-cols-2" role="region" aria-label="Trip progress">
    <Progress label="Planning progress" completed={selectedLegs} total={totalLegs}
      description={totalLegs ? `${selectedLegs} of ${totalLegs} legs have a selected flight` : "Add travel legs to start planning."} />
    <div className="space-y-2">
      <Progress label="Booking progress" completed={booked} total={participating}
        description={!selectedLegs ? "Select a flight to start tracking bookings."
          : !participating ? "No participating travelers on selected flights."
            : `${booked} of ${participating} traveler bookings complete`} />
      <p className="text-xs leading-5 text-secondary">Self-reported across selected flights. Travelers not joining are excluded.</p>
    </div>
  </Card>;
}
