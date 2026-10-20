import Link from "next/link";
import type { ComponentProps, ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/ui";

type Variant = "primary" | "outline" | "ghost";
type StyleProps = { variant?: Variant; className?: string };
export function buttonStyles({ variant = "primary", className }: StyleProps = {}) {
  return cn("ui-button", `ui-button-${variant}`, className);
}
export function Button({ variant, className, loading = false, disabled, children, type = "button", ...props }:
  ButtonHTMLAttributes<HTMLButtonElement> & StyleProps & { loading?: boolean }) {
  return <button {...props} type={type} disabled={disabled || loading} aria-busy={loading || undefined}
    className={buttonStyles({ variant, className })}>
    {loading && <span aria-hidden="true" className="size-4 animate-spin rounded-full border-2 border-current border-r-transparent" />}
    {children}
  </button>;
}
export function ButtonLink({ variant, className, ...props }: ComponentProps<typeof Link> & StyleProps) {
  return <Link {...props} className={buttonStyles({ variant, className })} />;
}
