"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowRight, ChevronDown, MapPin, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export interface ClaimHubItem {
  id: string;
  name: string;
  city?: string;
  country?: string;
}

/**
 * "Claim your Passport" CTA that expands an inline, scrollable list of approved
 * hubs (name + city, country) instead of dumping the pilgrim on the full hub
 * directory. Picking a hub takes them to that hub's page, where the claim flow
 * is clearest.
 */
export function ClaimHubPicker({ hubs }: { hubs: ClaimHubItem[] }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");

  const q = query.trim().toLowerCase();
  const filtered = q
    ? hubs.filter((h) =>
        [h.name, h.city, h.country]
          .filter(Boolean)
          .join(" ")
          .toLowerCase()
          .includes(q)
      )
    : hubs;

  return (
    <div>
      <div className="flex flex-wrap gap-3">
        <Button size="lg" onClick={() => setOpen((v) => !v)} aria-expanded={open}>
          Claim your Passport
          <ChevronDown
            className={cn(
              "w-4 h-4 transition-transform",
              open && "rotate-180"
            )}
          />
        </Button>
        <Link href="/hubs">
          <Button variant="secondary" size="lg">
            Browse Hubs
          </Button>
        </Link>
      </div>

      {open && (
        <div className="mt-5 rounded-2xl border border-border bg-surface overflow-hidden">
          <div className="px-4 py-3 border-b border-border">
            <p className="text-sm font-medium text-foreground mb-2">
              Choose a hub to claim your Passport from
            </p>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-light" />
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search by name, city, or country…"
                className="w-full rounded-lg border border-border bg-primary-bg/40 pl-9 pr-3 py-2 text-sm text-foreground placeholder:text-muted-light"
              />
            </div>
          </div>

          {filtered.length === 0 ? (
            <p className="px-4 py-6 text-sm text-muted">
              {hubs.length === 0
                ? "No approved hubs are available yet. Check back soon."
                : "No hubs match your search."}
            </p>
          ) : (
            <ul className="max-h-80 overflow-y-auto divide-y divide-border">
              {filtered.map((hub) => (
                <li key={hub.id}>
                  <Link
                    href={`/hubs/${hub.id}`}
                    className="group flex items-center justify-between gap-3 px-4 py-3 hover:bg-primary-bg/40 transition-colors"
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">
                        {hub.name}
                      </p>
                      {(hub.city || hub.country) && (
                        <p className="text-xs text-muted flex items-center gap-1 mt-0.5">
                          <MapPin className="w-3 h-3 shrink-0" />
                          <span className="truncate">
                            {[hub.city, hub.country].filter(Boolean).join(", ")}
                          </span>
                        </p>
                      )}
                    </div>
                    <ArrowRight className="w-4 h-4 text-muted-light group-hover:text-primary shrink-0" />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
