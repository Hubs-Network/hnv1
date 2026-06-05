"use client";

import { useEffect, useState, useCallback } from "react";
import { useAuth } from "@/context/auth-context";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Loader2,
  UserPlus,
  Trash2,
  Shield,
  Crown,
  Bot,
  Hash,
  ExternalLink,
  AlertTriangle,
} from "lucide-react";
import {
  addOwnerSponsored,
  removeOwnerSponsored,
  changeThresholdSponsored,
  proposeSafeOperation,
  buildAddOwnerData,
  buildRemoveOwnerData,
  buildChangeThresholdData,
} from "@/lib/safe-operations";

interface SafeOwnerEntry {
  wallet_address: string;
  role: string;
}

interface SafeInfoData {
  address: string;
  owners: string[];
  threshold: number;
  nonce: number;
  version?: string;
}

interface AdminPanelProps {
  hubId: string;
  safeAddress?: string;
}

export function AdminPanel({ hubId, safeAddress }: AdminPanelProps) {
  const { address, authProvider } = useAuth();
  const [entries, setEntries] = useState<SafeOwnerEntry[]>([]);
  const [safeInfo, setSafeInfo] = useState<SafeInfoData | null>(null);
  const [safeBased, setSafeBased] = useState(false);
  const [callerRole, setCallerRole] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [newAddress, setNewAddress] = useState("");
  const [newThreshold, setNewThreshold] = useState<number | null>(null);
  const [adding, setAdding] = useState(false);
  const [removing, setRemoving] = useState<string | null>(null);
  const [changingThreshold, setChangingThreshold] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const loadAdmins = useCallback(async () => {
    if (!address) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/hubs/${hubId}/admins`, {
        headers: { "x-wallet-address": address },
      });
      if (res.ok) {
        const data = await res.json();
        setEntries(data.admins || []);
        setCallerRole(data.caller_role);
        setSafeBased(data.safe_based || false);
        if (data.safe_info) {
          setSafeInfo(data.safe_info);
          setNewThreshold(data.safe_info.threshold);
        }
      }
    } catch {
      setError("Failed to load admins");
    } finally {
      setLoading(false);
    }
  }, [hubId, address]);

  useEffect(() => {
    loadAdmins();
  }, [loadAdmins]);

  // Derive owners list and threshold from entries if safeInfo not available yet
  const currentOwners = safeInfo?.owners || entries.map((e) => e.wallet_address);
  const currentThreshold = safeInfo?.threshold || 1;
  const effectiveSafeAddress = safeInfo?.address || safeAddress || hubId;

  async function handleAddOwner() {
    if (!address || !newAddress.trim()) return;

    if (!/^0x[a-fA-F0-9]{40}$/.test(newAddress.trim())) {
      setError("Invalid address. Must be 0x followed by 40 hex characters.");
      return;
    }

    setAdding(true);
    setError(null);
    setSuccess(null);

    try {
      if (safeBased || /^0x[a-fA-F0-9]{40}$/.test(hubId)) {
        if (currentThreshold === 1) {
          const txHash = await addOwnerSponsored(
            effectiveSafeAddress,
            address,
            newAddress.trim(),
            currentThreshold,
            authProvider
          );
          setSuccess(`Owner added! Tx: ${txHash.slice(0, 12)}...`);
        } else {
          const innerData = buildAddOwnerData(newAddress.trim(), currentThreshold);
          await proposeSafeOperation(effectiveSafeAddress, innerData, address, `Add owner ${newAddress.trim().slice(0, 8)}...`, authProvider);
          setSuccess("Transaction proposed! Other owners must confirm before execution.");
        }

        setNewAddress("");
        setTimeout(() => {
          loadAdmins();
          setSuccess(null);
        }, 8000);
      } else {
        // Legacy Neon flow
        const res = await fetch(`/api/hubs/${hubId}/admins`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            _wallet_address: address,
            wallet_address: newAddress.trim(),
            role: "admin",
          }),
        });
        const data = await res.json();
        if (!res.ok) {
          setError(data.error || "Failed to add admin");
          return;
        }
        setSuccess("Admin added");
        setNewAddress("");
        loadAdmins();
        setTimeout(() => setSuccess(null), 3000);
      }
    } catch (err: any) {
      console.error("Add owner error:", err);
      const msg = err?.message || err?.toString() || "Unknown error";
      setError(`Failed to add owner: ${msg}`);
    } finally {
      setAdding(false);
    }
  }

  async function handleRemoveOwner(targetAddress: string) {
    if (!address) return;
    if (!confirm(`Remove ${shortenAddress(targetAddress)} as owner?`)) return;
    setError(null);
    setRemoving(targetAddress);

    try {
      if (safeBased || /^0x[a-fA-F0-9]{40}$/.test(hubId)) {
        if (currentThreshold === 1) {
          const newThr = Math.min(currentThreshold, currentOwners.length - 1);
          const txHash = await removeOwnerSponsored(
            effectiveSafeAddress,
            address,
            currentOwners,
            targetAddress,
            Math.max(1, newThr),
            authProvider
          );
          setSuccess(`Owner removed! Tx: ${txHash.slice(0, 12)}...`);
        } else {
          const newThr = Math.min(currentThreshold, currentOwners.length - 1);
          const innerData = buildRemoveOwnerData(currentOwners, targetAddress, Math.max(1, newThr));
          await proposeSafeOperation(effectiveSafeAddress, innerData, address, `Remove owner ${targetAddress.slice(0, 8)}...`, authProvider);
          setSuccess("Removal proposed! Other owners must confirm before execution.");
        }
        setTimeout(() => {
          loadAdmins();
          setSuccess(null);
        }, 8000);
      } else {
        // Legacy Neon flow
        const res = await fetch(`/api/hubs/${hubId}/admins`, {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            _wallet_address: address,
            wallet_address: targetAddress,
          }),
        });
        const data = await res.json();
        if (!res.ok) {
          setError(data.error || "Failed to remove admin");
          return;
        }
        loadAdmins();
      }
    } catch (err: any) {
      console.error("Remove owner error:", err);
      const msg = err?.message || err?.toString() || "Unknown error";
      setError(`Failed to remove owner: ${msg}`);
    } finally {
      setRemoving(null);
    }
  }

  async function handleChangeThreshold() {
    if (newThreshold === null || newThreshold === currentThreshold) return;
    if (newThreshold < 1 || newThreshold > currentOwners.length) {
      setError(`Threshold must be between 1 and ${currentOwners.length}`);
      return;
    }

    setChangingThreshold(true);
    setError(null);
    setSuccess(null);

    try {
      if (currentThreshold === 1) {
        const txHash = await changeThresholdSponsored(
          effectiveSafeAddress,
          address!,
          newThreshold,
          authProvider
        );
        setSuccess(`Threshold updated! Tx: ${txHash.slice(0, 12)}...`);
      } else {
        const innerData = buildChangeThresholdData(newThreshold);
        await proposeSafeOperation(effectiveSafeAddress, innerData, address!, `Change threshold to ${newThreshold}`, authProvider);
        setSuccess("Threshold change proposed! Other owners must confirm before execution.");
      }
      setTimeout(() => {
        loadAdmins();
        setSuccess(null);
      }, 8000);
    } catch (err: any) {
      console.error("Change threshold error:", err);
      const msg = err?.message || err?.toString() || "Unknown error";
      setError(`Failed to change threshold: ${msg}`);
    } finally {
      setChangingThreshold(false);
    }
  }

  if (loading) {
    return (
      <Card className="p-6">
        <div className="flex items-center gap-2">
          <Loader2 className="w-4 h-4 animate-spin" />
          <span className="text-sm text-muted">Loading access settings...</span>
        </div>
      </Card>
    );
  }

  const isOwner = callerRole === "owner";
  const isSafe = safeBased || /^0x[a-fA-F0-9]{40}$/.test(hubId);

  return (
    <Card className="p-6 space-y-6">
      <div>
        <h3 className="text-base font-semibold flex items-center gap-2 mb-2">
          <Shield className="w-4 h-4 text-primary" />
          {isSafe ? "Safe Multisig Owners" : "Admins & Collaborators"}
        </h3>

        {/* Safe info badge */}
        {isSafe && (
          <div className="mb-4 p-3 rounded-lg bg-blue-50 border border-blue-200/60">
            <div className="flex items-center gap-2 mb-1">
              <Shield className="w-3.5 h-3.5 text-blue-600" />
              <span className="text-xs font-medium text-blue-800">On-chain Safe (Sepolia)</span>
            </div>
            <p className="text-xs font-mono text-blue-700 break-all">
              {effectiveSafeAddress}
            </p>
            <div className="flex items-center gap-3 mt-2 text-xs text-blue-600">
              <span className="flex items-center gap-1">
                <Hash className="w-3 h-3" />
                Threshold: {currentThreshold}/{currentOwners.length}
              </span>
              <a
                href={`https://app.safe.global/sep:${effectiveSafeAddress}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1 hover:underline"
              >
                <ExternalLink className="w-3 h-3" />
                View on Safe
              </a>
            </div>
            <p className="text-[10px] text-blue-500 mt-1 flex items-center gap-1">
              <span className="inline-block w-2 h-2 rounded-full bg-green-400" />
              All transactions are gas-sponsored
            </p>
          </div>
        )}

        {!isSafe && (
          <div className="mb-4 p-3 rounded-lg bg-amber-50 border border-amber-200/60">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
              <span className="text-xs text-amber-800">
                Legacy hub — no on-chain Safe attached.
              </span>
            </div>
          </div>
        )}

        <p className="text-xs text-muted mb-4">
          {isSafe
            ? "Owners of this Safe can edit the hub profile. Owners can add/remove other owners and change the threshold."
            : "Admins can edit this hub's profile. Only the owner can add or remove admins."}
        </p>

        {/* Owners list */}
        <div className="space-y-2 mb-4">
          {entries.map((entry) => (
            <div
              key={entry.wallet_address}
              className="flex items-center justify-between p-3 rounded-lg bg-stone-50 border border-stone-200/60"
            >
              <div className="flex items-center gap-2.5">
                {entry.role === "owner" ? (
                  <Crown className="w-4 h-4 text-amber-500" />
                ) : (
                  <Shield className="w-4 h-4 text-primary" />
                )}
                <span className="text-sm font-mono">
                  {shortenAddress(entry.wallet_address)}
                </span>
                <span className="text-xs px-1.5 py-0.5 rounded bg-stone-200 text-muted">
                  {entry.role}
                </span>
              </div>
              {isOwner &&
                entry.wallet_address.toLowerCase() !== address?.toLowerCase() &&
                currentOwners.length > 1 && (
                  <button
                    onClick={() => handleRemoveOwner(entry.wallet_address)}
                    disabled={removing === entry.wallet_address}
                    className="text-red-500 hover:text-red-700 transition-colors p-1 disabled:opacity-50"
                    title="Remove owner"
                  >
                    {removing === entry.wallet_address ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Trash2 className="w-4 h-4" />
                    )}
                  </button>
                )}
            </div>
          ))}
          {entries.length === 0 && (
            <p className="text-sm text-muted">No owners found.</p>
          )}
        </div>

        {/* Add owner (owner only) */}
        {isOwner && (
          <div className="flex gap-2">
            <Input
              value={newAddress}
              onChange={(e) => setNewAddress(e.target.value)}
              placeholder="0x... wallet address"
              className="flex-1 font-mono text-sm"
            />
            <Button
              onClick={handleAddOwner}
              disabled={adding || !newAddress.trim()}
              size="sm"
              className="gap-1.5"
            >
              {adding ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <UserPlus className="w-3.5 h-3.5" />
              )}
              Add
            </Button>
          </div>
        )}
      </div>

      {/* Threshold management (Safe-based only, owner only) */}
      {isSafe && isOwner && currentOwners.length > 1 && (
        <div className="pt-4 border-t border-border">
          <h4 className="text-sm font-semibold flex items-center gap-2 mb-3">
            <Hash className="w-3.5 h-3.5 text-primary" />
            Confirmation Threshold
          </h4>
          <p className="text-xs text-muted mb-3">
            Number of owner confirmations required to execute a transaction.
            Currently {currentThreshold} of {currentOwners.length}.
          </p>
          <div className="flex items-center gap-2">
            <Input
              type="number"
              min={1}
              max={currentOwners.length}
              value={newThreshold ?? currentThreshold}
              onChange={(e) => setNewThreshold(parseInt(e.target.value) || 1)}
              className="w-20 text-center"
            />
            <span className="text-xs text-muted">of {currentOwners.length} owners</span>
            <Button
              onClick={handleChangeThreshold}
              disabled={
                changingThreshold ||
                newThreshold === currentThreshold ||
                newThreshold === null
              }
              size="sm"
              variant="secondary"
            >
              {changingThreshold ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                "Update"
              )}
            </Button>
          </div>
        </div>
      )}

      {/* Holons integration placeholder */}
      <div className="pt-4 border-t border-border">
        <h4 className="text-sm font-semibold flex items-center gap-2 mb-2 text-muted">
          <Bot className="w-4 h-4" />
          Integrations
        </h4>
        <p className="text-xs text-muted">
          Holons bot integration coming soon.{" "}
          <a
            href="https://docs.holons.io/"
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary hover:underline"
          >
            Learn more →
          </a>
        </p>
      </div>

      {/* Feedback */}
      {error && (
        <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded">{error}</p>
      )}
      {success && (
        <p className="text-sm text-green-700 bg-green-50 px-3 py-2 rounded">{success}</p>
      )}
    </Card>
  );
}

function shortenAddress(addr: string): string {
  if (addr.length <= 12) return addr;
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
}
