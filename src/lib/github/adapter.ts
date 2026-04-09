/**
 * GitHub repository adapter for persisting entity data.
 *
 * Uses the GitHub Contents API to read/write JSON files directly in the repo.
 * Falls back to local filesystem when GITHUB_TOKEN is not configured (local dev).
 *
 * Required env vars for production:
 *   GITHUB_TOKEN, GITHUB_OWNER, GITHUB_REPO, GITHUB_BRANCH (optional, defaults to "main")
 */

import type { HubProfile, EntityType, SubmissionResult } from "@/types";

interface RepoAdapter {
  writeFile(path: string, content: string, message: string): Promise<SubmissionResult>;
  updateFile(path: string, content: string, message: string): Promise<SubmissionResult>;
  fileExists(path: string): Promise<boolean>;
}

class GitHubAPIAdapter implements RepoAdapter {
  private token: string;
  private owner: string;
  private repo: string;
  private branch: string;

  constructor() {
    this.token = process.env.GITHUB_TOKEN!;
    this.owner = process.env.GITHUB_OWNER!;
    this.repo = process.env.GITHUB_REPO!;
    this.branch = process.env.GITHUB_BRANCH || "main";
  }

  private get headers() {
    return {
      Authorization: `Bearer ${this.token}`,
      Accept: "application/vnd.github.v3+json",
      "Content-Type": "application/json",
    };
  }

  async writeFile(path: string, content: string, message: string): Promise<SubmissionResult> {
    const url = `https://api.github.com/repos/${this.owner}/${this.repo}/contents/${path}`;
    const body = {
      message,
      content: Buffer.from(content).toString("base64"),
      branch: this.branch,
    };

    const res = await fetch(url, {
      method: "PUT",
      headers: this.headers,
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const errorBody = await res.text();
      console.error(`GitHub API write error (${res.status}):`, errorBody);
      return { success: false, error: `GitHub API error: ${res.status}` };
    }

    return { success: true };
  }

  /**
   * Update requires the current file SHA (GitHub Contents API constraint).
   */
  async updateFile(path: string, content: string, message: string): Promise<SubmissionResult> {
    const url = `https://api.github.com/repos/${this.owner}/${this.repo}/contents/${path}?ref=${this.branch}`;

    const getRes = await fetch(url, { headers: this.headers });
    if (!getRes.ok) {
      return { success: false, error: "File not found on GitHub" };
    }

    const fileData = (await getRes.json()) as { sha: string };
    const sha = fileData.sha;

    const putUrl = `https://api.github.com/repos/${this.owner}/${this.repo}/contents/${path}`;
    const body = {
      message,
      content: Buffer.from(content).toString("base64"),
      sha,
      branch: this.branch,
    };

    const res = await fetch(putUrl, {
      method: "PUT",
      headers: this.headers,
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const errorBody = await res.text();
      console.error(`GitHub API update error (${res.status}):`, errorBody);
      return { success: false, error: `GitHub API error: ${res.status}` };
    }

    return { success: true };
  }

  async fileExists(path: string): Promise<boolean> {
    const url = `https://api.github.com/repos/${this.owner}/${this.repo}/contents/${path}?ref=${this.branch}`;
    const res = await fetch(url, { headers: this.headers });
    return res.ok;
  }
}

class LocalFSAdapter implements RepoAdapter {
  async writeFile(path: string, content: string, _message: string): Promise<SubmissionResult> {
    const fs = await import("fs");
    const pathMod = await import("path");
    const fullPath = pathMod.join(process.cwd(), path);
    const dir = pathMod.dirname(fullPath);

    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    fs.writeFileSync(fullPath, content, "utf-8");
    return { success: true };
  }

  async updateFile(path: string, content: string, message: string): Promise<SubmissionResult> {
    return this.writeFile(path, content, message);
  }

  async fileExists(path: string): Promise<boolean> {
    const fs = await import("fs");
    const pathMod = await import("path");
    const fullPath = pathMod.join(process.cwd(), path);
    return fs.existsSync(fullPath);
  }
}

function getAdapter(): RepoAdapter {
  if (process.env.GITHUB_TOKEN && process.env.GITHUB_OWNER && process.env.GITHUB_REPO) {
    return new GitHubAPIAdapter();
  }
  return new LocalFSAdapter();
}

export function serializeProfile(profile: HubProfile): string {
  return JSON.stringify(profile, null, 2);
}

function entityDataPath(type: EntityType, id: string): string {
  return `data/${type}s/${id}.json`;
}

export async function saveProfileToRepo(
  type: EntityType,
  profile: HubProfile
): Promise<SubmissionResult> {
  const adapter = getAdapter();
  const filePath = entityDataPath(type, profile.hub_id);
  const content = serializeProfile(profile);

  try {
    const exists = await adapter.fileExists(filePath);
    if (exists) {
      return {
        success: false,
        error: `A ${type} with ID "${profile.hub_id}" already exists`,
      };
    }

    const commitMessage = `Register ${type}: ${profile.name} (${profile.hub_id})`;
    const result = await adapter.writeFile(filePath, content, commitMessage);

    if (!result.success) return result;

    return { success: true, id: profile.hub_id };
  } catch (err) {
    console.error(`Error saving ${type} profile:`, err);
    return {
      success: false,
      error: err instanceof Error ? err.message : "Unknown error",
    };
  }
}

export async function updateProfileInRepo(
  type: EntityType,
  profile: HubProfile
): Promise<SubmissionResult> {
  const adapter = getAdapter();
  const filePath = entityDataPath(type, profile.hub_id);
  const content = serializeProfile(profile);

  try {
    const commitMessage = `Update ${type}: ${profile.name} (${profile.hub_id})`;
    const result = await adapter.updateFile(filePath, content, commitMessage);

    if (!result.success) return result;

    return { success: true, id: profile.hub_id };
  } catch (err) {
    console.error(`Error updating ${type} profile:`, err);
    return {
      success: false,
      error: err instanceof Error ? err.message : "Unknown error",
    };
  }
}
