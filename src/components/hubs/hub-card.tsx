import Link from "next/link";
import type { HubProfile } from "@/types";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { truncate, formatLabel } from "@/lib/utils";
import { MapPin, Building2, Users, Bed } from "lucide-react";

interface HubCardProps {
  hub: HubProfile;
}

export function HubCard({ hub }: HubCardProps) {
  return (
    <Link href={`/hubs/${hub.hub_id}`}>
      <Card hover className="h-full flex flex-col">
        <div className="flex items-start justify-between gap-3 mb-3">
          <div>
            <h3 className="text-base font-semibold text-foreground leading-snug">
              {hub.name}
            </h3>
            <div className="flex items-center gap-1.5 mt-1 text-muted">
              <MapPin className="w-3.5 h-3.5 shrink-0" />
              <span className="text-sm">
                {hub.location.city}, {hub.location.country}
              </span>
            </div>
          </div>
          <Badge
            label={hub.identity.organizational_type}
            variant="outline"
            size="sm"
          />
        </div>

        <p className="text-sm text-muted leading-relaxed mb-4">
          {truncate(hub.tagline, 120)}
        </p>

        <div className="flex flex-wrap gap-1.5 mb-4">
          {hub.identity.vocation_tags.slice(0, 4).map((tag) => (
            <Badge key={tag} label={tag} variant="primary" size="sm" />
          ))}
        </div>

        <div className="mt-auto pt-4 border-t border-border-light">
          <div className="grid grid-cols-3 gap-2 text-xs text-muted">
            <div className="flex items-center gap-1.5">
              <Building2 className="w-3.5 h-3.5" />
              <span>
                {hub.spaces.length} {hub.spaces.length === 1 ? "space" : "spaces"}
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              <Bed className="w-3.5 h-3.5" />
              <span>{formatLabel(hub.accommodation.type)}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <Users className="w-3.5 h-3.5" />
              <span>
                {hub.network.length}{" "}
                {hub.network.length === 1 ? "partner" : "partners"}
              </span>
            </div>
          </div>
        </div>
      </Card>
    </Link>
  );
}
