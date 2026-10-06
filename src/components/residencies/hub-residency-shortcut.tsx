"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ScrollText } from "lucide-react";
import { useAuth } from "@/context/auth-context";
import { Button } from "@/components/ui/button";
import type { HNBadgeStatus } from "@/types";

interface Props {
  hubId: string;
  /** On-chain HN Badge SBT status. Only "approved" hubs can publish. */
  badgeStatus?: HNBadgeStatus;
}

/**
 * Shortcut shown on a hub's public page that lets an authorized manager jump
 * straight to the residency creation module (which lives in the hub dashboard).
 *
 * - Verified hub ("approved"): active button linking to the create form.
 * - Claimed but not yet minted ("pending"): disabled button making it explicit
 *   that publishing isn't available yet.
 * - Otherwise (never claimed / rejected): renders nothing.
 *
 * Always gated on the viewer being a hub admin.
 */
export function HubResidencyShortcut({ hubId, badgeStatus }: Props) {
  const { address, isAuthenticated } = useAuth();
  const [isAdmin, setIsAdmin] = useState(false);
  const [checked, setChecked] = useState(false);

  const relevant = badgeStatus === "approved" || badgeStatus === "pending";

  useEffect(() => {
    if (!relevant || !isAuthenticated || !address) {
      setIsAdmin(false);
      setChecked(true);
      return;
    }

    let cancelled = false;
    async function check() {
      try {
        const res = await fetch("/api/admins/check", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            profile_id: hubId,
            profile_type: "hub",
            wallet_address: address,
          }),
        });
        const data = await res.json();
        if (!cancelled) setIsAdmin(data.is_admin === true);
      } catch {
        if (!cancelled) setIsAdmin(false);
      } finally {
        if (!cancelled) setChecked(true);
      }
    }

    check();
    return () => {
      cancelled = true;
    };
  }, [hubId, relevant, isAuthenticated, address]);

  if (!relevant || !checked || !isAdmin) return null;

  // SBT claimed but not minted yet — show a disabled, explanatory button.
  if (badgeStatus === "pending") {
    return (
      <Button
        variant="secondary"
        size="sm"
        className="gap-1.5 opacity-60 cursor-not-allowed"
        onClick={() =>
          alert(
            "Your Hub's SBT verification is still pending, please retry later"
          )
        }
      >
        <ScrollText className="w-3.5 h-3.5" />
        Create Residency (SBT claim pending…)
      </Button>
    );
  }

  return (
    <Link href={`/hubs/${hubId}/edit#hub-residencies`}>
      <Button variant="secondary" size="sm" className="gap-1.5">
        <ScrollText className="w-3.5 h-3.5" />
        Create residency
      </Button>
    </Link>
  );
}
