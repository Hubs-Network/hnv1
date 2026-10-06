"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ScrollText } from "lucide-react";
import { useAuth } from "@/context/auth-context";
import { Button } from "@/components/ui/button";

interface Props {
  hubId: string;
  /** Only hubs that hold the HN Badge SBT can publish residencies. */
  hasBadge: boolean;
}

/**
 * Shortcut shown on a hub's public page that lets an authorized manager jump
 * straight to the residency creation module (which lives in the hub dashboard).
 * Renders nothing unless the hub is verified AND the viewer is a hub admin.
 */
export function HubResidencyShortcut({ hubId, hasBadge }: Props) {
  const { address, isAuthenticated } = useAuth();
  const [isAdmin, setIsAdmin] = useState(false);
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    if (!hasBadge || !isAuthenticated || !address) {
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
  }, [hubId, hasBadge, isAuthenticated, address]);

  if (!hasBadge || !checked || !isAdmin) return null;

  return (
    <Link href={`/hubs/${hubId}/edit#hub-residencies`}>
      <Button variant="secondary" size="sm" className="gap-1.5">
        <ScrollText className="w-3.5 h-3.5" />
        Create residency
      </Button>
    </Link>
  );
}
