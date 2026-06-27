/**
 * Pilgrim skill categories & display labels — FRONTEND ONLY.
 *
 * The contract stores only bytes32 skill hashes; it never sees categories or
 * labels. This file groups the canonical skill IDs for UI display (selectors,
 * passport rendering). Grouping mirrors the natural clustering of the canonical
 * list in src/config/pilgrim-skills.ts and is purely cosmetic.
 */
import { PILGRIM_SKILL_IDS, type PilgrimSkillId } from "./pilgrim-skills";

export interface PilgrimSkillCategory {
  id: string;
  label: string;
  skills: PilgrimSkillId[];
}

export const PILGRIM_SKILL_CATEGORIES: PilgrimSkillCategory[] = [
  {
    id: "technology",
    label: "Technology & Engineering",
    skills: [
      "software_development",
      "frontend_development",
      "backend_development",
      "mobile_app_development",
      "smart_contracts",
      "blockchain_infrastructure",
      "web3_integrations",
      "ai_ml",
      "data_analysis",
      "cybersecurity",
      "devops",
      "hardware_hacking",
      "electronics",
      "iot",
      "fabrication_maker_skills",
      "no_code_low_code",
    ],
  },
  {
    id: "design",
    label: "Design",
    skills: [
      "product_design",
      "ui_ux",
      "service_design",
      "interaction_design",
      "prototyping",
      "design_research",
      "accessibility_design",
    ],
  },
  {
    id: "arts_media",
    label: "Arts & Media",
    skills: [
      "music",
      "sound_design",
      "audiovisual_production",
      "video_art",
      "photography",
      "digital_art",
      "installations",
      "painting_drawing",
      "sculpture",
      "performance",
      "dance",
      "theatre",
      "writing_journalism",
      "storytelling",
      "cultural_programming",
    ],
  },
  {
    id: "community_governance",
    label: "Community & Governance",
    skills: [
      "community_organizing",
      "coordination",
      "team_facilitation",
      "trust_building",
      "governance_facilitation",
      "dao_operations",
      "conflict_mediation",
      "public_speaking",
      "workshop_facilitation",
      "event_hosting",
      "onboarding_mentoring",
    ],
  },
  {
    id: "business_strategy",
    label: "Business & Strategy",
    skills: [
      "business_development",
      "strategy",
      "finance_accounting",
      "fundraising",
      "grant_writing",
      "tokenomics",
      "impact_measurement",
      "legal_policy",
      "partnerships",
      "communications",
      "marketing",
    ],
  },
  {
    id: "regenerative_environment",
    label: "Regenerative & Environment",
    skills: [
      "regenerative_practices",
      "permaculture",
      "circular_economy",
      "ecological_design",
      "energy_systems",
      "waste_reduction",
      "water_systems",
      "environmental_monitoring",
      "climate_adaptation",
      "low_tech_solutions",
    ],
  },
  {
    id: "food_agriculture",
    label: "Food & Agriculture",
    skills: [
      "traditional_agriculture",
      "urban_farming",
      "beekeeping",
      "food_preservation",
      "cooking",
      "fermentation",
      "agroecology",
      "soil_regeneration",
      "seed_saving",
    ],
  },
  {
    id: "wellbeing_care",
    label: "Wellbeing & Care",
    skills: [
      "wellness_practices",
      "massage",
      "psychotherapy",
      "coaching",
      "martial_arts",
      "self_defense",
      "bodywork",
      "meditation",
      "group_care",
      "trauma_informed_facilitation",
    ],
  },
  {
    id: "education_knowledge",
    label: "Education & Knowledge",
    skills: [
      "education",
      "curriculum_design",
      "research",
      "documentation",
      "knowledge_management",
      "translation",
      "scientific_communication",
      "peer_learning_facilitation",
      "field_research",
    ],
  },
  {
    id: "operations_hospitality",
    label: "Operations & Hospitality",
    skills: [
      "event_production",
      "logistics",
      "space_management",
      "residency_hosting",
      "guest_care",
      "procurement",
      "budgeting",
      "safety_coordination",
      "food_beverage_coordination",
      "travel_coordination",
    ],
  },
];

/** Skill ID → category id (built once from the grouping above). */
const SKILL_TO_CATEGORY: Record<string, string> = (() => {
  const map: Record<string, string> = {};
  for (const cat of PILGRIM_SKILL_CATEGORIES) {
    for (const s of cat.skills) map[s] = cat.id;
  }
  return map;
})();

export function getSkillCategoryId(skillId: string): string | null {
  return SKILL_TO_CATEGORY[skillId] ?? null;
}

/** Label overrides where naive humanization reads poorly. */
const LABEL_OVERRIDES: Partial<Record<PilgrimSkillId, string>> = {
  ai_ml: "AI / ML",
  ui_ux: "UI / UX",
  iot: "IoT",
  dao_operations: "DAO Operations",
  no_code_low_code: "No-code / Low-code",
  web3_integrations: "Web3 Integrations",
  devops: "DevOps",
};

/** Human-readable label for a skill ID (frontend display only). */
export function humanizeSkillId(skillId: string): string {
  if ((LABEL_OVERRIDES as Record<string, string>)[skillId]) {
    return (LABEL_OVERRIDES as Record<string, string>)[skillId];
  }
  return skillId
    .split("_")
    .map((w) => (w ? w[0].toUpperCase() + w.slice(1) : w))
    .join(" ");
}

// Dev-only sanity check: every canonical skill belongs to exactly one category.
if (process.env.NODE_ENV !== "production") {
  const missing = PILGRIM_SKILL_IDS.filter((s) => !SKILL_TO_CATEGORY[s]);
  if (missing.length > 0) {
    console.warn(
      `[pilgrim-skill-categories] uncategorized skills: ${missing.join(", ")}`
    );
  }
}
