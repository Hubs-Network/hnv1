/**
 * Hub profile completeness scoring.
 *
 * Pure, dependency-free helpers usable both server-side (public hub detail
 * page) and client-side (hub dashboard). Weights are tuned so that completing
 * only the mandatory "Basic Info" collected at registration is just a portion
 * of the total — the rest of the profile (identity, spaces, challenges, etc.)
 * is filled later from "Edit Hub Profile".
 *
 * Section weights sum to 100.
 */
import type { HubProfile } from "@/types";

export interface CompletenessSection {
  id: string;
  label: string;
  /** Contribution to the total percentage (all weights sum to 100). */
  weight: number;
  /** How complete this section is, 0..1. */
  score: number;
  /** True when the section is fully complete (score === 1). */
  complete: boolean;
}

export interface HubCompleteness {
  /** Overall completeness, integer 0..100. */
  percent: number;
  sections: CompletenessSection[];
  /** Labels of sections that are not fully complete. */
  missing: string[];
}

function hasText(v?: string | null): boolean {
  return typeof v === "string" && v.trim().length > 0;
}

function hasItems(v?: readonly unknown[] | null): boolean {
  return Array.isArray(v) && v.length > 0;
}

/** Fraction (0..1) of the given boolean checks that pass. */
function fraction(checks: boolean[]): number {
  if (checks.length === 0) return 0;
  const passed = checks.filter(Boolean).length;
  return passed / checks.length;
}

/**
 * Compute a weighted completeness breakdown for a hub profile.
 */
export function computeHubCompleteness(hub: HubProfile): HubCompleteness {
  const sections: CompletenessSection[] = [
    {
      id: "basic",
      label: "Basic Info",
      weight: 20,
      score: fraction([
        hasText(hub.name),
        hasText(hub.tagline),
        hasText(hub.description),
        hasText(hub.website),
        hasText(hub.location?.city),
        hasText(hub.location?.country),
        hasText(hub.contact?.contact_name),
      ]),
      complete: false,
    },
    {
      id: "identity",
      label: "Identity",
      weight: 15,
      score: fraction([
        hasItems(hub.identity?.vocation_tags),
        hasItems(hub.identity?.mission_keywords),
        hasItems(hub.identity?.revenue_models),
      ]),
      complete: false,
    },
    {
      id: "languages",
      label: "Languages",
      weight: 5,
      score: hasItems(hub.languages) ? 1 : 0,
      complete: false,
    },
    {
      id: "spaces",
      label: "Spaces",
      weight: 15,
      score: hasItems(hub.spaces) ? 1 : 0,
      complete: false,
    },
    {
      id: "accommodation",
      label: "Accommodation",
      weight: 10,
      // "none" means the hub explicitly offers no hosting — treated as not adding info.
      score: hub.accommodation && hub.accommodation.type !== "none" ? 1 : 0,
      complete: false,
    },
    {
      id: "challenges",
      label: "Challenges",
      weight: 15,
      score: hasItems(hub.challenges) ? 1 : 0,
      complete: false,
    },
    {
      id: "assets",
      label: "Assets",
      weight: 10,
      score: hasItems(hub.assets) ? 1 : 0,
      complete: false,
    },
    {
      id: "network",
      label: "Network",
      weight: 10,
      score: hasItems(hub.network) ? 1 : 0,
      complete: false,
    },
  ].map((s) => ({ ...s, complete: s.score >= 1 }));

  const weighted = sections.reduce((sum, s) => sum + s.weight * s.score, 0);
  const totalWeight = sections.reduce((sum, s) => sum + s.weight, 0);
  const percent = Math.round((weighted / totalWeight) * 100);

  const missing = sections.filter((s) => !s.complete).map((s) => s.label);

  return { percent, sections, missing };
}
