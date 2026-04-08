/**
 * Client-safe filtering logic. No Node.js (fs) imports.
 * Used by client components for in-memory filtering of hub data.
 */

import type { HubProfile, HubFilters } from "@/types";

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
