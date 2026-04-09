"use client";

import { useUP } from "@/context/up-context";
import { useEffect, useState } from "react";
import type { HubProfile } from "@/types";
import { HubCard } from "@/components/hubs/hub-card";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import Link from "next/link";
import {
  UserCircle,
  Loader2,
  Plus,
  Settings,
  Building2,
} from "lucide-react";

export function MyHubsClient() {
  const { address, isConnected, connect, isConnecting } = useUP();
  const [hubs, setHubs] = useState<HubProfile[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!address) return;

    async function loadHubs() {
      setLoading(true);
      try {
        const res = await fetch("/api/hubs");
        if (!res.ok) return;
        const allHubs: HubProfile[] = await res.json();
        const myHubs = allHubs.filter((hub) =>
          (hub.admins || [])
            .map((a) => a.toLowerCase())
            .includes(address!.toLowerCase())
        );
        setHubs(myHubs);
      } catch {
        console.error("Failed to load hubs");
      } finally {
        setLoading(false);
      }
    }

    loadHubs();
  }, [address]);

  if (!isConnected) {
    return (
      <Card padding="lg" className="max-w-lg mx-auto text-center">
        <UserCircle className="w-12 h-12 text-muted-light mx-auto mb-4" />
        <h2 className="text-xl font-bold text-foreground mb-2">
          Connect your Universal Profile
        </h2>
        <p className="text-sm text-muted mb-6">
          Connect your UP to see hubs you own or administer.
        </p>
        <Button onClick={connect} disabled={isConnecting}>
          {isConnecting ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            "Connect Universal Profile"
          )}
        </Button>
      </Card>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-6 h-6 animate-spin text-muted" />
      </div>
    );
  }

  if (hubs.length === 0) {
    return (
      <EmptyState
        icon={<Building2 className="w-12 h-12" />}
        title="No hubs yet"
        description="You haven't registered any hubs, and you're not listed as an admin on any existing hub."
        action={
          <Link href="/register/hub">
            <Button>
              <Plus className="w-4 h-4" />
              Register a Hub
            </Button>
          </Link>
        }
      />
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted">
          {hubs.length} {hubs.length === 1 ? "hub" : "hubs"}
        </p>
        <Link href="/register/hub">
          <Button variant="secondary" size="sm">
            <Plus className="w-3.5 h-3.5" />
            Register another
          </Button>
        </Link>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {hubs.map((hub) => (
          <div key={hub.hub_id} className="relative group">
            <HubCard hub={hub} />
            <Link
              href={`/hubs/${hub.hub_id}/edit`}
              className="absolute top-4 right-4 p-2 rounded-lg bg-surface border border-border shadow-sm opacity-0 group-hover:opacity-100 transition-opacity hover:bg-stone-50"
              title="Edit hub"
            >
              <Settings className="w-4 h-4 text-muted" />
            </Link>
          </div>
        ))}
      </div>
    </div>
  );
}
