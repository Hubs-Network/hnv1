"use client";

import { useState } from "react";
import { useAuth } from "@/context/auth-context";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Award, Loader2, CheckCircle, Clock, XCircle } from "lucide-react";
import { HN_MANIFESTO_URL } from "@/config/hubs-network";
import type { HNBadgeStatus } from "@/types";

interface HNBadgeCardProps {
  hubId: string;
  status: HNBadgeStatus;
  onApplied?: () => void;
}

export function HNBadgeCard({ hubId, status, onApplied }: HNBadgeCardProps) {
  const { address } = useAuth();
  const [accepted, setAccepted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [localStatus, setLocalStatus] = useState<HNBadgeStatus>(status || "none");

  async function handleApply() {
    if (!address || !accepted) return;
    setSubmitting(true);
    setError(null);

    try {
      const res = await fetch(`/api/hubs/${hubId}/hn-badge/apply`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          _wallet_address: address,
          manifestoAccepted: true,
        }),
      });
      const result = await res.json();
      if (!res.ok) {
        setError(result.error || "Application failed");
        return;
      }
      setLocalStatus("pending");
      onApplied?.();
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  const manifestoLink = (
    <a
      href={HN_MANIFESTO_URL}
      target="_blank"
      rel="noopener noreferrer"
      className="text-primary hover:underline"
    >
      Hubs Network Manifesto
    </a>
  );

  return (
    <Card className="space-y-4">
      <div className="flex items-center gap-2">
        <Award className="w-5 h-5 text-primary" />
        <h3 className="text-base font-semibold">Hubs Network Badge</h3>
      </div>

      {localStatus === "pending" && (
        <div className="flex items-center gap-2 text-sm text-amber-600 bg-amber-50 px-3 py-2 rounded-lg">
          <Clock className="w-4 h-4" />
          Application pending review
        </div>
      )}

      {localStatus === "approved" && (
        <div className="flex items-center gap-2 text-sm text-green-700 bg-green-50 px-3 py-2 rounded-lg">
          <CheckCircle className="w-4 h-4" />
          Hubs Network Badge approved
        </div>
      )}

      {localStatus === "rejected" && (
        <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">
          <XCircle className="w-4 h-4" />
          Application rejected
        </div>
      )}

      {(localStatus === "none" || localStatus === "rejected") && (
        <>
          <p className="text-sm text-muted">
            {localStatus === "rejected"
              ? "Your previous application was not approved. You can update your hub information and apply again — it will be reviewed by Hubs Network admins."
              : "Registering a hub does not automatically make it an official Hubs Network hub. Apply for the badge — it requires review by Hubs Network admins."}
          </p>

          <label className="flex items-start gap-2 text-sm text-foreground cursor-pointer">
            <input
              type="checkbox"
              checked={accepted}
              onChange={(e) => setAccepted(e.target.checked)}
              className="mt-0.5"
            />
            <span>I have read and accept the {manifestoLink}.</span>
          </label>

          <Button
            onClick={handleApply}
            disabled={!accepted || submitting}
            className="gap-1.5"
          >
            {submitting ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Award className="w-4 h-4" />
            )}
            {localStatus === "rejected"
              ? "Apply again for Hubs Network Badge"
              : "Apply for Hubs Network Badge"}
          </Button>
        </>
      )}

      {error && (
        <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded">{error}</p>
      )}
    </Card>
  );
}
