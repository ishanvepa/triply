import type { ReactNode } from "react";
import { cn } from "@/lib/ui";
export function ErrorMessage({ children, action, className }: { children: ReactNode; action?: ReactNode; className?: string }) {
  return <div role="alert" className={cn("space-y-3 rounded-card border border-danger/40 bg-danger-surface p-4 text-sm leading-6 text-danger", className)}>
    <p>{children}</p>{action}
  </div>;
}
