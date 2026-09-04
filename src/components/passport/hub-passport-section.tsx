"use client";

import { useCallback, useEffect, useState } from "react";
import { BadgeCheck } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/context/auth-context";
import { requestPassport } from "@/lib/pilgrim-passport-client";
import { MAX_INITIAL_SKILLS } from "@/config/pilgrim-passport";
import { SkillSelector } from "./skill-selector";
import { HubPassportClaimsAdmin } from "./hub-passport-claims-admin";
import { ClaimSteps, type ClaimStepDef } from "./claim-steps";

const CLAIM_STEPS: ClaimStepDef[] = [
  { id: "select", label: "Select your skills" },
  { id: "sign", label: "Sign & submit your claim" },
  { id: "approval", label: "Hub reviews & mints" },
  { id: "minted", label: "Passport minted" },
];

interface Props {
  hubId: string;
  hubSafe: string;
}

/** Surface a useful message from Errors and wallet RPC error objects alike. */
function extractErrorMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  if (typeof err === "string") return err;
  if (err && typeof err === "object" && "message" in err) {
    return String((err as { message: unknown }).message);
  }
  return "";
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
  const [progressMsg, setProgressMsg] = useState<string | null>(null);

  // Pilgrim identity — saved to the pilgrim's JSON so the hub owner sees who is
  // claiming (nickname required, tagline/link optional).
  const [nickname, setNickname] = useState("");
  const [tagline, setTagline] = useState("");
  const [link, setLink] = useState("");

  const loadState = useCallback(async () => {
    if (!address) return;
    setLoadingState(true);
    try {
      const [state, claimsRes, ownerRes, profileRes] = await Promise.all([
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
        fetch(`/api/pilgrims/${address}`).then((r) => r.json()),
      ]);

      // Prefill pilgrim identity from any existing profile.
      const profile = profileRes?.profile;
      if (profile) {
        setNickname((v) => v || profile.nickname || "");
        setTagline((v) => v || profile.tagline || "");
        setLink((v) => v || profile.link || "");
      }

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
    if (!nickname.trim()) {
      setError("Please choose a nickname before claiming.");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      // Save the pilgrim identity first so the hub owner sees it on the claim.
      await fetch("/api/pilgrims", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          _wallet_address: address,
          nickname: nickname.trim(),
          tagline: tagline.trim(),
          link: link.trim(),
        }),
      });

      const result = await requestPassport({
        applicant: address,
        hubSafe,
        hubId,
        skillIds: selected,
        authProvider,
        onStep: setProgressMsg,
      });
      setSubmittedTx(result.txHash);
      setPendingClaim(true);
      await loadState();
    } catch (err) {
      setError(extractErrorMessage(err) || "Failed to submit claim");
    } finally {
      setSubmitting(false);
      setProgressMsg(null);
    }
  }

  // While a claim is pending, poll so the UI reflects the mint without a
  // manual refresh (the section then hides itself for the new holder).
  const isPending = Boolean(submittedTx || pendingClaim);
  useEffect(() => {
    if (!address || !isPending || passport?.hasPassport) return;
    const t = setInterval(() => {
      loadState();
    }, 25000);
    return () => clearInterval(t);
  }, [address, isPending, passport?.hasPassport, loadState]);

  // Current stepper position from the claim lifecycle.
  const currentStep = passport?.hasPassport
    ? 3
    : isPending
      ? 2
      : submitting
        ? 1
        : 0;

  // Holders who aren't hub owners have nothing to do here; the Passport is
  // reachable from the top-right account menu instead.
  if (isAuthenticated && passport?.hasPassport && !isOwner) {
    return null;
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

      {/* Logged in (and not already a holder) */}
      {isAuthenticated && !passport?.hasPassport && (
        <div className="space-y-3">
          {/* Always-visible roadmap so the pilgrim understands the process */}
          {!isOwner && (
            <ClaimSteps
              steps={CLAIM_STEPS}
              current={currentStep}
              busy={submitting || isPending}
              subLabel={
                submitting
                  ? progressMsg
                  : isPending
                    ? "Waiting for a hub owner to approve and mint."
                    : null
              }
            />
          )}
          {loadingState && !passport ? (
            <p className="text-sm text-muted">Checking your Passport status…</p>
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
                Claim your Pilgrim Passport from this hub. Tell the hub who you
                are, then select the skills you propose to be attested.
              </p>

              <Input
                label="Nickname"
                name="pilgrim-nickname"
                placeholder="e.g. wandering.dev"
                value={nickname}
                onChange={(e) => setNickname(e.target.value)}
                disabled={submitting}
                hint="Shown to the hub and on your public card. Required."
              />
              <Textarea
                label="Tagline (optional)"
                name="pilgrim-tagline"
                placeholder="One line about you as a pilgrim"
                rows={2}
                value={tagline}
                onChange={(e) => setTagline(e.target.value)}
                disabled={submitting}
              />
              <Input
                label="Link (optional)"
                name="pilgrim-link"
                type="url"
                placeholder="https://your-site.xyz"
                value={link}
                onChange={(e) => setLink(e.target.value)}
                disabled={submitting}
              />

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
                disabled={submitting || selected.length < 1 || !nickname.trim()}
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
