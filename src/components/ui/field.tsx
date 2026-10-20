import type { ReactNode } from "react";
export type FieldProps = { id: string; label: string; error?: string; hint?: string };
export function fieldDescription({ id, error, hint }: FieldProps, extra?: string) {
  return [extra, hint && `${id}-hint`, error && `${id}-error`].filter(Boolean).join(" ") || undefined;
}
export function Field({ id, label, error, hint, children }: FieldProps & { children: ReactNode }) {
  return <div className="space-y-2">
    <label htmlFor={id} className="block text-sm font-semibold">{label}</label>
    {children}
    {hint && <p id={`${id}-hint`} className="text-xs leading-5 text-secondary">{hint}</p>}
    {error && <p id={`${id}-error`} className="text-sm text-danger">{error}</p>}
  </div>;
}
