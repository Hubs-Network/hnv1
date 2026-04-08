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
  contact_name: z.string().min(1, "Contact name is required"),
  email: z.email("Valid email is required"),
  telegram: z.string().optional().default(""),
  preferred_contact: z
    .array(z.enum(PREFERRED_CONTACT_METHODS))
    .min(1, "Select at least one contact method"),
});

const locationSchema = z.object({
  city: z.string().min(1, "City is required"),
  region: z.string().optional().default(""),
  country: z.string().min(1, "Country is required"),
  timezone: z.string().optional().default(""),
});

const identitySchema = z.object({
  vocation_tags: z
    .array(z.enum(VOCATION_TAGS))
    .min(1, "Select at least one vocation tag"),
  mission_keywords: z
    .array(z.string().min(1))
    .min(1, "Add at least one mission keyword"),
  organizational_type: z.enum(ORGANIZATIONAL_TYPES),
  stage: z.enum(STAGES),
  revenue_models: z
    .array(z.enum(REVENUE_MODELS))
    .min(1, "Select at least one revenue model"),
});

const spaceSchema = z.object({
  name: z.string().min(1, "Space name is required"),
  space_types: z
    .array(z.enum(SPACE_TYPES))
    .min(1, "Select at least one space type"),
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
  language: z.string().default("en"),
});

export const hubProfileSchema = z.object({
  schema_version: z.string().default("0.2"),
  hub_id: z.string().min(1),
  name: z.string().min(2, "Hub name is required (min 2 chars)"),
  tagline: z.string().min(5, "Tagline is required (min 5 chars)"),
  description: z.string().min(20, "Description is required (min 20 chars)"),
  website: z.string().url().optional().or(z.literal("")),
  contact: contactSchema,
  location: locationSchema,
  languages: z.array(z.enum(LANGUAGES)).min(1, "Select at least one language"),
  identity: identitySchema,
  spaces: z.array(spaceSchema).min(1, "Add at least one space"),
  accommodation: accommodationSchema,
  assets: z.array(assetSchema).default([]),
  network: z.array(networkEntrySchema).default([]),
  challenges: z.array(challengeSchema).default([]),
  metadata: metadataSchema,
});

/**
 * Schema for the registration form (excludes auto-generated fields).
 * hub_id and metadata are generated on submission.
 */
export const hubRegistrationSchema = hubProfileSchema.omit({
  schema_version: true,
  hub_id: true,
  metadata: true,
});

export type HubProfileInput = z.infer<typeof hubProfileSchema>;
export type HubRegistrationInput = z.infer<typeof hubRegistrationSchema>;
