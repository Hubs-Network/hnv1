"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { BadgeCheck } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/context/auth-context";
import { requestPassport } from "@/lib/pilgrim-passport-client";
import { MAX_INITIAL_SKILLS } from "@/config/pilgrim-passport";
import { SkillSelector } from "./skill-selector";
import { HubPassportClaimsAdmin } from "./hub-passport-claims-admin";

interface Props {
  hubId: string;
  hubSafe: string;
}

interface PassportState {
  hasPassport: boolean;
  tokenId: string | null;
}

/**
 * Pilgrim Passport section shown on an approved hub's detail page.
 * - Lets a logged-in user without a Passport claim one from this hub.
 * - Shows passport / pending states.
 * - Renders the owner approvals panel when the user owns the hub Safe.
 */
export function HubPassportSection({ hubId, hubSafe }: Props) {
  const { address, authProvider, isAuthenticated, isLoading } = useAuth();

  const [passport, setPassport] = useState<PassportState | null>(null);
  const [pendingClaim, setPendingClaim] = useState<boolean>(false);
  const [isOwner, setIsOwner] = useState(false);
  const [loadingState, setLoadingState] = useState(false);

  const [selected, setSelected] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submittedTx, setSubmittedTx] = useState<string | null>(null);

  const loadState = useCallback(async () => {
    if (!address) return;
    setLoadingState(true);
    try {
      const [state, claimsRes, ownerRes] = await Promise.all([
        fetch(`/api/pilgrim-passport/passport?owner=${address}`).then((r) => r.json()),
        fetch(`/api/pilgrim-passport/claims?applicant=${address}`).then((r) => r.json()),
        fetch("/api/admins/check", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            profile_id: hubId,
            profile_type: "hub",
            wallet_address: address,
            safe_address: hubSafe,
          }),
        }).then((r) => r.json()),
      ]);

      setPassport({
        hasPassport: Boolean(state?.hasPassport),
        tokenId: state?.tokenId ?? null,
      });

      const claims = Array.isArray(claimsRes?.claims) ? claimsRes.claims : [];
      setPendingClaim(
        claims.some(
          (c: { hubSafe: string; status: string }) =>
            c.hubSafe.toLowerCase() === hubSafe.toLowerCase() &&
            c.status === "pending"
        )
      );

      setIsOwner(Boolean(ownerRes?.is_admin));
    } catch {
      // leave defaults
    } finally {
      setLoadingState(false);
    }
  }, [address, hubId, hubSafe]);

  useEffect(() => {
    loadState();
  }, [loadState]);

  async function handleClaim() {
    if (!address) return;
    setSubmitting(true);
    setError(null);
    try {
      const result = await requestPassport({
        applicant: address,
        hubSafe,
        hubId,
        skillIds: selected,
        authProvider,
      });
      setSubmittedTx(result.txHash);
      setPendingClaim(true);
      await loadState();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to submit claim");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Card padding="md">
      <h3 className="font-semibold text-foreground mb-3 flex items-center gap-2">
        <BadgeCheck className="w-4 h-4 text-primary" />
        Pilgrim Passport
      </h3>

      {/* Not logged in */}
      {!isLoading && !isAuthenticated && (
        <p className="text-sm text-muted">
          Log in or connect a wallet to claim a Pilgrim Passport from this hub.
        </p>
      )}

      {/* Logged in */}
      {isAuthenticated && (
        <div className="space-y-3">
          {loadingState && !passport ? (
            <p className="text-sm text-muted">Checking your Passport status…</p>
          ) : passport?.hasPassport ? (
            <p className="text-sm text-foreground">
              You hold Passport #{passport.tokenId}.{" "}
              <Link
                href={`/passport/${passport.tokenId}`}
                className="text-primary hover:underline"
              >
                View Passport
              </Link>
            </p>
          ) : submittedTx || pendingClaim ? (
            <div className="text-sm text-foreground space-y-1">
              <p>Your claim is pending a hub owner&apos;s approval.</p>
              {submittedTx && (
                <p className="text-xs text-muted break-all">
                  Request tx:{" "}
                  <a
                    href={`https://sepolia.etherscan.io/tx/${submittedTx}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary hover:underline"
                  >
                    {submittedTx.slice(0, 12)}…
                  </a>
                </p>
              )}
            </div>
          ) : (
            <div className="space-y-3">
              <p className="text-sm text-muted">
                Claim your Pilgrim Passport from this hub by selecting the skills
                you propose to be attested.
              </p>
              <SkillSelector
                selected={selected}
                onChange={setSelected}
                max={MAX_INITIAL_SKILLS}
                disabled={submitting}
              />
              {error && <p className="text-xs text-danger">{error}</p>}
              <Button
                size="sm"
                onClick={handleClaim}
                disabled={submitting || selected.length < 1}
              >
                {submitting ? "Submitting…" : "Claim Pilgrim Passport"}
              </Button>
            </div>
          )}
        </div>
      )}

      {/* Owner approvals panel */}
      {isAuthenticated && isOwner && <HubPassportClaimsAdmin hubSafe={hubSafe} />}
    </Card>
  );
}
