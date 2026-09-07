"use client";

import { useState } from "react";
import Link from "next/link";
import { useAuth } from "@/context/auth-context";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { SkillSelector } from "@/components/passport/skill-selector";
import { ClaimSteps, type ClaimStepDef } from "@/components/passport/claim-steps";
import { requestPatronApplication } from "@/lib/patron-sbt-client";
import { PATRON_SKILL_MIN, PATRON_SKILL_MAX } from "@/config/patron-sbt";
import { CheckCircle, Loader2, Building2 } from "lucide-react";

const STEPS: ClaimStepDef[] = [
  { id: "details", label: "Company details & skills" },
  { id: "auth", label: "App authorization" },
  { id: "sign", label: "Sign your application" },
  { id: "submit", label: "Submit (gasless) & confirm" },
];

export function PatronRegistrationForm() {
  const { address, authProvider, isAuthenticated, isLoading } = useAuth();

  const [companyName, setCompanyName] = useState("");
  const [description, setDescription] = useState("");
  const [website, setWebsite] = useState("");
  const [contact, setContact] = useState("");
  const [skills, setSkills] = useState<string[]>([]);

  const [submitting, setSubmitting] = useState(false);
  const [stepIdx, setStepIdx] = useState(0);
  const [progress, setProgress] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<{ applicationId: string } | null>(null);

  const skillsOk =
    skills.length >= PATRON_SKILL_MIN && skills.length <= PATRON_SKILL_MAX;
  const fieldsOk =
    companyName.trim() && description.trim() && website.trim() && contact.trim();
  const canSubmit = Boolean(fieldsOk && skillsOk && !submitting && address);

  async function handleSubmit() {
    if (!address || !canSubmit) return;
    setSubmitting(true);
    setError(null);
    setStepIdx(1);
    try {
      const res = await requestPatronApplication({
        applicant: address,
        skillIds: skills,
        authProvider,
        company: {
          companyName: companyName.trim(),
          description: description.trim(),
          website: website.trim(),
          contact: contact.trim(),
        },
        onStep: (msg) => {
          setProgress(msg);
          if (msg.includes("authorization")) setStepIdx(1);
          else if (msg.includes("signature")) setStepIdx(2);
          else if (msg.includes("Submitting") || msg.includes("Finalizing"))
            setStepIdx(3);
        },
      });
      setDone({ applicationId: res.applicationId });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Application failed";
      setError(msg);
      setStepIdx(0);
    } finally {
      setSubmitting(false);
      setProgress(null);
    }
  }

  if (isLoading) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="w-6 h-6 animate-spin text-muted" />
      </div>
    );
  }

  if (!isAuthenticated || !address) {
    return (
      <Card className="p-8 text-center">
        <Building2 className="w-10 h-10 text-muted mx-auto mb-3" />
        <h2 className="text-lg font-semibold mb-1">Sign in to register a Patron</h2>
        <p className="text-sm text-muted">
          Connect your wallet to register your organization as a Hubs Network Patron.
        </p>
      </Card>
    );
  }

  if (done) {
    return (
      <Card className="p-8 text-center">
        <CheckCircle className="w-12 h-12 text-green-600 mx-auto mb-4" />
        <h2 className="text-xl font-semibold mb-2">Patron application submitted</h2>
        <p className="text-sm text-muted mb-6">
          Your application is now <strong>pending Hubs Network approval</strong>.
          You will be able to see it publicly once an HN Director approves it.
        </p>
        <Link href="/my-patrons">
          <Button>View My Patrons</Button>
        </Link>
      </Card>
    );
  }

  return (
    <div className="grid gap-6 md:grid-cols-[1fr_260px]">
      <Card className="p-6 space-y-5">
        <Input
          label="Company name"
          value={companyName}
          onChange={(e) => setCompanyName(e.target.value)}
          placeholder="Acme Foundation"
          disabled={submitting}
        />
        <Textarea
          label="Description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="What your organization does and how it supports Hubs Network residencies."
          rows={4}
          disabled={submitting}
        />
        <Input
          label="Company website"
          value={website}
          onChange={(e) => setWebsite(e.target.value)}
          placeholder="https://example.org"
          disabled={submitting}
        />
        <Input
          label="Contact"
          value={contact}
          onChange={(e) => setContact(e.target.value)}
          placeholder="Name and email or handle for HN Directors to reach you"
          hint="Shown to HN Directors and to you — not published in the public directory."
          disabled={submitting}
        />

        <div>
          <label className="block text-sm font-medium text-foreground mb-2">
            Skills scope{" "}
            <span
              className={
                skillsOk ? "text-green-600" : "text-muted-light"
              }
            >
              ({skills.length}/{PATRON_SKILL_MAX})
            </span>
          </label>
          <SkillSelector
            selected={skills}
            onChange={setSkills}
            max={PATRON_SKILL_MAX}
            disabled={submitting}
          />
        </div>

        {error && (
          <div className="p-3 rounded-lg bg-red-50 border border-red-200">
            <p className="text-sm text-red-600">{error}</p>
          </div>
        )}

        <Button onClick={handleSubmit} disabled={!canSubmit} className="w-full gap-2">
          {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
          {submitting
            ? "Submitting…"
            : skillsOk
              ? "Submit Patron application"
              : `Select 1–${PATRON_SKILL_MAX} skills to continue`}
        </Button>
        <p className="text-xs text-muted text-center">
          Gasless — you only sign. Hubs Network sponsors the transaction.
        </p>
      </Card>

      <div className="md:pt-2">
        <Card className="p-5">
          <h3 className="text-sm font-semibold text-foreground mb-3">
            How it works
          </h3>
          <ClaimSteps
            steps={STEPS}
            current={stepIdx}
            busy={submitting}
            subLabel={progress}
          />
        </Card>
      </div>
    </div>
  );
}
