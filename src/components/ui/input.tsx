import type { InputHTMLAttributes } from "react";
import { cn } from "@/lib/ui";
import { Field, fieldDescription, type FieldProps } from "./field";
export function Input({ id, label, error, hint, className, "aria-describedby": describedBy, ...props }:
  InputHTMLAttributes<HTMLInputElement> & FieldProps) {
  const field = { id, label, error, hint };
  return <Field {...field}><input {...props} id={id} aria-invalid={error ? true : props["aria-invalid"]}
    aria-describedby={fieldDescription(field, describedBy)} className={cn("ui-control", className)} /></Field>;
}
