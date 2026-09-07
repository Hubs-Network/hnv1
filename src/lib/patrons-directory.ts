/**
 * Public Patron directory reconciliation (SERVER ONLY).
 *
 * Discovers approved patron profiles from GitHub JSON, then verifies each is
 * still an ACTIVE SBT on-chain (isActivePatron). The contract is authoritative:
 * a profile that says "approved" but whose token was burned/revoked is excluded.
 * Skills are always read from chain, never from JSON.
 */
import { getAllPatrons } from "@/lib/data/patrons";
import {
  getCachedActivePatronSet,
  isActivePatron,
  getPatronSkills,
} from "@/lib/patron-sbt";
import { resolveSkillLabelByHash } from "@/lib/pilgrim-skills-catalog";

export interface PublicPatron {
  applicationId: string;
  tokenId: string;
  companyName: string;
  description: string;
  website: string;
  wallet: string;
  skills: { hash: string; label: string }[];
}

async function resolveSkills(
  tokenId: bigint
): Promise<{ hash: string; label: string }[]> {
  const hashes = await getPatronSkills(tokenId);
  return Promise.all(
    hashes.map(async (h) => ({ hash: h, label: await resolveSkillLabelByHash(h) }))
  );
}

/** All ACTIVE, APPROVED patrons (public directory). Contact is never included. */
export async function getPublicPatrons(): Promise<PublicPatron[]> {
  const profiles = await getAllPatrons();
  const candidates = profiles.filter(
    (p) => p.status === "approved" && p.tokenId
  );
  if (candidates.length === 0) return [];

  const activeSet = await getCachedActivePatronSet(
    candidates.map((p) => p.tokenId as string)
  );

  const active = candidates.filter((p) =>
    // If the batch failed (null), fall back to the JSON status.
    activeSet ? activeSet.has(p.tokenId as string) : true
  );

  return Promise.all(
    active.map(async (p) => ({
      applicationId: p.applicationId,
      tokenId: p.tokenId as string,
      companyName: p.companyName,
      description: p.description,
      website: p.website,
      wallet: p.applicant,
      skills: await resolveSkills(BigInt(p.tokenId as string)),
    }))
  );
}

/** Resolve a single public Patron by tokenId, or null if not active/approved. */
export async function getPublicPatronByTokenId(
  tokenId: string
): Promise<PublicPatron | null> {
  let id: bigint;
  try {
    id = BigInt(tokenId);
  } catch {
    return null;
  }

  if (!(await isActivePatron(id))) return null;

  const profiles = await getAllPatrons();
  const profile = profiles.find(
    (p) => p.tokenId === tokenId && p.status === "approved"
  );
  if (!profile) return null;

  return {
    applicationId: profile.applicationId,
    tokenId,
    companyName: profile.companyName,
    description: profile.description,
    website: profile.website,
    wallet: profile.applicant,
    skills: await resolveSkills(id),
  };
}

/** Application id of an approved patron by tokenId — used for admin actions. */
export async function getApplicationIdByTokenId(
  tokenId: string
): Promise<string | null> {
  const profiles = await getAllPatrons();
  const p = profiles.find((x) => x.tokenId === tokenId);
  return p ? p.applicationId : null;
}
