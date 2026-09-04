import { cn } from "@/lib/utils";

interface CompletenessBarProps {
  /** Integer 0..100. */
  percent: number;
  className?: string;
  /** Show the "Profile completeness" label row above the bar. */
  showLabel?: boolean;
  /** Optional label text override. */
  label?: string;
}

/**
 * Presentational-only completeness bar. No hooks, so it renders in both
 * server and client components.
 */
export function CompletenessBar({
  percent,
  className,
  showLabel = true,
  label = "Profile completeness",
}: CompletenessBarProps) {
  const clamped = Math.max(0, Math.min(100, Math.round(percent)));
  const tone =
    clamped >= 80
      ? "bg-green-500"
      : clamped >= 40
        ? "bg-amber-500"
        : "bg-rose-500";

  return (
    <div className={cn("w-full", className)}>
      {showLabel && (
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-xs font-medium text-muted">{label}</span>
          <span className="text-xs font-semibold text-foreground">
            {clamped}%
          </span>
        </div>
      )}
      <div
        className="h-2 w-full rounded-full bg-stone-100 overflow-hidden"
        role="progressbar"
        aria-valuenow={clamped}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={label}
      >
        <div
          className={cn("h-full rounded-full transition-all", tone)}
          style={{ width: `${clamped}%` }}
        />
      </div>
    </div>
  );
}
