import Link from "next/link";
import { Card } from "@/components/ui/card";
import { MapPin, Users } from "lucide-react";
import { ResidencyStatusBadge } from "./residency-status-badge";
import type { ResidencyView } from "@/lib/residencies-directory";

/**
 * Bulletin Board card preview. Shows only: hub name, title, skills and status.
 * Full details (and the apply flow) live on the residency detail page, which is
 * gated to Pilgrim Passport holders / hub signers.
 */
export function ResidencyCard({ residency }: { residency: ResidencyView }) {
  const skills = residency.skills.slice(0, 6);
  const extra = residency.skills.length - skills.length;

  return (
    <Link href={`/residencies/${residency.id}`} className="block group">
      <Card className="p-5 h-full transition-colors group-hover:border-primary/40">
        <div className="flex items-start justify-between gap-3 mb-2">
          <div className="min-w-0">
            {residency.hubName && (
              <p className="text-xs text-muted flex items-center gap-1 truncate">
                <MapPin className="w-3 h-3 shrink-0" />
                {residency.hubName}
              </p>
            )}
            <h3 className="text-base font-semibold text-foreground mt-0.5 line-clamp-2">
              {residency.title || `Residency #${residency.id}`}
            </h3>
          </div>
          <ResidencyStatusBadge status={residency.uiStatus} />
        </div>

        {skills.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mt-3">
            {skills.map((s) => (
              <span
                key={s.hash}
                className="px-2 py-0.5 rounded-full text-[11px] font-medium bg-primary-bg text-primary border border-primary/15"
              >
                {s.label}
              </span>
            ))}
            {extra > 0 && (
              <span className="px-2 py-0.5 rounded-full text-[11px] font-medium bg-stone-100 text-muted">
                +{extra} more
              </span>
            )}
          </div>
        )}

        <div className="flex items-center gap-3 mt-4 text-xs text-muted">
          <span className="inline-flex items-center gap-1">
            <Users className="w-3 h-3" />
            {residency.applicantCount} applicant
            {residency.applicantCount === 1 ? "" : "s"}
          </span>
        </div>
      </Card>
    </Link>
  );
}
