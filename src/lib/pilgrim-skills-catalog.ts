/**
 * Pilgrim skill catalog (SERVER): merges the static taxonomy with runtime
 * custom skills added by HN Directors via setSkillStatusByHNDirector.
 *
 * The contract only knows bytes32 hashes, so the human text (id/label/category)
 * for custom skills lives in the off-chain store (data/pilgrim/custom-skills.json).
 * This module is the single place that reconciles both, used by API routes and
 * server components.
 */
import {
  PILGRIM_SKILL_CATEGORIES,
  type PilgrimSkillCategory,
} from "@/config/pilgrim-skill-categories";
import {
  isCanonicalSkillId,
  skillIdToHash,
  skillHashToId,
  getSkillLabel,
  computeSkillHash,
  PILGRIM_SKILL_IDS,
} from "@/lib/pilgrim-skills";
import { getCustomSkills, type CustomSkill } from "@/lib/data/pilgrim-skills-store";

export interface CatalogSkill {
  id: string;
  label: string;
  hash: `0x${string}`;
  categoryId: string;
  custom: boolean;
}

export interface CatalogCategory {
  id: string;
  label: string;
  skills: { id: string; label: string; custom: boolean }[];
}

/** Valid static category ids (custom skills must target one of these). */
export function isValidCategoryId(categoryId: string): boolean {
  return PILGRIM_SKILL_CATEGORIES.some((c) => c.id === categoryId);
}

/** Flat list of every skill (canonical + custom) with id/label/hash/category. */
export async function getAllCatalogSkills(): Promise<CatalogSkill[]> {
  const custom = await getCustomSkills();
  const staticSkills: CatalogSkill[] = PILGRIM_SKILL_IDS.map((id) => ({
    id,
    label: getSkillLabel(id),
    hash: skillIdToHash(id),
    categoryId: categoryIdOf(id),
    custom: false,
  }));
  const customSkills: CatalogSkill[] = custom.map((s) => ({
    id: s.id,
    label: s.label,
    hash: s.hash,
    categoryId: s.categoryId,
    custom: true,
  }));
  return [...staticSkills, ...customSkills];
}

function categoryIdOf(skillId: string): string {
  for (const cat of PILGRIM_SKILL_CATEGORIES) {
    if ((cat.skills as readonly string[]).includes(skillId)) return cat.id;
  }
  return "";
}

/** Categories (with labels) merging static + custom skills, for the UI. */
export async function getMergedCategories(): Promise<CatalogCategory[]> {
  const custom = await getCustomSkills();
  const customByCat = new Map<string, CustomSkill[]>();
  for (const s of custom) {
    const arr = customByCat.get(s.categoryId) ?? [];
    arr.push(s);
    customByCat.set(s.categoryId, arr);
  }
  return PILGRIM_SKILL_CATEGORIES.map((cat: PilgrimSkillCategory) => ({
    id: cat.id,
    label: cat.label,
    skills: [
      ...cat.skills.map((id) => ({
        id,
        label: getSkillLabel(id),
        custom: false,
      })),
      ...(customByCat.get(cat.id) ?? []).map((s) => ({
        id: s.id,
        label: s.label,
        custom: true,
      })),
    ],
  }));
}

/** Whether a skill id is allowed (canonical OR a known custom skill). */
export async function isAllowedSkillId(skillId: string): Promise<boolean> {
  if (isCanonicalSkillId(skillId)) return true;
  const custom = await getCustomSkills();
  return custom.some((s) => s.id === skillId);
}

/** Resolve a bytes32 hash to a skill id (canonical or custom), or null. */
export async function resolveSkillId(hash: string): Promise<string | null> {
  const canonical = skillHashToId(hash);
  if (canonical) return canonical;
  const custom = await getCustomSkills();
  const found = custom.find((s) => s.hash.toLowerCase() === hash.toLowerCase());
  return found ? found.id : null;
}

/** Resolve a bytes32 hash to a human label (canonical or custom), or the hash. */
export async function resolveSkillLabelByHash(hash: string): Promise<string> {
  const canonical = skillHashToId(hash);
  if (canonical) return getSkillLabel(canonical);
  const custom = await getCustomSkills();
  const found = custom.find((s) => s.hash.toLowerCase() === hash.toLowerCase());
  return found ? found.label : hash;
}

/** Map an array of bytes32 hashes to skill ids (drops unresolved). */
export async function resolveSkillIds(hashes: readonly string[]): Promise<string[]> {
  const custom = await getCustomSkills();
  const customByHash = new Map(
    custom.map((s) => [s.hash.toLowerCase(), s.id] as const)
  );
  return hashes
    .map((h) => skillHashToId(h) ?? customByHash.get(h.toLowerCase()) ?? null)
    .filter((id): id is string => id !== null);
}

/** id → bytes32 hash for any allowed skill id (canonical or custom). */
export function skillIdToHashUniversal(skillId: string): `0x${string}` {
  return isCanonicalSkillId(skillId)
    ? skillIdToHash(skillId)
    : computeSkillHash(skillId);
}
