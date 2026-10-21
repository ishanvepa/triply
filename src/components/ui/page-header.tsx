import Link from "next/link";
import type { ReactNode } from "react";
export function PageHeader({ title, description, backHref, action }: { title: string; description?: string; backHref?: string; action?: ReactNode }) {
  return <header className="mb-8 space-y-3">
    {backHref && <Link href={backHref} aria-label="Go back" className="ui-link -ml-3 mb-2 inline-flex size-11 items-center justify-center text-3xl">‹</Link>}
    <div className="flex flex-wrap items-center justify-between gap-4"><h1 className="min-w-0 break-words text-page font-bold tracking-tight [overflow-wrap:anywhere]">{title}</h1>{action}</div>
    {description && <p className="max-w-prose text-sm leading-6 text-secondary">{description}</p>}
  </header>;
}
