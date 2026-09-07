"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/context/auth-context";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, Building2, ExternalLink } from "lucide-react";

interface MyPatron {
  applicationId: string;
  status: "pending" | "approved" | "rejected" | "revoked";
  active: boolean;
  tokenId: string | null;
  companyName: string | null;
  description: string | null;
  website: string | null;
  contact: string | null;
  createdAt: string | null;
  skills: { hash: string; label: string }[];
}

const STATUS_STYLES: Record<MyPatron["status"], string> = {
  pending: "bg-amber-50 text-amber-700",
  approved: "bg-green-50 text-green-700",
  rejected: "bg-red-50 text-red-700",
  revoked: "bg-stone-100 text-muted",
};

const STATUS_LABEL: Record<MyPatron["status"], string> = {
  pending: "Pending approval",
  approved: "Active Patron",
  rejected: "Rejected",
  revoked: "Revoked",
};

export default function MyPatronsPage() {
  const { address, isAuthenticated, isLoading } = useAuth();
  const [loading, setLoading] = useState(true);
  const [patrons, setPatrons] = useState<MyPatron[]>([]);

  useEffect(() => {
    if (isLoading) return;
    if (!address) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/patrons/mine?applicant=${address}`);
        if (res.ok) {
          const data = await res.json();
          if (!cancelled) setPatrons(data.patrons || []);
        }
      } catch {
        // silent
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [address, isLoading]);

  if (isLoading || loading) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-20 flex justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-muted" />
      </div>
    );
  }

  if (!isAuthenticated || !address) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-20 text-center">
        <Building2 className="w-10 h-10 text-muted mx-auto mb-3" />
        <h1 className="text-xl font-semibold mb-2">My Patrons</h1>
        <p className="text-sm text-muted">Connect your wallet to view your Patrons.</p>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-10 sm:py-14">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-2xl font-bold text-foreground mb-1">My Patrons</h1>
          <p className="text-sm text-muted">
            Your Patron applications and badges. A wallet can hold multiple Patrons.
          </p>
        </div>
        <Link href="/register/patron" className="shrink-0">
          <Button>Register a Patron</Button>
        </Link>
      </div>

      {patrons.length === 0 ? (
        <Card className="p-10 text-center">
          <p className="text-sm text-muted mb-4">
            You have no Patron applications yet.
          </p>
          <Link href="/register/patron">
            <Button>Register a Patron</Button>
          </Link>
        </Card>
      ) : (
        <div className="space-y-3">
          {patrons.map((p) => (
            <Card key={p.applicationId} className="p-5">
              <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                <div className="min-w-0 space-y-1.5">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="font-semibold text-foreground">
                      {p.companyName || "Patron application"}
                    </h3>
                    <span
                      className={`text-[10px] uppercase tracking-wide px-2 py-0.5 rounded-full ${STATUS_STYLES[p.status]}`}
                    >
                      {STATUS_LABEL[p.status]}
                    </span>
                  </div>
                  {p.description && (
                    <p className="text-sm text-muted line-clamp-2">
                      {p.description}
                    </p>
                  )}
                  {p.website && (
                    <a
                      href={p.website}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
                    >
                      {p.website}
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  )}
                  {p.contact && (
                    <p className="text-xs text-muted">Contact: {p.contact}</p>
                  )}
                  {p.skills.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 pt-1">
                      {p.skills.map((s) => (
                        <span
                          key={s.hash}
                          className="px-2 py-0.5 rounded-full text-[11px] bg-primary-bg text-primary border border-primary/20"
                        >
                          {s.label}
                        </span>
                      ))}
                    </div>
                  )}
                  {p.status === "rejected" && (
                    <p className="text-xs text-muted pt-1">
                      This application was rejected. You can register another Patron.
                    </p>
                  )}
                </div>

                {p.status === "approved" && p.tokenId && (
                  <Link href={`/patrons/${p.tokenId}`} className="shrink-0">
                    <Button size="sm" variant="secondary">
                      View public page
                    </Button>
                  </Link>
                )}
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
