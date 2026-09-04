"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/auth-context";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { type FormData } from "./types";
import { describeIssues, type ValidationIssue } from "./validation-issues";
import { RegistrationBasicsStep } from "./steps/registration-basics";
import { Loader2, UserCircle, Shield } from "lucide-react";
import { LoginPanel } from "@/components/auth/login-panel";
import { deploySafeForHub } from "@/lib/safe-client";

const DRAFT_KEY = "hn_hub_registration_draft";

const initialData: FormData = {
  name: "",
  tagline: "",
  description: "",
  website: "",
  contact: {
    contact_name: "",
    email: "",
    telegram: "",
    preferred_contact: [] as never[],
  },
  location: {
    city: "",
    region: "",
    country: "",
    timezone: "",
  },
  languages: [],
  identity: {
    vocation_tags: [],
    mission_keywords: [],
    organizational_type: "nonprofit",
    stage: "informal",
    revenue_models: [],
    revenue_notes: "",
  },
  spaces: [],
  accommodation: {
    type: "none",
    formats: [],
    notes: "",
  },
  assets: [],
  network: [],
  challenges: [],
};

export function HubRegistrationForm() {
  const router = useRouter();
  const { address, isAuthenticated, isLoading: authLoading, authProvider } = useAuth();
  const [data, setData] = useState<FormData>(initialData);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [issueList, setIssueList] = useState<ValidationIssue[]>([]);

  useEffect(() => {
    try {
      const draft = localStorage.getItem(DRAFT_KEY);
      if (draft) {
        const parsed = JSON.parse(draft);
        // Client-only draft hydration; effect avoids SSR hydration mismatch.
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setData((prev) => ({ ...prev, ...parsed }));
      }
    } catch {}
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(DRAFT_KEY, JSON.stringify(data));
    } catch {}
  }, [data]);

  const updateData = useCallback((patch: Partial<FormData>) => {
    setData((prev) => ({ ...prev, ...patch }));
    setErrors({});
    setSubmitError(null);
    setIssueList([]);
  }, []);

  const [deployingStatus, setDeployingStatus] = useState<string | null>(null);

  async function handleSubmit() {
    if (!address) return;
    setSubmitting(true);
    setSubmitError(null);

    try {
      // Step 1: Deploy a Safe on Sepolia (gas-sponsored)
      setDeployingStatus("Deploying your Hub Safe on Sepolia...");
      let safeAddress: string;
      try {
        safeAddress = await deploySafeForHub(address, authProvider);
      } catch (err) {
        setSubmitError(
          `Safe deployment failed: ${err instanceof Error ? err.message : "Unknown error"}. Please try again.`
        );
        return;
      }

      // Step 2: Submit hub profile with Safe address
      setDeployingStatus("Saving hub profile...");
      const res = await fetch("/api/hubs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...data,
          _wallet_address: address,
          _safe_address: safeAddress,
        }),
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
          setSubmitError("Some fields need attention before submitting:");
        } else {
          setSubmitError(result.error || "Submission failed");
        }
        return;
      }

      // Success: clear draft and take the owner straight to their hub dashboard,
      // where they can verify the hub, manage signers and complete the profile.
      localStorage.removeItem(DRAFT_KEY);
      setDeployingStatus("Opening your hub dashboard...");
      router.push(`/hubs/${result.hub_id}/edit`);
    } catch {
      setSubmitError("Network error. Please try again.");
      setSubmitting(false);
      setDeployingStatus(null);
    }
  }

  if (authLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="w-6 h-6 animate-spin text-muted" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="max-w-md mx-auto py-12">
        <Card className="p-8 text-center">
          <UserCircle className="w-12 h-12 text-muted mx-auto mb-4" />
          <h2 className="text-lg font-semibold mb-2">Login required</h2>
          <p className="text-sm text-muted mb-6">
            Connect your wallet or sign in with email to register a hub.
            Your wallet address will be set as the hub owner.
          </p>
          <LoginPanel />
        </Card>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto">
      {/* Step header */}
      <div className="mb-6">
        <h2 className="text-xl font-bold text-foreground">Basic Info</h2>
        <p className="text-sm text-muted mt-1">
          Just the essentials to create your hub. You can complete the full
          profile from your hub dashboard right after.
        </p>
      </div>

      {/* Form */}
      <div className="mb-8">
        <RegistrationBasicsStep data={data} updateData={updateData} errors={errors} />
      </div>

      {/* Error message */}
      {submitError && (
        <div className="mb-4 p-4 rounded-lg bg-danger-bg border border-danger/20">
          <p className="text-sm text-danger font-medium">{submitError}</p>
          {issueList.length > 0 && (
            <ul className="mt-3 space-y-1.5">
              {issueList.map((issue, i) => (
                <li key={i} className="text-sm text-danger flex items-start gap-2">
                  <span className="mt-1.5 w-1 h-1 rounded-full bg-danger shrink-0" />
                  <span>
                    <span className="font-medium">{issue.section}</span>
                    {issue.label && (
                      <span className="text-danger/80"> · {issue.label}</span>
                    )}
                    <span className="text-danger/70"> — {issue.message}</span>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {/* Deploy */}
      <div className="flex items-center justify-end border-t border-border pt-6">
        <Button onClick={handleSubmit} disabled={submitting}>
          {submitting ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              {deployingStatus || "Submitting…"}
            </>
          ) : (
            <>
              <Shield className="w-4 h-4" />
              Deploy Hub
            </>
          )}
        </Button>
      </div>
    </div>
  );
}
