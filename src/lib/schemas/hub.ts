import { z } from "zod/v4";
import {
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

const scoreRange = z.number().int().min(0).max(5);

const contactSchema = z.object({
  contact_name: z.string().optional().default(""),
  email: z.string().optional().default(""),
  telegram: z.string().optional().default(""),
  preferred_contact: z
    .array(z.enum(PREFERRED_CONTACT_METHODS))
    .optional()
    .default([]),
});

const locationSchema = z.object({
  city: z.string().optional().default(""),
  region: z.string().optional().default(""),
  country: z.string().optional().default(""),
  timezone: z.string().optional().default(""),
});

const identitySchema = z.object({
  vocation_tags: z
    .array(z.enum(VOCATION_TAGS))
    .optional()
    .default([]),
  mission_keywords: z
    .array(z.string().min(1))
    .optional()
    .default([]),
  organizational_type: z.enum(ORGANIZATIONAL_TYPES).optional().default("nonprofit"),
  stage: z.enum(STAGES).optional().default("informal"),
  revenue_models: z
    .array(z.enum(REVENUE_MODELS))
    .optional()
    .default([]),
  revenue_notes: z.string().optional().default(""),
});

const spaceSchema = z.object({
  name: z.string().min(1, "Space name is required"),
  space_types: z
    .array(z.enum(SPACE_TYPES))
    .optional()
    .default([]),
  host_capacity_day: z.number().int().min(0).optional(),
  notes: z.string().optional().default(""),
});

const accommodationSchema = z.object({
  type: z.enum(ACCOMMODATION_TYPES),
  formats: z.array(z.enum(ACCOMMODATION_FORMATS)).optional().default([]),
  notes: z.string().optional().default(""),
});

const assetSchema = z.object({
  name: z.string().min(1, "Asset name is required"),
  category: z.enum(ASSET_CATEGORIES),
  focus_areas: z
    .array(z.enum(ASSET_FOCUS_AREAS))
    .min(1, "Select at least one focus area"),
  notes: z.string().optional().default(""),
});

const networkEntrySchema = z.object({
  name: z.string().min(1, "Network entry name is required"),
  scale: z.enum(NETWORK_SCALES),
  scope: z
    .array(z.enum(NETWORK_SCOPES))
    .min(1, "Select at least one scope"),
  url: z.string().url().optional().or(z.literal("")),
});

const impactScoresSchema = z.object({
  technological: scoreRange,
  artistic: scoreRange,
  financial: scoreRange,
  production: scoreRange,
  educational: scoreRange,
  community: scoreRange,
});

const challengeSchema = z.object({
  title: z.string().min(1, "Challenge title is required"),
  problem_description: z.string().min(10, "Describe the problem (min 10 chars)"),
  area: z
    .array(z.enum(CHALLENGE_AREAS))
    .min(1, "Select at least one challenge area"),
  urgency: z.number().int().min(1).max(5),
  difficulty: z.number().int().min(1).max(5),
  impact_scores: impactScoresSchema,
  expected_solution: z.string().min(10, "Describe expected solution (min 10 chars)"),
});

const metadataSchema = z.object({
  submitted_at: z.string(),
  updated_at: z.string(),
  submitted_by: z.string().min(1),
  creator_address: z.string().optional().default(""),
  language: z.string().default("en"),
});

export const hubProfileSchema = z.object({
  schema_version: z.string().default("0.2"),
  hub_id: z.string().min(1),
  name: z.string().min(2, "Hub name is required (min 2 chars)"),
  tagline: z.string().min(5, "Tagline is required (min 5 chars)"),
  description: z.string().min(20, "Description is required (min 20 chars)"),
  website: z.string().url().optional().or(z.literal("")),
  contact: contactSchema.optional().default(() => ({ contact_name: "", email: "", telegram: "", preferred_contact: [] })),
  location: locationSchema.optional().default(() => ({ city: "", region: "", country: "", timezone: "" })),
  languages: z.array(z.enum(LANGUAGES)).optional().default([]),
  identity: identitySchema.optional().default(() => ({ vocation_tags: [], mission_keywords: [], organizational_type: "nonprofit" as const, stage: "informal" as const, revenue_models: [], revenue_notes: "" })),
  spaces: z.array(spaceSchema).optional().default([]),
  accommodation: accommodationSchema.optional().default(() => ({ type: "none" as const, formats: [], notes: "" })),
  assets: z.array(assetSchema).default([]),
  network: z.array(networkEntrySchema).default([]),
  challenges: z.array(challengeSchema).default([]),
  admins: z.array(z.string()).default([]),
  metadata: metadataSchema,
  // On-chain Safe multisig fields (Sepolia)
  safeAddress: z.string().optional(),
  chainId: z.number().optional(),
  network_id: z.string().optional(),
});

/**
 * Schema for the registration form (excludes auto-generated fields).
 * hub_id, admins, and metadata are generated on submission.
 */
export const hubRegistrationSchema = hubProfileSchema.omit({
  schema_version: true,
  hub_id: true,
  admins: true,
  metadata: true,
  safeAddress: true,
  chainId: true,
  network_id: true,
});

export type HubProfileInput = z.infer<typeof hubProfileSchema>;
export type HubRegistrationInput = z.infer<typeof hubRegistrationSchema>;
