"use client";

import { Check, Loader2, CircleDashed } from "lucide-react";
import {
  deriveMilestoneDoneStatus,
  type MilestoneDoneStatus,
} from "@/lib/schemas/residency-milestones";

export interface ChecklistMilestone {
  id: string;
  title: string;
  description?: string;
  order: number;
  pilgrimDone: boolean;
  hubDone: boolean;
}

const STATUS_LABEL: Record<MilestoneDoneStatus, string> = {
  open: "Open",
  pilgrim_done: "Pilgrim done",
  hub_done: "Hub done",
  validated: "Validated",
};

function DoneToggle({
  label,
  checked,
  canToggle,
  busy,
  onToggle,
}: {
  label: string;
  checked: boolean;
  canToggle: boolean;
  busy: boolean;
  onToggle: (next: boolean) => void;
}) {
  return (
    <button
      type="button"
      disabled={!canToggle || busy}
      onClick={() => onToggle(!checked)}
      className={
        "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border transition-colors " +
        (checked
          ? "bg-green-100 text-green-700 border-green-200"
          : "bg-surface text-muted border-border") +
        (canToggle && !busy ? " hover:border-primary/40 cursor-pointer" : " cursor-default")
      }
      title={canToggle ? `Toggle ${label}` : label}
    >
      {busy ? (
        <Loader2 className="w-3 h-3 animate-spin" />
      ) : checked ? (
        <Check className="w-3 h-3" />
      ) : (
        <CircleDashed className="w-3 h-3" />
      )}
      {label}
    </button>
  );
}

/**
 * Confirmed-plan checklist. Each milestone needs both the Pilgrim and a Hub
 * signer to mark it done before it is validated.
 */
export function MilestoneDoneChecklist({
  milestones,
  canMarkPilgrimDone,
  canMarkHubDone,
  busyId,
  onToggle,
}: {
  milestones: ChecklistMilestone[];
  canMarkPilgrimDone: boolean;
  canMarkHubDone: boolean;
  busyId: string | null;
  onToggle: (milestoneId: string, actor: "pilgrim" | "hub", done: boolean) => void;
}) {
  return (
    <div className="space-y-2">
      {milestones
        .slice()
        .sort((a, b) => a.order - b.order)
        .map((m) => {
          const status = deriveMilestoneDoneStatus(m);
          const validated = status === "validated";
          return (
            <div
              key={m.id}
              className={
                "rounded-lg border p-3 " +
                (validated ? "border-green-200 bg-green-50/50" : "border-border bg-surface")
              }
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-foreground">{m.title}</p>
                  {m.description && (
                    <p className="text-xs text-muted mt-0.5 whitespace-pre-wrap">
                      {m.description}
                    </p>
                  )}
                </div>
                <span
                  className={
                    "shrink-0 text-[10px] font-semibold uppercase tracking-wide " +
                    (validated ? "text-green-700" : "text-muted-light")
                  }
                >
                  {STATUS_LABEL[status]}
                </span>
              </div>
              <div className="flex flex-wrap gap-2 mt-2">
                <DoneToggle
                  label="Pilgrim done"
                  checked={m.pilgrimDone}
                  canToggle={canMarkPilgrimDone}
                  busy={busyId === `${m.id}:pilgrim`}
                  onToggle={(next) => onToggle(m.id, "pilgrim", next)}
                />
                <DoneToggle
                  label="Hub confirmed"
                  checked={m.hubDone}
                  canToggle={canMarkHubDone}
                  busy={busyId === `${m.id}:hub`}
                  onToggle={(next) => onToggle(m.id, "hub", next)}
                />
              </div>
            </div>
          );
        })}
    </div>
  );
}
