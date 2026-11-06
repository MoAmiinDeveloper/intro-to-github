import * as React from "react";
import { cn } from "@/lib/utils";

const base =
  "w-full rounded-md border border-gray-300 bg-white px-3 text-sm text-gray-900 placeholder:text-gray-400 focus:border-navy-400 focus:outline-none focus:ring-2 focus:ring-navy-100 disabled:bg-gray-50 disabled:text-gray-500";

export const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(function Input(
  { className, ...props },
  ref,
) {
  return <input ref={ref} className={cn(base, "h-9", className)} {...props} />;
});

export const Textarea = React.forwardRef<HTMLTextAreaElement, React.TextareaHTMLAttributes<HTMLTextAreaElement>>(
  function Textarea({ className, ...props }, ref) {
    return <textarea ref={ref} className={cn(base, "py-2 min-h-[80px]", className)} {...props} />;
  },
);

export const Select = React.forwardRef<HTMLSelectElement, React.SelectHTMLAttributes<HTMLSelectElement>>(function Select(
  { className, ...props },
  ref,
) {
  return <select ref={ref} className={cn(base, "h-9 pr-8", className)} {...props} />;
});

export function Label({ className, ...props }: React.LabelHTMLAttributes<HTMLLabelElement>) {
  return <label className={cn("block text-sm font-medium text-gray-700", className)} {...props} />;
}

export function Checkbox({ label, className, ...props }: React.InputHTMLAttributes<HTMLInputElement> & { label: React.ReactNode }) {
  return (
    <label className={cn("inline-flex items-center gap-2 text-sm text-gray-800 cursor-pointer", className)}>
      <input type="checkbox" className="h-4 w-4 rounded border-gray-300 accent-navy" {...props} />
      <span>{label}</span>
    </label>
  );
}

/** Label + control + help + error, the standard form row. */
export function Field({
  label,
  htmlFor,
  error,
  help,
  required,
  className,
  children,
}: {
  label: string;
  htmlFor?: string;
  error?: string;
  help?: string;
  required?: boolean;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={cn("space-y-1", className)}>
      <Label htmlFor={htmlFor}>
        {label}
        {required && <span className="text-red-600"> *</span>}
      </Label>
      {children}
      {help && !error && <p className="text-xs text-gray-500">{help}</p>}
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  );
}
