/**
 * Pilgrim skill helpers (client + server safe; pure functions).
 *
 * Bridges canonical skill IDs (src/config/pilgrim-skills.ts) and their on-chain
 * bytes32 hashes. Labels/categories are frontend-only (see
 * src/config/pilgrim-skill-categories.ts) and never go on-chain.
 */
import {
  PILGRIM_SKILL_IDS,
  PILGRIM_SKILL_HASHES,
  type PilgrimSkillId,
} from "@/config/pilgrim-skills";
import {
  getSkillCategoryId,
  humanizeSkillId,
  PILGRIM_SKILL_CATEGORIES,
} from "@/config/pilgrim-skill-categories";

export type SkillHash = `0x${string}`;

/** Reverse lookup: bytes32 hash → canonical skill ID. */
const HASH_TO_ID: Record<string, PilgrimSkillId> = (() => {
  const map: Record<string, PilgrimSkillId> = {};
  for (const id of PILGRIM_SKILL_IDS) {
    map[PILGRIM_SKILL_HASHES[id].toLowerCase()] = id;
  }
  return map;
})();

export function isCanonicalSkillId(skillId: string): skillId is PilgrimSkillId {
  return Object.prototype.hasOwnProperty.call(PILGRIM_SKILL_HASHES, skillId);
}

/** Canonical skill ID → bytes32 hash. Throws on unknown IDs. */
export function skillIdToHash(skillId: string): SkillHash {
  if (!isCanonicalSkillId(skillId)) {
    throw new Error(`Unknown pilgrim skill id: ${skillId}`);
  }
  return PILGRIM_SKILL_HASHES[skillId];
}

/** bytes32 hash → canonical skill ID, or null if not canonical. */
export function skillHashToId(hash: string): PilgrimSkillId | null {
  if (!hash) return null;
  return HASH_TO_ID[hash.toLowerCase()] ?? null;
}

/** Human-readable label for a skill ID (frontend display). */
export function getSkillLabel(skillId: string): string {
  return humanizeSkillId(skillId);
}

/** Category id for a skill ID, or null. */
export function getSkillCategory(skillId: string): string | null {
  return getSkillCategoryId(skillId);
}

/** Label for a skill given its bytes32 hash (falls back to the raw hash). */
export function getSkillLabelByHash(hash: string): string {
  const id = skillHashToId(hash);
  return id ? getSkillLabel(id) : hash;
}

export { PILGRIM_SKILL_IDS, PILGRIM_SKILL_HASHES, PILGRIM_SKILL_CATEGORIES };
export type { PilgrimSkillId };
