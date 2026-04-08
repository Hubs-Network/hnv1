"use client";

import { useState, useMemo } from "react";
import type { HubProfile, HubFilters } from "@/types";
import { filterHubs } from "@/lib/data/client-filters";
import { HubCard } from "@/components/hubs/hub-card";
import { HubFiltersPanel } from "@/components/hubs/hub-filters";
import { EmptyState } from "@/components/ui/empty-state";
import { Button } from "@/components/ui/button";
import { Search, SlidersHorizontal, X } from "lucide-react";
import { cn } from "@/lib/utils";

interface Props {
  hubs: HubProfile[];
  countries: string[];
}

export function HubDirectoryClient({ hubs, countries }: Props) {
  const [filters, setFilters] = useState<HubFilters>({});
  const [showMobileFilters, setShowMobileFilters] = useState(false);

  const filtered = useMemo(() => filterHubs(hubs, filters), [hubs, filters]);

  return (
    <div className="flex gap-8">
      {/* Desktop filters sidebar */}
      <aside className="hidden lg:block w-72 shrink-0">
        <div className="sticky top-24">
          <HubFiltersPanel
            filters={filters}
            onChange={setFilters}
            countries={countries}
            totalCount={hubs.length}
            filteredCount={filtered.length}
          />
        </div>
      </aside>

      {/* Mobile filter toggle */}
      <div className="lg:hidden fixed bottom-6 right-6 z-40">
        <Button
          onClick={() => setShowMobileFilters(true)}
          className="rounded-full shadow-lg"
          size="lg"
        >
          <SlidersHorizontal className="w-4 h-4" />
          Filters
        </Button>
      </div>

      {/* Mobile filter drawer */}
      {showMobileFilters && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div
            className="absolute inset-0 bg-black/30"
            onClick={() => setShowMobileFilters(false)}
          />
          <div className="absolute right-0 top-0 bottom-0 w-80 bg-surface border-l border-border p-6 overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-semibold">Filters</h2>
              <button
                onClick={() => setShowMobileFilters(false)}
                className="text-muted hover:text-foreground"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <HubFiltersPanel
              filters={filters}
              onChange={setFilters}
              countries={countries}
              totalCount={hubs.length}
              filteredCount={filtered.length}
            />
          </div>
        </div>
      )}

      {/* Results */}
      <div className="flex-1 min-w-0">
        {filtered.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {filtered.map((hub) => (
              <HubCard key={hub.hub_id} hub={hub} />
            ))}
          </div>
        ) : (
          <EmptyState
            icon={<Search className="w-12 h-12" />}
            title="No hubs found"
            description="Try adjusting your filters or search terms."
            action={
              <Button variant="secondary" onClick={() => setFilters({})}>
                Clear all filters
              </Button>
            }
          />
        )}
      </div>
    </div>
  );
}
