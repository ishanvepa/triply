import type { HTMLAttributes } from "react";
import { cn } from "@/lib/ui";
export function Card({ className, elevated = false, ...props }: HTMLAttributes<HTMLDivElement> & { elevated?: boolean }) {
  return <div {...props} className={cn("rounded-card border border-border p-4 sm:p-5", elevated ? "bg-elevated" : "bg-surface", className)} />;
}
