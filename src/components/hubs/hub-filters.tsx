"use client";

import { useCallback } from "react";
import type { HubFilters } from "@/types";
import { Select } from "@/components/ui/select";
import { SearchInput } from "@/components/ui/search-input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  VOCATION_TAGS,
  ORGANIZATIONAL_TYPES,
  STAGES,
  ACCOMMODATION_TYPES,
  REVENUE_MODELS,
  CHALLENGE_AREAS,
} from "@/config/vocabularies";
import { formatLabel } from "@/lib/utils";
import { SlidersHorizontal, X } from "lucide-react";

interface HubFiltersProps {
  filters: HubFilters;
  onChange: (filters: HubFilters) => void;
  countries: string[];
  totalCount: number;
  filteredCount: number;
}

export function HubFiltersPanel({
  filters,
  onChange,
  countries,
  totalCount,
  filteredCount,
}: HubFiltersProps) {
  const update = useCallback(
    (patch: Partial<HubFilters>) => {
      onChange({ ...filters, ...patch });
    },
    [filters, onChange]
  );

  const toggleVocationTag = useCallback(
    (tag: string) => {
      const current = filters.vocation_tags || [];
      const next = current.includes(tag as never)
        ? current.filter((t) => t !== tag)
        : [...current, tag as never];
      update({ vocation_tags: next });
    },
    [filters.vocation_tags, update]
  );

  const hasFilters =
    filters.search ||
    filters.country ||
    filters.vocation_tags?.length ||
    filters.organizational_type ||
    filters.stage ||
    filters.accommodation_type ||
    filters.revenue_models?.length ||
    filters.challenge_areas?.length;

  const clearAll = () => onChange({});

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <SlidersHorizontal className="w-4 h-4 text-muted" />
          <h2 className="text-sm font-semibold text-foreground">Filters</h2>
        </div>
        <span className="text-xs text-muted">
          {filteredCount} of {totalCount} hubs
        </span>
      </div>

      <SearchInput
        placeholder="Search hubs…"
        value={filters.search || ""}
        onSearch={(value) => update({ search: value })}
      />

      <div className="space-y-4">
        <div>
          <label className="block text-xs font-medium text-muted uppercase tracking-wider mb-2">
            Vocation
          </label>
          <div className="flex flex-wrap gap-1.5">
            {VOCATION_TAGS.map((tag) => (
              <Badge
                key={tag}
                label={tag}
                variant="primary"
                size="sm"
                active={filters.vocation_tags?.includes(tag)}
                onClick={() => toggleVocationTag(tag)}
              />
            ))}
          </div>
        </div>

        <Select
          label="Country"
          options={countries}
          value={filters.country || ""}
          onChange={(e) => update({ country: e.target.value || undefined })}
          placeholder="All countries"
        />

        <Select
          label="Organization Type"
          options={[...ORGANIZATIONAL_TYPES]}
          value={filters.organizational_type || ""}
          onChange={(e) =>
            update({ organizational_type: (e.target.value as never) || undefined })
          }
          placeholder="Any type"
        />

        <Select
          label="Stage"
          options={[...STAGES]}
          value={filters.stage || ""}
          onChange={(e) => update({ stage: (e.target.value as never) || undefined })}
          placeholder="Any stage"
        />

        <Select
          label="Accommodation"
          options={[...ACCOMMODATION_TYPES]}
          value={filters.accommodation_type || ""}
          onChange={(e) =>
            update({
              accommodation_type: (e.target.value as never) || undefined,
            })
          }
          placeholder="Any accommodation"
        />
      </div>

      {hasFilters && (
        <Button
          variant="ghost"
          size="sm"
          onClick={clearAll}
          className="w-full justify-center gap-1"
        >
          <X className="w-3.5 h-3.5" />
          Clear all filters
        </Button>
      )}
    </div>
  );
}
