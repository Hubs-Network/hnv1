import type { Metadata } from "next";
import { HubRegistrationForm } from "@/components/forms/hub-registration";

export const metadata: Metadata = {
  title: "Register your Hub",
  description:
    "Register your hub on the Hubs Network platform. Share your spaces, assets, network and challenges.",
};

export default function RegisterHubPage() {
  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <div className="max-w-3xl mx-auto mb-10">
        <h1 className="text-3xl font-bold text-foreground">
          Register your Hub
        </h1>
        <p className="mt-3 text-muted leading-relaxed">
          Share your hub&apos;s profile with the Hubs Network. Fill in the sections
          below to describe your spaces, capabilities, network and challenges.
        </p>
        <div className="mt-4 p-3.5 rounded-lg bg-amber-50 border border-amber-200/60">
          <p className="text-sm text-amber-800">
            All information submitted here will be <strong>publicly visible</strong> and
            stored as open JSON in the project repository. Do not include
            private or sensitive data.
          </p>
        </div>
      </div>

      <HubRegistrationForm />
    </div>
  );
}
