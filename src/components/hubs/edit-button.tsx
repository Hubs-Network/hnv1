"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/context/auth-context";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { Pencil } from "lucide-react";

interface EditButtonProps {
  hubId: string;
}

export function HubEditButton({ hubId }: EditButtonProps) {
  const { address, isAuthenticated } = useAuth();
  const [isAdmin, setIsAdmin] = useState(false);
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    if (!isAuthenticated || !address) {
      setIsAdmin(false);
      setChecked(true);
      return;
    }

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
        setIsAdmin(data.is_admin === true);
      } catch {
        setIsAdmin(false);
      } finally {
        setChecked(true);
      }
    }

    check();
  }, [hubId, isAuthenticated, address]);

  if (!checked || !isAdmin) return null;

  return (
    <Link href={`/hubs/${hubId}/edit`}>
      <Button variant="secondary" size="sm" className="gap-1.5">
        <Pencil className="w-3.5 h-3.5" />
        Edit profile
      </Button>
    </Link>
  );
}
