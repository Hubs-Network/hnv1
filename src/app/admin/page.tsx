"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/context/auth-context";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import {
  Loader2,
  ShieldCheck,
  ShieldX,
  Award,
  ExternalLink,
  CheckCircle,
} from "lucide-react";

interface BadgeApplication {
  hub_id: string;
  name?: string;
  safeAddress?: string;
  status: string;
  applicantAddress?: string;
  submittedAt?: string;
}

function shorten(addr?: string): string {
  if (!addr) return "—";
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

const SEPOLIA_EXPLORER = "https://sepolia.etherscan.io/tx/";

export default function AdminPage() {
  const { address, authProvider, isAuthenticated, isLoading: authLoading } = useAuth();
  const [checking, setChecking] = useState(true);
  const [isHNAdmin, setIsHNAdmin] = useState(false);
  const [loadingApps, setLoadingApps] = useState(false);
  const [applications, setApplications] = useState<BadgeApplication[]>([]);
  const [actioning, setActioning] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [successTx, setSuccessTx] = useState<Record<string, string>>({});

  async function refreshApplications() {
    if (!address) return;
    try {
      const res = await fetch("/api/admin/hn-badge/applications", {
        headers: { "x-wallet-address": address },
      });
      if (res.ok) {
        const data = await res.json();
        setApplications(data.applications || []);
      }
    } catch {
      // silent
    }
  }

  async function handleApprove(hubId: string) {
    if (!address) return;
    setActioning(hubId);
    setActionError(null);
    try {
      const { signHNBadgeAction } = await import("@/lib/hn-badge-client");
      const { signature, issuedAt } = await signHNBadgeAction({
        action: "approve",
        hubId,
        authProvider,
      });

      const res = await fetch(
        `/api/admin/hn-badge/applications/${hubId}/approve`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ signature, issuedAt }),
        }
      );
      const result = await res.json();
      if (!res.ok) {
        setActionError(result.error || "Approval failed");
        return;
      }
      if (result.txHash) {
        setSuccessTx((prev) => ({ ...prev, [hubId]: result.txHash }));
      }
      await refreshApplications();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Signing failed";
      setActionError(msg);
    } finally {
      setActioning(null);
    }
  }

  async function handleReject(hubId: string) {
    if (!address) return;
    if (!confirm("Reject this badge application?")) return;
    setActioning(hubId);
    setActionError(null);
    try {
      const { signHNBadgeAction } = await import("@/lib/hn-badge-client");
      const { signature, issuedAt } = await signHNBadgeAction({
        action: "reject",
        hubId,
        authProvider,
      });

      const res = await fetch(
        `/api/admin/hn-badge/applications/${hubId}/reject`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ signature, issuedAt }),
        }
      );
      const result = await res.json();
      if (!res.ok) {
        setActionError(result.error || "Rejection failed");
        return;
      }
      await refreshApplications();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Signing failed";
      setActionError(msg);
    } finally {
      setActioning(null);
    }
  }

  useEffect(() => {
    if (authLoading) return;
    if (!isAuthenticated || !address) {
      setChecking(false);
      setIsHNAdmin(false);
      return;
    }

    let cancelled = false;
    (async () => {
      setChecking(true);
      try {
        const res = await fetch("/api/hn/is-admin", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ wallet_address: address }),
        });
        const result = await res.json();
        if (!cancelled) setIsHNAdmin(result.is_hn_admin === true);
      } catch {
        if (!cancelled) setIsHNAdmin(false);
      } finally {
        if (!cancelled) setChecking(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [authLoading, isAuthenticated, address]);

  useEffect(() => {
    if (!isHNAdmin || !address) return;

    let cancelled = false;
    (async () => {
      setLoadingApps(true);
      try {
        const res = await fetch("/api/admin/hn-badge/applications", {
          headers: { "x-wallet-address": address },
        });
        if (res.ok) {
          const data = await res.json();
          if (!cancelled) setApplications(data.applications || []);
        }
      } catch {
        // silent
      } finally {
        if (!cancelled) setLoadingApps(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isHNAdmin, address]);

  if (authLoading || checking) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-20 flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-muted" />
      </div>
    );
  }

  if (!isAuthenticated || !isHNAdmin) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-20 text-center">
        <ShieldX className="w-12 h-12 text-red-500 mx-auto mb-4" />
        <h1 className="text-xl font-semibold mb-2">Admin Panel</h1>
        <p className="text-sm text-muted">
          {isAuthenticated
            ? "Your wallet is not an owner of the HN Directors Safe."
            : "Connect your wallet to access the admin panel."}
        </p>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <div className="flex items-center gap-2 mb-2">
        <ShieldCheck className="w-6 h-6 text-primary" />
        <h1 className="text-2xl font-bold text-foreground">Admin Panel</h1>
      </div>
      <p className="text-sm text-muted mb-8">
        Hubs Network administration. You are an owner of the HN Directors Safe.
      </p>

      <section>
        <div className="flex items-center gap-2 mb-4">
          <Award className="w-5 h-5 text-primary" />
          <h2 className="text-lg font-semibold text-foreground">
            HN Badge Applications
          </h2>
        </div>

        {actionError && (
          <div className="mb-4 p-3 rounded-lg bg-red-50 border border-red-200">
            <p className="text-sm text-red-600">{actionError}</p>
          </div>
        )}

        {loadingApps ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-5 h-5 animate-spin text-muted" />
          </div>
        ) : applications.length === 0 ? (
          <Card className="p-8 text-center">
            <p className="text-sm text-muted">No pending applications.</p>
          </Card>
        ) : (
          <div className="space-y-3">
            {applications.map((app) => (
              <Card key={app.hub_id} className="p-5">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="space-y-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold text-foreground truncate">
                        {app.name || app.hub_id}
                      </h3>
                      <span className="text-[10px] uppercase tracking-wide px-2 py-0.5 rounded-full bg-amber-50 text-amber-700">
                        {app.status}
                      </span>
                    </div>
                    <p className="text-xs text-muted font-mono break-all">
                      Safe: {app.safeAddress || app.hub_id}
                    </p>
                    <p className="text-xs text-muted">
                      Applicant: {shorten(app.applicantAddress)}
                    </p>
                    <p className="text-xs text-muted">
                      Submitted:{" "}
                      {app.submittedAt
                        ? new Date(app.submittedAt).toLocaleString()
                        : "—"}
                    </p>
                    <Link
                      href={`/hubs/${app.hub_id}`}
                      className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
                    >
                      View hub profile
                      <ExternalLink className="w-3 h-3" />
                    </Link>
                    {successTx[app.hub_id] && (
                      <p className="flex items-center gap-1 text-xs text-green-700">
                        <CheckCircle className="w-3 h-3" />
                        Minted —
                        <a
                          href={`${SEPOLIA_EXPLORER}${successTx[app.hub_id]}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="font-mono hover:underline"
                        >
                          {shorten(successTx[app.hub_id])}
                        </a>
                      </p>
                    )}
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <Button
                      size="sm"
                      onClick={() => handleApprove(app.hub_id)}
                      disabled={actioning === app.hub_id}
                      className="gap-1.5"
                    >
                      {actioning === app.hub_id ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Award className="w-4 h-4" />
                      )}
                      Approve
                    </Button>
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => handleReject(app.hub_id)}
                      disabled={actioning === app.hub_id}
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
    </div>
  );
}
