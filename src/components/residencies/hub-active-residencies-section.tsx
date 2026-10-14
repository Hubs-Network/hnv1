"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ListChecks, ArrowRight, Loader2 } from "lucide-react";
import { useAuth } from "@/context/auth-context";
import { Card } from "@/components/ui/card";
import {
  MILESTONE_PLAN_STATUS_LABELS,
  type MilestonePlanStatus,
} from "@/lib/schemas/residency-milestones";

interface Row {
  residencyId: string;
  title: string | null;
  pilgrimPassportTokenId: string;
  pilgrimOwner: string | null;
  pilgrimNickname: string | null;
  planStatus: MilestonePlanStatus;
}

/** CTA label a hub signer sees for each active pilgrim, driven by plan status. */
function hubCta(status: MilestonePlanStatus): string {
  switch (status) {
    case "submitted":
      return "Confirm milestones";
    case "confirmed":
      return "Validate progress";
    case "all_validated":
      return "Award skills";
    case "none":
    case "draft":
    default:
      return "Review milestones";
  }
}

/**
 * Hub-side "Active Residencies": selected, not-yet-awarded pilgrims across the
 * hub's residencies, each linking to its Milestone Dashboard. Shown in the hub
 * dashboard alongside Create Residency.
 */
export function HubActiveResidenciesSection({ hubSafe }: { hubSafe: string }) {
  const { address, isLoading: authLoading } = useAuth();
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async (signal?: AbortSignal) => {
    // Wait for the auth session to settle so we don't fetch with a stale address.
    if (authLoading) return;
    if (!address) {
      setRows([]);
      setLoading(false);
      return;
    }
    try {
      const res = await fetch(
        `/api/residencies/active/hub?hubSafe=${hubSafe}&wallet=${address}`,
        { signal }
      );
      if (res.ok) {
        const data = await res.json();
        setRows(data.residencies ?? []);
      } else {
        // Not a signer for this hub (e.g. switched to another account) → clear.
        setRows([]);
      }
    } catch (err) {
      if (signal?.aborted || (err as Error)?.name === "AbortError") return;
    } finally {
      if (!signal?.aborted) setLoading(false);
    }
  }, [hubSafe, address, authLoading]);

  useEffect(() => {
    const controller = new AbortController();
    load(controller.signal);
    return () => controller.abort();
  }, [load]);

  return (
    <Card className="space-y-4">
      <div className="flex items-center gap-2">
        <ListChecks className="w-5 h-5 text-primary" />
        <h3 className="text-base font-semibold">Active residencies</h3>
      </div>

      {loading ? (
        <div className="flex justify-center py-6">
          <Loader2 className="w-5 h-5 animate-spin text-muted" />
        </div>
      ) : rows.length === 0 ? (
        <p className="text-sm text-muted">
          No selected pilgrims awaiting milestones. Once you select a pilgrim for
          a residency, their milestone dashboard will appear here.
        </p>
      ) : (
        <div className="space-y-2">
          {rows.map((r) => (
            <Link
              key={`${r.residencyId}:${r.pilgrimPassportTokenId}`}
              href={`/residencies/${r.residencyId}/milestones/${r.pilgrimPassportTokenId}`}
              className="flex items-center justify-between gap-3 p-3 rounded-lg border border-border hover:border-primary/40 transition-colors"
            >
              <div className="min-w-0">
                <p className="text-sm font-medium text-foreground truncate">
                  {r.title || `Residency #${r.residencyId}`}
                </p>
                <p className="text-xs text-muted truncate">
                  {r.pilgrimNickname || `Passport #${r.pilgrimPassportTokenId}`} ·{" "}
                  {MILESTONE_PLAN_STATUS_LABELS[r.planStatus]}
                </p>
              </div>
              <span className="inline-flex items-center gap-1 text-sm text-primary shrink-0">
                {hubCta(r.planStatus)}
                <ArrowRight className="w-3.5 h-3.5" />
              </span>
            </Link>
          ))}
        </div>
      )}
    </Card>
  );
}
