import type {
  VOCATION_TAGS,
  ORGANIZATIONAL_TYPES,
  STAGES,
  REVENUE_MODELS,
  PREFERRED_CONTACT_METHODS,
  SPACE_TYPES,
  ACCOMMODATION_TYPES,
  ACCOMMODATION_FORMATS,
  ASSET_CATEGORIES,
  ASSET_FOCUS_AREAS,
  NETWORK_SCALES,
  NETWORK_SCOPES,
  CHALLENGE_AREAS,
  LANGUAGES,
} from "@/config/vocabularies";

// ─── Vocabulary Types ────────────────────────────────────────────────

export type VocationTag = (typeof VOCATION_TAGS)[number];
export type OrganizationalType = (typeof ORGANIZATIONAL_TYPES)[number];
export type Stage = (typeof STAGES)[number];
export type RevenueModel = (typeof REVENUE_MODELS)[number];
export type PreferredContact = (typeof PREFERRED_CONTACT_METHODS)[number];
export type SpaceType = (typeof SPACE_TYPES)[number];
export type AccommodationType = (typeof ACCOMMODATION_TYPES)[number];
export type AccommodationFormat = (typeof ACCOMMODATION_FORMATS)[number];
export type AssetCategory = (typeof ASSET_CATEGORIES)[number];
export type AssetFocusArea = (typeof ASSET_FOCUS_AREAS)[number];
export type NetworkScale = (typeof NETWORK_SCALES)[number];
export type NetworkScope = (typeof NETWORK_SCOPES)[number];
export type ChallengeArea = (typeof CHALLENGE_AREAS)[number];
export type Language = (typeof LANGUAGES)[number];

// ─── Hub Profile ─────────────────────────────────────────────────────

export interface HubContact {
  contact_name: string;
  email: string;
  telegram?: string;
  preferred_contact: PreferredContact[];
}

export interface HubLocation {
  city: string;
  region?: string;
  country: string;
  timezone?: string;
}

export interface HubIdentity {
  vocation_tags: VocationTag[];
  mission_keywords: string[];
  organizational_type: OrganizationalType;
  stage: Stage;
  revenue_models: RevenueModel[];
}

export interface HubSpace {
  name: string;
  space_types: SpaceType[];
  host_capacity_day?: number;
  notes?: string;
}

export interface HubAccommodation {
  type: AccommodationType;
  formats?: AccommodationFormat[];
  notes?: string;
}

export interface HubAsset {
  name: string;
  category: AssetCategory;
  focus_areas: AssetFocusArea[];
  notes?: string;
}

export interface HubNetworkEntry {
  name: string;
  scale: NetworkScale;
  scope: NetworkScope[];
  url?: string;
}

export interface ImpactScores {
  technological: number;
  artistic: number;
  financial: number;
  production: number;
  educational: number;
  community: number;
}

export interface HubChallenge {
  title: string;
  problem_description: string;
  area: ChallengeArea[];
  urgency: number;
  difficulty: number;
  impact_scores: ImpactScores;
  expected_solution: string;
}

export interface HubMetadata {
  submitted_at: string;
  updated_at: string;
  submitted_by: string;
  language: string;
}

export interface HubProfile {
  schema_version: string;
  hub_id: string;
  name: string;
  tagline: string;
  description: string;
  website?: string;
  contact: HubContact;
  location: HubLocation;
  languages: Language[];
  identity: HubIdentity;
  spaces: HubSpace[];
  accommodation: HubAccommodation;
  assets: HubAsset[];
  network: HubNetworkEntry[];
  challenges: HubChallenge[];
  metadata: HubMetadata;
}

// ─── Filter & Query Types ────────────────────────────────────────────

export interface HubFilters {
  search?: string;
  country?: string;
  vocation_tags?: VocationTag[];
  organizational_type?: OrganizationalType;
  stage?: Stage;
  accommodation_type?: AccommodationType;
  revenue_models?: RevenueModel[];
  challenge_areas?: ChallengeArea[];
}

// ─── Generic entity type for future extensibility ────────────────────

export type EntityType = "hub" | "pilgrim" | "patron";

export interface SubmissionResult {
  success: boolean;
  id?: string;
  error?: string;
}
