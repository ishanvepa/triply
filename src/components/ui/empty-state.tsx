import type { ReactNode } from "react";
import { Card } from "./card";
export function EmptyState({ title, description, icon = "✈", action }: { title: string; description: string; icon?: ReactNode; action?: ReactNode }) {
  return <Card className="flex flex-col items-center gap-4 py-10 text-center">
    <span aria-hidden="true" className="flex size-12 items-center justify-center rounded-full bg-elevated text-2xl text-accent">{icon}</span>
    <h2 className="text-base font-bold">{title}</h2>
    <p className="max-w-sm text-sm leading-6 text-secondary">{description}</p>
    {action && <div className="mt-2">{action}</div>}
  </Card>;
}
