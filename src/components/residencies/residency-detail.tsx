"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/context/auth-context";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ResidencyStatusBadge } from "./residency-status-badge";
import {
  applyToResidency,
  selectPilgrims,
  awardPilgrim,
  cancelResidency,
} from "@/lib/residencies-client";
import type { ResidencyUiStatus } from "@/config/residencies";
import {
  Loader2,
  ArrowLeft,
  ExternalLink,
  Calendar,
  Clock,
  ListChecks,
  Award,
  CheckCircle,
  Lock,
} from "lucide-react";

// ── Local shapes (mirror the API responses; no server imports in the client) ──
interface SkillView {
  hash: string;
  id: string | null;
  label: string;
}
interface ResidencyView {
  id: string;
  hubSafe: string;
  hubName: string | null;
  title: string | null;
  description: string | null;
  status: number;
  uiStatus: ResidencyUiStatus;
  isApplicationOpen: boolean;
  applicationDeadline: number;
  isCalendarBound: boolean;
  startDate: number;
  endDate: number;
  skills: SkillView[];
  milestones: string[];
  externalFormLink: string | null;
  externalFormInstructions: string | null;
  applicantCount: number;
}
interface ApplicantView {
  tokenId: string;
  owner: string | null;
  nickname: string | null;
  isSelected: boolean;
  isAwarded: boolean;
}
interface Eligibility {
  hasPassport: boolean;
  tokenId: string | null;
  alreadyApplied: boolean;
  matchingSkills: SkillView[];
  canApply: boolean;
}

function fmtDate(unix: number): string {
  if (!unix) return "—";
  return new Date(unix * 1000).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function shortAddr(a: string): string {
  return `${a.slice(0, 6)}…${a.slice(-4)}`;
}

export function ResidencyDetail({ residencyId }: { residencyId: string }) {
  const { address, authProvider, isAuthenticated } = useAuth();

  const [residency, setResidency] = useState<ResidencyView | null>(null);
  const [applicants, setApplicants] = useState<ApplicantView[]>([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  const [eligibility, setEligibility] = useState<Eligibility | null>(null);
  const [isHubSigner, setIsHubSigner] = useState(false);

  const [busy, setBusy] = useState<string | null>(null);
  const [progress, setProgress] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  // Hub selection + award local state
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [awardSkills, setAwardSkills] = useState<Record<string, Set<string>>>({});

  const loadResidency = useCallback(async () => {
    try {
      const res = await fetch(`/api/residencies/${residencyId}`);
      if (res.status === 404) {
        setNotFound(true);
        return;
      }
      const data = await res.json();
      if (res.ok) {
        setResidency(data.residency);
        setApplicants(data.applicants ?? []);
      }
    } finally {
      setLoading(false);
    }
  }, [residencyId]);

  useEffect(() => {
    loadResidency();
  }, [loadResidency]);

  // Viewer-specific: eligibility + hub-signer status
  useEffect(() => {
    let cancelled = false;
    async function loadViewer() {
      if (!isAuthenticated || !address || !residency) {
        setEligibility(null);
        setIsHubSigner(false);
        return;
      }
      try {
        const [elig, adminRes] = await Promise.all([
          fetch(
            `/api/residencies/${residencyId}/eligibility?owner=${address}`
          ).then((r) => r.json()),
          fetch("/api/admins/check", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              profile_id: residency.hubSafe,
              profile_type: "hub",
              wallet_address: address,
              safe_address: residency.hubSafe,
            }),
          }).then((r) => r.json()),
        ]);
        if (cancelled) return;
        setEligibility(elig?.error ? null : elig);
        setIsHubSigner(adminRes?.is_admin === true);
      } catch {
        if (!cancelled) {
          setEligibility(null);
          setIsHubSigner(false);
        }
      }
    }
    loadViewer();
    return () => {
      cancelled = true;
    };
  }, [isAuthenticated, address, residency, residencyId]);

  function toggleSelected(tokenId: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(tokenId)) next.delete(tokenId);
      else next.add(tokenId);
      return next;
    });
  }

  function toggleAwardSkill(tokenId: string, skillId: string) {
    setAwardSkills((prev) => {
      const cur = new Set(prev[tokenId] ?? []);
      if (cur.has(skillId)) cur.delete(skillId);
      else cur.add(skillId);
      return { ...prev, [tokenId]: cur };
    });
  }

  async function run(label: string, fn: () => Promise<unknown>) {
    setBusy(label);
    setError(null);
    setNotice(null);
    setProgress(null);
    try {
      await fn();
      await loadResidency();
      setNotice("Done. On-chain state updated.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Action failed");
    } finally {
      setBusy(null);
      setProgress(null);
    }
  }

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="w-6 h-6 animate-spin text-muted" />
      </div>
    );
  }

  if (notFound || !residency) {
    return (
      <div className="text-center py-20">
        <p className="text-muted">Residency not found.</p>
        <Link href="/bulletin-board" className="text-primary hover:underline text-sm mt-2 inline-block">
          Back to Bulletin Board
        </Link>
      </div>
    );
  }

  const canView = isHubSigner || eligibility?.hasPassport;
  const nowSec = Math.floor(Date.now() / 1000);
  const deadlinePassed = nowSec > residency.applicationDeadline;

  return (
    <div>
      <Link
        href="/bulletin-board"
        className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-foreground transition-colors mb-6"
      >
        <ArrowLeft className="w-4 h-4" />
        Bulletin Board
      </Link>

      <div className="flex items-start justify-between gap-4 mb-1">
        <div>
          {residency.hubName && (
            <p className="text-sm text-muted">{residency.hubName}</p>
          )}
          <h1 className="text-2xl sm:text-3xl font-bold text-foreground">
            {residency.title || `Residency #${residency.id}`}
          </h1>
        </div>
        <ResidencyStatusBadge status={residency.uiStatus} />
      </div>

      {/* Meta */}
      <div className="flex flex-wrap gap-4 text-sm text-muted mt-3 mb-6">
        <span className="inline-flex items-center gap-1.5">
          <Clock className="w-4 h-4" />
          Apply by {fmtDate(residency.applicationDeadline)}
        </span>
        {residency.isCalendarBound ? (
          <span className="inline-flex items-center gap-1.5">
            <Calendar className="w-4 h-4" />
            {fmtDate(residency.startDate)} → {fmtDate(residency.endDate)}
          </span>
        ) : (
          <span className="inline-flex items-center gap-1.5">
            <Calendar className="w-4 h-4" />
            Open in time
          </span>
        )}
      </div>

      {/* Gate: non-pilgrims (and non-signers) cannot see the details */}
      {!canView ? (
        <Card className="p-8 text-center">
          <Lock className="w-10 h-10 text-muted mx-auto mb-3" />
          <h2 className="text-lg font-semibold mb-1">Pilgrims only</h2>
          <p className="text-sm text-muted mb-4">
            {isAuthenticated
              ? "Claim a Pilgrim Passport first to explore and apply to residencies."
              : "Sign in and claim a Pilgrim Passport to explore and apply to residencies."}
          </p>
          <Link href="/pilgrims">
            <Button>Become a Pilgrim</Button>
          </Link>
        </Card>
      ) : (
        <div className="space-y-6">
          {/* Description */}
          {residency.description && (
            <Card className="p-5">
              <p className="text-sm text-foreground whitespace-pre-wrap">
                {residency.description}
              </p>
            </Card>
          )}

          {/* Rewarded skills */}
          <Card className="p-5">
            <h3 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
              <Award className="w-4 h-4 text-primary" />
              Rewarded skills
            </h3>
            <div className="flex flex-wrap gap-1.5">
              {residency.skills.map((s) => (
                <span
                  key={s.hash}
                  className="px-2.5 py-1 rounded-full text-xs font-medium bg-primary-bg text-primary border border-primary/15"
                >
                  {s.label}
                </span>
              ))}
            </div>
          </Card>

          {/* Milestones */}
          {residency.milestones.length > 0 && (
            <Card className="p-5">
              <h3 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
                <ListChecks className="w-4 h-4 text-primary" />
                Milestones
              </h3>
              <ul className="space-y-1.5">
                {residency.milestones.map((m, i) => (
                  <li key={i} className="text-sm text-foreground flex items-start gap-2">
                    <span className="mt-1.5 w-1 h-1 rounded-full bg-primary shrink-0" />
                    {m}
                  </li>
                ))}
              </ul>
            </Card>
          )}

          {/* External form + Apply */}
          {residency.externalFormLink && (
            <Card className="p-5">
              <h3 className="text-sm font-semibold text-foreground mb-2">
                How to apply
              </h3>
              <ol className="text-sm text-muted space-y-1 mb-3 list-decimal list-inside">
                <li>Open and submit the external application form.</li>
                <li>Return here and apply on-chain with your Passport.</li>
              </ol>
              {residency.externalFormInstructions && (
                <p className="text-xs text-muted bg-stone-50 border border-border rounded-lg p-3 mb-3">
                  {residency.externalFormInstructions}
                </p>
              )}
              <a
                href={residency.externalFormLink}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-sm text-primary hover:underline"
              >
                Open external form
                <ExternalLink className="w-3.5 h-3.5" />
              </a>

              {/* Apply CTA (pilgrims) */}
              {eligibility?.hasPassport && (
                <div className="mt-4 pt-4 border-t border-border">
                  {eligibility.alreadyApplied ? (
                    <p className="text-sm text-green-700 flex items-center gap-2">
                      <CheckCircle className="w-4 h-4" />
                      You have applied to this residency.
                    </p>
                  ) : eligibility.canApply ? (
                    <Button
                      disabled={busy !== null}
                      onClick={() =>
                        run("apply", () =>
                          applyToResidency({
                            residencyId,
                            pilgrim: address!,
                            pilgrimPassportTokenId: eligibility.tokenId!,
                            matchingSkillId: eligibility.matchingSkills[0].id!,
                            authProvider,
                            onStep: setProgress,
                          })
                        )
                      }
                      className="gap-2"
                    >
                      {busy === "apply" && <Loader2 className="w-4 h-4 animate-spin" />}
                      Apply on Hubs Network
                    </Button>
                  ) : (
                    <p className="text-sm text-muted">
                      {residency.uiStatus !== "open"
                        ? "Applications are closed for this residency."
                        : eligibility.matchingSkills.length === 0
                          ? "Your Passport has no matching skill for this residency."
                          : "You cannot apply right now."}
                    </p>
                  )}
                  {progress && busy === "apply" && (
                    <p className="text-xs text-muted mt-2">{progress}</p>
                  )}
                </div>
              )}
            </Card>
          )}

          {/* Applicants */}
          <Card className="p-5">
            <h3 className="text-sm font-semibold text-foreground mb-3">
              Applicants ({applicants.length})
            </h3>
            {applicants.length === 0 ? (
              <p className="text-sm text-muted">No applicants yet.</p>
            ) : (
              <div className="space-y-2">
                {applicants.map((a) => (
                  <div
                    key={a.tokenId}
                    className="flex items-center justify-between gap-3 p-3 rounded-lg border border-border"
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">
                        {a.nickname || `Passport #${a.tokenId}`}
                      </p>
                      <p className="text-xs text-muted">
                        Passport #{a.tokenId}
                        {a.owner ? ` · ${shortAddr(a.owner)}` : ""}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {a.isAwarded && (
                        <span className="text-[11px] px-2 py-0.5 rounded-full bg-green-100 text-green-700 border border-green-200">
                          Awarded
                        </span>
                      )}
                      {a.isSelected && !a.isAwarded && (
                        <span className="text-[11px] px-2 py-0.5 rounded-full bg-primary-bg text-primary border border-primary/15">
                          Selected
                        </span>
                      )}
                      {/* Hub selection checkbox (open + deadline passed) */}
                      {isHubSigner &&
                        residency.uiStatus === "applications_closed" &&
                        !a.isSelected && (
                          <label className="text-xs flex items-center gap-1.5 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={selected.has(a.tokenId)}
                              onChange={() => toggleSelected(a.tokenId)}
                            />
                            Select
                          </label>
                        )}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Hub: waiting for the deadline before selection can open */}
            {isHubSigner && residency.uiStatus === "open" && (
              <div className="mt-4 pt-4 border-t border-border">
                <p className="text-sm text-muted flex items-center gap-2">
                  <Clock className="w-4 h-4 shrink-0" />
                  Selection opens after the application deadline (
                  {fmtDate(residency.applicationDeadline)}).
                </p>
              </div>
            )}

            {/* Hub: select & close */}
            {isHubSigner &&
              residency.uiStatus === "applications_closed" &&
              deadlinePassed && (
                <div className="mt-4 pt-4 border-t border-border">
                  <Button
                    disabled={busy !== null || selected.size === 0}
                    onClick={() =>
                      run("select", () =>
                        selectPilgrims({
                          residencyId,
                          signer: address!,
                          pilgrimPassportTokenIds: [...selected],
                          authProvider,
                          onStep: setProgress,
                        })
                      )
                    }
                    className="gap-2"
                  >
                    {busy === "select" && <Loader2 className="w-4 h-4 animate-spin" />}
                    Select {selected.size > 0 ? `(${selected.size})` : ""} & close
                  </Button>
                  {progress && busy === "select" && (
                    <p className="text-xs text-muted mt-2">{progress}</p>
                  )}
                </div>
              )}
          </Card>

          {/* Hub: award selected pilgrims (closed) */}
          {isHubSigner && residency.uiStatus === "closed" && (
            <Card className="p-5">
              <h3 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
                <Award className="w-4 h-4 text-primary" />
                Award selected Pilgrims
              </h3>
              {applicants.filter((a) => a.isSelected).length === 0 ? (
                <p className="text-sm text-muted">No selected pilgrims.</p>
              ) : (
                <div className="space-y-4">
                  {applicants
                    .filter((a) => a.isSelected)
                    .map((a) => {
                      const chosen = awardSkills[a.tokenId] ?? new Set<string>();
                      return (
                        <div
                          key={a.tokenId}
                          className="p-3 rounded-lg border border-border"
                        >
                          <p className="text-sm font-medium text-foreground mb-1">
                            {a.nickname || `Passport #${a.tokenId}`}
                          </p>
                          {a.isAwarded ? (
                            <p className="text-sm text-green-700 flex items-center gap-2">
                              <CheckCircle className="w-4 h-4" />
                              Awarded
                            </p>
                          ) : (
                            <>
                              <p className="text-xs text-muted mb-2">
                                Choose skills to attest (subset of the residency skillset):
                              </p>
                              <div className="flex flex-wrap gap-1.5 mb-3">
                                {residency.skills
                                  .filter((s) => s.id)
                                  .map((s) => {
                                    const on = chosen.has(s.id!);
                                    return (
                                      <button
                                        key={s.hash}
                                        type="button"
                                        onClick={() => toggleAwardSkill(a.tokenId, s.id!)}
                                        className={
                                          "px-2.5 py-1 rounded-full text-xs font-medium border transition-colors " +
                                          (on
                                            ? "bg-primary text-white border-primary"
                                            : "bg-surface text-foreground border-border hover:bg-stone-50")
                                        }
                                      >
                                        {s.label}
                                      </button>
                                    );
                                  })}
                              </div>
                              <Button
                                disabled={busy !== null || chosen.size === 0}
                                onClick={() =>
                                  run(`award-${a.tokenId}`, () =>
                                    awardPilgrim({
                                      residencyId,
                                      hubSafe: residency.hubSafe,
                                      signer: address!,
                                      pilgrimPassportTokenId: a.tokenId,
                                      skillIds: [...chosen],
                                      authProvider,
                                      onStep: setProgress,
                                    })
                                  )
                                }
                                className="gap-2"
                              >
                                {busy === `award-${a.tokenId}` && (
                                  <Loader2 className="w-4 h-4 animate-spin" />
                                )}
                                Award skills
                              </Button>
                              {progress && busy === `award-${a.tokenId}` && (
                                <p className="text-xs text-muted mt-2">{progress}</p>
                              )}
                            </>
                          )}
                        </div>
                      );
                    })}
                </div>
              )}
            </Card>
          )}

          {/* Hub: cancel (open) */}
          {isHubSigner && residency.uiStatus === "open" && (
            <Card className="p-5">
              <h3 className="text-sm font-semibold text-foreground mb-1">
                Danger zone
              </h3>
              <p className="text-xs text-muted mb-3">
                Cancelling closes this residency permanently.
              </p>
              <Button
                variant="ghost"
                disabled={busy !== null}
                onClick={() =>
                  run("cancel", () =>
                    cancelResidency({
                      residencyId,
                      signer: address!,
                      authProvider,
                      onStep: setProgress,
                    })
                  )
                }
                className="gap-2 text-red-600"
              >
                {busy === "cancel" && <Loader2 className="w-4 h-4 animate-spin" />}
                Cancel residency
              </Button>
            </Card>
          )}

          {error && (
            <div className="p-3 rounded-lg bg-red-50 border border-red-200">
              <p className="text-sm text-red-600">{error}</p>
            </div>
          )}
          {notice && (
            <div className="p-3 rounded-lg bg-green-50 border border-green-200">
              <p className="text-sm text-green-700">{notice}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
