"use client";

import Link from "next/link";
import { ScrollText, ArrowRight } from "lucide-react";
import { useAuth } from "@/context/auth-context";
import { useNotifications } from "@/hooks/use-notifications";

/**
 * Shows "you were selected for a residency" notices inside the pilgrim's own
 * passport section. Rendered on the public passport page but gated to the
 * connected owner, so only the pilgrim sees their selection notices.
 */
export function PassportResidencyNotices({ owner }: { owner: string }) {
  const { address } = useAuth();
  const { all } = useNotifications(address);

  const isOwner =
    !!address && address.toLowerCase() === owner.toLowerCase();
  if (!isOwner) return null;

  const selected = all.filter(
    (n) => n.channel === "passport" && n.type === "residency_selected"
  );
  if (selected.length === 0) return null;

  return (
    <div className="mb-8 space-y-2">
      {selected.map((n) => (
        <div
          key={n.id}
          className="flex items-start gap-3 rounded-xl border border-primary/20 bg-primary-bg p-4"
        >
          <ScrollText className="w-5 h-5 text-primary mt-0.5 shrink-0" />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-foreground">{n.title}</p>
            <p className="text-sm text-muted mt-0.5">{n.message}</p>
            {n.href && (
              <Link
                href={n.href}
                className="inline-flex items-center gap-1 text-sm text-primary hover:underline mt-1.5"
              >
                View residency
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
