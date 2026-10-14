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
  hubSafe: string;
  hubName: string | null;
  title: string | null;
  pilgrimPassportTokenId: string;
  planStatus: MilestonePlanStatus;
}

/**
 * "Active Residencies" for a pilgrim: residencies where their Passport is
 * selected and not yet awarded. Shown on the pilgrim's own passport page.
 * Owner-gated so only the pilgrim sees it.
 */
export function PilgrimActiveResidencies({ owner }: { owner: string }) {
  const { address, isLoading: authLoading } = useAuth();
  const [rows, setRows] = useState<Row[]>([]);
  const [loaded, setLoaded] = useState(false);

  const isOwner = !!address && address.toLowerCase() === owner.toLowerCase();

  const load = useCallback(async (signal?: AbortSignal) => {
    // Wait for the auth session to settle so we don't fetch with a stale address.
    if (authLoading) return;
    if (!isOwner || !address) {
      setRows([]);
      setLoaded(true);
      return;
    }
    try {
      const res = await fetch(`/api/residencies/active/pilgrim?owner=${address}`, {
        signal,
      });
      if (res.ok) {
        const data = await res.json();
        setRows(data.residencies ?? []);
      } else {
        setRows([]);
      }
    } catch (err) {
      if (signal?.aborted || (err as Error)?.name === "AbortError") return;
    } finally {
      if (!signal?.aborted) setLoaded(true);
    }
  }, [isOwner, address, authLoading]);

  useEffect(() => {
    const controller = new AbortController();
    load(controller.signal);
    return () => controller.abort();
  }, [load]);

  if (!isOwner) return null;
  if (!loaded) {
    return (
      <Card className="mb-8 flex items-center gap-2">
        <Loader2 className="w-4 h-4 animate-spin text-muted" />
        <span className="text-sm text-muted">Loading active residencies…</span>
      </Card>
    );
  }
  if (rows.length === 0) return null;

  return (
    <Card className="mb-8 space-y-3">
      <div className="flex items-center gap-2">
        <ListChecks className="w-5 h-5 text-primary" />
        <h2 className="text-base font-semibold text-foreground">Active residencies</h2>
      </div>
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
              <p className="text-xs text-muted">
                {r.hubName ? `${r.hubName} · ` : ""}
                {MILESTONE_PLAN_STATUS_LABELS[r.planStatus]}
              </p>
            </div>
            <span className="inline-flex items-center gap-1 text-sm text-primary shrink-0">
              Open milestones
              <ArrowRight className="w-3.5 h-3.5" />
            </span>
          </Link>
        ))}
      </div>
    </Card>
  );
}
