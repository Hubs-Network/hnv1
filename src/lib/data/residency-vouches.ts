/**
 * Residency vouch data layer (SERVER ONLY).
 *
 * One JSON file per (residency, patron):
 *   data/vouches/<residencyId>/<patronApplicationId>.json
 * so re-submitting a vouch upserts (one active vouch per patron per residency).
 * Local filesystem in dev, GitHub Contents API in production.
 */
import { isGitHubConfigured } from "@/lib/github/adapter";
import type { Vouch } from "@/lib/schemas/vouch";

const DIR = "data/vouches";

function fileId(patronApplicationId: string): string {
  return patronApplicationId.toLowerCase();
}

function repoPath(residencyId: string, patronApplicationId: string): string {
  return `${DIR}/${residencyId}/${fileId(patronApplicationId)}.json`;
}

// ── Local filesystem ────────────────────────────────────────────────────
async function fsMods() {
  const fs = await import("fs");
  const path = await import("path");
  return { fs, path };
}

async function readLocalAll(residencyId: string): Promise<Vouch[]> {
  const { fs, path } = await fsMods();
  const dir = path.join(process.cwd(), DIR, residencyId);
  if (!fs.existsSync(dir)) return [];
  const out: Vouch[] = [];
  for (const f of fs.readdirSync(dir).filter((f) => f.endsWith(".json"))) {
    try {
      out.push(JSON.parse(fs.readFileSync(path.join(dir, f), "utf-8")) as Vouch);
    } catch {
      // skip malformed
    }
  }
  return out;
}

async function readLocalOne(
  residencyId: string,
  patronApplicationId: string
): Promise<Vouch | null> {
  const { fs, path } = await fsMods();
  const file = path.join(process.cwd(), repoPath(residencyId, patronApplicationId));
  if (!fs.existsSync(file)) return null;
  try {
    return JSON.parse(fs.readFileSync(file, "utf-8")) as Vouch;
  } catch {
    return null;
  }
}

async function writeLocalOne(v: Vouch): Promise<void> {
  const { fs, path } = await fsMods();
  const dir = path.join(process.cwd(), DIR, v.residencyId);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  const file = path.join(dir, `${fileId(v.patronApplicationId)}.json`);
  fs.writeFileSync(file, JSON.stringify(v, null, 2), "utf-8");
}

// ── GitHub Contents API ──────────────────────────────────────────────────
function githubBase() {
  const owner = process.env.GITHUB_OWNER!;
  const repo = process.env.GITHUB_REPO!;
  const branch = process.env.GITHUB_BRANCH || "main";
  const token = process.env.GITHUB_TOKEN;
  return { owner, repo, branch, token };
}

async function ghReadOne(
  residencyId: string,
  patronApplicationId: string
): Promise<{ vouch: Vouch | null; sha: string | null }> {
  const { owner, repo, branch, token } = githubBase();
  const url = `https://api.github.com/repos/${owner}/${repo}/contents/${repoPath(residencyId, patronApplicationId)}?ref=${branch}`;
  const headers: Record<string, string> = { Accept: "application/vnd.github+json" };
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(url, { headers, cache: "no-store" });
  if (res.status === 404) return { vouch: null, sha: null };
  if (!res.ok) throw new Error(`GitHub read failed: ${res.status}`);

  const data = (await res.json()) as { content?: string; sha: string };
  let vouch: Vouch | null = null;
  if (data.content) {
    try {
      vouch = JSON.parse(
        Buffer.from(data.content, "base64").toString("utf-8")
      ) as Vouch;
    } catch {
      vouch = null;
    }
  }
  return { vouch, sha: data.sha };
}

async function ghWriteOne(v: Vouch, sha: string | null): Promise<void> {
  const { owner, repo, branch, token } = githubBase();
  const url = `https://api.github.com/repos/${owner}/${repo}/contents/${repoPath(v.residencyId, v.patronApplicationId)}`;
  const body: Record<string, unknown> = {
    message: `Vouch ${v.status} — residency ${v.residencyId} by patron ${fileId(v.patronApplicationId)}`,
    content: Buffer.from(JSON.stringify(v, null, 2)).toString("base64"),
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

async function ghListAll(residencyId: string): Promise<Vouch[]> {
  const { owner, repo, branch, token } = githubBase();
  const dirUrl = `https://api.github.com/repos/${owner}/${repo}/contents/${DIR}/${residencyId}?ref=${branch}`;
  const headers: Record<string, string> = { Accept: "application/vnd.github+json" };
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(dirUrl, { headers, cache: "no-store" });
  if (res.status === 404) return [];
  if (!res.ok) throw new Error(`GitHub list failed: ${res.status}`);

  const entries = (await res.json()) as { name: string; download_url?: string }[];
  const jsonFiles = entries.filter((e) => e.name.endsWith(".json"));
  const out: Vouch[] = [];
  await Promise.all(
    jsonFiles.map(async (e) => {
      if (!e.download_url) return;
      try {
        const r = await fetch(e.download_url, { cache: "no-store" });
        if (r.ok) out.push((await r.json()) as Vouch);
      } catch {
        // skip
      }
    })
  );
  return out;
}

// ── Public API ──────────────────────────────────────────────────────────

/** All vouches (any status) for a residency. */
export async function listVouchesForResidency(residencyId: string): Promise<Vouch[]> {
  if (isGitHubConfigured()) {
    try {
      return await ghListAll(residencyId);
    } catch {
      return [];
    }
  }
  return readLocalAll(residencyId);
}

/** Active vouches only. */
export async function listActiveVouches(residencyId: string): Promise<Vouch[]> {
  return (await listVouchesForResidency(residencyId)).filter(
    (v) => v.status === "active"
  );
}

/** Count of active vouches for a residency (used by the Bulletin Board card). */
export async function countActiveVouches(residencyId: string): Promise<number> {
  return (await listActiveVouches(residencyId)).length;
}

export async function getVouch(
  residencyId: string,
  patronApplicationId: string
): Promise<Vouch | null> {
  if (isGitHubConfigured()) {
    try {
      return (await ghReadOne(residencyId, patronApplicationId)).vouch;
    } catch {
      return null;
    }
  }
  return readLocalOne(residencyId, patronApplicationId);
}

/** Create or overwrite a vouch (idempotent upsert). */
export async function saveVouch(v: Vouch): Promise<void> {
  if (isGitHubConfigured()) {
    const { sha } = await ghReadOne(v.residencyId, v.patronApplicationId);
    await ghWriteOne(v, sha);
    return;
  }
  await writeLocalOne(v);
}
