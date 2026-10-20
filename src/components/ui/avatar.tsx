import { cn } from "@/lib/ui";
export function Avatar({ name, size = "md", className }: { name: string; size?: "sm" | "md" | "lg"; className?: string }) {
  const words = name.trim().split(/\s+/).filter(Boolean);
  const initials = (words.length > 1 ? words[0][0] + words.at(-1)![0] : words[0]?.slice(0, 2) || "?").toLocaleUpperCase();
  return <span role="img" aria-label={name.trim() || "Traveler"} className={cn("inline-flex shrink-0 items-center justify-center rounded-full border border-border bg-elevated font-bold text-accent", { sm: "size-8 text-xs", md: "size-11 text-sm", lg: "size-14 text-base" }[size], className)}>{initials}</span>;
}
