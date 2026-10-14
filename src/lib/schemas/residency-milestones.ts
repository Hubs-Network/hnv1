/**
 * Residency Milestone plan — schema & derived helpers.
 *
 * ⚠️ MAINNET WARNING
 * The milestone checklist is an OFF-CHAIN pilot coordination layer. It gates the
 * on-chain award (skill attestation) at the APP/API level only — NOT at the
 * smart-contract level. If trustless enforcement is required later, a new
 * contract (or a Residencies contract upgrade) is needed. The JSON store is
 * public and single-writer (GitHub Contents API / filesystem): do NOT put
 * private information in milestone titles/descriptions.
 */
import { z } from "zod";

export const MAX_MILESTONES = 10;
export const MILESTONE_TITLE_MAX = 120;
export const MILESTONE_DESC_MAX = 1000;

/** Lifecycle of the whole plan. */
export type MilestonePlanStatus =
  | "none"
  | "draft"
  | "submitted"
  | "confirmed"
  | "all_validated"
  | "awarded";

export const MILESTONE_PLAN_STATUSES: readonly MilestonePlanStatus[] = [
  "none",
  "draft",
  "submitted",
  "confirmed",
  "all_validated",
  "awarded",
] as const;

/** Per-milestone mutual-done status. */
export type MilestoneDoneStatus =
  | "open"
  | "pilgrim_done"
  | "hub_done"
  | "validated";

const addressSchema = z
  .string()
  .regex(/^0x[a-fA-F0-9]{40}$/, "Invalid Ethereum address");

export const milestoneItemSchema = z.object({
  id: z.string().min(1),
  title: z.string().trim().min(1).max(MILESTONE_TITLE_MAX),
  description: z.string().trim().max(MILESTONE_DESC_MAX).optional(),
  order: z.number().int().min(0),

  pilgrimDone: z.boolean(),
  pilgrimDoneAt: z.string().optional(),
  pilgrimDoneBy: z.string().optional(),

  hubDone: z.boolean(),
  hubDoneAt: z.string().optional(),
  hubDoneBy: z.string().optional(),

  validatedAt: z.string().optional(),
});

export type ResidencyMilestoneItem = z.infer<typeof milestoneItemSchema>;

export const milestonePlanSchema = z.object({
  residencyId: z.number().int().positive(),
  hubSafe: addressSchema,
  pilgrimPassportTokenId: z.number().int().positive(),
  pilgrimAddress: addressSchema,

  status: z.enum(
    MILESTONE_PLAN_STATUSES as unknown as [MilestonePlanStatus, ...MilestonePlanStatus[]]
  ),

  milestones: z.array(milestoneItemSchema).max(MAX_MILESTONES),

  createdAt: z.string(),
  createdBy: z.string(),

  submittedAt: z.string().optional(),
  submittedBy: z.string().optional(),

  confirmedAt: z.string().optional(),
  confirmedBy: z.string().optional(),

  awardedAt: z.string().optional(),
  awardTxHash: z.string().optional(),

  updatedAt: z.string(),
  updatedBy: z.string(),

  revision: z.number().int().min(0),
});

export type ResidencyMilestonePlan = z.infer<typeof milestonePlanSchema>;

/**
 * PUT input: the editable fields of each milestone. `id` is optional — the
 * server keeps existing ids (to preserve done-state across edits) and mints
 * new ones for added rows. `order` is derived from array position server-side.
 */
export const milestoneInputItemSchema = z.object({
  id: z.string().min(1).optional(),
  title: z.string().trim().min(1).max(MILESTONE_TITLE_MAX),
  description: z.string().trim().max(MILESTONE_DESC_MAX).optional(),
});

export type MilestoneInputItem = z.infer<typeof milestoneInputItemSchema>;

export const updateMilestonesInputSchema = z.object({
  milestones: z.array(milestoneInputItemSchema).max(MAX_MILESTONES),
});

export const doneInputSchema = z.object({
  milestoneId: z.string().min(1),
  actor: z.enum(["pilgrim", "hub"]),
  done: z.boolean(),
});

// ── Derived helpers ────────────────────────────────────────────────────

export function deriveMilestoneDoneStatus(
  m: Pick<ResidencyMilestoneItem, "pilgrimDone" | "hubDone">
): MilestoneDoneStatus {
  if (m.pilgrimDone && m.hubDone) return "validated";
  if (m.pilgrimDone && !m.hubDone) return "pilgrim_done";
  if (!m.pilgrimDone && m.hubDone) return "hub_done";
  return "open";
}

export function isMilestoneValidated(
  m: Pick<ResidencyMilestoneItem, "pilgrimDone" | "hubDone">
): boolean {
  return m.pilgrimDone && m.hubDone;
}

export function allMilestonesValidated(
  milestones: Pick<ResidencyMilestoneItem, "pilgrimDone" | "hubDone">[]
): boolean {
  return milestones.length > 0 && milestones.every(isMilestoneValidated);
}

/**
 * Recompute the confirmed→all_validated transition after a done toggle. Only
 * applies once a plan is `confirmed` or `all_validated`; other states are
 * returned unchanged.
 */
export function recomputePlanStatusAfterDone(
  status: MilestonePlanStatus,
  milestones: Pick<ResidencyMilestoneItem, "pilgrimDone" | "hubDone">[]
): MilestonePlanStatus {
  if (status !== "confirmed" && status !== "all_validated") return status;
  return allMilestonesValidated(milestones) ? "all_validated" : "confirmed";
}

/** Human-friendly plan status for list/cards. */
export const MILESTONE_PLAN_STATUS_LABELS: Record<MilestonePlanStatus, string> = {
  none: "Milestones needed",
  draft: "Draft (pilgrim)",
  submitted: "Waiting for Hub confirmation",
  confirmed: "In progress",
  all_validated: "Ready for attestation",
  awarded: "Awarded",
};
