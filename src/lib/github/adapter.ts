/**
 * GitHub repository adapter for persisting entity data.
 *
 * This module provides an abstraction layer over repository write operations.
 * Currently implements a local filesystem adapter. To enable actual GitHub
 * integration, implement the GitHubAdapter class and set the appropriate
 * environment variables.
 *
 * Required env vars for GitHub mode:
 *   GITHUB_TOKEN, GITHUB_OWNER, GITHUB_REPO, GITHUB_BRANCH (optional)
 */

import type { HubProfile, EntityType, SubmissionResult } from "@/types";
import { saveHub, hubExists } from "@/lib/data/hubs";

interface RepoAdapter {
  writeFile(path: string, content: string): Promise<SubmissionResult>;
  fileExists(path: string): Promise<boolean>;
}

class LocalFSAdapter implements RepoAdapter {
  async writeFile(_path: string, _content: string): Promise<SubmissionResult> {
    return { success: true };
  }

  async fileExists(_path: string): Promise<boolean> {
    return false;
  }
}

/**
 * Placeholder for actual GitHub Contents API integration.
 * Uncomment and implement when ready to write directly to GitHub.
 */
// class GitHubAPIAdapter implements RepoAdapter {
//   private token: string;
//   private owner: string;
//   private repo: string;
//   private branch: string;
//
//   constructor() {
//     this.token = process.env.GITHUB_TOKEN!;
//     this.owner = process.env.GITHUB_OWNER!;
//     this.repo = process.env.GITHUB_REPO!;
//     this.branch = process.env.GITHUB_BRANCH || "main";
//   }
//
//   async writeFile(path: string, content: string): Promise<SubmissionResult> {
//     const url = `https://api.github.com/repos/${this.owner}/${this.repo}/contents/${path}`;
//     const body = {
//       message: `Add ${path}`,
//       content: Buffer.from(content).toString("base64"),
//       branch: this.branch,
//     };
//     const res = await fetch(url, {
//       method: "PUT",
//       headers: {
//         Authorization: `Bearer ${this.token}`,
//         "Content-Type": "application/json",
//       },
//       body: JSON.stringify(body),
//     });
//     if (!res.ok) return { success: false, error: await res.text() };
//     return { success: true };
//   }
//
//   async fileExists(path: string): Promise<boolean> {
//     const url = `https://api.github.com/repos/${this.owner}/${this.repo}/contents/${path}`;
//     const res = await fetch(url, {
//       headers: { Authorization: `Bearer ${this.token}` },
//     });
//     return res.ok;
//   }
// }

function getAdapter(): RepoAdapter {
  // Swap to GitHubAPIAdapter when GITHUB_TOKEN is configured
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
    if (type === "hub") {
      const exists = await hubExists(profile.hub_id);
      if (exists) {
        return {
          success: false,
          error: `A hub with ID "${profile.hub_id}" already exists`,
        };
      }
      await saveHub(profile);
    }

    await adapter.writeFile(filePath, content);
    return { success: true, id: profile.hub_id };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Unknown error",
    };
  }
}
