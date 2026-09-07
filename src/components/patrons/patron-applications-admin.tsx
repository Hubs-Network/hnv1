"use client";

import { useCallback, useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Loader2,
  Building2,
  CheckCircle,
  ExternalLink,
} from "lucide-react";
import {
  approvePatronApplication,
  rejectPatronApplication,
} from "@/lib/patron-sbt-client";

interface PatronApplication {
  applicationId: string;
  applicant: string;
  companyName: string;
  description: string;
  website: string;
  contact: string;
  createdAt: string;
  skills: { hash: string; label: string }[];
  skillHashes: string[];
}

const SEPOLIA_EXPLORER = "https://sepolia.etherscan.io/tx/";

function shorten(addr?: string): string {
  if (!addr) return "—";
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

export function PatronApplicationsAdmin({
  address,
  authProvider,
}: {
  address: string;
  authProvider: string | null;
}) {
  const [loading, setLoading] = useState(true);
  const [apps, setApps] = useState<PatronApplication[]>([]);
  const [actioning, setActioning] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [successTx, setSuccessTx] = useState<Record<string, string>>({});

  const refresh = useCallback(async () => {
    try {
      const res = await fetch("/api/patrons/applications", {
        headers: { "x-wallet-address": address },
      });
      if (res.ok) {
        const data = await res.json();
        setApps(data.applications || []);
      }
    } catch {
      // silent
    }
  }, [address]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      await refresh();
      if (!cancelled) setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [refresh]);

  async function handleApprove(app: PatronApplication) {
    setActioning(app.applicationId);
    setError(null);
    try {
      const result = await approvePatronApplication({
        applicationId: app.applicationId,
        applicant: app.applicant,
        skillHashes: app.skillHashes,
        signerAddress: address,
        authProvider,
      });
      if (result.txHash) {
        setSuccessTx((prev) => ({ ...prev, [app.applicationId]: result.txHash }));
      }
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Approval failed");
    } finally {
      setActioning(null);
    }
  }

  async function handleReject(app: PatronApplication) {
    if (!confirm("Reject this Patron application?")) return;
    setActioning(app.applicationId);
    setError(null);
    try {
      await rejectPatronApplication({
        applicationId: app.applicationId,
        applicant: app.applicant,
        signerAddress: address,
        authProvider,
      });
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Rejection failed");
    } finally {
      setActioning(null);
    }
  }

  return (
    <section className="mt-12">
      <div className="flex items-center gap-2 mb-4">
        <Building2 className="w-5 h-5 text-primary" />
        <h2 className="text-lg font-semibold text-foreground">
          Patron Applications
        </h2>
      </div>

      {error && (
        <div className="mb-4 p-3 rounded-lg bg-red-50 border border-red-200">
          <p className="text-sm text-red-600">{error}</p>
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-5 h-5 animate-spin text-muted" />
        </div>
      ) : apps.length === 0 ? (
        <Card className="p-8 text-center">
          <p className="text-sm text-muted">No pending Patron applications.</p>
        </Card>
      ) : (
        <div className="space-y-3">
          {apps.map((app) => (
            <Card key={app.applicationId} className="p-5">
              <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                <div className="space-y-1.5 min-w-0">
                  <h3 className="font-semibold text-foreground">
                    {app.companyName}
                  </h3>
                  <p className="text-sm text-muted whitespace-pre-wrap break-words">
                    {app.description}
                  </p>
                  <a
                    href={app.website}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
                  >
                    {app.website}
                    <ExternalLink className="w-3 h-3" />
                  </a>
                  <p className="text-xs text-muted">Contact: {app.contact}</p>
                  <p className="text-xs text-muted">
                    Applicant: {shorten(app.applicant)}
                  </p>
                  <p className="text-xs text-muted">
                    Submitted:{" "}
                    {app.createdAt
                      ? new Date(app.createdAt).toLocaleString()
                      : "—"}
                  </p>
                  <p className="text-[10px] text-muted-light font-mono break-all">
                    {app.applicationId}
                  </p>
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {app.skills.map((s) => (
                      <span
                        key={s.hash}
                        className="px-2 py-0.5 rounded-full text-[11px] bg-primary-bg text-primary border border-primary/20"
                      >
                        {s.label}
                      </span>
                    ))}
                  </div>
                  {successTx[app.applicationId] && (
                    <p className="flex items-center gap-1 text-xs text-green-700 pt-1">
                      <CheckCircle className="w-3 h-3" />
                      Minted —
                      <a
                        href={`${SEPOLIA_EXPLORER}${successTx[app.applicationId]}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="font-mono hover:underline"
                      >
                        {shorten(successTx[app.applicationId])}
                      </a>
                    </p>
                  )}
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <Button
                    size="sm"
                    onClick={() => handleApprove(app)}
                    disabled={actioning === app.applicationId}
                    className="gap-1.5"
                  >
                    {actioning === app.applicationId ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <CheckCircle className="w-4 h-4" />
                    )}
                    Approve
                  </Button>
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => handleReject(app)}
                    disabled={actioning === app.applicationId}
                  >
                    Reject
                  </Button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </section>
  );
}
