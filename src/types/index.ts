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
  contact_name?: string;
  email?: string;
  telegram?: string;
  preferred_contact?: PreferredContact[];
}

export interface HubLocation {
  city?: string;
  region?: string;
  country?: string;
  timezone?: string;
}

export interface HubIdentity {
  vocation_tags?: VocationTag[];
  mission_keywords?: string[];
  organizational_type?: OrganizationalType;
  stage?: Stage;
  revenue_models?: RevenueModel[];
  revenue_notes?: string;
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
  creator_address?: string;
  language: string;
}

// ─── Hubs Network Badge ──────────────────────────────────────────────

export type HNBadgeStatus = "none" | "pending" | "approved" | "rejected";

export interface HNBadgeApplication {
  submittedAt: string;
  manifestoAccepted: true;
  manifestoUrl: "https://www.hubsnetwork.org/manifesto";
  applicantAddress?: string;
}

export interface HubProfile {
  schema_version: string;
  hub_id: string;
  name: string;
  tagline: string;
  description: string;
  website?: string;
  contact?: HubContact;
  location?: HubLocation;
  languages?: Language[];
  identity?: HubIdentity;
  spaces?: HubSpace[];
  accommodation?: HubAccommodation;
  assets?: HubAsset[];
  network?: HubNetworkEntry[];
  challenges?: HubChallenge[];
  admins?: string[];
  metadata: HubMetadata;
  // On-chain Safe multisig fields (Sepolia)
  safeAddress?: string;
  chainId?: number;
  network_id?: string;
  // Hubs Network Badge application (optional; legacy hubs treated as "none")
  hnBadgeStatus?: HNBadgeStatus;
  hnBadgeApplication?: HNBadgeApplication;
  // Hubs Network Badge SBT (set on approval / rejection)
  hnBadgeTokenId?: string;
  hnBadgeApprovedAt?: string;
  hnBadgeApprovedBy?: string;
  hnBadgeTxHash?: string;
  hnBadgeRejectedAt?: string;
  hnBadgeRejectedBy?: string;
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

// ─── Pilgrim profile (off-chain, editable by the pilgrim) ─────────────

export interface PilgrimSkillSnapshot {
  /** bytes32 on-chain skill hash. */
  hash: string;
  /** Human-readable label resolved at publish time. */
  label: string;
}

/**
 * Off-chain, pilgrim-owned profile stored as data/pilgrims/{wallet}.json.
 *
 * Nickname / tagline / link can be saved anytime. The passport token id is
 * only written when the pilgrim explicitly "publishes" after the hub mints
 * their SBT — and only after verifying on-chain that the wallet owns it.
 */
export interface PilgrimProfile {
  /** Lowercased wallet address — the file id. */
  wallet: string;
  nickname?: string;
  tagline?: string;
  /** Optional external URL (personal site, portfolio, socials). */
  link?: string;
  /** Set on publish, after on-chain ownership verification. */
  passportTokenId?: string;
  /** True once the pilgrim has published (card visible in the directory). */
  published?: boolean;
  /** Skills snapshot captured at publish time for cheap directory rendering. */
  skills?: PilgrimSkillSnapshot[];
  createdAt: string;
  updatedAt: string;
  publishedAt?: string;
}

// ─── Generic entity type for future extensibility ────────────────────

export type EntityType = "hub" | "pilgrim" | "patron";

export interface SubmissionResult {
  success: boolean;
  id?: string;
  error?: string;
}
