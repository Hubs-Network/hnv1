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
} from "lucide-react";

interface AdminEntry {
  wallet_address: string;
  role: string;
  created_at: string;
}

interface AdminPanelProps {
  hubId: string;
}

export function AdminPanel({ hubId }: AdminPanelProps) {
  const { address } = useAuth();
  const [entries, setEntries] = useState<AdminEntry[]>([]);
  const [callerRole, setCallerRole] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [newAddress, setNewAddress] = useState("");
  const [adding, setAdding] = useState(false);
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

  async function handleAdd() {
    if (!address || !newAddress.trim()) return;

    if (!/^0x[a-fA-F0-9]{40}$/.test(newAddress.trim())) {
      setError("Invalid address. Must be 0x followed by 40 hex characters.");
      return;
    }

    setAdding(true);
    setError(null);
    setSuccess(null);

    try {
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
    } catch {
      setError("Network error");
    } finally {
      setAdding(false);
    }
  }

  async function handleRemove(targetAddress: string) {
    if (!address) return;
    if (!confirm(`Remove ${shortenAddress(targetAddress)} as admin?`)) return;
    setError(null);

    try {
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
    } catch {
      setError("Network error");
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

  return (
    <Card className="p-6 space-y-6">
      <div>
        <h3 className="text-base font-semibold flex items-center gap-2 mb-4">
          <Shield className="w-4 h-4 text-primary" />
          Admins & Collaborators
        </h3>
        <p className="text-xs text-muted mb-4">
          Admins can edit this hub&apos;s profile. Only the owner can add or remove admins.
        </p>

        {/* Wallet admins list */}
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
              {isOwner && entry.role !== "owner" && (
                <button
                  onClick={() => handleRemove(entry.wallet_address)}
                  className="text-red-500 hover:text-red-700 transition-colors p-1"
                  title="Remove admin"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              )}
            </div>
          ))}
          {entries.length === 0 && (
            <p className="text-sm text-muted">No admins found.</p>
          )}
        </div>

        {/* Add admin (owner only) */}
        {isOwner && (
          <div className="flex gap-2">
            <Input
              value={newAddress}
              onChange={(e) => setNewAddress(e.target.value)}
              placeholder="0x... wallet address"
              className="flex-1 font-mono text-sm"
            />
            <Button
              onClick={handleAdd}
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
