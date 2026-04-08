"use client";

import { cn, formatLabel } from "@/lib/utils";

interface BadgeProps {
  label: string;
  variant?: "default" | "primary" | "accent" | "outline";
  size?: "sm" | "md";
  raw?: boolean;
  className?: string;
  onClick?: () => void;
  active?: boolean;
}

const variantStyles = {
  default: "bg-stone-100 text-stone-700",
  primary: "bg-primary-bg text-primary",
  accent: "bg-accent-bg text-amber-800",
  outline: "border border-border text-stone-600 bg-transparent",
};

export function Badge({
  label,
  variant = "default",
  size = "sm",
  raw = false,
  className,
  onClick,
  active,
}: BadgeProps) {
  const displayLabel = raw ? label : formatLabel(label);
  const isInteractive = !!onClick;

  return (
    <span
      onClick={onClick}
      className={cn(
        "inline-flex items-center rounded-full font-medium whitespace-nowrap",
        size === "sm" ? "px-2.5 py-0.5 text-xs" : "px-3 py-1 text-sm",
        active ? "bg-primary text-white" : variantStyles[variant],
        isInteractive && "cursor-pointer hover:opacity-80 transition-opacity",
        className
      )}
    >
      {displayLabel}
    </span>
  );
}
