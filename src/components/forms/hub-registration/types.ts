import type { HubRegistrationInput } from "@/lib/schemas/hub";

export type FormData = HubRegistrationInput;

export interface StepProps {
  data: FormData;
  updateData: (patch: Partial<FormData>) => void;
  errors: Record<string, string>;
}

export interface FormStep {
  id: string;
  title: string;
  description: string;
}

export const FORM_STEPS: FormStep[] = [
  {
    id: "basic",
    title: "Basic Info",
    description: "Name, tagline and description of your hub",
  },
  {
    id: "contact",
    title: "Contact & Location",
    description: "How to reach you and where you are",
  },
  {
    id: "identity",
    title: "Identity",
    description: "Vocation, mission and organizational details",
  },
  {
    id: "spaces",
    title: "Spaces",
    description: "Physical spaces available at your hub",
  },
  {
    id: "accommodation",
    title: "Accommodation",
    description: "Hosting and accommodation options",
  },
  {
    id: "assets",
    title: "Assets",
    description: "Tools, infrastructure and resources",
  },
  {
    id: "network",
    title: "Network",
    description: "Partner organizations and connections",
  },
  {
    id: "challenges",
    title: "Challenges",
    description: "Current challenges and needs",
  },
  {
    id: "review",
    title: "Review & Submit",
    description: "Review your profile before submitting",
  },
];
