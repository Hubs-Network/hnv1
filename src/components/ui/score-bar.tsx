import { cn } from "@/lib/utils";

interface ScoreBarProps {
  label: string;
  value: number;
  max?: number;
  color?: string;
}

export function ScoreBar({ label, value, max = 5, color }: ScoreBarProps) {
  const pct = Math.round((value / max) * 100);

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-xs">
        <span className="text-muted capitalize">{label}</span>
        <span className="font-medium text-foreground">
          {value}/{max}
        </span>
      </div>
      <div className="h-1.5 w-full rounded-full bg-stone-100">
        <div
          className={cn("h-full rounded-full transition-all", color || "bg-primary")}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}
