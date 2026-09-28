"use client";

import { useState } from "react";
import { isAddress, getAddress } from "viem";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Loader2, Plus, X, ShieldCheck } from "lucide-react";

/**
 * Owner-only manager for a Patron's off-chain admin list. Admins can manage the
 * Patron's residency actions (feature coming next). The on-chain owner is always
 * an implicit manager and is the only one who can edit this list.
 */
export function PatronAdminsManager({
  applicationId,
  ownerAddress,
  initialAdmins,
}: {
  applicationId: string;
  ownerAddress: string;
  initialAdmins: string[];
}) {
  const [admins, setAdmins] = useState<string[]>(
    initialAdmins.map((a) => getAddress(a))
  );
  const [value, setValue] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function mutate(admin: string, action: "add" | "remove") {
    setBusy(action === "add" ? "add" : admin);
    setError(null);
    try {
      const res = await fetch(`/api/patrons/applications/${applicationId}/admins`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ _wallet_address: ownerAddress, admin, action }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data?.error || "Action failed");
        return;
      }
      setAdmins((data.admins as string[]).map((a) => getAddress(a)));
      if (action === "add") setValue("");
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setBusy(null);
    }
  }

  function handleAdd() {
    const v = value.trim();
    if (!isAddress(v)) {
      setError("Enter a valid 0x address.");
      return;
    }
    if (getAddress(v) === getAddress(ownerAddress)) {
      setError("You are the owner — already a manager.");
      return;
    }
    if (admins.some((a) => getAddress(a) === getAddress(v))) {
      setError("This address is already an admin.");
      return;
    }
    mutate(v, "add");
  }

  return (
    <div className="mt-4 pt-4 border-t border-border">
      <div className="flex items-center gap-2 mb-2">
        <ShieldCheck className="w-4 h-4 text-primary" />
        <h4 className="text-sm font-semibold text-foreground">Patron admins</h4>
      </div>
      <p className="text-xs text-muted mb-3">
        Delegate management of this Patron&apos;s residency actions. You (the owner)
        are always a manager.
      </p>

      {admins.length > 0 ? (
        <div className="space-y-1.5 mb-3">
          {admins.map((a) => (
            <div
              key={a}
              className="flex items-center justify-between gap-2 px-3 py-2 rounded-lg border border-border"
            >
              <span className="text-xs font-mono text-foreground truncate">{a}</span>
              <button
                type="button"
                onClick={() => mutate(a, "remove")}
                disabled={busy !== null}
                className="p-1 text-muted hover:text-red-600 disabled:opacity-50"
                aria-label="Remove admin"
              >
                {busy === a ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <X className="w-4 h-4" />
                )}
              </button>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-xs text-muted mb-3">No admins yet.</p>
      )}

      <div className="flex gap-2 items-start">
        <div className="flex-1">
          <Input
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder="0x… admin address"
            disabled={busy !== null}
          />
        </div>
        <Button onClick={handleAdd} disabled={busy !== null || !value.trim()} className="gap-1.5">
          {busy === "add" ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Plus className="w-4 h-4" />
          )}
          Add
        </Button>
      </div>

      {error && <p className="text-xs text-red-600 mt-2">{error}</p>}
    </div>
  );
}
