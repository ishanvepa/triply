import type { SelectHTMLAttributes } from "react";
import { cn } from "@/lib/ui";
import { Field, fieldDescription, type FieldProps } from "./field";
// Native select preserves mobile pickers, keyboard navigation, and form behavior.
export function Select({ id, label, error, hint, className, children, "aria-describedby": describedBy, ...props }:
  SelectHTMLAttributes<HTMLSelectElement> & FieldProps) {
  const field = { id, label, error, hint };
  return <Field {...field}><select {...props} id={id} aria-invalid={error ? true : props["aria-invalid"]}
    aria-describedby={fieldDescription(field, describedBy)} className={cn("ui-control", className)}>{children}</select></Field>;
}
