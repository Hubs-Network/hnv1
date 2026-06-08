/**
 * Maps server-side Zod validation issues to human-readable entries
 * with the relevant tab/step, so users know exactly what to fix.
 *
 * Step indices match FORM_STEPS (registration) and EDIT_STEPS (edit) which
 * share the same order: 0 Basic, 1 Contact, 2 Identity, 3 Spaces,
 * 4 Accommodation, 5 Challenges, 6 Assets, 7 Network.
 */

const SECTION_MAP: Record<string, { title: string; step: number }> = {
  name: { title: "Basic Info", step: 0 },
  tagline: { title: "Basic Info", step: 0 },
  description: { title: "Basic Info", step: 0 },
  website: { title: "Basic Info", step: 0 },
  contact: { title: "Contact & Location", step: 1 },
  location: { title: "Contact & Location", step: 1 },
  languages: { title: "Contact & Location", step: 1 },
  identity: { title: "Identity", step: 2 },
  spaces: { title: "Spaces", step: 3 },
  accommodation: { title: "Accommodation", step: 4 },
  challenges: { title: "Challenges", step: 5 },
  assets: { title: "Assets", step: 6 },
  network: { title: "Network", step: 7 },
};

const FIELD_LABELS: Record<string, string> = {
  name: "Name",
  tagline: "Tagline",
  description: "Description",
  website: "Website",
  scope: "Scope",
  scale: "Scale",
  url: "URL",
  focus_areas: "Focus areas",
  category: "Category",
  problem_description: "Problem description",
  expected_solution: "Expected solution",
  title: "Title",
  area: "Area",
  type: "Type",
  space_types: "Space types",
  email: "Email",
};

export interface ValidationIssue {
  step: number;
  section: string;
  label: string;
  message: string;
}

export function describeIssues(
  issues: { path?: (string | number)[]; message: string }[]
): ValidationIssue[] {
  return issues.map((issue) => {
    const path = issue.path || [];
    const topKey = String(path[0] ?? "");
    const section = SECTION_MAP[topKey] || { title: "General", step: 0 };

    const parts: string[] = [];
    let fieldKey = topKey;
    if (typeof path[1] === "number") {
      parts.push(`Item ${path[1] + 1}`);
      if (path[2]) fieldKey = String(path[2]);
    } else if (path[1]) {
      fieldKey = String(path[1]);
    }
    const fieldLabel = FIELD_LABELS[fieldKey] || fieldKey;
    if (fieldLabel) parts.push(fieldLabel);

    return {
      step: section.step,
      section: section.title,
      label: parts.join(" · ") || fieldLabel,
      message: issue.message,
    };
  });
}
