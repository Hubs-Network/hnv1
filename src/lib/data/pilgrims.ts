/**
 * Pilgrim profile data layer (SERVER ONLY).
 *
 * Mirrors the hub data layer: local filesystem in dev, GitHub Contents API in
 * production. One JSON file per pilgrim at data/pilgrims/{wallet}.json, keyed
 * by the lowercased wallet address.
 *
 * Only the pilgrim (their own wallet) is allowed to write their file; the API
 * routes enforce that. This module is pure read/write plumbing.
 */
import { isGitHubConfigured } from "@/lib/github/adapter";
import type { PilgrimProfile } from "@/types";

const DIR = "data/pilgrims";

function fileId(wallet: string): string {
  return wallet.toLowerCase();
}

function repoPath(wallet: string): string {
  return `${DIR}/${fileId(wallet)}.json`;
}

// ── Local filesystem ────────────────────────────────────────────────────
async function localDir() {
  const fs = await import("fs");
  const path = await import("path");
  return { fs, path, full: path.join(process.cwd(), DIR) };
}

async function readLocalAll(): Promise<PilgrimProfile[]> {
  const { fs, path, full } = await localDir();
  if (!fs.existsSync(full)) return [];
  const out: PilgrimProfile[] = [];
  for (const f of fs.readdirSync(full).filter((f) => f.endsWith(".json"))) {
    try {
      out.push(
        JSON.parse(fs.readFileSync(path.join(full, f), "utf-8")) as PilgrimProfile
      );
    } catch {
      // skip malformed file
    }
  }
  return out;
}

async function readLocalOne(wallet: string): Promise<PilgrimProfile | null> {
  const { fs, path, full } = await localDir();
  const file = path.join(full, `${fileId(wallet)}.json`);
  if (!fs.existsSync(file)) return null;
  try {
    return JSON.parse(fs.readFileSync(file, "utf-8")) as PilgrimProfile;
  } catch {
    return null;
  }
}

async function writeLocalOne(profile: PilgrimProfile): Promise<void> {
  const { fs, path, full } = await localDir();
  if (!fs.existsSync(full)) fs.mkdirSync(full, { recursive: true });
  const file = path.join(full, `${fileId(profile.wallet)}.json`);
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
  wallet: string
): Promise<{ profile: PilgrimProfile | null; sha: string | null }> {
  const { owner, repo, branch, token } = githubBase();
  const url = `https://api.github.com/repos/${owner}/${repo}/contents/${repoPath(wallet)}?ref=${branch}`;
  const headers: Record<string, string> = { Accept: "application/vnd.github+json" };
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(url, { headers, cache: "no-store" });
  if (res.status === 404) return { profile: null, sha: null };
  if (!res.ok) throw new Error(`GitHub read failed: ${res.status}`);

  const data = (await res.json()) as { content?: string; sha: string };
  let profile: PilgrimProfile | null = null;
  if (data.content) {
    try {
      profile = JSON.parse(
        Buffer.from(data.content, "base64").toString("utf-8")
      ) as PilgrimProfile;
    } catch {
      profile = null;
    }
  }
  return { profile, sha: data.sha };
}

async function ghWriteOne(
  profile: PilgrimProfile,
  sha: string | null
): Promise<void> {
  const { owner, repo, branch, token } = githubBase();
  const url = `https://api.github.com/repos/${owner}/${repo}/contents/${repoPath(profile.wallet)}`;
  const body: Record<string, unknown> = {
    message: `Update pilgrim profile ${fileId(profile.wallet)}`,
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

async function ghListAll(): Promise<PilgrimProfile[]> {
  const { owner, repo, branch, token } = githubBase();
  const dirUrl = `https://api.github.com/repos/${owner}/${repo}/contents/${DIR}?ref=${branch}`;
  const headers: Record<string, string> = { Accept: "application/vnd.github+json" };
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(dirUrl, { headers, cache: "no-store" });
  if (res.status === 404) return [];
  if (!res.ok) throw new Error(`GitHub list failed: ${res.status}`);

  const entries = (await res.json()) as { name: string; download_url?: string }[];
  const jsonFiles = entries.filter((e) => e.name.endsWith(".json"));
  const out: PilgrimProfile[] = [];
  await Promise.all(
    jsonFiles.map(async (e) => {
      if (!e.download_url) return;
      try {
        const r = await fetch(e.download_url, { cache: "no-store" });
        if (r.ok) out.push((await r.json()) as PilgrimProfile);
      } catch {
        // skip
      }
    })
  );
  return out;
}

// ── Public API ──────────────────────────────────────────────────────────
export async function getPilgrimByWallet(
  wallet: string
): Promise<PilgrimProfile | null> {
  if (isGitHubConfigured()) {
    try {
      return (await ghReadOne(wallet)).profile;
    } catch {
      return null;
    }
  }
  return readLocalOne(wallet);
}

export async function getAllPilgrims(): Promise<PilgrimProfile[]> {
  if (isGitHubConfigured()) {
    try {
      return await ghListAll();
    } catch {
      return [];
    }
  }
  return readLocalAll();
}

/** Only pilgrims who explicitly published and have a passport token id. */
export async function getPublishedPilgrims(): Promise<PilgrimProfile[]> {
  const all = await getAllPilgrims();
  return all
    .filter((p) => p.published && p.passportTokenId)
    .sort((a, b) =>
      (b.publishedAt || b.updatedAt || "").localeCompare(
        a.publishedAt || a.updatedAt || ""
      )
    );
}

/** Create or overwrite a pilgrim profile file. */
export async function savePilgrim(profile: PilgrimProfile): Promise<void> {
  if (isGitHubConfigured()) {
    const { sha } = await ghReadOne(profile.wallet);
    await ghWriteOne(profile, sha);
    return;
  }
  await writeLocalOne(profile);
}
