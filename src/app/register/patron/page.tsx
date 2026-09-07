import type { Metadata } from "next";
import { PatronRegistrationForm } from "@/components/patrons/patron-registration-form";

export const metadata: Metadata = {
  title: "Register a Patron — Hubs Network",
  description:
    "Register your organization as a Hubs Network Patron supporting residencies and activities.",
};

export default function RegisterPatronPage() {
  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-10 sm:py-14">
      <div className="mb-8">
        <p className="text-xs uppercase tracking-wider text-primary font-semibold mb-2">
          Patron
        </p>
        <h1 className="text-2xl sm:text-3xl font-bold text-foreground mb-2">
          Register a Patron
        </h1>
        <p className="text-sm text-muted max-w-2xl">
          Patrons are companies and organizations supporting Hubs Network
          activities and residencies. Applications are reviewed by Hubs Network
          Directors before a Patron badge is minted. A wallet can hold multiple
          Patron badges.
        </p>
      </div>

      <PatronRegistrationForm />
    </div>
  );
}
