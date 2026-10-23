"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/context/auth-context";
import { CompletenessBar } from "./completeness-bar";

interface Props {
  hubId: string;
  /** Integer 0..100. */
  percent: number;
}

/**
 * Shows the hub's "Profile completeness" bar only to the hub's signers.
 * Renders nothing for everyone else (visitors, other wallets).
 */
export function HubCompletenessGate({ hubId, percent }: Props) {
  const { address, isAuthenticated, isLoading: authLoading } = useAuth();
  const [isAdmin, setIsAdmin] = useState(false);
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    // Wait for the auth session to settle so we don't admin-check a stale address.
    if (authLoading) return;
    if (!isAuthenticated || !address) {
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
  }, [hubId, isAuthenticated, authLoading, address]);

  if (!checked || !isAdmin) return null;

  return (
    <div className="mt-5 max-w-md">
      <CompletenessBar percent={percent} />
    </div>
  );
}
