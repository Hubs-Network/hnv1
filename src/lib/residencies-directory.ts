/**
 * Residency directory helpers (SERVER ONLY).
 *
 * Assembles a UI-friendly "ResidencyView" from on-chain data (authoritative)
 * + off-chain metadata JSON + resolved skill labels. Used by the Bulletin Board,
 * the residency detail page and the hub dashboard.
 *
 * The contract is the source of truth for status, skills, applicants, selection
 * and awards; the JSON only supplies title/description/milestones/form link.
 */
import type { Hex } from "viem";
import {
  RESIDENCY_STATUS,
  type ResidencyUiStatus,
} from "@/config/residencies";
import {
  getResidency,
  getResidencySkills,
  getResidencyApplicants,
  getSelectedPilgrims,
  getHubResidencies,
  getTotalResidencies,
  isApplicationOpen as readIsApplicationOpen,
  isAwarded as readIsAwarded,
  type OnChainResidency,
} from "@/lib/residencies-contract";
import { getResidencyMetadata } from "@/lib/data/residencies";
import { parseResidencyMetadataURI, type ResidencyMetadata } from "@/lib/schemas/residency";
import { resolveSkillId, resolveSkillLabelByHash } from "@/lib/pilgrim-skills-catalog";
import {
  getPassportOwner,
  hasActiveAttestation,
} from "@/lib/pilgrim-passport-sbt";
import { getPilgrimByWallet } from "@/lib/data/pilgrims";

export interface ResidencySkillView {
  hash: string;
  id: string | null;
  label: string;
}

export interface ResidencyView {
  id: string;
  hubSafe: string;
  hubName: string | null;
  title: string | null;
  description: string | null;
  metadataURI: string;
  metadataHash: string;
  status: number;
  uiStatus: ResidencyUiStatus;
  isApplicationOpen: boolean;
  createdAt: number;
  applicationDeadline: number;
  isCalendarBound: boolean;
  startDate: number;
  endDate: number;
  skills: ResidencySkillView[];
  milestones: string[];
  externalFormLink: string | null;
  externalFormInstructions: string | null;
  applicantCount: number;
  metadata: ResidencyMetadata | null;
}

export interface ResidencyApplicantView {
  tokenId: string;
  owner: string | null;
  nickname: string | null;
  isSelected: boolean;
  isAwarded: boolean;
  /**
   * Lowercased residency-skill hashes ALREADY actively attested to this passport
   * by the residency's hub. Those cannot be awarded again by the same hub
   * (PilgrimPassportSBT reverts with DuplicateAttestation), so the award UI hides
   * them. Only computed for selected pilgrims (empty otherwise).
   */
  alreadyAttestedByHub: string[];
}

export function deriveUiStatus(
  status: number,
  applicationOpen: boolean
): ResidencyUiStatus {
  if (status === RESIDENCY_STATUS.Open) {
    return applicationOpen ? "open" : "applications_closed";
  }
  if (status === RESIDENCY_STATUS.Closed) return "closed";
  if (status === RESIDENCY_STATUS.Cancelled) return "cancelled";
  return "none";
}

async function resolveSkills(hashes: Hex[]): Promise<ResidencySkillView[]> {
  return Promise.all(
    hashes.map(async (hash) => ({
      hash,
      id: await resolveSkillId(hash),
      label: await resolveSkillLabelByHash(hash),
    }))
  );
}

async function loadMetadata(
  onChain: OnChainResidency
): Promise<ResidencyMetadata | null> {
  const parsed = parseResidencyMetadataURI(onChain.metadataURI);
  if (!parsed) return null;
  return getResidencyMetadata(parsed.hubSafe, parsed.draftId);
}

/** Build a full ResidencyView for a single id (null if not found on-chain). */
export async function getResidencyView(
  residencyId: bigint
): Promise<ResidencyView | null> {
  const onChain = await getResidency(residencyId);
  if (!onChain) return null;

  const [skillHashes, applicants, applicationOpen, metadata] = await Promise.all([
    getResidencySkills(residencyId),
    getResidencyApplicants(residencyId),
    readIsApplicationOpen(residencyId),
    loadMetadata(onChain),
  ]);

  const skills = await resolveSkills(skillHashes);

  return {
    id: residencyId.toString(),
    hubSafe: onChain.hubSafe,
    hubName: metadata?.hubName ?? null,
    title: metadata?.title ?? null,
    description: metadata?.description ?? null,
    metadataURI: onChain.metadataURI,
    metadataHash: onChain.metadataHash,
    status: onChain.status,
    uiStatus: deriveUiStatus(onChain.status, applicationOpen),
    isApplicationOpen: applicationOpen,
    createdAt: onChain.createdAt,
    applicationDeadline: onChain.applicationDeadline,
    isCalendarBound: onChain.isCalendarBound,
    startDate: onChain.startDate,
    endDate: onChain.endDate,
    skills,
    milestones: metadata?.milestones ?? [],
    externalFormLink: metadata?.externalFormLink ?? null,
    externalFormInstructions: metadata?.externalFormInstructions ?? null,
    applicantCount: applicants.length,
    metadata: metadata ?? null,
  };
}

/** Enumerate all residencies for the Bulletin Board (ids 1..totalResidencies). */
export async function listResidencyViews(): Promise<ResidencyView[]> {
  const total = await getTotalResidencies();
  const n = Number(total);
  if (!n || n < 1) return [];
  const ids = Array.from({ length: n }, (_, i) => BigInt(i + 1));
  const views = await Promise.all(ids.map((id) => getResidencyView(id)));
  return views
    .filter((v): v is ResidencyView => v !== null)
    .sort((a, b) => Number(b.id) - Number(a.id));
}

/** Residencies created by a specific hub Safe. */
export async function listHubResidencyViews(
  hubSafe: string
): Promise<ResidencyView[]> {
  const ids = await getHubResidencies(hubSafe);
  const views = await Promise.all(ids.map((id) => getResidencyView(id)));
  return views
    .filter((v): v is ResidencyView => v !== null)
    .sort((a, b) => Number(b.id) - Number(a.id));
}

/** Applicants for a residency, enriched with owner + pilgrim nickname. */
export async function getResidencyApplicantViews(
  residencyId: bigint
): Promise<ResidencyApplicantView[]> {
  const onChain = await getResidency(residencyId);
  const hubSafe = onChain?.hubSafe ?? null;

  const [applicants, selected, residencySkills] = await Promise.all([
    getResidencyApplicants(residencyId),
    getSelectedPilgrims(residencyId),
    getResidencySkills(residencyId),
  ]);
  const selectedSet = new Set(selected.map((t) => t.toString()));

  return Promise.all(
    applicants.map(async (tokenId) => {
      const owner = await getPassportOwner(tokenId);
      let nickname: string | null = null;
      if (owner) {
        try {
          const profile = await getPilgrimByWallet(owner);
          nickname = profile?.nickname ?? null;
        } catch {
          nickname = null;
        }
      }
      const isSelected = selectedSet.has(tokenId.toString());
      const awarded = isSelected
        ? await readIsAwarded(residencyId, tokenId)
        : false;

      // Only compute the "already attested by this hub" set for selected, not
      // yet awarded pilgrims (that's when the award UI needs it).
      let alreadyAttestedByHub: string[] = [];
      if (isSelected && !awarded && hubSafe) {
        const flags = await Promise.all(
          residencySkills.map((hash) =>
            hasActiveAttestation(tokenId, hash, hubSafe)
          )
        );
        alreadyAttestedByHub = residencySkills
          .filter((_, i) => flags[i])
          .map((h) => h.toLowerCase());
      }

      return {
        tokenId: tokenId.toString(),
        owner,
        nickname,
        isSelected,
        isAwarded: awarded,
        alreadyAttestedByHub,
      };
    })
  );
}
