/**
 * Patron profile schema.
 *
 * Company metadata lives off-chain (GitHub JSON at data/patrons/{applicationId}.json).
 * Skills are NEVER stored here — they are authoritative on-chain and read via
 * getApplicationSkills(applicationId) / getSkills(tokenId). The `status` field is
 * a cache/UI convenience; the contract remains the source of truth.
 */
import { z } from "zod";
import { PATRON_SBT_ADDRESS, PATRON_SBT_CHAIN_ID } from "@/config/patron-sbt";

export const PATRON_STATUS_VALUES = [
  "pending",
  "approved",
  "rejected",
  "revoked",
] as const;

export type PatronStatus = (typeof PATRON_STATUS_VALUES)[number];

const hex = z.string().regex(/^0x[a-fA-F0-9]+$/, "Invalid hex value");
const address = z.string().regex(/^0x[a-fA-F0-9]{40}$/, "Invalid address");

/** Zod schema for the persisted Patron JSON file. */
export const patronProfileSchema = z.object({
  applicationId: hex,
  applicant: address,

  companyName: z.string().min(1).max(120),
  description: z.string().min(1).max(4000),
  website: z.string().url().max(300),
  contact: z.string().min(1).max(200),

  chainId: z.number().int(),
  contractAddress: address,

  status: z.enum(PATRON_STATUS_VALUES),

  applicationTxHash: hex.optional(),
  createdAt: z.string(),

  tokenId: z.string().optional(),

  approvedAt: z.string().optional(),
  approvedBy: address.optional(),
  approvalTxHash: hex.optional(),

  rejectedAt: z.string().optional(),
  rejectedBy: address.optional(),
  rejectionTxHash: hex.optional(),

  revokedAt: z.string().optional(),
  revokedBy: address.optional(),
  revocationTxHash: hex.optional(),

  updatedAt: z.string().optional(),
});

export type PatronProfile = z.infer<typeof patronProfileSchema>;

/** Validated shape for the registration form input (company fields only). */
export const patronFormSchema = z.object({
  companyName: z.string().trim().min(1, "Company name is required").max(120),
  description: z.string().trim().min(1, "Description is required").max(4000),
  website: z
    .string()
    .trim()
    .url("Enter a valid URL (https://…)")
    .max(300),
  contact: z.string().trim().min(1, "Contact is required").max(200),
});

export type PatronFormInput = z.infer<typeof patronFormSchema>;

/** Defaults for chain/contract references written into new profiles. */
export const PATRON_JSON_DEFAULTS = {
  chainId: PATRON_SBT_CHAIN_ID,
  contractAddress: PATRON_SBT_ADDRESS,
} as const;
