import type { Metadata } from "next";
import Link from "next/link";
import { getPublicPatrons } from "@/lib/patrons-directory";
import { PatronCard } from "@/components/patrons/patron-card";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = {
  title: "Patrons — Hubs Network",
  description:
    "Companies and organizations supporting Hubs Network residencies and activities.",
};

export const dynamic = "force-dynamic";

export default async function PatronsPage() {
  const patrons = await getPublicPatrons();

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-10 sm:py-14">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-8">
        <div>
          <p className="text-xs uppercase tracking-wider text-primary font-semibold mb-2">
            Patrons
          </p>
          <h1 className="text-2xl sm:text-3xl font-bold text-foreground mb-2">
            Hubs Network Patrons
          </h1>
          <p className="text-sm text-muted max-w-2xl">
            Companies and organizations supporting Hubs Network residencies and
            activities. Each Patron holds a verified, non-transferable badge.
          </p>
        </div>
        <Link href="/register/patron" className="shrink-0">
          <Button>Register a Patron</Button>
        </Link>
      </div>

      {patrons.length === 0 ? (
        <div className="rounded-xl border border-border bg-surface p-10 text-center">
          <p className="text-sm text-muted">
            No Patrons yet. Be the first to{" "}
            <Link href="/register/patron" className="text-primary hover:underline">
              register a Patron
            </Link>
            .
          </p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {patrons.map((p) => (
            <PatronCard key={p.tokenId} patron={p} />
          ))}
        </div>
      )}
    </div>
  );
}
