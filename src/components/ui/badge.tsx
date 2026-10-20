import type { HTMLAttributes } from "react";
import { cn } from "@/lib/ui";
const tones = { neutral: "bg-elevated text-secondary", accent: "bg-elevated text-accent", success: "bg-success-surface text-success", warning: "bg-warning-surface text-warning", danger: "bg-danger-surface text-danger" };
export function Badge({ tone = "neutral", className, ...props }: HTMLAttributes<HTMLSpanElement> & { tone?: keyof typeof tones }) {
  return <span {...props} className={cn("inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold", tones[tone], className)} />;
}
