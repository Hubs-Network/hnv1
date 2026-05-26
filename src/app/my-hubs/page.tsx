"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/context/auth-context";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { Loader2, Crown, Shield, Building2, Plus, Trash2 } from "lucide-react";

interface MyHub {
  profile_id: string;
  role: string;
}

export default function MyHubsPage() {
  const { address, isAuthenticated, isLoading: authLoading } = useAuth();
  const [hubs, setHubs] = useState<MyHub[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState<string | null>(null);

  useEffect(() => {
    if (!isAuthenticated || !address) {
      setLoading(false);
      return;
    }

    async function load() {
      try {
        const res = await fetch("/api/admins/my-hubs", {
          headers: { "x-wallet-address": address! },
        });
        if (res.ok) {
          const data = await res.json();
          setHubs(data.hubs || []);
        }
      } catch {
        // silent
      } finally {
        setLoading(false);
      }
    }

    load();
  }, [isAuthenticated, address]);

  async function handleDelete(hubId: string) {
    if (!address) return;
    if (!confirm(`Are you sure you want to permanently delete "${hubId}"? This cannot be undone.`)) return;

    setDeleting(hubId);
    try {
      const res = await fetch(`/api/hubs/${hubId}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ _wallet_address: address }),
      });

      if (res.ok) {
        setHubs((prev) => prev.filter((h) => h.profile_id !== hubId));
      } else {
        const data = await res.json();
        alert(data.error || "Failed to delete hub");
      }
    } catch {
      alert("Network error");
    } finally {
      setDeleting(null);
    }
  }

  if (authLoading || loading) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-20 flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-muted" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-20 text-center">
        <Building2 className="w-12 h-12 text-muted mx-auto mb-4" />
        <h1 className="text-xl font-semibold mb-2">My Hubs</h1>
        <p className="text-sm text-muted">
          Connect your wallet to see hubs you manage.
        </p>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-foreground">My Hubs</h1>
          <p className="text-sm text-muted mt-1">
            Hubs where you are owner or admin.
          </p>
        </div>
        <Link href="/register/hub">
          <Button size="sm" className="gap-1.5">
            <Plus className="w-4 h-4" />
            New Hub
          </Button>
        </Link>
      </div>

      {hubs.length === 0 ? (
        <Card className="p-8 text-center">
          <Building2 className="w-10 h-10 text-muted mx-auto mb-3" />
          <p className="text-sm text-muted mb-4">
            You don&apos;t have any hubs yet.
          </p>
          <Link href="/register/hub">
            <Button size="sm">Register your first hub</Button>
          </Link>
        </Card>
      ) : (
        <div className="space-y-3">
          {hubs.map((hub) => (
            <Card key={hub.profile_id} className="p-4">
              <div className="flex items-center justify-between">
                <Link href={`/hubs/${hub.profile_id}`} className="flex items-center gap-3 flex-1">
                  {hub.role === "owner" ? (
                    <Crown className="w-5 h-5 text-amber-500" />
                  ) : (
                    <Shield className="w-5 h-5 text-primary" />
                  )}
                  <div>
                    <p className="text-sm font-semibold text-foreground">
                      {hub.profile_id}
                    </p>
                    <p className="text-xs text-muted capitalize">{hub.role}</p>
                  </div>
                </Link>
                <div className="flex items-center gap-2">
                  <Link href={`/hubs/${hub.profile_id}`}>
                    <Button variant="ghost" size="sm">
                      View →
                    </Button>
                  </Link>
                  {hub.role === "owner" && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDelete(hub.profile_id)}
                      disabled={deleting === hub.profile_id}
                      className="text-red-500 hover:text-red-700 hover:bg-red-50"
                    >
                      {deleting === hub.profile_id ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Trash2 className="w-4 h-4" />
                      )}
                    </Button>
                  )}
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
