/**
 * Patron profile data layer (SERVER ONLY).
 *
 * Mirrors the hub/pilgrim data layer: local filesystem in dev, GitHub Contents
 * API in production. One JSON file per application at
 * data/patrons/{applicationId}.json. Skills are NOT stored here.
 */
import { isGitHubConfigured } from "@/lib/github/adapter";
import type { PatronProfile } from "@/lib/schemas/patron";

const DIR = "data/patrons";

function fileId(applicationId: string): string {
  return applicationId.toLowerCase();
}

function repoPath(applicationId: string): string {
  return `${DIR}/${fileId(applicationId)}.json`;
}

// ── Local filesystem ────────────────────────────────────────────────────
async function localDir() {
  const fs = await import("fs");
  const path = await import("path");
  return { fs, path, full: path.join(process.cwd(), DIR) };
}

async function readLocalAll(): Promise<PatronProfile[]> {
  const { fs, path, full } = await localDir();
  if (!fs.existsSync(full)) return [];
  const out: PatronProfile[] = [];
  for (const f of fs.readdirSync(full).filter((f) => f.endsWith(".json"))) {
    try {
      out.push(
        JSON.parse(fs.readFileSync(path.join(full, f), "utf-8")) as PatronProfile
      );
    } catch {
      // skip malformed file
    }
  }
  return out;
}

async function readLocalOne(applicationId: string): Promise<PatronProfile | null> {
  const { fs, path, full } = await localDir();
  const file = path.join(full, `${fileId(applicationId)}.json`);
  if (!fs.existsSync(file)) return null;
  try {
    return JSON.parse(fs.readFileSync(file, "utf-8")) as PatronProfile;
  } catch {
    return null;
  }
}

async function writeLocalOne(profile: PatronProfile): Promise<void> {
  const { fs, path, full } = await localDir();
  if (!fs.existsSync(full)) fs.mkdirSync(full, { recursive: true });
  const file = path.join(full, `${fileId(profile.applicationId)}.json`);
  fs.writeFileSync(file, JSON.stringify(profile, null, 2), "utf-8");
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
  applicationId: string
): Promise<{ profile: PatronProfile | null; sha: string | null }> {
  const { owner, repo, branch, token } = githubBase();
  const url = `https://api.github.com/repos/${owner}/${repo}/contents/${repoPath(applicationId)}?ref=${branch}`;
  const headers: Record<string, string> = { Accept: "application/vnd.github+json" };
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(url, { headers, cache: "no-store" });
  if (res.status === 404) return { profile: null, sha: null };
  if (!res.ok) throw new Error(`GitHub read failed: ${res.status}`);

  const data = (await res.json()) as { content?: string; sha: string };
  let profile: PatronProfile | null = null;
  if (data.content) {
    try {
      profile = JSON.parse(
        Buffer.from(data.content, "base64").toString("utf-8")
      ) as PatronProfile;
    } catch {
      profile = null;
    }
  }
  return { profile, sha: data.sha };
}

async function ghWriteOne(profile: PatronProfile, sha: string | null): Promise<void> {
  const { owner, repo, branch, token } = githubBase();
  const url = `https://api.github.com/repos/${owner}/${repo}/contents/${repoPath(profile.applicationId)}`;
  const body: Record<string, unknown> = {
    message: `Update patron ${fileId(profile.applicationId)} (${profile.status})`,
    content: Buffer.from(JSON.stringify(profile, null, 2)).toString("base64"),
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

async function ghListAll(): Promise<PatronProfile[]> {
  const { owner, repo, branch, token } = githubBase();
  const dirUrl = `https://api.github.com/repos/${owner}/${repo}/contents/${DIR}?ref=${branch}`;
  const headers: Record<string, string> = { Accept: "application/vnd.github+json" };
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(dirUrl, { headers, cache: "no-store" });
  if (res.status === 404) return [];
  if (!res.ok) throw new Error(`GitHub list failed: ${res.status}`);

  const entries = (await res.json()) as { name: string; download_url?: string }[];
  const jsonFiles = entries.filter((e) => e.name.endsWith(".json"));
  const out: PatronProfile[] = [];
  await Promise.all(
    jsonFiles.map(async (e) => {
      if (!e.download_url) return;
      try {
        const r = await fetch(e.download_url, { cache: "no-store" });
        if (r.ok) out.push((await r.json()) as PatronProfile);
      } catch {
        // skip
      }
    })
  );
  return out;
}

// ── Public API ──────────────────────────────────────────────────────────
export async function getPatronById(
  applicationId: string
): Promise<PatronProfile | null> {
  if (isGitHubConfigured()) {
    try {
      return (await ghReadOne(applicationId)).profile;
    } catch {
      return null;
    }
  }
  return readLocalOne(applicationId);
}

export async function getAllPatrons(): Promise<PatronProfile[]> {
  if (isGitHubConfigured()) {
    try {
      return await ghListAll();
    } catch {
      return [];
    }
  }
  return readLocalAll();
}

/** Create or overwrite a patron profile file (idempotent upsert). */
export async function savePatron(profile: PatronProfile): Promise<void> {
  if (isGitHubConfigured()) {
    const { sha } = await ghReadOne(profile.applicationId);
    await ghWriteOne(profile, sha);
    return;
  }
  await writeLocalOne(profile);
}
