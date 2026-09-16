"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/context/auth-context";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { SkillSelector } from "@/components/passport/skill-selector";
import { ResidencyStatusBadge } from "./residency-status-badge";
import { createResidency } from "@/lib/residencies-client";
import type { ResidencyUiStatus } from "@/config/residencies";
import { EXTERNAL_FORM_INSTRUCTIONS } from "@/lib/schemas/residency";
import { MAX_RESIDENCY_SKILLS } from "@/config/residencies";
import { Loader2, Plus, X, ScrollText, ExternalLink } from "lucide-react";

interface HubResidencyRow {
  id: string;
  title: string | null;
  uiStatus: ResidencyUiStatus;
  applicantCount: number;
}

export function HubResidenciesSection({
  hubSafe,
  hubName,
}: {
  hubSafe: string;
  hubName: string;
}) {
  const { address, authProvider } = useAuth();

  const [rows, setRows] = useState<HubResidencyRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);

  // form state
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [isCalendarBound, setIsCalendarBound] = useState(false);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [applicationDeadline, setApplicationDeadline] = useState("");
  const [milestones, setMilestones] = useState<string[]>([""]);
  const [skills, setSkills] = useState<string[]>([]);
  const [externalFormLink, setExternalFormLink] = useState("");

  const [submitting, setSubmitting] = useState(false);
  const [progress, setProgress] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/residencies/hub/${hubSafe}`);
      const data = await res.json();
      if (res.ok) setRows(data.residencies ?? []);
    } finally {
      setLoading(false);
    }
  }, [hubSafe]);

  useEffect(() => {
    load();
  }, [load]);

  function setMilestone(i: number, v: string) {
    setMilestones((prev) => prev.map((m, idx) => (idx === i ? v : m)));
  }
  function addMilestone() {
    setMilestones((prev) => [...prev, ""]);
  }
  function removeMilestone(i: number) {
    setMilestones((prev) => prev.filter((_, idx) => idx !== i));
  }

  const cleanMilestones = milestones.map((m) => m.trim()).filter(Boolean);
  const skillsOk = skills.length >= 1 && skills.length <= MAX_RESIDENCY_SKILLS;
  const canSubmit =
    !!address &&
    title.trim() &&
    description.trim() &&
    applicationDeadline &&
    cleanMilestones.length >= 1 &&
    skillsOk &&
    externalFormLink.trim() &&
    (!isCalendarBound || (startDate && endDate)) &&
    !submitting;

  async function handleCreate() {
    if (!address || !canSubmit) return;
    setSubmitting(true);
    setError(null);
    setNotice(null);
    try {
      await createResidency({
        hubSafe,
        hubName,
        signer: address,
        title: title.trim(),
        description: description.trim(),
        isCalendarBound,
        startDate: isCalendarBound ? new Date(startDate).toISOString() : undefined,
        endDate: isCalendarBound ? new Date(endDate).toISOString() : undefined,
        applicationDeadline: new Date(applicationDeadline).toISOString(),
        milestones: cleanMilestones,
        rewardedSkills: skills,
        externalFormLink: externalFormLink.trim(),
        authProvider,
        onStep: setProgress,
      });
      setNotice("Residency created.");
      // reset
      setTitle("");
      setDescription("");
      setIsCalendarBound(false);
      setStartDate("");
      setEndDate("");
      setApplicationDeadline("");
      setMilestones([""]);
      setSkills([]);
      setExternalFormLink("");
      setShowForm(false);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create residency");
    } finally {
      setSubmitting(false);
      setProgress(null);
    }
  }

  return (
    <Card className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <ScrollText className="w-5 h-5 text-primary" />
          <h3 className="text-base font-semibold">Residencies</h3>
        </div>
        <Button
          variant={showForm ? "ghost" : "primary"}
          onClick={() => setShowForm((v) => !v)}
          className="gap-1.5"
        >
          {showForm ? "Close" : (<><Plus className="w-4 h-4" /> Create Residency</>)}
        </Button>
      </div>

      {/* Existing residencies */}
      {loading ? (
        <div className="flex justify-center py-6">
          <Loader2 className="w-5 h-5 animate-spin text-muted" />
        </div>
      ) : rows.length === 0 ? (
        <p className="text-sm text-muted">No residencies yet.</p>
      ) : (
        <div className="space-y-2">
          {rows.map((r) => (
            <Link
              key={r.id}
              href={`/residencies/${r.id}`}
              className="flex items-center justify-between gap-3 p-3 rounded-lg border border-border hover:border-primary/40 transition-colors"
            >
              <div className="min-w-0">
                <p className="text-sm font-medium text-foreground truncate">
                  {r.title || `Residency #${r.id}`}
                </p>
                <p className="text-xs text-muted">
                  {r.applicantCount} applicant{r.applicantCount === 1 ? "" : "s"}
                </p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <ResidencyStatusBadge status={r.uiStatus} />
                <ExternalLink className="w-3.5 h-3.5 text-muted" />
              </div>
            </Link>
          ))}
        </div>
      )}

      {/* Create form */}
      {showForm && (
        <div className="space-y-4 border-t border-border pt-4">
          <p className="text-xs text-muted">
            Your hub must be verified (Hubs Network Badge) to create residencies.
          </p>
          <Input
            label="Title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Regenerative building sprint"
            disabled={submitting}
          />
          <Textarea
            label="Description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="What the residency is about, who it's for, what pilgrims will do."
            rows={4}
            disabled={submitting}
          />

          {/* Time type */}
          <div>
            <label className="block text-sm font-medium text-foreground mb-2">
              Time type
            </label>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setIsCalendarBound(false)}
                className={
                  "px-3 py-1.5 rounded-lg text-sm border transition-colors " +
                  (!isCalendarBound
                    ? "bg-primary text-white border-primary"
                    : "bg-surface text-foreground border-border")
                }
                disabled={submitting}
              >
                Open in time
              </button>
              <button
                type="button"
                onClick={() => setIsCalendarBound(true)}
                className={
                  "px-3 py-1.5 rounded-lg text-sm border transition-colors " +
                  (isCalendarBound
                    ? "bg-primary text-white border-primary"
                    : "bg-surface text-foreground border-border")
                }
                disabled={submitting}
              >
                Specific calendar frame
              </button>
            </div>
          </div>

          {isCalendarBound && (
            <div className="grid grid-cols-2 gap-3">
              <Input
                label="Start date"
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                disabled={submitting}
              />
              <Input
                label="End date"
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                disabled={submitting}
              />
            </div>
          )}

          <Input
            label="Application deadline"
            type="datetime-local"
            value={applicationDeadline}
            onChange={(e) => setApplicationDeadline(e.target.value)}
            disabled={submitting}
          />

          {/* Milestones */}
          <div>
            <label className="block text-sm font-medium text-foreground mb-2">
              Milestones
            </label>
            <div className="space-y-2">
              {milestones.map((m, i) => (
                <div key={i} className="flex gap-2">
                  <input
                    value={m}
                    onChange={(e) => setMilestone(i, e.target.value)}
                    placeholder={`Milestone ${i + 1}`}
                    disabled={submitting}
                    className="flex-1 px-3 py-2 rounded-lg border border-border bg-surface text-sm text-foreground"
                  />
                  {milestones.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeMilestone(i)}
                      className="p-2 text-muted hover:text-red-600"
                      disabled={submitting}
                    >
                      <X className="w-4 h-4" />
                    </button>
                  )}
                </div>
              ))}
            </div>
            <button
              type="button"
              onClick={addMilestone}
              className="mt-2 text-sm text-primary hover:underline inline-flex items-center gap-1"
              disabled={submitting}
            >
              <Plus className="w-3.5 h-3.5" /> Add milestone
            </button>
          </div>

          {/* Rewarded skills */}
          <div>
            <label className="block text-sm font-medium text-foreground mb-2">
              Rewarded skillset{" "}
              <span className={skillsOk ? "text-green-600" : "text-muted-light"}>
                ({skills.length}/{MAX_RESIDENCY_SKILLS})
              </span>
            </label>
            <SkillSelector
              selected={skills}
              onChange={setSkills}
              max={MAX_RESIDENCY_SKILLS}
              disabled={submitting}
            />
          </div>

          {/* External form */}
          <div>
            <Input
              label="External application form link"
              value={externalFormLink}
              onChange={(e) => setExternalFormLink(e.target.value)}
              placeholder="https://forms.gle/…"
              disabled={submitting}
            />
            <p className="text-xs text-muted mt-1.5 bg-stone-50 border border-border rounded-lg p-2.5">
              {EXTERNAL_FORM_INSTRUCTIONS}
            </p>
          </div>

          {error && (
            <div className="p-3 rounded-lg bg-red-50 border border-red-200">
              <p className="text-sm text-red-600">{error}</p>
            </div>
          )}

          <Button onClick={handleCreate} disabled={!canSubmit} className="w-full gap-2">
            {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
            {submitting ? progress || "Creating…" : "Publish residency"}
          </Button>
          <p className="text-xs text-muted text-center">
            Gasless — you only sign. Hubs Network sponsors the transaction.
          </p>
        </div>
      )}

      {notice && (
        <div className="p-3 rounded-lg bg-green-50 border border-green-200">
          <p className="text-sm text-green-700">{notice}</p>
        </div>
      )}
    </Card>
  );
}
