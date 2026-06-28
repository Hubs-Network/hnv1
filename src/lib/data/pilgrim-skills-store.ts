/**
 * Custom Pilgrim skills store (SERVER ONLY).
 *
 * The PilgrimPassportSBT contract stores ONLY the bytes32 skill hash
 * (keccak256(toBytes(id))); it never stores human text. So when an HN Director
 * adds a new skill on-chain, its label/category/id must be persisted off-chain
 * here so the frontend can render it as readable text grouped by area.
 *
 * Storage mirrors the hub data layer: local filesystem in dev, GitHub Contents
 * API in production (GITHUB_OWNER/REPO/TOKEN configured). A single JSON file
 * holds the array of custom skills.
 */
import { isGitHubConfigured } from "@/lib/github/adapter";

export interface CustomSkill {
  /** Canonical slug id (e.g. "glass_blowing"). */
  id: string;
  /** Human-readable label shown in the UI. */
  label: string;
  /** Static category id this skill is grouped under. */
  categoryId: string;
  /** keccak256(toBytes(id)) — the on-chain bytes32 skill hash. */
  hash: `0x${string}`;
  /** HN Director wallet that added it. */
  addedBy: `0x${string}`;
  /** ISO timestamp. */
  addedAt: string;
  /** setSkillStatusByHNDirector tx hash. */
  txHash?: string;
}

const REPO_PATH = "data/pilgrim/custom-skills.json";

// ── Local filesystem ────────────────────────────────────────────────────
async function readLocal(): Promise<CustomSkill[]> {
  const fs = await import("fs");
  const path = await import("path");
  const full = path.join(process.cwd(), REPO_PATH);
  if (!fs.existsSync(full)) return [];
  try {
    return JSON.parse(fs.readFileSync(full, "utf-8")) as CustomSkill[];
  } catch {
    return [];
  }
}

async function writeLocal(skills: CustomSkill[]): Promise<void> {
  const fs = await import("fs");
  const path = await import("path");
  const full = path.join(process.cwd(), REPO_PATH);
  const dir = path.dirname(full);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(full, JSON.stringify(skills, null, 2), "utf-8");
}

// ── GitHub Contents API ──────────────────────────────────────────────────
function githubBase() {
  const owner = process.env.GITHUB_OWNER!;
  const repo = process.env.GITHUB_REPO!;
  const branch = process.env.GITHUB_BRANCH || "main";
  const token = process.env.GITHUB_TOKEN;
  return { owner, repo, branch, token };
}

async function readGitHub(): Promise<{ skills: CustomSkill[]; sha: string | null }> {
  const { owner, repo, branch, token } = githubBase();
  const url = `https://api.github.com/repos/${owner}/${repo}/contents/${REPO_PATH}?ref=${branch}`;
  const headers: Record<string, string> = { Accept: "application/vnd.github+json" };
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(url, { headers, cache: "no-store" });
  if (res.status === 404) return { skills: [], sha: null };
  if (!res.ok) throw new Error(`GitHub read failed: ${res.status}`);

  const data = (await res.json()) as { content?: string; sha: string };
  let skills: CustomSkill[] = [];
  if (data.content) {
    try {
      skills = JSON.parse(
        Buffer.from(data.content, "base64").toString("utf-8")
      ) as CustomSkill[];
    } catch {
      skills = [];
    }
  }
  return { skills, sha: data.sha };
}

async function writeGitHub(skills: CustomSkill[], sha: string | null): Promise<void> {
  const { owner, repo, branch, token } = githubBase();
  const url = `https://api.github.com/repos/${owner}/${repo}/contents/${REPO_PATH}`;
  const body: Record<string, unknown> = {
    message: `Add pilgrim skill (${skills[skills.length - 1]?.id ?? "update"})`,
    content: Buffer.from(JSON.stringify(skills, null, 2)).toString("base64"),
    branch,
  };
  if (sha) body.sha = sha;

  const res = await fetch(url, {
    method: "PUT",
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/vnd.github+json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`GitHub write failed: ${res.status} ${text}`);
  }
}

// ── Public API ─────────────────────────────────────────────────────────────
export async function getCustomSkills(): Promise<CustomSkill[]> {
  if (isGitHubConfigured()) {
    try {
      return (await readGitHub()).skills;
    } catch {
      return [];
    }
  }
  return readLocal();
}

/**
 * Append a custom skill. Returns false if a skill with the same id already
 * exists in the store (race-safe re-read just before writing).
 */
export async function addCustomSkill(skill: CustomSkill): Promise<boolean> {
  if (isGitHubConfigured()) {
    const { skills, sha } = await readGitHub();
    if (skills.some((s) => s.id === skill.id)) return false;
    await writeGitHub([...skills, skill], sha);
    return true;
  }
  const skills = await readLocal();
  if (skills.some((s) => s.id === skill.id)) return false;
  await writeLocal([...skills, skill]);
  return true;
}
