"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Shield, Trash2, List, UserPlus, Lock } from "lucide-react";

interface AdminEntry {
  wallet_address: string;
  role: string;
  created_at: string;
}

export default function AdminDevPage() {
  const [secret, setSecret] = useState("");
  const [unlocked, setUnlocked] = useState(false);

  const [profileId, setProfileId] = useState("");
  const [profileType, setProfileType] = useState<"hub" | "pilgrim">("hub");
  const [walletAddress, setWalletAddress] = useState("");
  const [role, setRole] = useState("owner");

  const [admins, setAdmins] = useState<AdminEntry[]>([]);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [loading, setLoading] = useState(false);

  function authHeaders() {
    return {
      "Content-Type": "application/json",
      Authorization: `Bearer ${secret}`,
    };
  }

  async function handleAdd() {
    setMessage(null);
    setLoading(true);
    try {
      const res = await fetch("/api/admins/add", {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify({
          profile_id: profileId,
          profile_type: profileType,
          wallet_address: walletAddress,
          role,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setMessage({ type: "error", text: data.error || "Failed" });
      } else {
        setMessage({ type: "success", text: "Admin added successfully" });
      }
    } catch {
      setMessage({ type: "error", text: "Network error" });
    } finally {
      setLoading(false);
    }
  }

  async function handleRemove(addr: string) {
    setMessage(null);
    setLoading(true);
    try {
      const res = await fetch("/api/admins/remove", {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify({
          profile_id: profileId,
          profile_type: profileType,
          wallet_address: addr,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setMessage({ type: "error", text: data.error || "Failed" });
      } else {
        setMessage({ type: "success", text: "Admin removed" });
        setAdmins((prev) => prev.filter((a) => a.wallet_address !== addr.toLowerCase()));
      }
    } catch {
      setMessage({ type: "error", text: "Network error" });
    } finally {
      setLoading(false);
    }
  }

  async function handleList() {
    setMessage(null);
    setLoading(true);
    try {
      const res = await fetch(
        `/api/admins/list?profile_id=${encodeURIComponent(profileId)}&profile_type=${profileType}`,
        { headers: { Authorization: `Bearer ${secret}` } }
      );
      const data = await res.json();
      if (!res.ok) {
        setMessage({ type: "error", text: data.error || "Failed" });
      } else {
        setAdmins(data.admins || []);
      }
    } catch {
      setMessage({ type: "error", text: "Network error" });
    } finally {
      setLoading(false);
    }
  }

  if (!unlocked) {
    return (
      <div className="max-w-md mx-auto py-20 px-4">
        <Card className="p-8 text-center">
          <Lock className="w-10 h-10 text-muted mx-auto mb-4" />
          <h1 className="text-lg font-semibold mb-2">Admin Dev Tool</h1>
          <p className="text-sm text-muted mb-6">
            Enter the admin management secret to continue.
          </p>
          <Input
            type="password"
            value={secret}
            onChange={(e) => setSecret(e.target.value)}
            placeholder="ADMIN_MANAGEMENT_SECRET"
            className="mb-4"
          />
          <Button
            onClick={() => setUnlocked(true)}
            disabled={!secret.trim()}
            className="w-full"
          >
            Unlock
          </Button>
        </Card>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto py-12 px-4">
      <h1 className="text-2xl font-bold mb-2 flex items-center gap-2">
        <Shield className="w-6 h-6 text-primary" />
        Admin Dev Tool
      </h1>
      <p className="text-sm text-muted mb-8">
        Manage wallet admins for profiles. This tool uses the ADMIN_MANAGEMENT_SECRET for auth.
      </p>

      {/* Profile selector */}
      <Card className="p-6 mb-6 space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-xs font-medium text-muted block mb-1">Profile ID</label>
            <Input
              value={profileId}
              onChange={(e) => setProfileId(e.target.value)}
              placeholder="stone-oven-house-rora"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-muted block mb-1">Profile Type</label>
            <select
              value={profileType}
              onChange={(e) => setProfileType(e.target.value as "hub" | "pilgrim")}
              className="w-full h-10 rounded-lg border border-border bg-white px-3 text-sm"
            >
              <option value="hub">hub</option>
              <option value="pilgrim">pilgrim</option>
            </select>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-xs font-medium text-muted block mb-1">Wallet Address</label>
            <Input
              value={walletAddress}
              onChange={(e) => setWalletAddress(e.target.value)}
              placeholder="0x..."
              className="font-mono text-sm"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-muted block mb-1">Role</label>
            <select
              value={role}
              onChange={(e) => setRole(e.target.value)}
              className="w-full h-10 rounded-lg border border-border bg-white px-3 text-sm"
            >
              <option value="owner">owner</option>
              <option value="admin">admin</option>
              <option value="editor">editor</option>
            </select>
          </div>
        </div>

        <div className="flex gap-3 pt-2">
          <Button onClick={handleAdd} disabled={loading || !profileId || !walletAddress} className="gap-1.5">
            <UserPlus className="w-4 h-4" />
            Add Admin
          </Button>
          <Button onClick={handleList} disabled={loading || !profileId} variant="secondary" className="gap-1.5">
            <List className="w-4 h-4" />
            List Admins
          </Button>
        </div>
      </Card>

      {/* Feedback */}
      {message && (
        <div
          className={`mb-6 p-3 rounded-lg text-sm ${
            message.type === "success"
              ? "bg-green-50 text-green-700 border border-green-200"
              : "bg-red-50 text-red-700 border border-red-200"
          }`}
        >
          {message.text}
        </div>
      )}

      {/* Admin list */}
      {admins.length > 0 && (
        <Card className="p-6">
          <h2 className="text-sm font-semibold mb-3">
            Admins for <code className="text-primary">{profileId}</code>
          </h2>
          <div className="space-y-2">
            {admins.map((entry) => (
              <div
                key={entry.wallet_address}
                className="flex items-center justify-between p-3 rounded-lg bg-stone-50 border border-stone-200/60"
              >
                <div className="flex items-center gap-2">
                  <span className="text-sm font-mono">{entry.wallet_address}</span>
                  <span className="text-xs px-1.5 py-0.5 rounded bg-stone-200 text-muted">
                    {entry.role}
                  </span>
                </div>
                <button
                  onClick={() => handleRemove(entry.wallet_address)}
                  className="text-red-500 hover:text-red-700 transition-colors p-1"
                  title="Remove"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}
