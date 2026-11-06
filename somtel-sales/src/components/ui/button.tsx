import * as React from "react";
import { cn } from "@/lib/utils";

const variants = {
  primary: "bg-gold text-navy hover:bg-gold-300 font-semibold shadow-sm",
  navy: "bg-navy text-white hover:bg-navy-600",
  outline: "border border-gray-300 bg-white text-gray-800 hover:bg-gray-50",
  ghost: "text-gray-700 hover:bg-gray-100",
  danger: "bg-red-600 text-white hover:bg-red-700",
  link: "text-navy underline-offset-2 hover:underline px-0",
} as const;

const sizes = {
  sm: "h-8 px-3 text-sm",
  md: "h-9 px-4 text-sm",
  lg: "h-10 px-5",
  icon: "h-8 w-8 p-0",
} as const;

export type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: keyof typeof variants;
  size?: keyof typeof sizes;
};

export function buttonClass(variant: keyof typeof variants = "primary", size: keyof typeof sizes = "md", className?: string) {
  return cn(
    "inline-flex items-center justify-center gap-2 rounded-md transition-colors disabled:opacity-50 disabled:pointer-events-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-navy-300 whitespace-nowrap",
    variants[variant],
    sizes[size],
    className,
  );
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { className, variant = "primary", size = "md", ...props },
  ref,
) {
  return <button ref={ref} className={buttonClass(variant, size, className)} {...props} />;
});
