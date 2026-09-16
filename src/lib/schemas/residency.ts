/**
 * Residency metadata schema + canonical hashing.
 *
 * Title, description, milestones and the external form link live OFF-chain in
 * GitHub JSON. On-chain we only anchor `metadataURI` + `metadataHash`.
 *
 * Skills are NOT authoritative here — they are read from the contract via
 * getResidencySkills(id). We still persist `rewardedSkills` (canonical ids) for
 * convenient display and to reconstruct the exact skills the hub selected.
 */
import { z } from "zod";
import { keccak256, toBytes, type Hex } from "viem";
import { RESIDENCIES_CHAIN_ID } from "@/config/residencies";

export const RESIDENCY_METADATA_SCHEMA_ID = "hubs-network-residency-v1" as const;

/** Persisted metadata JSON (data/residencies/<hubSafe>/<draftId>.json). */
export const residencyMetadataSchema = z.object({
  schema: z.literal(RESIDENCY_METADATA_SCHEMA_ID),
  residencyId: z.string().optional(),
  chainId: z.literal(RESIDENCIES_CHAIN_ID),
  contractAddress: z.string(),
  hubSafe: z.string(),
  hubName: z.string(),
  title: z.string().min(1).max(200),
  description: z.string().min(1).max(8000),
  isCalendarBound: z.boolean(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  applicationDeadline: z.string(),
  milestones: z.array(z.string().min(1)).min(1),
  rewardedSkills: z.array(z.string().min(1)).min(1).max(10),
  externalFormLink: z.string().url(),
  externalFormInstructions: z.string(),
  createdBy: z.string(),
  createdAt: z.string(),
  txHash: z.string().optional(),
  /** Opaque stable id (folder key), set by the server on create. */
  draftId: z.string(),
});

export type ResidencyMetadata = z.infer<typeof residencyMetadataSchema>;

/** Standard copy required near the external form link field. */
export const EXTERNAL_FORM_INSTRUCTIONS =
  "Your external application form must include the Pilgrim wallet address and/or the pseudonym displayed on Hubs Network, so that the Hub can match the form response to the on-chain Passport application.";

/**
 * Deterministic canonical stringification for hashing. Excludes volatile fields
 * (residencyId, txHash) that are only known/added AFTER the hash is signed, so
 * the hash stays stable across the create → persist-residencyId lifecycle.
 */
export function canonicalResidencyJson(
  meta: Omit<ResidencyMetadata, "residencyId" | "txHash">
): string {
  const ordered = {
    schema: meta.schema,
    chainId: meta.chainId,
    contractAddress: meta.contractAddress.toLowerCase(),
    hubSafe: meta.hubSafe.toLowerCase(),
    hubName: meta.hubName,
    title: meta.title,
    description: meta.description,
    isCalendarBound: meta.isCalendarBound,
    startDate: meta.startDate ?? "",
    endDate: meta.endDate ?? "",
    applicationDeadline: meta.applicationDeadline,
    milestones: meta.milestones,
    rewardedSkills: meta.rewardedSkills,
    externalFormLink: meta.externalFormLink,
    externalFormInstructions: meta.externalFormInstructions,
    createdBy: meta.createdBy.toLowerCase(),
    createdAt: meta.createdAt,
    draftId: meta.draftId,
  };
  return JSON.stringify(ordered);
}

/** metadataHash = keccak256(utf8Bytes(canonicalJson)). */
export function computeMetadataHash(
  meta: Omit<ResidencyMetadata, "residencyId" | "txHash">
): Hex {
  return keccak256(toBytes(canonicalResidencyJson(meta)));
}

/** Opaque, stable metadata URI scheme: hnres:v1:<hubSafe>:<draftId>. */
export function buildResidencyMetadataURI(
  hubSafe: string,
  draftId: string
): string {
  return `hnres:v1:${hubSafe.toLowerCase()}:${draftId}`;
}

export function parseResidencyMetadataURI(
  uri: string
): { hubSafe: string; draftId: string } | null {
  const m = /^hnres:v1:(0x[a-fA-F0-9]{40}):([A-Za-z0-9_-]+)$/.exec(uri.trim());
  if (!m) return null;
  return { hubSafe: m[1].toLowerCase(), draftId: m[2] };
}

/** Zod schema for the create-residency form payload (server validation). */
export const createResidencyInputSchema = z
  .object({
    hubSafe: z.string().regex(/^0x[a-fA-F0-9]{40}$/),
    hubName: z.string().min(1),
    title: z.string().min(1).max(200),
    description: z.string().min(1).max(8000),
    isCalendarBound: z.boolean(),
    startDate: z.string().optional(),
    endDate: z.string().optional(),
    applicationDeadline: z.string().min(1),
    milestones: z.array(z.string().min(1)).min(1),
    rewardedSkills: z.array(z.string().min(1)).min(1).max(10),
    externalFormLink: z.string().url(),
    createdBy: z.string().regex(/^0x[a-fA-F0-9]{40}$/),
  })
  .refine(
    (v) => {
      const deadlineMs = Date.parse(v.applicationDeadline);
      return !Number.isNaN(deadlineMs) && deadlineMs > Date.now();
    },
    { message: "Application deadline must be a valid future date", path: ["applicationDeadline"] }
  )
  .refine(
    (v) => {
      if (!v.isCalendarBound) return true;
      const s = v.startDate ? Date.parse(v.startDate) : NaN;
      const e = v.endDate ? Date.parse(v.endDate) : NaN;
      return !Number.isNaN(s) && !Number.isNaN(e) && e > s;
    },
    { message: "Calendar-bound residencies need a start date and a later end date", path: ["endDate"] }
  );

export type CreateResidencyInput = z.infer<typeof createResidencyInputSchema>;
