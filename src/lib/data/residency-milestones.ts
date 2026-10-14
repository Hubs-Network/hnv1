/**
 * Residency milestone plan data layer (SERVER ONLY).
 *
 * One JSON file per (residency, pilgrim passport):
 *   data/residency-milestones/<residencyId>/<pilgrimPassportTokenId>.json
 * Local filesystem in dev, GitHub Contents API in production — same pattern as
 * residency vouches.
 *
 * ⚠️ Off-chain pilot coordination layer. The contract is authoritative for
 * selection/award; this JSON only coordinates the milestone checklist and gates
 * the award at API level. Public + single-writer store — no private data.
 */
import { isGitHubConfigured } from "@/lib/github/adapter";
import type { ResidencyMilestonePlan } from "@/lib/schemas/residency-milestones";

const DIR = "data/residency-milestones";

function repoPath(residencyId: string, tokenId: string): string {
  return `${DIR}/${residencyId}/${tokenId}.json`;
}

// ── Local filesystem ────────────────────────────────────────────────────
async function fsMods() {
  const fs = await import("fs");
  const path = await import("path");
  return { fs, path };
}

async function readLocalAll(residencyId: string): Promise<ResidencyMilestonePlan[]> {
  const { fs, path } = await fsMods();
  const dir = path.join(process.cwd(), DIR, residencyId);
  if (!fs.existsSync(dir)) return [];
  const out: ResidencyMilestonePlan[] = [];
  for (const f of fs.readdirSync(dir).filter((f) => f.endsWith(".json"))) {
    try {
      out.push(
        JSON.parse(fs.readFileSync(path.join(dir, f), "utf-8")) as ResidencyMilestonePlan
      );
    } catch {
      // skip malformed
    }
  }
  return out;
}

async function readLocalEverything(): Promise<ResidencyMilestonePlan[]> {
  const { fs, path } = await fsMods();
  const root = path.join(process.cwd(), DIR);
  if (!fs.existsSync(root)) return [];
  const out: ResidencyMilestonePlan[] = [];
  for (const resDir of fs.readdirSync(root)) {
    const resPath = path.join(root, resDir);
    try {
      if (!fs.statSync(resPath).isDirectory()) continue;
    } catch {
      continue;
    }
    for (const f of fs.readdirSync(resPath).filter((f) => f.endsWith(".json"))) {
      try {
        out.push(
          JSON.parse(fs.readFileSync(path.join(resPath, f), "utf-8")) as ResidencyMilestonePlan
        );
      } catch {
        // skip malformed
      }
    }
  }
  return out;
}

async function readLocalOne(
  residencyId: string,
  tokenId: string
): Promise<ResidencyMilestonePlan | null> {
  const { fs, path } = await fsMods();
  const file = path.join(process.cwd(), repoPath(residencyId, tokenId));
  if (!fs.existsSync(file)) return null;
  try {
    return JSON.parse(fs.readFileSync(file, "utf-8")) as ResidencyMilestonePlan;
  } catch {
    return null;
  }
}

async function writeLocalOne(plan: ResidencyMilestonePlan): Promise<void> {
  const { fs, path } = await fsMods();
  const dir = path.join(process.cwd(), DIR, String(plan.residencyId));
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  const file = path.join(dir, `${plan.pilgrimPassportTokenId}.json`);
  fs.writeFileSync(file, JSON.stringify(plan, null, 2), "utf-8");
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
  tokenId: string
): Promise<{ plan: ResidencyMilestonePlan | null; sha: string | null }> {
  const { owner, repo, branch, token } = githubBase();
  const url = `https://api.github.com/repos/${owner}/${repo}/contents/${repoPath(residencyId, tokenId)}?ref=${branch}`;
  const headers: Record<string, string> = { Accept: "application/vnd.github+json" };
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(url, { headers, cache: "no-store" });
  if (res.status === 404) return { plan: null, sha: null };
  if (!res.ok) throw new Error(`GitHub read failed: ${res.status}`);

  const data = (await res.json()) as { content?: string; sha: string };
  let plan: ResidencyMilestonePlan | null = null;
  if (data.content) {
    try {
      plan = JSON.parse(
        Buffer.from(data.content, "base64").toString("utf-8")
      ) as ResidencyMilestonePlan;
    } catch {
      plan = null;
    }
  }
  return { plan, sha: data.sha };
}

async function ghWriteOne(
  plan: ResidencyMilestonePlan,
  sha: string | null
): Promise<void> {
  const { owner, repo, branch, token } = githubBase();
  const url = `https://api.github.com/repos/${owner}/${repo}/contents/${repoPath(String(plan.residencyId), String(plan.pilgrimPassportTokenId))}`;
  const body: Record<string, unknown> = {
    message: `Milestone plan ${plan.status} — residency ${plan.residencyId} / passport ${plan.pilgrimPassportTokenId} (rev ${plan.revision})`,
    content: Buffer.from(JSON.stringify(plan, null, 2)).toString("base64"),
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

async function ghListAll(residencyId: string): Promise<ResidencyMilestonePlan[]> {
  const { owner, repo, branch, token } = githubBase();
  const dirUrl = `https://api.github.com/repos/${owner}/${repo}/contents/${DIR}/${residencyId}?ref=${branch}`;
  const headers: Record<string, string> = { Accept: "application/vnd.github+json" };
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(dirUrl, { headers, cache: "no-store" });
  if (res.status === 404) return [];
  if (!res.ok) throw new Error(`GitHub list failed: ${res.status}`);

  const entries = (await res.json()) as { name: string; download_url?: string }[];
  const jsonFiles = entries.filter((e) => e.name.endsWith(".json"));
  const out: ResidencyMilestonePlan[] = [];
  await Promise.all(
    jsonFiles.map(async (e) => {
      if (!e.download_url) return;
      try {
        const r = await fetch(e.download_url, { cache: "no-store" });
        if (r.ok) out.push((await r.json()) as ResidencyMilestonePlan);
      } catch {
        // skip
      }
    })
  );
  return out;
}

// ── Public API ──────────────────────────────────────────────────────────

export async function getMilestonePlan(
  residencyId: number | bigint | string,
  pilgrimPassportTokenId: number | bigint | string
): Promise<ResidencyMilestonePlan | null> {
  const rid = String(residencyId);
  const tid = String(pilgrimPassportTokenId);
  if (isGitHubConfigured()) {
    try {
      return (await ghReadOne(rid, tid)).plan;
    } catch {
      return null;
    }
  }
  return readLocalOne(rid, tid);
}

/** Create or overwrite a milestone plan (idempotent upsert). */
export async function upsertMilestonePlan(
  plan: ResidencyMilestonePlan
): Promise<void> {
  if (isGitHubConfigured()) {
    const { sha } = await ghReadOne(
      String(plan.residencyId),
      String(plan.pilgrimPassportTokenId)
    );
    await ghWriteOne(plan, sha);
    return;
  }
  await writeLocalOne(plan);
}

export async function listMilestonePlansForResidency(
  residencyId: number | bigint | string
): Promise<ResidencyMilestonePlan[]> {
  const rid = String(residencyId);
  if (isGitHubConfigured()) {
    try {
      return await ghListAll(rid);
    } catch {
      return [];
    }
  }
  return readLocalAll(rid);
}

/**
 * Best-effort list of this pilgrim's plans across residencies. In production
 * (GitHub) the Contents API has no cheap recursive listing, so callers that
 * need production coverage should enumerate residencies from chain and call
 * {@link getMilestonePlan} per residency. In local dev this scans the tree.
 */
export async function listActiveMilestonePlansForPilgrim(
  pilgrimPassportTokenId: number | bigint | string
): Promise<ResidencyMilestonePlan[]> {
  const tid = String(pilgrimPassportTokenId);
  if (isGitHubConfigured()) return [];
  const all = await readLocalEverything();
  return all.filter(
    (p) => String(p.pilgrimPassportTokenId) === tid && p.status !== "awarded"
  );
}

/** Flag a plan as awarded after the on-chain attestation tx succeeds. */
export async function markMilestonePlanAwarded(
  residencyId: number | bigint | string,
  pilgrimPassportTokenId: number | bigint | string,
  txHash: string
): Promise<void> {
  const plan = await getMilestonePlan(residencyId, pilgrimPassportTokenId);
  if (!plan) return;
  const now = new Date().toISOString();
  await upsertMilestonePlan({
    ...plan,
    status: "awarded",
    awardedAt: plan.awardedAt || now,
    awardTxHash: plan.awardTxHash || txHash,
    updatedAt: now,
    updatedBy: plan.updatedBy,
    revision: plan.revision + 1,
  });
}
