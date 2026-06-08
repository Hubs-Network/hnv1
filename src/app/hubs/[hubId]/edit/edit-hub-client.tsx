"use client";

import { useParams, useRouter } from "next/navigation";
import { useEffect, useState, useCallback } from "react";
import { useAuth } from "@/context/auth-context";
import type { HubProfile } from "@/types";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { FormData } from "@/components/forms/hub-registration/types";
import { BasicInfoStep } from "@/components/forms/hub-registration/steps/basic-info";
import { ContactLocationStep } from "@/components/forms/hub-registration/steps/contact-location";
import { IdentityStep } from "@/components/forms/hub-registration/steps/identity";
import { SpacesStep } from "@/components/forms/hub-registration/steps/spaces";
import { AccommodationStep } from "@/components/forms/hub-registration/steps/accommodation";
import { AssetsStep } from "@/components/forms/hub-registration/steps/assets";
import { NetworkStep } from "@/components/forms/hub-registration/steps/network";
import { ChallengesStep } from "@/components/forms/hub-registration/steps/challenges";
import {
  Loader2,
  Check,
  ArrowLeft,
  ArrowRight,
  ShieldX,
  UserCircle,
} from "lucide-react";
import Link from "next/link";
import { AdminPanel } from "@/components/hubs/admin-panel";
import { PendingTransactions } from "@/components/hubs/pending-transactions";
import { describeIssues, type ValidationIssue } from "@/components/forms/hub-registration/validation-issues";

const EDIT_STEPS = [
  { id: "basic", title: "Basic Info", description: "Name, tagline and description" },
  { id: "contact", title: "Contact & Location", description: "How to reach you and where you are" },
  { id: "identity", title: "Identity", description: "Vocation, mission and organizational details" },
  { id: "spaces", title: "Spaces", description: "Physical spaces available at your hub" },
  { id: "accommodation", title: "Accommodation", description: "Hosting and accommodation options" },
  { id: "challenges", title: "Challenges", description: "Current challenges and needs" },
  { id: "assets", title: "Assets", description: "Tools, infrastructure and resources" },
  { id: "network", title: "Network", description: "Partner organizations and connections" },
];


function hubToFormData(hub: HubProfile): FormData {
  return {
    name: hub.name,
    tagline: hub.tagline,
    description: hub.description,
    website: hub.website || "",
    contact: {
      contact_name: hub.contact?.contact_name || "",
      email: hub.contact?.email || "",
      telegram: hub.contact?.telegram || "",
      preferred_contact: hub.contact?.preferred_contact || ([] as never[]),
    },
    location: {
      city: hub.location?.city || "",
      region: hub.location?.region || "",
      country: hub.location?.country || "",
      timezone: hub.location?.timezone || "",
    },
    languages: hub.languages || [],
    identity: {
      vocation_tags: hub.identity?.vocation_tags || [],
      mission_keywords: hub.identity?.mission_keywords || [],
      organizational_type: hub.identity?.organizational_type || "nonprofit",
      stage: hub.identity?.stage || "informal",
      revenue_models: hub.identity?.revenue_models || [],
      revenue_notes: hub.identity?.revenue_notes || "",
    },
    spaces: (hub.spaces && hub.spaces.length > 0)
      ? hub.spaces.map((s) => ({ ...s, notes: s.notes || "" }))
      : [],
    accommodation: {
      type: hub.accommodation?.type || "none",
      formats: hub.accommodation?.formats || [],
      notes: hub.accommodation?.notes || "",
    },
    assets: (hub.assets || []).map((a) => ({ ...a, notes: a.notes || "" })),
    network: (hub.network || []).map((n) => ({ ...n, url: n.url || "" })),
    challenges: hub.challenges || [],
  };
}

export function EditHubClient() {
  const params = useParams();
  const router = useRouter();
  const hubId = params.hubId as string;
  const { address, isAuthenticated } = useAuth();

  const [hub, setHub] = useState<HubProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [authorized, setAuthorized] = useState<boolean | null>(null);

  const [step, setStep] = useState(0);
  const [data, setData] = useState<FormData | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [issueList, setIssueList] = useState<ValidationIssue[]>([]);

  const checkAdmin = useCallback(async () => {
    if (!isAuthenticated || !address) {
      setAuthorized(false);
      return;
    }
    try {
      const res = await fetch("/api/admins/check", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          profile_id: hubId,
          profile_type: "hub",
          wallet_address: address,
          safe_address: hub?.safeAddress,
        }),
      });
      const result = await res.json();
      setAuthorized(result.is_admin === true);
    } catch {
      setAuthorized(false);
    }
  }, [hubId, isAuthenticated, address, hub?.safeAddress]);

  const loadHub = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/hubs/${hubId}`);
      if (!res.ok) {
        setError("Hub not found");
        return;
      }
      const hubData: HubProfile = await res.json();
      setHub(hubData);
      setData(hubToFormData(hubData));
    } catch {
      setError("Failed to load hub");
    } finally {
      setLoading(false);
    }
  }, [hubId]);

  useEffect(() => {
    loadHub();
  }, [loadHub]);

  useEffect(() => {
    if (!loading && hub) {
      checkAdmin();
    }
  }, [loading, hub, checkAdmin]);

  const updateData = useCallback((patch: Partial<FormData>) => {
    setData((prev) => (prev ? { ...prev, ...patch } : prev));
    setErrors({});
    setError(null);
    setIssueList([]);
  }, []);

  const currentStep = EDIT_STEPS[step];
  const isFirst = step === 0;
  const isLast = step === EDIT_STEPS.length - 1;

  function goNext() {
    if (step < EDIT_STEPS.length - 1) {
      setStep(step + 1);
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  }

  function goBack() {
    if (step > 0) {
      setStep(step - 1);
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  }

  async function handleSave() {
    if (!hub || !data || !address) return;

    setSaving(true);
    setError(null);
    setSaved(false);
    setIssueList([]);

    try {
      const res = await fetch(`/api/hubs/${hubId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...data, _wallet_address: address }),
      });

      const result = await res.json();

      if (!res.ok) {
        if (result.issues) {
          const fieldErrors: Record<string, string> = {};
          for (const issue of result.issues) {
            const path = issue.path?.join(".") || "general";
            fieldErrors[path] = issue.message;
          }
          setErrors(fieldErrors);
          setIssueList(describeIssues(result.issues));
          setError("Some fields need attention before saving:");
        } else {
          setError(result.error || "Update failed");
        }
        return;
      }

      setSaved(true);
      setTimeout(() => setSaved(false), 4000);
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-6 h-6 animate-spin text-muted" />
      </div>
    );
  }

  if (!hub || !data || error === "Hub not found") {
    return (
      <div className="text-center py-20">
        <p className="text-muted">Hub not found.</p>
        <Link href="/hubs" className="text-primary hover:underline text-sm mt-2 inline-block">
          Back to Hubs
        </Link>
      </div>
    );
  }

  if (authorized === null) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-6 h-6 animate-spin text-muted" />
        <span className="ml-2 text-sm text-muted">Checking permissions...</span>
      </div>
    );
  }

  if (!authorized) {
    return (
      <div className="max-w-md mx-auto text-center py-20">
        <Card className="p-8">
          {!isAuthenticated ? (
            <>
              <UserCircle className="w-12 h-12 text-muted mx-auto mb-4" />
              <h2 className="text-lg font-semibold mb-2">Login required</h2>
              <p className="text-sm text-muted mb-4">
                Connect your wallet to edit this hub profile.
              </p>
            </>
          ) : (
            <>
              <ShieldX className="w-12 h-12 text-red-500 mx-auto mb-4" />
              <h2 className="text-lg font-semibold mb-2">Access denied</h2>
              <p className="text-sm text-muted mb-4">
                Your wallet is not authorized to edit this hub.
              </p>
            </>
          )}
          <Link href={`/hubs/${hubId}`} className="text-primary hover:underline text-sm">
            Back to {hub.name}
          </Link>
        </Card>
      </div>
    );
  }

  const stepProps = { data, updateData, errors };

  return (
    <div className="max-w-3xl mx-auto">
      <Link
        href={`/hubs/${hubId}`}
        className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-foreground transition-colors mb-6"
      >
        <ArrowLeft className="w-4 h-4" />
        Back to {hub.name}
      </Link>

      <h1 className="text-2xl font-bold text-foreground mb-1">
        Edit {hub.name}
      </h1>
      <p className="text-sm text-muted mb-8">
        Update your hub&apos;s public profile. Navigate between sections and save when ready.
      </p>

      {/* Step indicator */}
      <div className="mb-8">
        <div className="flex items-center gap-1 overflow-x-auto pb-2">
          {EDIT_STEPS.map((s, i) => (
            <button
              key={s.id}
              type="button"
              onClick={() => setStep(i)}
              className={cn(
                "flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium whitespace-nowrap transition-colors",
                i === step
                  ? "bg-primary text-white"
                  : "bg-stone-100 text-muted hover:bg-stone-200"
              )}
            >
              <span
                className={cn(
                  "w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold",
                  i === step
                    ? "bg-white/20 text-white"
                    : "bg-stone-200 text-muted-light"
                )}
              >
                {i + 1}
              </span>
              <span className="hidden sm:inline">{s.title}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Step header */}
      <div className="mb-6">
        <h2 className="text-xl font-bold text-foreground">{currentStep.title}</h2>
        <p className="text-sm text-muted mt-1">{currentStep.description}</p>
      </div>

      {/* Step content */}
      <div className="mb-8">
        {step === 0 && <BasicInfoStep {...stepProps} />}
        {step === 1 && <ContactLocationStep {...stepProps} />}
        {step === 2 && <IdentityStep {...stepProps} />}
        {step === 3 && <SpacesStep {...stepProps} />}
        {step === 4 && <AccommodationStep {...stepProps} />}
        {step === 5 && <ChallengesStep {...stepProps} />}
        {step === 6 && <AssetsStep {...stepProps} />}
        {step === 7 && <NetworkStep {...stepProps} />}
      </div>

      {/* Error / success */}
      {error && (
        <div className="mb-4 p-4 rounded-lg bg-danger-bg border border-danger/20">
          <p className="text-sm text-danger font-medium">{error}</p>
          {issueList.length > 0 && (
            <ul className="mt-3 space-y-1.5">
              {issueList.map((issue, i) => (
                <li key={i} className="text-sm text-danger flex items-start gap-2">
                  <span className="mt-1.5 w-1 h-1 rounded-full bg-danger shrink-0" />
                  <button
                    type="button"
                    onClick={() => {
                      setStep(issue.step);
                      window.scrollTo({ top: 0, behavior: "smooth" });
                    }}
                    className="text-left hover:underline"
                  >
                    <span className="font-medium">{issue.section}</span>
                    {issue.label && (
                      <span className="text-danger/80"> · {issue.label}</span>
                    )}
                    <span className="text-danger/70"> — {issue.message}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {saved && (
        <div className="mb-4 p-4 rounded-lg bg-primary-bg border border-primary/20">
          <p className="text-sm text-primary flex items-center gap-2">
            <Check className="w-4 h-4" />
            Hub updated successfully.
          </p>
        </div>
      )}

      {/* Navigation + Save */}
      <div className="flex items-center justify-between border-t border-border pt-6">
        <Button
          variant="ghost"
          onClick={goBack}
          disabled={isFirst}
          className={isFirst ? "invisible" : ""}
        >
          <ArrowLeft className="w-4 h-4" />
          Back
        </Button>

        <div className="flex items-center gap-3">
          <Button onClick={handleSave} disabled={saving} variant={isLast ? "primary" : "secondary"}>
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

          {!isLast && (
            <Button onClick={goNext}>
              Next
              <ArrowRight className="w-4 h-4" />
            </Button>
          )}
        </div>
      </div>

      {/* Admin management (visible to all admins, editable by owner) */}
      <div className="mt-12 space-y-4">
        <AdminPanel hubId={hubId} safeAddress={hub?.safeAddress} />
        {(hub?.safeAddress || /^0x[a-fA-F0-9]{40}$/.test(hubId)) && (
          <PendingTransactions
            safeAddress={hub?.safeAddress || hubId}
            threshold={1}
            owners={[]}
          />
        )}
      </div>
    </div>
  );
}
