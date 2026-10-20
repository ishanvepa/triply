export function LoadingState({ label = "Loading…" }: { label?: string }) {
  return <div role="status" className="flex items-center justify-center gap-3 py-8 text-sm text-secondary">
    <span aria-hidden="true" className="size-5 animate-spin rounded-full border-2 border-border border-t-accent" />{label}
  </div>;
}
