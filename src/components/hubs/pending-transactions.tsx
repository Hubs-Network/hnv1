"use client";

import { useEffect, useState, useCallback } from "react";
import { useAuth } from "@/context/auth-context";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Loader2, CheckCircle, Clock, AlertCircle, Zap, X } from "lucide-react";

interface Confirmation {
  owner: string;
  signature: string;
}

interface Proposal {
  id: number;
  safe_address: string;
  to_address: string;
  data: string;
  nonce: number;
  safe_tx_hash: string;
  description: string | null;
  proposer: string;
  threshold: number;
  confirmations: Confirmation[];
  created_at: string;
}

interface PendingTransactionsProps {
  safeAddress: string;
  threshold: number;
  owners: string[];
  onExecuted?: () => void;
}

export function PendingTransactions({
  safeAddress,
  threshold,
  owners,
  onExecuted,
}: PendingTransactionsProps) {
  const { address, authProvider } = useAuth();
  const [proposals, setProposals] = useState<Proposal[]>([]);
  const [loading, setLoading] = useState(true);
  const [confirming, setConfirming] = useState<string | null>(null);
  const [executing, setExecuting] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const loadPending = useCallback(async () => {
    if (!safeAddress) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/relay/pending?safeAddress=${safeAddress}`);
      if (res.ok) {
        const data = await res.json();
        setProposals(data.proposals || []);
      }
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, [safeAddress]);

  useEffect(() => {
    loadPending();
  }, [loadPending]);

  const hasConfirmed = (proposal: Proposal) => {
    if (!address) return false;
    return proposal.confirmations.some(
      (c) => c.owner.toLowerCase() === address.toLowerCase()
    );
  };

  const canExecute = (proposal: Proposal) => {
    return proposal.confirmations.length >= proposal.threshold;
  };

  function describeProposal(proposal: Proposal): string {
    if (proposal.description) return proposal.description;
    // Try to decode from data
    const data = proposal.data;
    if (data.startsWith("0x694e80c3")) return "Change threshold";
    if (data.startsWith("0x0d582f13")) return "Add owner";
    if (data.startsWith("0xf8dc5dd9")) return "Remove owner";
    return `Transaction (nonce ${proposal.nonce})`;
  }

  async function handleConfirm(proposal: Proposal) {
    if (!address) return;
    setConfirming(proposal.safe_tx_hash);
    setError(null);
    setSuccess(null);

    try {
      const { signAndConfirmProposal } = await import("@/lib/safe-operations");
      await signAndConfirmProposal(safeAddress, proposal, address, authProvider);

      setSuccess("Confirmed! Waiting for other owners.");
      setTimeout(() => {
        loadPending();
        setSuccess(null);
      }, 3000);
    } catch (err: any) {
      console.error("Confirm error:", err);
      setError(err?.message || "Failed to confirm");
    } finally {
      setConfirming(null);
    }
  }

  async function handleExecute(proposal: Proposal) {
    if (!address) return;
    setExecuting(proposal.safe_tx_hash);
    setError(null);
    setSuccess(null);

    try {
      const res = await fetch("/api/relay/execute", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ safeTxHash: proposal.safe_tx_hash }),
      });

      const result = await res.json();
      if (!res.ok) {
        throw new Error(result.error || "Execution failed");
      }

      setSuccess(`Executed! Tx: ${result.txHash.slice(0, 12)}...`);
      onExecuted?.();
      setTimeout(() => {
        loadPending();
        setSuccess(null);
      }, 5000);
    } catch (err: any) {
      console.error("Execute error:", err);
      setError(err?.message || "Failed to execute");
    } finally {
      setExecuting(null);
    }
  }

  if (loading) return null;
  if (proposals.length === 0) return null;

  return (
    <Card className="p-6 space-y-4 border-amber-200 bg-amber-50/30">
      <h4 className="text-sm font-semibold flex items-center gap-2">
        <Clock className="w-4 h-4 text-amber-500" />
        Pending Transactions ({proposals.length})
      </h4>
      <p className="text-xs text-muted">
        These transactions require {threshold} confirmation(s) before execution.
      </p>

      <div className="space-y-3">
        {proposals.map((proposal) => (
          <div
            key={proposal.safe_tx_hash}
            className="p-4 rounded-lg border border-amber-200 bg-white"
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium">{describeProposal(proposal)}</span>
              <span className="text-xs text-muted">
                Nonce #{proposal.nonce}
              </span>
            </div>

            <div className="flex items-center gap-2 mb-3">
              <div className="flex gap-0.5">
                {Array.from({ length: proposal.threshold }).map((_, i) => (
                  <div
                    key={i}
                    className={`w-2.5 h-2.5 rounded-full ${
                      i < proposal.confirmations.length ? "bg-green-500" : "bg-stone-300"
                    }`}
                  />
                ))}
              </div>
              <span className="text-xs text-muted">
                {proposal.confirmations.length}/{proposal.threshold} confirmations
              </span>
            </div>

            {proposal.confirmations.length > 0 && (
              <div className="text-xs text-muted mb-3">
                Confirmed by:{" "}
                {proposal.confirmations.map((c) => shortenAddr(c.owner)).join(", ")}
              </div>
            )}

            <div className="text-xs text-muted mb-3">
              Proposed by: {shortenAddr(proposal.proposer)}
              {" · "}
              {new Date(proposal.created_at).toLocaleDateString()}
            </div>

            <div className="flex gap-2">
              {!hasConfirmed(proposal) && !canExecute(proposal) && (
                <Button
                  onClick={() => handleConfirm(proposal)}
                  disabled={confirming === proposal.safe_tx_hash}
                  size="sm"
                  variant="secondary"
                  className="gap-1.5"
                >
                  {confirming === proposal.safe_tx_hash ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <CheckCircle className="w-3.5 h-3.5" />
                  )}
                  Confirm
                </Button>
              )}

              {hasConfirmed(proposal) && !canExecute(proposal) && (
                <span className="text-xs text-green-600 flex items-center gap-1 py-1">
                  <CheckCircle className="w-3 h-3" />
                  You confirmed — waiting for others
                </span>
              )}

              {canExecute(proposal) && (
                <Button
                  onClick={() => handleExecute(proposal)}
                  disabled={executing === proposal.safe_tx_hash}
                  size="sm"
                  className="gap-1.5"
                >
                  {executing === proposal.safe_tx_hash ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Zap className="w-3.5 h-3.5" />
                  )}
                  Execute (gas-free)
                </Button>
              )}
            </div>
          </div>
        ))}
      </div>

      {error && (
        <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 p-2 rounded">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span className="flex-1">{error}</span>
          <button onClick={() => setError(null)}>
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}
      {success && (
        <p className="text-sm text-green-700 bg-green-50 px-3 py-2 rounded">{success}</p>
      )}
    </Card>
  );
}

function shortenAddr(addr: string): string {
  if (addr.length <= 12) return addr;
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
}
