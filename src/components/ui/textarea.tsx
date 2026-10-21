import type { TextareaHTMLAttributes } from "react";
import { cn } from "@/lib/ui";
import { Field, fieldDescription, type FieldProps } from "./field";

export function Textarea({ id, label, error, hint, className, "aria-describedby": describedBy, ...props }:
  TextareaHTMLAttributes<HTMLTextAreaElement> & FieldProps) {
  const field = { id, label, error, hint };
  return <Field {...field}><textarea {...props} id={id} aria-invalid={error ? true : props["aria-invalid"]}
    aria-describedby={fieldDescription(field, describedBy)} className={cn("ui-control min-h-32 resize-y", className)} /></Field>;
}
