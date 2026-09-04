"use client";

import { Check, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

export interface ClaimStepDef {
  id: string;
  label: string;
}

interface ClaimStepsProps {
  steps: ClaimStepDef[];
  /** Index of the current step. */
  current: number;
  /** Whether the current step is actively working (spinner). */
  busy?: boolean;
  /** Optional sub-status shown under the current step. */
  subLabel?: string | null;
}

/**
 * Compact vertical stepper that keeps the pilgrim oriented throughout the
 * passport claim: which steps are done, which is in progress, what's next.
 */
export function ClaimSteps({ steps, current, busy, subLabel }: ClaimStepsProps) {
  return (
    <ol className="space-y-2.5 mb-4">
      {steps.map((s, i) => {
        const done = i < current;
        const active = i === current;
        return (
          <li key={s.id} className="flex items-start gap-2.5">
            <span
              className={cn(
                "mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-bold",
                done && "bg-primary text-white",
                active && "bg-primary/15 text-primary ring-2 ring-primary/30",
                !done && !active && "bg-stone-100 text-muted-light"
              )}
            >
              {done ? (
                <Check className="h-3 w-3" />
              ) : active && busy ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : (
                i + 1
              )}
            </span>
            <div className="min-w-0">
              <p
                className={cn(
                  "text-sm leading-5",
                  active ? "text-foreground font-medium" : "text-muted"
                )}
              >
                {s.label}
              </p>
              {active && subLabel && (
                <p className="text-xs text-muted-light mt-0.5">{subLabel}</p>
              )}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
