"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ScrollText, Plus } from "lucide-react";
import { useAuth } from "@/context/auth-context";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

interface EligibleHub {
  profile_id: string;
  name?: string;
}

/**
 * Shown on the Residencies board. If the viewer manages at least one verified
 * hub (HN Badge SBT), surface a shortcut to publish a residency. Hidden for
 * everyone else.
 */
export function ResidenciesPublishCTA() {
  const { address, isAuthenticated, isLoading } = useAuth();
  const [hubs, setHubs] = useState<EligibleHub[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (!isAuthenticated || !address) {
      setHubs([]);
      setLoaded(true);
      return;
    }

    let cancelled = false;
    async function load() {
      try {
        const res = await fetch("/api/admins/my-hubs", {
          headers: { "x-wallet-address": address! },
        });
        if (res.ok) {
          const data = await res.json();
          const eligible: EligibleHub[] = (data.hubs || [])
            .filter((h: { has_badge?: boolean }) => h.has_badge === true)
            .map((h: { profile_id: string; name?: string }) => ({
              profile_id: h.profile_id,
              name: h.name,
            }));
          if (!cancelled) setHubs(eligible);
        }
      } catch {
        // silent
      } finally {
        if (!cancelled) setLoaded(true);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [isAuthenticated, address]);

  // Nothing to show until we know the viewer manages a verified hub.
  if (isLoading || !loaded || hubs.length === 0) return null;

  return (
    <Card className="mb-8 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between bg-primary-bg border-primary/20">
      <div className="flex items-start gap-3">
        <ScrollText className="w-5 h-5 text-primary mt-0.5 shrink-0" />
        <div>
          <h2 className="text-sm font-semibold text-foreground">
            Publish a residency
          </h2>
          <p className="text-xs text-muted">
            {hubs.length === 1
              ? "You manage a verified hub. Post a new residency to the board."
              : "You manage verified hubs. Choose one to post a new residency."}
          </p>
        </div>
      </div>

      {hubs.length === 1 ? (
        <Link
          href={`/hubs/${hubs[0].profile_id}/edit#hub-residencies`}
          className="shrink-0"
        >
          <Button size="sm" className="gap-1.5">
            <Plus className="w-4 h-4" />
            Create residency
          </Button>
        </Link>
      ) : (
        <div className="flex flex-wrap gap-2">
          {hubs.map((h) => (
            <Link
              key={h.profile_id}
              href={`/hubs/${h.profile_id}/edit#hub-residencies`}
            >
              <Button variant="secondary" size="sm" className="gap-1.5">
                <Plus className="w-4 h-4" />
                {h.name || h.profile_id}
              </Button>
            </Link>
          ))}
        </div>
      )}
    </Card>
  );
}
