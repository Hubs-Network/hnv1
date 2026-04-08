/**
 * Controlled vocabularies for the Hubs Network platform.
 * Shared across schemas, forms, filters, and display logic.
 * Extend these when adding Pilgrims, Patrons, or Residencies.
 */

export const VOCATION_TAGS = [
  "technology",
  "art",
  "environment",
  "economics",
  "community_learning",
  "health_wellbeing",
  "agriculture",
] as const;

export const ORGANIZATIONAL_TYPES = [
  "nonprofit",
  "for_profit",
  "affiliated_research_centre",
] as const;

export const STAGES = ["informal", "incorporated"] as const;

export const REVENUE_MODELS = [
  "donations",
  "memberships_subscriptions",
  "space_or_asset_rental",
  "grants",
  "product_sales",
  "consulting_services",
  "ticketing",
  "food_and_beverage",
  "venture_funding",
] as const;

export const PREFERRED_CONTACT_METHODS = [
  "email",
  "telegram",
  "signal",
  "phone",
  "whatsapp",
] as const;

export const SPACE_TYPES = [
  "coworking",
  "event_space",
  "workshop_space",
  "studio",
  "maker_space",
  "residency_space",
  "garden",
  "kitchen",
  "classroom",
  "office",
  "outdoor_space",
  "gallery",
] as const;

export const ACCOMMODATION_TYPES = [
  "in_house",
  "outsourced",
  "none",
] as const;

export const ACCOMMODATION_FORMATS = [
  "single",
  "dormitory",
  "shared_bathroom",
  "private_bathroom",
] as const;

export const ASSET_CATEGORIES = [
  "hardware",
  "software",
  "infrastructure",
] as const;

export const ASSET_FOCUS_AREAS = [
  "community",
  "education",
  "research",
  "data",
  "media",
  "production",
  "fabrication",
  "art",
  "economy",
  "governance",
  "agriculture",
  "health_wellbeing",
  "operations",
] as const;

export const NETWORK_SCALES = [
  "local",
  "regional",
  "international",
] as const;

export const NETWORK_SCOPES = [
  "funding",
  "events",
  "education",
  "knowledge_transfer",
  "asset_sharing",
  "visibility",
  "research",
  "governance",
  "production",
  "community_building",
] as const;

export const CHALLENGE_AREAS = [
  "funding_revenue",
  "documentation",
  "onboarding",
  "communication",
  "events",
  "software_development",
  "production_fabrication_agriculture",
  "knowledge_transfer",
  "experimentation",
  "governance",
  "space_design",
  "partnerships",
  "community_growth",
  "education_programming",
  "operations",
] as const;

export const LANGUAGES = [
  "english",
  "spanish",
  "french",
  "german",
  "italian",
  "portuguese",
  "dutch",
  "catalan",
  "arabic",
  "mandarin",
  "japanese",
  "korean",
  "hindi",
  "russian",
  "turkish",
  "greek",
  "polish",
  "czech",
  "swedish",
  "norwegian",
  "danish",
  "finnish",
] as const;

// Human-readable labels for display
type LabelMap<T extends readonly string[]> = Record<T[number], string>;

function toLabelMap<T extends readonly string[]>(values: T): LabelMap<T> {
  const map: Record<string, string> = {};
  for (const v of values) {
    map[v] = v
      .replace(/_/g, " ")
      .replace(/\b\w/g, (c) => c.toUpperCase());
  }
  return map as LabelMap<T>;
}

export const VOCATION_TAG_LABELS = toLabelMap(VOCATION_TAGS);
export const ORGANIZATIONAL_TYPE_LABELS = toLabelMap(ORGANIZATIONAL_TYPES);
export const STAGE_LABELS = toLabelMap(STAGES);
export const REVENUE_MODEL_LABELS = toLabelMap(REVENUE_MODELS);
export const PREFERRED_CONTACT_LABELS = toLabelMap(PREFERRED_CONTACT_METHODS);
export const SPACE_TYPE_LABELS = toLabelMap(SPACE_TYPES);
export const ACCOMMODATION_TYPE_LABELS = toLabelMap(ACCOMMODATION_TYPES);
export const ACCOMMODATION_FORMAT_LABELS = toLabelMap(ACCOMMODATION_FORMATS);
export const ASSET_CATEGORY_LABELS = toLabelMap(ASSET_CATEGORIES);
export const ASSET_FOCUS_AREA_LABELS = toLabelMap(ASSET_FOCUS_AREAS);
export const NETWORK_SCALE_LABELS = toLabelMap(NETWORK_SCALES);
export const NETWORK_SCOPE_LABELS = toLabelMap(NETWORK_SCOPES);
export const CHALLENGE_AREA_LABELS = toLabelMap(CHALLENGE_AREAS);
export const LANGUAGE_LABELS = toLabelMap(LANGUAGES);
