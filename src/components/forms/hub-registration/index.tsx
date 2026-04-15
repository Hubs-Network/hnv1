"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useUP } from "@/context/up-context";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { FORM_STEPS, type FormData } from "./types";
import { BasicInfoStep } from "./steps/basic-info";
import { ContactLocationStep } from "./steps/contact-location";
import { IdentityStep } from "./steps/identity";
import { SpacesStep } from "./steps/spaces";
import { AccommodationStep } from "./steps/accommodation";
import { AssetsStep } from "./steps/assets";
import { NetworkStep } from "./steps/network";
import { ChallengesStep } from "./steps/challenges";
import { ReviewStep } from "./steps/review";
import { ArrowLeft, ArrowRight, Check, Loader2, UserCircle } from "lucide-react";

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
  spaces: [
    {
      name: "",
      space_types: [],
      host_capacity_day: undefined,
      notes: "",
    },
  ],
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
  const { address, isConnected, connect, isConnecting } = useUP();
  const [step, setStep] = useState(0);
  const [data, setData] = useState<FormData>(initialData);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submittedHubId, setSubmittedHubId] = useState<string | null>(null);

  useEffect(() => {
    try {
      const draft = localStorage.getItem(DRAFT_KEY);
      if (draft) {
        const parsed = JSON.parse(draft);
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
  }, []);

  const currentStep = FORM_STEPS[step];
  const isFirst = step === 0;
  const isLast = step === FORM_STEPS.length - 1;

  function goNext() {
    if (step < FORM_STEPS.length - 1) {
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

  async function handleSubmit() {
    if (!address) return;

    setSubmitting(true);
    setSubmitError(null);

    try {
      const res = await fetch("/api/hubs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...data,
          _creator_address: address,
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
          setSubmitError(
            "Please fix the validation errors and try again."
          );
        } else {
          setSubmitError(result.error || "Submission failed");
        }
        return;
      }

      localStorage.removeItem(DRAFT_KEY);
      setSubmitted(true);
      setSubmittedHubId(result.hub_id);
    } catch {
      setSubmitError("Network error. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  // Gate: require UP connection
  if (!isConnected) {
    return (
      <Card padding="lg" className="max-w-lg mx-auto text-center">
        <UserCircle className="w-12 h-12 text-muted-light mx-auto mb-4" />
        <h2 className="text-xl font-bold text-foreground mb-2">
          Connect your Universal Profile
        </h2>
        <p className="text-sm text-muted mb-6 leading-relaxed">
          To register a hub you need to connect your LUKSO Universal Profile.
          Your UP address will be linked as the hub creator and administrator.
        </p>
        <Button onClick={connect} disabled={isConnecting}>
          {isConnecting ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            "Connect Universal Profile"
          )}
        </Button>
        <p className="text-xs text-muted-light mt-4">
          Don&apos;t have one?{" "}
          <a
            href="https://my.universalprofile.cloud"
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary hover:underline"
          >
            Create a Universal Profile
          </a>
        </p>
      </Card>
    );
  }

  if (submitted) {
    return (
      <div className="max-w-2xl mx-auto text-center py-16">
        <div className="w-16 h-16 rounded-full bg-primary-bg flex items-center justify-center mx-auto mb-6">
          <Check className="w-8 h-8 text-primary" />
        </div>
        <h2 className="text-2xl font-bold text-foreground mb-3">
          Hub Registered Successfully
        </h2>
        <p className="text-muted mb-8">
          Your hub profile has been saved and is now visible in the directory.
          Your Universal Profile is registered as the hub administrator.
        </p>
        <div className="flex gap-3 justify-center">
          {submittedHubId && (
            <Button onClick={() => router.push(`/hubs/${submittedHubId}`)}>
              View your hub
            </Button>
          )}
          <Button variant="secondary" onClick={() => router.push("/my-hubs")}>
            My Hubs
          </Button>
        </div>
      </div>
    );
  }

  const stepProps = { data, updateData, errors };

  return (
    <div className="max-w-3xl mx-auto">
      {/* Connected indicator */}
      <div className="mb-6 flex items-center gap-2 text-xs text-muted">
        <span className="w-2 h-2 rounded-full bg-primary-lighter" />
        Connected as <span className="font-mono">{address?.slice(0, 8)}…{address?.slice(-6)}</span>
      </div>

      {/* Step indicator */}
      <div className="mb-8">
        <div className="flex items-center gap-1 overflow-x-auto pb-2">
          {FORM_STEPS.map((s, i) => (
            <button
              key={s.id}
              type="button"
              onClick={() => setStep(i)}
              className={cn(
                "flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium whitespace-nowrap transition-colors",
                i === step
                  ? "bg-primary text-white"
                  : i < step
                    ? "bg-primary-bg text-primary"
                    : "bg-stone-100 text-muted"
              )}
            >
              <span
                className={cn(
                  "w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold",
                  i === step
                    ? "bg-white/20 text-white"
                    : i < step
                      ? "bg-primary/20 text-primary"
                      : "bg-stone-200 text-muted-light"
                )}
              >
                {i < step ? <Check className="w-3 h-3" /> : i + 1}
              </span>
              <span className="hidden sm:inline">{s.title}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Step header */}
      <div className="mb-6">
        <h2 className="text-xl font-bold text-foreground">
          {currentStep.title}
        </h2>
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
        {step === 8 && <ReviewStep {...stepProps} />}
      </div>

      {/* Error message */}
      {submitError && (
        <div className="mb-4 p-4 rounded-lg bg-danger-bg border border-danger/20">
          <p className="text-sm text-danger">{submitError}</p>
        </div>
      )}

      {/* Navigation */}
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

        {isLast ? (
          <Button onClick={handleSubmit} disabled={submitting}>
            {submitting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Submitting…
              </>
            ) : (
              <>
                Submit Registration
                <Check className="w-4 h-4" />
              </>
            )}
          </Button>
        ) : (
          <Button onClick={goNext}>
            Next
            <ArrowRight className="w-4 h-4" />
          </Button>
        )}
      </div>
    </div>
  );
}
