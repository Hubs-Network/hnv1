import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { BadgeCheck, ExternalLink, ArrowLeft } from "lucide-react";
import { getPublicPatronByTokenId } from "@/lib/patrons-directory";
import { NEXT_PUBLIC_PATRON_SBT_ADDRESS } from "@/config/patron-sbt";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ tokenId: string }>;
}): Promise<Metadata> {
  const { tokenId } = await params;
  const patron = await getPublicPatronByTokenId(tokenId);
  return {
    title: patron
      ? `${patron.companyName} — Hubs Network Patron`
      : "Patron — Hubs Network",
  };
}

const EXPLORER = "https://sepolia.etherscan.io";

function shorten(addr: string): string {
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

export default async function PatronDetailPage({
  params,
}: {
  params: Promise<{ tokenId: string }>;
}) {
  const { tokenId } = await params;
  const patron = await getPublicPatronByTokenId(tokenId);
  if (!patron) notFound();

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-10 sm:py-14">
      <Link
        href="/patrons"
        className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-foreground mb-6"
      >
        <ArrowLeft className="w-4 h-4" />
        All Patrons
      </Link>

      <div className="flex items-center gap-2 mb-1">
        <BadgeCheck className="w-6 h-6 text-primary" />
        <h1 className="text-2xl sm:text-3xl font-bold text-foreground">
          {patron.companyName}
        </h1>
      </div>
      <p className="text-xs uppercase tracking-wide text-green-700 font-semibold mb-6">
        Verified Patron · #{patron.tokenId}
      </p>

      <div className="space-y-6">
        <section>
          <h2 className="text-sm font-semibold text-foreground mb-1.5">About</h2>
          <p className="text-sm text-muted whitespace-pre-wrap">
            {patron.description}
          </p>
        </section>

        {patron.website && (
          <section>
            <h2 className="text-sm font-semibold text-foreground mb-1.5">
              Website
            </h2>
            <a
              href={patron.website}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-sm text-primary hover:underline"
            >
              {patron.website}
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
          </section>
        )}

        <section>
          <h2 className="text-sm font-semibold text-foreground mb-2">
            Skills scope
          </h2>
          <div className="flex flex-wrap gap-1.5">
            {patron.skills.map((s) => (
              <span
                key={s.hash}
                className="inline-flex items-center rounded-full bg-primary-bg text-primary px-2.5 py-0.5 text-xs font-medium"
              >
                {s.label}
              </span>
            ))}
          </div>
        </section>

        <section className="rounded-lg border border-border bg-surface p-4 space-y-2 text-xs text-muted">
          <div className="flex items-center justify-between gap-2">
            <span>Patron token</span>
            <span className="font-mono">#{patron.tokenId}</span>
          </div>
          <div className="flex items-center justify-between gap-2">
            <span>Wallet</span>
            <a
              href={`${EXPLORER}/address/${patron.wallet}`}
              target="_blank"
              rel="noopener noreferrer"
              className="font-mono text-primary hover:underline"
            >
              {shorten(patron.wallet)}
            </a>
          </div>
          <div className="flex items-center justify-between gap-2">
            <span>Contract</span>
            <a
              href={`${EXPLORER}/address/${NEXT_PUBLIC_PATRON_SBT_ADDRESS}`}
              target="_blank"
              rel="noopener noreferrer"
              className="font-mono text-primary hover:underline"
            >
              {shorten(NEXT_PUBLIC_PATRON_SBT_ADDRESS)}
            </a>
          </div>
        </section>
      </div>
    </div>
  );
}
