"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { BadgeCheck, Loader2, Check, ExternalLink, Sparkles } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/context/auth-context";
import type { PilgrimProfile } from "@/types";

interface Props {
  tokenId: string;
  owner: string;
}

/**
 * Shown on /passport/[tokenId].
 * - The passport owner gets an editable profile (nickname, tagline, link) plus
 *   a "Publish" action that writes the passport id onto their pilgrim JSON and
 *   surfaces a card in the /pilgrims directory.
 * - Everyone else sees the read-only public card (only once published).
 */
export function PilgrimProfilePanel({ tokenId, owner }: Props) {
  const { address } = useAuth();
  const isOwner = !!address && address.toLowerCase() === owner.toLowerCase();

  const [profile, setProfile] = useState<PilgrimProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [nickname, setNickname] = useState("");
  const [tagline, setTagline] = useState("");
  const [link, setLink] = useState("");
  const [saving, setSaving] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/pilgrims/${owner}`);
      const data = await res.json();
      const p: PilgrimProfile | null = data?.profile ?? null;
      setProfile(p);
      setNickname(p?.nickname || "");
      setTagline(p?.tagline || "");
      setLink(p?.link || "");
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, [owner]);

  useEffect(() => {
    load();
  }, [load]);

  const isPublished =
    !!profile?.published && profile?.passportTokenId === tokenId;

  async function handleSave() {
    if (!address) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/pilgrims", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ _wallet_address: address, nickname, tagline, link }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data?.error || "Failed to save");
        return;
      }
      setProfile(data.profile);
      setSavedAt(Date.now());
      setTimeout(() => setSavedAt(null), 3000);
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  async function handlePublish() {
    if (!address) return;
    setPublishing(true);
    setError(null);
    try {
      // Persist any profile edits first so the published card is up to date.
      await fetch("/api/pilgrims", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ _wallet_address: address, nickname, tagline, link }),
      });
      const res = await fetch(`/api/pilgrims/${owner}/publish`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ _wallet_address: address, tokenId }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data?.error || "Failed to publish");
        return;
      }
      setProfile(data.profile);
      // Tell the wallet badge to clear its "ready to publish" red dot now,
      // without waiting for its next poll.
      if (typeof window !== "undefined") {
        window.dispatchEvent(new CustomEvent("pilgrim:published"));
      }
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setPublishing(false);
    }
  }

  if (loading) {
    return (
      <Card padding="md" className="flex items-center gap-2">
        <Loader2 className="w-4 h-4 animate-spin text-muted" />
        <span className="text-sm text-muted">Loading pilgrim profile…</span>
      </Card>
    );
  }

  // Public read-only view (non-owner). Only render if published with content.
  if (!isOwner) {
    if (!isPublished || (!profile?.nickname && !profile?.tagline && !profile?.link)) {
      return null;
    }
    return (
      <Card padding="md" className="space-y-2">
        <h3 className="font-semibold text-foreground flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-primary" />
          {profile?.nickname || "Pilgrim"}
        </h3>
        {profile?.tagline && (
          <p className="text-sm text-muted">{profile.tagline}</p>
        )}
        {profile?.link && (
          <a
            href={profile.link}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm text-primary hover:underline inline-flex items-center gap-1"
          >
            {profile.link.replace(/^https?:\/\//, "")}
            <ExternalLink className="w-3 h-3" />
          </a>
        )}
      </Card>
    );
  }

  // Owner editable panel
  return (
    <Card padding="md" className="space-y-4">
      <div className="flex items-center gap-2">
        <BadgeCheck className="w-4 h-4 text-primary" />
        <h3 className="font-semibold text-foreground">Your Pilgrim Profile</h3>
      </div>

      {isPublished ? (
        <div className="flex items-center gap-2 text-sm text-green-700 bg-green-50 px-3 py-2 rounded-lg">
          <Check className="w-4 h-4" />
          Published to the{" "}
          <Link href="/pilgrims" className="underline">
            Pilgrims directory
          </Link>
          .
        </div>
      ) : (
        <p className="text-sm text-muted">
          Your passport is ready. Set your public identity, then{" "}
          <strong>publish</strong> to show a card in the Pilgrims directory.
        </p>
      )}

      <Input
        label="Nickname"
        name="nickname"
        placeholder="e.g. wandering.dev"
        value={nickname}
        onChange={(e) => setNickname(e.target.value)}
      />
      <div>
        <Textarea
          label="Tagline"
          name="tagline"
          placeholder="One line about you as a pilgrim"
          rows={2}
          value={tagline}
          onChange={(e) => setTagline(e.target.value)}
        />
      </div>
      <Input
        label="Link"
        name="link"
        type="url"
        placeholder="https://your-site.xyz"
        value={link}
        onChange={(e) => setLink(e.target.value)}
        hint="Optional"
      />

      {error && <p className="text-xs text-danger">{error}</p>}

      <div className="flex flex-wrap items-center gap-3">
        <Button size="sm" variant="secondary" onClick={handleSave} disabled={saving}>
          {saving ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Saving…
            </>
          ) : (
            <>
              Save
              {savedAt && <Check className="w-4 h-4" />}
            </>
          )}
        </Button>

        <Button size="sm" onClick={handlePublish} disabled={publishing}>
          {publishing ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Publishing…
            </>
          ) : isPublished ? (
            "Update published card"
          ) : (
            "Publish to Pilgrims"
          )}
        </Button>
      </div>
    </Card>
  );
}
