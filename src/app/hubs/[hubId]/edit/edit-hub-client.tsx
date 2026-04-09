"use client";

import { useUP } from "@/context/up-context";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState, useCallback } from "react";
import type { HubProfile } from "@/types";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Loader2,
  Check,
  ArrowLeft,
  UserCircle,
  ShieldCheck,
  Plus,
  X,
  Trash2,
} from "lucide-react";
import Link from "next/link";

export function EditHubClient() {
  const { address, isConnected, connect, isConnecting } = useUP();
  const params = useParams();
  const router = useRouter();
  const hubId = params.hubId as string;

  const [hub, setHub] = useState<HubProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);

  // Editable fields
  const [tagline, setTagline] = useState("");
  const [description, setDescription] = useState("");
  const [website, setWebsite] = useState("");

  // Admin management
  const [admins, setAdmins] = useState<string[]>([]);
  const [newAdmin, setNewAdmin] = useState("");

  const loadHub = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/hubs/${hubId}`);
      if (!res.ok) {
        setError("Hub not found");
        return;
      }
      const data: HubProfile = await res.json();
      setHub(data);
      setTagline(data.tagline);
      setDescription(data.description);
      setWebsite(data.website || "");
      setAdmins(data.admins || []);

      if (address) {
        const hubAdmins = (data.admins || []).map((a) => a.toLowerCase());
        setIsAdmin(hubAdmins.includes(address.toLowerCase()));
      }
    } catch {
      setError("Failed to load hub");
    } finally {
      setLoading(false);
    }
  }, [hubId, address]);

  useEffect(() => {
    loadHub();
  }, [loadHub]);

  function addAdmin() {
    const addr = newAdmin.trim().toLowerCase();
    if (!addr || !addr.startsWith("0x") || addr.length < 10) return;
    if (admins.map((a) => a.toLowerCase()).includes(addr)) return;
    setAdmins([...admins, addr]);
    setNewAdmin("");
  }

  function removeAdmin(addr: string) {
    if (hub?.metadata.creator_address?.toLowerCase() === addr.toLowerCase()) {
      return;
    }
    setAdmins(admins.filter((a) => a.toLowerCase() !== addr.toLowerCase()));
  }

  async function handleSave() {
    if (!address || !hub) return;

    setSaving(true);
    setError(null);

    try {
      const res = await fetch(`/api/hubs/${hubId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tagline,
          description,
          website,
          admins,
          _caller_address: address,
        }),
      });

      const result = await res.json();

      if (!res.ok) {
        setError(result.error || "Update failed");
        return;
      }

      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  if (!isConnected) {
    return (
      <Card padding="lg" className="max-w-lg mx-auto text-center">
        <UserCircle className="w-12 h-12 text-muted-light mx-auto mb-4" />
        <h2 className="text-xl font-bold text-foreground mb-2">
          Connect your Universal Profile
        </h2>
        <p className="text-sm text-muted mb-6">
          You need to connect your UP to edit this hub.
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

  if (!hub || error === "Hub not found") {
    return (
      <div className="text-center py-20">
        <p className="text-muted">Hub not found.</p>
        <Link href="/my-hubs" className="text-primary hover:underline text-sm mt-2 inline-block">
          Back to My Hubs
        </Link>
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <Card padding="lg" className="max-w-lg mx-auto text-center">
        <ShieldCheck className="w-12 h-12 text-muted-light mx-auto mb-4" />
        <h2 className="text-xl font-bold text-foreground mb-2">
          Access Denied
        </h2>
        <p className="text-sm text-muted mb-6">
          Your Universal Profile is not listed as an admin of this hub.
        </p>
        <Link href={`/hubs/${hubId}`}>
          <Button variant="secondary">View hub profile</Button>
        </Link>
      </Card>
    );
  }

  return (
    <div className="max-w-3xl mx-auto">
      <Link
        href={`/hubs/${hubId}`}
        className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-foreground transition-colors mb-8"
      >
        <ArrowLeft className="w-4 h-4" />
        Back to {hub.name}
      </Link>

      <h1 className="text-2xl font-bold text-foreground mb-2">
        Edit {hub.name}
      </h1>
      <p className="text-sm text-muted mb-8">
        Update your hub&apos;s public profile information.
      </p>

      <div className="space-y-8">
        {/* Basic fields */}
        <Card padding="md" className="space-y-5">
          <h2 className="text-sm font-semibold text-foreground">
            Profile Information
          </h2>

          <Input
            label="Tagline"
            value={tagline}
            onChange={(e) => setTagline(e.target.value)}
          />

          <Textarea
            label="Description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={4}
          />

          <Input
            label="Website"
            type="url"
            value={website}
            onChange={(e) => setWebsite(e.target.value)}
          />
        </Card>

        {/* Admin management */}
        <Card padding="md" className="space-y-4">
          <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-primary" />
            Administrators
          </h2>
          <p className="text-xs text-muted">
            Administrators can edit this hub&apos;s profile. The creator address
            cannot be removed.
          </p>

          <div className="space-y-2">
            {admins.map((admin) => {
              const isCreator =
                hub.metadata.creator_address?.toLowerCase() ===
                admin.toLowerCase();
              return (
                <div
                  key={admin}
                  className="flex items-center justify-between gap-2 p-2.5 rounded-lg bg-stone-50"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="text-xs font-mono text-foreground truncate">
                      {admin}
                    </span>
                    {isCreator && (
                      <Badge
                        label="Creator"
                        raw
                        variant="primary"
                        size="sm"
                      />
                    )}
                  </div>
                  {!isCreator && (
                    <button
                      onClick={() => removeAdmin(admin)}
                      className="text-muted-light hover:text-danger transition-colors shrink-0"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              );
            })}
          </div>

          <div className="flex gap-2">
            <Input
              placeholder="0x… Universal Profile address"
              value={newAdmin}
              onChange={(e) => setNewAdmin(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  addAdmin();
                }
              }}
            />
            <Button type="button" variant="secondary" onClick={addAdmin}>
              <Plus className="w-4 h-4" />
            </Button>
          </div>
        </Card>

        {/* Error / success */}
        {error && (
          <div className="p-4 rounded-lg bg-danger-bg border border-danger/20">
            <p className="text-sm text-danger">{error}</p>
          </div>
        )}

        {saved && (
          <div className="p-4 rounded-lg bg-primary-bg border border-primary/20">
            <p className="text-sm text-primary flex items-center gap-2">
              <Check className="w-4 h-4" />
              Hub updated successfully. Changes will appear after the next
              deployment.
            </p>
          </div>
        )}

        {/* Save */}
        <div className="flex justify-end gap-3 pt-4 border-t border-border">
          <Link href={`/hubs/${hubId}`}>
            <Button variant="secondary">Cancel</Button>
          </Link>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Saving…
              </>
            ) : (
              <>
                Save Changes
                <Check className="w-4 h-4" />
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
