"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useAuth } from "@/context/auth-context";
import { ResidencyCard } from "./residency-card";
import { CollapsibleSection } from "./collapsible-section";
import type { ResidencyView } from "@/lib/residencies-directory";

/** True if the residency shares at least one skill with the given hash set. */
function matchesSkills(r: ResidencyView, mySkills: Set<string>): boolean {
  return r.skills.some((s) => mySkills.has(s.hash.toLowerCase()));
}

function Grid({ items }: { items: ResidencyView[] }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {items.map((r) => (
        <ResidencyCard key={r.id} residency={r} />
      ))}
    </div>
  );
}

/**
 * Residencies board list with an optional Pilgrim-only "my skills" filter.
 *
 * Data is fetched on the server and passed in (serializable). This client
 * component only owns the viewer-specific filter: the checkbox is shown ONLY to
 * a logged-in Pilgrim whose Passport has at least one attested skill, and it
 * narrows both the open list and the collapsed "closed" section to residencies
 * sharing a skill with that Passport.
 */
export function ResidenciesBoard({
  openResidencies,
  closedResidencies,
}: {
  openResidencies: ResidencyView[];
  closedResidencies: ResidencyView[];
}) {
  const { address } = useAuth();
  const [mySkills, setMySkills] = useState<Set<string> | null>(null);
  const [onlyMine, setOnlyMine] = useState(false);

  const loadSkills = useCallback(async (signal?: AbortSignal) => {
    if (!address) {
      setMySkills(null);
      return;
    }
    try {
      const res = await fetch(`/api/pilgrims/${address}/passport-skills`, {
        signal,
      });
      if (!res.ok) {
        setMySkills(null);
        return;
      }
      const data = await res.json();
      setMySkills(
        data?.hasPassport
          ? new Set<string>(
              (data.skillHashes ?? []).map((h: string) => h.toLowerCase())
            )
          : null
      );
    } catch (err) {
      if (signal?.aborted || (err as Error)?.name === "AbortError") return;
      setMySkills(null);
    }
  }, [address]);

  useEffect(() => {
    const controller = new AbortController();
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadSkills(controller.signal);
    return () => controller.abort();
  }, [loadSkills]);

  // The filter is only meaningful for a Pilgrim with at least one attested skill.
  const canFilter = !!mySkills && mySkills.size > 0;
  const active = canFilter && onlyMine;

  const openList = useMemo(
    () =>
      active && mySkills
        ? openResidencies.filter((r) => matchesSkills(r, mySkills))
        : openResidencies,
    [active, mySkills, openResidencies]
  );
  const closedList = useMemo(
    () =>
      active && mySkills
        ? closedResidencies.filter((r) => matchesSkills(r, mySkills))
        : closedResidencies,
    [active, mySkills, closedResidencies]
  );

  return (
    <div className="space-y-6">
      {canFilter && (
        <label className="inline-flex items-center gap-2 text-sm text-foreground cursor-pointer select-none">
          <input
            type="checkbox"
            checked={onlyMine}
            onChange={(e) => setOnlyMine(e.target.checked)}
            className="rounded border-border"
          />
          Show only Residencies for my Skills
        </label>
      )}

      {openList.length > 0 ? (
        <Grid items={openList} />
      ) : (
        <div className="text-center py-12 border border-dashed border-border rounded-xl">
          <p className="text-muted">
            {active
              ? "No open residencies match your skills right now."
              : "No open residencies right now."}
          </p>
        </div>
      )}

      {closedList.length > 0 && (
        <CollapsibleSection title="Closed residencies" count={closedList.length}>
          <Grid items={closedList} />
        </CollapsibleSection>
      )}
    </div>
  );
}
