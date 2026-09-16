/**
 * Residency metadata data layer (SERVER ONLY).
 *
 * Mirrors the patron/pilgrim data layer: local filesystem in dev, GitHub
 * Contents API in production. One JSON file per residency draft at
 * data/residencies/{hubSafe}/{draftId}.json. Skills are NOT authoritative here
 * (read from chain); the JSON is metadata + a display cache.
 */
import { isGitHubConfigured } from "@/lib/github/adapter";
import type { ResidencyMetadata } from "@/lib/schemas/residency";

const DIR = "data/residencies";

function keyPath(hubSafe: string, draftId: string): string {
  return `${DIR}/${hubSafe.toLowerCase()}/${draftId}`;
}

function repoPath(hubSafe: string, draftId: string): string {
  return `${keyPath(hubSafe, draftId)}.json`;
}

// ── Local filesystem ────────────────────────────────────────────────────
async function fsMods() {
  const fs = await import("fs");
  const path = await import("path");
  return { fs, path };
}

async function readLocalOne(
  hubSafe: string,
  draftId: string
): Promise<ResidencyMetadata | null> {
  const { fs, path } = await fsMods();
  const file = path.join(process.cwd(), repoPath(hubSafe, draftId));
  if (!fs.existsSync(file)) return null;
  try {
    return JSON.parse(fs.readFileSync(file, "utf-8")) as ResidencyMetadata;
  } catch {
    return null;
  }
}

async function readLocalAll(): Promise<ResidencyMetadata[]> {
  const { fs, path } = await fsMods();
  const root = path.join(process.cwd(), DIR);
  if (!fs.existsSync(root)) return [];
  const out: ResidencyMetadata[] = [];
  for (const hubDir of fs.readdirSync(root)) {
    const hubPath = path.join(root, hubDir);
    if (!fs.statSync(hubPath).isDirectory()) continue;
    for (const f of fs.readdirSync(hubPath).filter((f) => f.endsWith(".json"))) {
      try {
        out.push(
          JSON.parse(fs.readFileSync(path.join(hubPath, f), "utf-8")) as ResidencyMetadata
        );
      } catch {
        // skip malformed
      }
    }
  }
  return out;
}

async function writeLocalOne(meta: ResidencyMetadata): Promise<void> {
  const { fs, path } = await fsMods();
  const dir = path.join(process.cwd(), DIR, meta.hubSafe.toLowerCase());
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  const file = path.join(dir, `${meta.draftId}.json`);
  fs.writeFileSync(file, JSON.stringify(meta, null, 2), "utf-8");
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
  hubSafe: string,
  draftId: string
): Promise<{ meta: ResidencyMetadata | null; sha: string | null }> {
  const { owner, repo, branch, token } = githubBase();
  const url = `https://api.github.com/repos/${owner}/${repo}/contents/${repoPath(hubSafe, draftId)}?ref=${branch}`;
  const headers: Record<string, string> = { Accept: "application/vnd.github+json" };
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(url, { headers, cache: "no-store" });
  if (res.status === 404) return { meta: null, sha: null };
  if (!res.ok) throw new Error(`GitHub read failed: ${res.status}`);

  const data = (await res.json()) as { content?: string; sha: string };
  let meta: ResidencyMetadata | null = null;
  if (data.content) {
    try {
      meta = JSON.parse(
        Buffer.from(data.content, "base64").toString("utf-8")
      ) as ResidencyMetadata;
    } catch {
      meta = null;
    }
  }
  return { meta, sha: data.sha };
}

async function ghWriteOne(meta: ResidencyMetadata, sha: string | null): Promise<void> {
  const { owner, repo, branch, token } = githubBase();
  const url = `https://api.github.com/repos/${owner}/${repo}/contents/${repoPath(meta.hubSafe, meta.draftId)}`;
  const body: Record<string, unknown> = {
    message: `Residency ${meta.draftId} @ ${meta.hubSafe.toLowerCase()}${meta.residencyId ? ` (#${meta.residencyId})` : ""}`,
    content: Buffer.from(JSON.stringify(meta, null, 2)).toString("base64"),
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

// ── Public API ──────────────────────────────────────────────────────────

export async function getResidencyMetadata(
  hubSafe: string,
  draftId: string
): Promise<ResidencyMetadata | null> {
  if (isGitHubConfigured()) {
    try {
      return (await ghReadOne(hubSafe, draftId)).meta;
    } catch {
      return null;
    }
  }
  return readLocalOne(hubSafe, draftId);
}

export async function getAllResidencyMetadata(): Promise<ResidencyMetadata[]> {
  if (isGitHubConfigured()) {
    // Fallback: no cheap recursive list via Contents API for nested dirs here.
    // Residencies are enumerated from chain; metadata is fetched per-URI, so a
    // global list is only a best-effort convenience in local dev.
    return [];
  }
  return readLocalAll();
}

/** Create or overwrite a residency metadata file (idempotent upsert). */
export async function saveResidencyMetadata(meta: ResidencyMetadata): Promise<void> {
  if (isGitHubConfigured()) {
    const { sha } = await ghReadOne(meta.hubSafe, meta.draftId);
    await ghWriteOne(meta, sha);
    return;
  }
  await writeLocalOne(meta);
}
