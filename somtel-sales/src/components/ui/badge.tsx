import * as React from "react";
import { cn } from "@/lib/utils";

const tones = {
  gray: "bg-gray-100 text-gray-700",
  navy: "bg-navy-50 text-navy",
  gold: "bg-gold-100 text-navy",
  green: "bg-green-100 text-green-800",
  red: "bg-red-100 text-red-700",
  amber: "bg-amber-100 text-amber-800",
  blue: "bg-blue-100 text-blue-800",
} as const;

export type Tone = keyof typeof tones;

export function Badge({ tone = "gray", className, ...props }: React.HTMLAttributes<HTMLSpanElement> & { tone?: Tone }) {
  return (
    <span
      className={cn("inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium whitespace-nowrap", tones[tone], className)}
      {...props}
    />
  );
}
