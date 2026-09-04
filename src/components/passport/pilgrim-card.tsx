import Link from "next/link";
import { BadgeCheck, ExternalLink } from "lucide-react";
import { Card } from "@/components/ui/card";
import type { PilgrimProfile } from "@/types";

/** Public card for a published pilgrim, shown in the /pilgrims directory. */
export function PilgrimCard({ pilgrim }: { pilgrim: PilgrimProfile }) {
  const skills = pilgrim.skills ?? [];
  const shown = skills.slice(0, 6);
  const extra = skills.length - shown.length;

  return (
    <Card padding="md" className="flex flex-col gap-3 h-full">
      <div className="flex items-start justify-between gap-2">
        <h3 className="font-semibold text-foreground flex items-center gap-1.5 min-w-0">
          <BadgeCheck className="w-4 h-4 text-primary shrink-0" />
          <span className="truncate">{pilgrim.nickname || "Pilgrim"}</span>
        </h3>
        {pilgrim.passportTokenId && (
          <Link
            href={`/passport/${pilgrim.passportTokenId}`}
            className="text-xs text-primary hover:underline shrink-0"
          >
            #{pilgrim.passportTokenId}
          </Link>
        )}
      </div>

      {pilgrim.tagline && (
        <p className="text-sm text-muted line-clamp-3">{pilgrim.tagline}</p>
      )}

      {shown.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {shown.map((s) => (
            <span
              key={s.hash}
              className="inline-flex items-center rounded-full bg-primary-bg text-primary px-2.5 py-0.5 text-xs font-medium"
            >
              {s.label}
            </span>
          ))}
          {extra > 0 && (
            <span className="inline-flex items-center rounded-full bg-stone-100 text-muted px-2.5 py-0.5 text-xs font-medium">
              +{extra}
            </span>
          )}
        </div>
      )}

      <div className="mt-auto flex items-center justify-between pt-1">
        {pilgrim.link ? (
          <a
            href={pilgrim.link}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-primary hover:underline inline-flex items-center gap-1 min-w-0"
          >
            <span className="truncate">
              {pilgrim.link.replace(/^https?:\/\//, "")}
            </span>
            <ExternalLink className="w-3 h-3 shrink-0" />
          </a>
        ) : (
          <span />
        )}
        {pilgrim.passportTokenId && (
          <Link
            href={`/passport/${pilgrim.passportTokenId}`}
            className="text-xs text-muted hover:text-foreground"
          >
            View passport →
          </Link>
        )}
      </div>
    </Card>
  );
}
