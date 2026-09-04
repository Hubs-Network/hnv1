"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/context/auth-context";
import { cn } from "@/lib/utils";
import { useSkillCatalog } from "@/lib/use-skill-catalog";
import { approvePassportClaim } from "@/lib/pilgrim-passport-client";
import {
  MAX_INITIAL_SKILLS,
  MIN_INITIAL_SKILLS,
} from "@/config/pilgrim-passport";
import { ExternalLink } from "lucide-react";
import type { PilgrimProfile } from "@/types";

interface ClaimRecord {
  claimId: string;
  applicant: string;
  hubSafe: string;
  proposedSkills: string[];
  status: string;
}

/**
 * Hub Safe owner panel: lists pending Passport claims for this hub. The pilgrim
 * already proposed the skills; the owner just reviews them (all preselected by
 * default, individually deselectable to grant a subset) and mints.
 * Rendered only when the connected wallet is a hub Safe owner.
 */
export function HubPassportClaimsAdmin({ hubSafe }: { hubSafe: string }) {
  const { address, authProvider } = useAuth();
  const { labelOf } = useSkillCatalog();
  const [claims, setClaims] = useState<ClaimRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedByClaim, setSelectedByClaim] = useState<Record<string, string[]>>({});
  const [busyClaim, setBusyClaim] = useState<string | null>(null);
  const [errorByClaim, setErrorByClaim] = useState<Record<string, string>>({});
  const [mintedByClaim, setMintedByClaim] = useState<Record<string, string | null>>({});
  const [profileByApplicant, setProfileByApplicant] = useState<
    Record<string, PilgrimProfile | null>
  >({});

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(
        `/api/pilgrim-passport/claims?hubSafe=${hubSafe}`
      ).then((r) => r.json());
      const next: ClaimRecord[] = Array.isArray(res?.claims) ? res.claims : [];
      setClaims(next);
      // Default every claim's selection to ALL proposed skills (owner can then
      // deselect to grant fewer). Preserve any selection already in progress.
      setSelectedByClaim((prev) => {
        const merged = { ...prev };
        for (const c of next) {
          if (!merged[c.claimId]) merged[c.claimId] = [...c.proposedSkills];
        }
        return merged;
      });

      // Fetch the pilgrim identity for each applicant so the owner sees who is
      // claiming, not just an address.
      const applicants = Array.from(
        new Set(next.map((c) => c.applicant.toLowerCase()))
      );
      const entries = await Promise.all(
        applicants.map(async (addr) => {
          try {
            const p = await fetch(`/api/pilgrims/${addr}`).then((r) => r.json());
            return [addr, p?.profile ?? null] as const;
          } catch {
            return [addr, null] as const;
          }
        })
      );
      setProfileByApplicant(Object.fromEntries(entries));
    } catch {
      setClaims([]);
    } finally {
      setLoading(false);
    }
  }, [hubSafe]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  function toggleSkill(claim: ClaimRecord, skillId: string) {
    if (busyClaim === claim.claimId) return;
    setSelectedByClaim((prev) => {
      const current = prev[claim.claimId] ?? [...claim.proposedSkills];
      const next = current.includes(skillId)
        ? current.filter((s) => s !== skillId)
        : [...current, skillId];
      return { ...prev, [claim.claimId]: next };
    });
  }

  async function handleApprove(claim: ClaimRecord) {
    if (!address) return;
    const approvedSkillIds = selectedByClaim[claim.claimId] || [];
    if (
      approvedSkillIds.length < MIN_INITIAL_SKILLS ||
      approvedSkillIds.length > MAX_INITIAL_SKILLS
    ) {
      setErrorByClaim((e) => ({
        ...e,
        [claim.claimId]: `Select ${MIN_INITIAL_SKILLS}–${MAX_INITIAL_SKILLS} skills to approve.`,
      }));
      return;
    }
    setBusyClaim(claim.claimId);
    setErrorByClaim((e) => ({ ...e, [claim.claimId]: "" }));
    try {
      const result = await approvePassportClaim({
        claimId: claim.claimId,
        applicant: claim.applicant,
        hubSafe: claim.hubSafe,
        approvedSkillIds,
        signerAddress: address,
        authProvider,
      });
      setMintedByClaim((m) => ({ ...m, [claim.claimId]: result.tokenId }));
      await refresh();
    } catch (err) {
      const msg =
        err instanceof Error
          ? err.message
          : err && typeof err === "object" && "message" in err
            ? String((err as { message: unknown }).message)
            : "Approval failed";
      setErrorByClaim((e) => ({ ...e, [claim.claimId]: msg || "Approval failed" }));
    } finally {
      setBusyClaim(null);
    }
  }

  return (
    <Card padding="md" className="mt-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-semibold text-foreground">Pending Passport Claims</h3>
        <button
          onClick={refresh}
          className="text-xs text-primary hover:underline"
          type="button"
        >
          Refresh
        </button>
      </div>

      {loading ? (
        <p className="text-sm text-muted">Loading claims…</p>
      ) : claims.length === 0 ? (
        <p className="text-sm text-muted">No pending claims for this hub.</p>
      ) : (
        <div className="space-y-4">
          {claims.map((claim) => {
            const minted = mintedByClaim[claim.claimId];
            const profile = profileByApplicant[claim.applicant.toLowerCase()];
            return (
              <div
                key={claim.claimId}
                className="border border-border rounded-lg p-3 space-y-3"
              >
                <div className="space-y-1">
                  {profile?.nickname && (
                    <p className="text-sm font-semibold text-foreground">
                      {profile.nickname}
                    </p>
                  )}
                  {profile?.tagline && (
                    <p className="text-xs text-muted">{profile.tagline}</p>
                  )}
                  {profile?.link && (
                    <a
                      href={profile.link}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-primary hover:underline inline-flex items-center gap-1"
                    >
                      {profile.link.replace(/^https?:\/\//, "")}
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  )}
                  <p className="text-xs text-muted break-all">
                    Applicant:{" "}
                    <span className="text-foreground">{claim.applicant}</span>
                  </p>
                </div>

                {minted !== undefined ? (
                  <p className="text-sm text-green-700">
                    Minted{minted ? ` Passport #${minted}` : ""}.{" "}
                    {minted && (
                      <Link href={`/passport/${minted}`} className="text-primary hover:underline">
                        View
                      </Link>
                    )}
                  </p>
                ) : (
                  <>
                    <div>
                      <p className="text-xs text-muted mb-1.5">
                        Skills proposed by the pilgrim — tap to exclude any you
                        don&apos;t want to attest:
                      </p>
                      <div className="flex flex-wrap gap-1.5">
                        {claim.proposedSkills.length === 0 && (
                          <span className="text-xs text-muted">
                            Could not load proposed skills from chain.
                          </span>
                        )}
                        {claim.proposedSkills.map((s) => {
                          const isSelected = (
                            selectedByClaim[claim.claimId] ??
                            claim.proposedSkills
                          ).includes(s);
                          return (
                            <button
                              key={s}
                              type="button"
                              onClick={() => toggleSkill(claim, s)}
                              disabled={busyClaim === claim.claimId}
                              className={cn(
                                "px-2.5 py-1 rounded-full text-xs font-medium border transition-colors",
                                isSelected
                                  ? "bg-primary text-white border-primary"
                                  : "bg-surface text-muted border-border line-through hover:bg-stone-50",
                                busyClaim === claim.claimId &&
                                  "opacity-50 cursor-not-allowed"
                              )}
                            >
                              {labelOf(s)}
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {errorByClaim[claim.claimId] && (
                      <p className="text-xs text-danger">{errorByClaim[claim.claimId]}</p>
                    )}

                    <Button
                      size="sm"
                      onClick={() => handleApprove(claim)}
                      disabled={
                        busyClaim === claim.claimId ||
                        (selectedByClaim[claim.claimId] ?? claim.proposedSkills)
                          .length < MIN_INITIAL_SKILLS
                      }
                    >
                      {busyClaim === claim.claimId ? "Approving…" : "Approve & mint"}
                    </Button>
                  </>
                )}
              </div>
            );
          })}
        </div>
      )}
    </Card>
  );
}
