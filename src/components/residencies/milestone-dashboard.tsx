"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Loader2,
  Lock,
  ListChecks,
  Send,
  CheckCircle,
  Award,
  ExternalLink,
} from "lucide-react";
import { useAuth } from "@/context/auth-context";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { awardPilgrim } from "@/lib/residencies-client";
import {
  MilestoneListEditor,
  newMilestone,
  milestoneFromTitle,
  type EditableMilestone,
} from "./milestone-list-editor";
import {
  MilestoneDoneChecklist,
  type ChecklistMilestone,
} from "./milestone-done-checklist";
import {
  MILESTONE_PLAN_STATUS_LABELS,
  MAX_MILESTONES,
  type MilestonePlanStatus,
} from "@/lib/schemas/residency-milestones";

interface PlanItem {
  id: string;
  title: string;
  description?: string;
  order: number;
  pilgrimDone: boolean;
  hubDone: boolean;
}
interface Plan {
  status: MilestonePlanStatus;
  milestones: PlanItem[];
  awardTxHash?: string;
}
interface Permissions {
  canEditDraft: boolean;
  canEditSubmitted: boolean;
  canSubmit: boolean;
  canConfirm: boolean;
  canMarkPilgrimDone: boolean;
  canMarkHubDone: boolean;
  canAward: boolean;
}
interface GetResp {
  residency: {
    id: string;
    hubSafe: string;
    title: string | null;
    hubName: string | null;
    status: number;
    predefinedMilestones?: string[];
  };
  pilgrim: { tokenId: string; owner: string | null; nickname: string | null };
  plan: Plan | null;
  role: "pilgrim" | "hubSigner" | "both" | "none";
  permissions: Permissions;
}

interface SkillView {
  hash: string;
  id: string | null;
  label: string;
}

export function MilestoneDashboard({
  residencyId,
  pilgrimPassportTokenId,
}: {
  residencyId: string;
  pilgrimPassportTokenId: string;
}) {
  const { address, authProvider, isAuthenticated, isLoading: authLoading } = useAuth();

  const [data, setData] = useState<GetResp | null>(null);
  const [loading, setLoading] = useState(true);
  const [forbidden, setForbidden] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  // Draft/submitted editing buffer
  const [editItems, setEditItems] = useState<EditableMilestone[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [progress, setProgress] = useState<string | null>(null);
  const [doneBusyId, setDoneBusyId] = useState<string | null>(null);

  // Award (hub, all_validated)
  const [awardSkills, setAwardSkills] = useState<SkillView[]>([]);
  const [attestedHashes, setAttestedHashes] = useState<Set<string>>(new Set());
  const [chosenSkills, setChosenSkills] = useState<Set<string>>(new Set());

  const load = useCallback(async (signal?: AbortSignal) => {
    // Wait for the auth session to settle before fetching: during an account
    // switch / optimistic restore `address` is briefly the previous one, and a
    // fetch keyed on it would wrongly 403.
    if (authLoading) return;
    if (!address) {
      setLoading(false);
      return;
    }
    try {
      const res = await fetch(
        `/api/residencies/${residencyId}/milestones/${pilgrimPassportTokenId}?wallet=${address}`,
        { signal }
      );
      if (res.status === 403) {
        setForbidden(true);
        setData(null);
        return;
      }
      const json = await res.json();
      if (!res.ok) {
        setError(json?.error || "Failed to load milestone dashboard");
        return;
      }
      setForbidden(false);
      setError(null);
      setData(json as GetResp);
      // Seed the editor from the plan, or — for a fresh pilgrim draft with no plan
      // yet — from the milestones the hub pre-defined on the residency (which the
      // pilgrim may keep, reorder or delete). Falls back to one empty row.
      const items = (json.plan?.milestones ?? []) as PlanItem[];
      if (items.length > 0) {
        setEditItems(
          items
            .slice()
            .sort((a, b) => a.order - b.order)
            .map((m) => ({ id: m.id, title: m.title, description: m.description ?? "" }))
        );
      } else if (json.permissions?.canEditDraft) {
        const predefined = (json.residency?.predefinedMilestones ?? []) as string[];
        const seeded = predefined
          .map((t) => t.trim())
          .filter((t) => t.length > 0)
          .slice(0, MAX_MILESTONES)
          .map((t) => milestoneFromTitle(t));
        setEditItems(seeded.length > 0 ? seeded : [newMilestone()]);
      } else {
        setEditItems([]);
      }
    } catch (err) {
      // Ignore aborts from a superseded request (e.g. account switch).
      if (signal?.aborted || (err as Error)?.name === "AbortError") return;
      setError("Network error. Please try again.");
    } finally {
      if (!signal?.aborted) setLoading(false);
    }
  }, [address, authLoading, residencyId, pilgrimPassportTokenId]);

  useEffect(() => {
    const controller = new AbortController();
    load(controller.signal);
    return () => controller.abort();
  }, [load]);

  // When the hub needs to award, fetch residency skills + already-attested set.
  useEffect(() => {
    let cancelled = false;
    async function loadAwardSkills() {
      if (!data || !data.permissions.canAward) return;
      try {
        const res = await fetch(`/api/residencies/${residencyId}`);
        const json = await res.json();
        if (cancelled || !res.ok) return;
        const skills: SkillView[] = json.residency?.skills ?? [];
        const applicant = (json.applicants ?? []).find(
          (a: { tokenId: string }) => a.tokenId === pilgrimPassportTokenId
        );
        const attested = new Set<string>(
          (applicant?.alreadyAttestedByHub ?? []).map((h: string) => h.toLowerCase())
        );
        setAwardSkills(skills.filter((s) => s.id && !attested.has(s.hash.toLowerCase())));
        setAttestedHashes(attested);
      } catch {
        // ignore — award UI will show no skills
      }
    }
    loadAwardSkills();
    return () => {
      cancelled = true;
    };
  }, [data, residencyId, pilgrimPassportTokenId]);

  async function run(label: string, fn: () => Promise<unknown>) {
    setBusy(label);
    setError(null);
    setNotice(null);
    setProgress(null);
    try {
      await fn();
      await load();
      setNotice("Done.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Action failed");
    } finally {
      setBusy(null);
      setProgress(null);
    }
  }

  function cleanedItems() {
    return editItems
      .map((m) => ({
        id: m.id,
        title: m.title.trim(),
        description: m.description.trim() || undefined,
      }))
      .filter((m) => m.title.length > 0);
  }

  async function savePlan() {
    const res = await fetch(
      `/api/residencies/${residencyId}/milestones/${pilgrimPassportTokenId}`,
      {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ _wallet_address: address, milestones: cleanedItems() }),
      }
    );
    const json = await res.json();
    if (!res.ok) throw new Error(json?.error || "Failed to save");
  }

  async function postAction(path: string, body?: Record<string, unknown>) {
    const res = await fetch(
      `/api/residencies/${residencyId}/milestones/${pilgrimPassportTokenId}/${path}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ _wallet_address: address, ...(body ?? {}) }),
      }
    );
    const json = await res.json();
    if (!res.ok) throw new Error(json?.error || "Action failed");
  }

  async function toggleDone(
    milestoneId: string,
    actor: "pilgrim" | "hub",
    done: boolean
  ) {
    setDoneBusyId(`${milestoneId}:${actor}`);
    setError(null);
    try {
      await postAction("done", { milestoneId, actor, done });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update");
    } finally {
      setDoneBusyId(null);
    }
  }

  function toggleChosen(skillId: string) {
    setChosenSkills((prev) => {
      const next = new Set(prev);
      if (next.has(skillId)) next.delete(skillId);
      else next.add(skillId);
      return next;
    });
  }

  // ── Render ──────────────────────────────────────────────────────────────
  if (!isAuthenticated) {
    return (
      <Card className="p-8 text-center">
        <Lock className="w-10 h-10 text-muted mx-auto mb-3" />
        <h2 className="text-lg font-semibold mb-1">Sign in required</h2>
        <p className="text-sm text-muted">
          Connect your wallet to open the milestone dashboard.
        </p>
      </Card>
    );
  }

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="w-6 h-6 animate-spin text-muted" />
      </div>
    );
  }

  if (forbidden) {
    return (
      <Card className="p-8 text-center">
        <Lock className="w-10 h-10 text-muted mx-auto mb-3" />
        <h2 className="text-lg font-semibold mb-1">Not authorized</h2>
        <p className="text-sm text-muted mb-4">
          Only the selected Pilgrim and the hosting Hub&apos;s signers can access
          this milestone dashboard.
        </p>
        <Link href="/residencies" className="text-primary hover:underline text-sm">
          Back to Residencies
        </Link>
      </Card>
    );
  }

  if (!data) {
    return (
      <div className="text-center py-20">
        <p className="text-muted">Milestone dashboard unavailable.</p>
        <Link href="/residencies" className="text-primary hover:underline text-sm mt-2 inline-block">
          Back to Residencies
        </Link>
      </div>
    );
  }

  const { residency, pilgrim, plan, permissions, role } = data;
  const status: MilestonePlanStatus = plan?.status ?? "none";
  const checklistItems: ChecklistMilestone[] = (plan?.milestones ?? []).map((m) => ({
    id: m.id,
    title: m.title,
    description: m.description,
    order: m.order,
    pilgrimDone: m.pilgrimDone,
    hubDone: m.hubDone,
  }));
  const showEditor = permissions.canEditDraft || permissions.canEditSubmitted;
  const showChecklist = status === "confirmed" || status === "all_validated" || status === "awarded";
  const pilgrimLabel = pilgrim.nickname || `Passport #${pilgrim.tokenId}`;

  return (
    <div>
      <Link
        href={`/residencies/${residencyId}`}
        className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-foreground transition-colors mb-6"
      >
        <ArrowLeft className="w-4 h-4" />
        Back to residency
      </Link>

      <div className="flex items-center gap-2 mb-1">
        <ListChecks className="w-6 h-6 text-primary" />
        <h1 className="text-2xl font-bold text-foreground">Milestones</h1>
      </div>
      <p className="text-sm text-muted mb-1">
        {residency.title || `Residency #${residency.id}`}
        {residency.hubName ? ` · ${residency.hubName}` : ""}
      </p>
      <p className="text-xs text-muted mb-6">
        Pilgrim: {pilgrimLabel} · Plan status:{" "}
        <span className="font-medium text-foreground">
          {MILESTONE_PLAN_STATUS_LABELS[status]}
        </span>
        {role !== "none" && <> · You are the {role === "both" ? "pilgrim & hub signer" : role === "hubSigner" ? "hub signer" : "pilgrim"}</>}
      </p>

      {/* ── State 1: no plan ─────────────────────────────────────────────── */}
      {status === "none" && !permissions.canEditDraft && (
        <Card className="p-5">
          <p className="text-sm text-muted">
            Waiting for the Pilgrim to submit a milestone plan.
          </p>
        </Card>
      )}

      {/* ── Editor (draft by pilgrim, submitted edits by hub) ────────────── */}
      {showEditor && (
        <Card className="p-5 space-y-4">
          <div>
            <h3 className="text-sm font-semibold text-foreground">
              {permissions.canEditSubmitted
                ? "Review & edit the submitted plan"
                : "Propose your milestones"}
            </h3>
            <p className="text-xs text-muted mt-0.5">
              Up to 10 milestones. Drag to reorder. Each will later need to be
              marked done by both the Pilgrim and a Hub signer.
            </p>
            {status === "none" &&
              permissions.canEditDraft &&
              (residency.predefinedMilestones?.length ?? 0) > 0 && (
                <p className="text-xs text-muted mt-1.5">
                  Pre-filled with the milestones the Hub defined on this residency.
                  Keep them, reorder, edit or delete as you see fit.
                </p>
              )}
          </div>

          <MilestoneListEditor
            items={editItems}
            onChange={setEditItems}
            disabled={busy !== null}
          />

          <div className="flex flex-wrap gap-3 pt-1">
            <Button
              variant="secondary"
              size="sm"
              disabled={busy !== null}
              onClick={() => run("save", savePlan)}
            >
              {busy === "save" && <Loader2 className="w-4 h-4 animate-spin" />}
              Save
            </Button>

            {permissions.canEditDraft && (
              <Button
                size="sm"
                className="gap-1.5"
                disabled={busy !== null || cleanedItems().length < 1}
                onClick={() =>
                  run("submit", async () => {
                    await savePlan();
                    await postAction("submit");
                  })
                }
              >
                {busy === "submit" ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Send className="w-4 h-4" />
                )}
                Submit to Hub
              </Button>
            )}

            {permissions.canConfirm && (
              <Button
                size="sm"
                className="gap-1.5"
                disabled={busy !== null || cleanedItems().length < 1}
                onClick={() =>
                  run("confirm", async () => {
                    await savePlan();
                    await postAction("confirm");
                  })
                }
              >
                {busy === "confirm" ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <CheckCircle className="w-4 h-4" />
                )}
                Confirm plan
              </Button>
            )}
          </div>
        </Card>
      )}

      {/* Pilgrim waiting for hub review (submitted, pilgrim view) */}
      {status === "submitted" && !permissions.canEditSubmitted && role === "pilgrim" && (
        <Card className="p-5">
          <h3 className="text-sm font-semibold text-foreground mb-2">
            Submitted — waiting for Hub confirmation
          </h3>
          <ul className="space-y-1.5">
            {(plan?.milestones ?? [])
              .slice()
              .sort((a, b) => a.order - b.order)
              .map((m) => (
                <li key={m.id} className="text-sm text-foreground flex items-start gap-2">
                  <span className="mt-1.5 w-1 h-1 rounded-full bg-primary shrink-0" />
                  {m.title}
                </li>
              ))}
          </ul>
        </Card>
      )}

      {/* ── Checklist (confirmed / all_validated / awarded) ──────────────── */}
      {showChecklist && (
        <Card className="p-5 space-y-4">
          <div>
            <h3 className="text-sm font-semibold text-foreground">Milestone checklist</h3>
            <p className="text-xs text-muted mt-0.5">
              A milestone is validated once both the Pilgrim and a Hub signer mark
              it done.
            </p>
          </div>
          <MilestoneDoneChecklist
            milestones={checklistItems}
            canMarkPilgrimDone={permissions.canMarkPilgrimDone}
            canMarkHubDone={permissions.canMarkHubDone}
            busyId={doneBusyId}
            onToggle={toggleDone}
          />

          {status === "all_validated" && !permissions.canAward && role === "pilgrim" && (
            <p className="text-sm text-green-700 flex items-center gap-2">
              <CheckCircle className="w-4 h-4" />
              All milestones are validated. Waiting for Hub attestation.
            </p>
          )}
        </Card>
      )}

      {/* ── Award (hub, all_validated) ───────────────────────────────────── */}
      {permissions.canAward && (
        <Card className="p-5 space-y-3 mt-6">
          <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
            <Award className="w-4 h-4 text-primary" />
            Award skills
          </h3>
          <p className="text-xs text-muted">
            All milestones are validated. Choose which residency skills to attest
            to this Passport (subset of the reward skillset). Gasless — you sign
            twice (award + attestation).
          </p>
          {awardSkills.length === 0 ? (
            <p className="text-sm text-muted">
              {attestedHashes.size > 0
                ? "Your Hub has already attested all of this residency's skills to this Passport."
                : "No awardable skills found."}
            </p>
          ) : (
            <>
              <div className="flex flex-wrap gap-1.5">
                {awardSkills.map((s) => {
                  const on = chosenSkills.has(s.id!);
                  return (
                    <button
                      key={s.hash}
                      type="button"
                      onClick={() => toggleChosen(s.id!)}
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
                className="gap-2"
                disabled={busy !== null || chosenSkills.size === 0}
                onClick={() =>
                  run("award", () =>
                    awardPilgrim({
                      residencyId,
                      hubSafe: residency.hubSafe,
                      signer: address!,
                      pilgrimPassportTokenId,
                      skillIds: [...chosenSkills],
                      authProvider,
                      onStep: setProgress,
                    })
                  )
                }
              >
                {busy === "award" && <Loader2 className="w-4 h-4 animate-spin" />}
                Award skills
              </Button>
              {progress && busy === "award" && (
                <p className="text-xs text-muted">{progress}</p>
              )}
            </>
          )}
        </Card>
      )}

      {/* ── Awarded summary ──────────────────────────────────────────────── */}
      {status === "awarded" && (
        <Card className="p-5 mt-6">
          <h3 className="text-sm font-semibold text-green-700 flex items-center gap-2 mb-1">
            <CheckCircle className="w-4 h-4" />
            Skills attested
          </h3>
          <p className="text-sm text-muted">
            This residency has been awarded and the Passport skills attested.
          </p>
          {plan?.awardTxHash && (
            <a
              href={`https://sepolia.etherscan.io/tx/${plan.awardTxHash}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-sm text-primary hover:underline mt-2"
            >
              View attestation tx
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
          )}
        </Card>
      )}

      {progress && busy !== "award" && (
        <p className="text-xs text-muted mt-3">{progress}</p>
      )}
      {error && (
        <div className="p-3 rounded-lg bg-red-50 border border-red-200 mt-4">
          <p className="text-sm text-red-600">{error}</p>
        </div>
      )}
      {notice && !error && (
        <div className="p-3 rounded-lg bg-green-50 border border-green-200 mt-4">
          <p className="text-sm text-green-700">{notice}</p>
        </div>
      )}
    </div>
  );
}
