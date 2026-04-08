import fs from "fs";
import path from "path";
import type { HubProfile, HubFilters } from "@/types";

const DATA_DIR = path.join(process.cwd(), "data", "hubs");

function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

export async function getAllHubs(): Promise<HubProfile[]> {
  ensureDataDir();
  const files = fs.readdirSync(DATA_DIR).filter((f) => f.endsWith(".json"));
  const hubs: HubProfile[] = [];

  for (const file of files) {
    try {
      const raw = fs.readFileSync(path.join(DATA_DIR, file), "utf-8");
      hubs.push(JSON.parse(raw) as HubProfile);
    } catch {
      console.warn(`Failed to parse hub file: ${file}`);
    }
  }

  return hubs.sort(
    (a, b) =>
      new Date(b.metadata.submitted_at).getTime() -
      new Date(a.metadata.submitted_at).getTime()
  );
}

export async function getHubById(hubId: string): Promise<HubProfile | null> {
  ensureDataDir();
  const filePath = path.join(DATA_DIR, `${hubId}.json`);

  if (!fs.existsSync(filePath)) return null;

  try {
    const raw = fs.readFileSync(filePath, "utf-8");
    return JSON.parse(raw) as HubProfile;
  } catch {
    return null;
  }
}

export async function saveHub(hub: HubProfile): Promise<void> {
  ensureDataDir();
  const filePath = path.join(DATA_DIR, `${hub.hub_id}.json`);
  fs.writeFileSync(filePath, JSON.stringify(hub, null, 2), "utf-8");
}

export async function hubExists(hubId: string): Promise<boolean> {
  ensureDataDir();
  return fs.existsSync(path.join(DATA_DIR, `${hubId}.json`));
}

export function filterHubs(
  hubs: HubProfile[],
  filters: HubFilters
): HubProfile[] {
  return hubs.filter((hub) => {
    if (filters.search) {
      const q = filters.search.toLowerCase();
      const searchable = [
        hub.name,
        hub.tagline,
        hub.description,
        hub.location.city,
        hub.location.country,
        ...hub.identity.vocation_tags,
        ...hub.identity.mission_keywords,
      ]
        .join(" ")
        .toLowerCase();
      if (!searchable.includes(q)) return false;
    }

    if (
      filters.country &&
      hub.location.country.toLowerCase() !== filters.country.toLowerCase()
    )
      return false;

    if (filters.vocation_tags?.length) {
      const has = filters.vocation_tags.some((t) =>
        hub.identity.vocation_tags.includes(t)
      );
      if (!has) return false;
    }

    if (
      filters.organizational_type &&
      hub.identity.organizational_type !== filters.organizational_type
    )
      return false;

    if (filters.stage && hub.identity.stage !== filters.stage) return false;

    if (
      filters.accommodation_type &&
      hub.accommodation.type !== filters.accommodation_type
    )
      return false;

    if (filters.revenue_models?.length) {
      const has = filters.revenue_models.some((r) =>
        hub.identity.revenue_models.includes(r)
      );
      if (!has) return false;
    }

    if (filters.challenge_areas?.length) {
      const hubAreas = hub.challenges.flatMap((c) => c.area);
      const has = filters.challenge_areas.some((a) => hubAreas.includes(a));
      if (!has) return false;
    }

    return true;
  });
}

export function extractCountries(hubs: HubProfile[]): string[] {
  const countries = new Set(hubs.map((h) => h.location.country));
  return Array.from(countries).sort();
}
