/**
 * Milestone Dashboard authorization (SERVER ONLY).
 *
 * The dashboard is accessible only to the selected Pilgrim (Passport owner) and
 * to Hub Safe signers of the hosting hub. Authorization is derived from
 * authoritative sources: on-chain Passport ownership, on-chain residency
 * selection/award state, and on-chain Safe ownership. Never trust the client.
 *
 * This mirrors the EIP-712 / Safe-ownership identity model used elsewhere — no
 * msg.sender-style trust and no new on-chain surface.
 */
import { getAddress } from "viem";
import {
  getResidency,
  isSelected as readIsSelected,
  isAwarded as readIsAwarded,
  type OnChainResidency,
} from "@/lib/residencies-contract";
import {
  getPassportOwner,
  getPassportTokenOfOwner,
} from "@/lib/pilgrim-passport-sbt";
import { isHubAdmin } from "@/lib/safe";
import type { MilestonePlanStatus } from "@/lib/schemas/residency-milestones";

export type MilestoneRole = "pilgrim" | "hubSigner" | "both" | "none";

export interface MilestoneAccess {
  residency: OnChainResidency;
  role: MilestoneRole;
  isPilgrim: boolean;
  isHubSigner: boolean;
  selected: boolean;
  awarded: boolean;
}

/**
 * Resolve the caller's role for a (residency, passport) pair. Returns null when
 * the residency does not exist.
 */
export async function resolveMilestoneAccess(
  residencyId: bigint,
  pilgrimPassportTokenId: bigint,
  wallet: string
): Promise<MilestoneAccess | null> {
  const residency = await getResidency(residencyId);
  if (!residency) return null;

  let addr: string | null = null;
  try {
    addr = getAddress(wallet);
  } catch {
    addr = null;
  }

  const [selected, awarded] = await Promise.all([
    readIsSelected(residencyId, pilgrimPassportTokenId),
    readIsAwarded(residencyId, pilgrimPassportTokenId),
  ]);

  let isPilgrim = false;
  let isHubSigner = false;

  if (addr) {
    const [ownerOf, hubOwner] = await Promise.all([
      getPassportOwner(pilgrimPassportTokenId).catch(() => null),
      isHubAdmin(residency.hubSafe, addr).catch(() => false),
    ]);
    isHubSigner = hubOwner === true;
    if (ownerOf && getAddress(ownerOf) === addr) {
      const tokenOf = await getPassportTokenOfOwner(addr).catch(() => null);
      isPilgrim = tokenOf !== null && tokenOf === pilgrimPassportTokenId;
    }
  }

  let role: MilestoneRole = "none";
  if (isPilgrim && isHubSigner) role = "both";
  else if (isPilgrim) role = "pilgrim";
  else if (isHubSigner) role = "hubSigner";

  return { residency, role, isPilgrim, isHubSigner, selected, awarded };
}

export interface MilestonePermissions {
  canEditDraft: boolean;
  canEditSubmitted: boolean;
  canSubmit: boolean;
  canConfirm: boolean;
  canMarkPilgrimDone: boolean;
  canMarkHubDone: boolean;
  canAward: boolean;
}

/**
 * Compute per-action permissions from role + current plan status.
 *
 * `allValidated` must reflect whether every milestone is mutually validated.
 * `hasMinimumMilestones` indicates the plan has 1–10 milestones (submit gate).
 */
export function computeMilestonePermissions(args: {
  access: Pick<MilestoneAccess, "isPilgrim" | "isHubSigner" | "selected" | "awarded">;
  status: MilestonePlanStatus;
  allValidated: boolean;
  hasMinimumMilestones: boolean;
}): MilestonePermissions {
  const { access, status, allValidated, hasMinimumMilestones } = args;
  const active = access.selected && !access.awarded;

  const pilgrim = active && access.isPilgrim;
  const hub = active && access.isHubSigner;

  return {
    canEditDraft: pilgrim && (status === "none" || status === "draft"),
    canEditSubmitted: hub && status === "submitted",
    canSubmit: pilgrim && status === "draft" && hasMinimumMilestones,
    canConfirm: hub && status === "submitted" && hasMinimumMilestones,
    canMarkPilgrimDone:
      pilgrim && (status === "confirmed" || status === "all_validated"),
    canMarkHubDone:
      hub && (status === "confirmed" || status === "all_validated"),
    canAward: hub && status === "all_validated" && allValidated,
  };
}
