"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { isAddress } from "viem";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  FIAT_CURRENCIES,
  CRYPTO_CURRENCIES,
  VOUCH_CHAINS,
  formatVouchCurrency,
  type VouchCurrency,
} from "@/config/vouch-currencies";
import { HandHeart, Loader2, ExternalLink, X } from "lucide-react";

export interface ManageablePatron {
  applicationId: string;
  tokenId: string;
  companyName: string;
  isOwner: boolean;
}

interface VouchItem {
  patronApplicationId: string;
  patronTokenId: string;
  patronName: string;
  amount: string;
  currency: VouchCurrency;
  purpose: string;
  link: string | null;
  createdAt: string;
}

type CurrencyKind = "fiat" | "crypto" | "token";

export function ResidencyVouches({
  residencyId,
  canVouch,
  manageablePatrons,
  walletAddress,
}: {
  residencyId: string;
  canVouch: boolean;
  manageablePatrons: ManageablePatron[];
  walletAddress: string | null;
}) {
  const [vouches, setVouches] = useState<VouchItem[]>([]);
  const [loading, setLoading] = useState(true);

  // form state
  const [patronId, setPatronId] = useState<string>(
    manageablePatrons[0]?.applicationId ?? ""
  );
  const [kind, setKind] = useState<CurrencyKind>("fiat");
  const [fiatCode, setFiatCode] = useState<string>(FIAT_CURRENCIES[0]);
  const [cryptoSymbol, setCryptoSymbol] = useState<string>(CRYPTO_CURRENCIES[0]);
  const [tokenAddress, setTokenAddress] = useState("");
  const [tokenChainId, setTokenChainId] = useState<number>(VOUCH_CHAINS[0].id);
  const [tokenSymbol, setTokenSymbol] = useState("");
  const [amount, setAmount] = useState("");
  const [purpose, setPurpose] = useState("");
  const [link, setLink] = useState("");

  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/residencies/${residencyId}/vouches`);
      const data = await res.json();
      if (res.ok) setVouches(data.vouches ?? []);
    } finally {
      setLoading(false);
    }
  }, [residencyId]);

  useEffect(() => {
    load();
  }, [load]);

  const canManage = manageablePatrons.length > 0 && canVouch && !!walletAddress;

  // Existing vouch for the currently selected patron (to prefill / withdraw).
  const existing = useMemo(
    () => vouches.find((v) => v.patronApplicationId.toLowerCase() === patronId.toLowerCase()),
    [vouches, patronId]
  );

  function buildCurrency(): VouchCurrency | null {
    if (kind === "fiat") {
      return { kind: "fiat", code: fiatCode } as VouchCurrency;
    }
    if (kind === "crypto") {
      return { kind: "crypto", symbol: cryptoSymbol } as VouchCurrency;
    }
    if (!isAddress(tokenAddress)) return null;
    return {
      kind: "token",
      address: tokenAddress,
      chainId: tokenChainId,
      symbol: tokenSymbol.trim() || undefined,
    };
  }

  const amountOk = /^\d+(\.\d+)?$/.test(amount.trim()) && Number(amount) > 0;
  const purposeOk = purpose.trim().length >= 1 && purpose.trim().length <= 250;
  const tokenOk = kind !== "token" || isAddress(tokenAddress);
  const canSubmit = canManage && !!patronId && amountOk && purposeOk && tokenOk && !busy;

  async function submit() {
    if (!walletAddress || !canSubmit) return;
    const currency = buildCurrency();
    if (!currency) {
      setError("Enter a valid token address.");
      return;
    }
    setBusy("submit");
    setError(null);
    setNotice(null);
    try {
      const res = await fetch(`/api/residencies/${residencyId}/vouches`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          _wallet_address: walletAddress,
          patronApplicationId: patronId,
          amount: amount.trim(),
          currency,
          purpose: purpose.trim(),
          link: link.trim() || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data?.error || "Failed to vouch");
        return;
      }
      setNotice(existing ? "Vouch updated." : "Vouch published.");
      await load();
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setBusy(null);
    }
  }

  async function withdraw() {
    if (!walletAddress || !patronId) return;
    setBusy("withdraw");
    setError(null);
    setNotice(null);
    try {
      const res = await fetch(`/api/residencies/${residencyId}/vouches`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          _wallet_address: walletAddress,
          action: "withdraw",
          patronApplicationId: patronId,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data?.error || "Failed to withdraw");
        return;
      }
      setNotice("Vouch withdrawn.");
      setAmount("");
      setPurpose("");
      setLink("");
      await load();
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <Card className="p-5">
      <h3 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
        <HandHeart className="w-4 h-4 text-primary" />
        Patron support ({vouches.length})
      </h3>

      {/* List */}
      {loading ? (
        <div className="flex justify-center py-4">
          <Loader2 className="w-5 h-5 animate-spin text-muted" />
        </div>
      ) : vouches.length === 0 ? (
        <p className="text-sm text-muted">No Patron vouches yet.</p>
      ) : (
        <div className="space-y-2">
          {vouches.map((v) => (
            <div
              key={v.patronApplicationId}
              className="p-3 rounded-lg border border-border"
            >
              <div className="flex items-center justify-between gap-3">
                <Link
                  href={`/patrons/${v.patronTokenId}`}
                  className="text-sm font-medium text-primary hover:underline truncate"
                >
                  {v.patronName}
                </Link>
                <span className="text-sm font-semibold text-foreground whitespace-nowrap">
                  {v.amount} {formatVouchCurrency(v.currency)}
                </span>
              </div>
              <p className="text-xs text-muted mt-1 whitespace-pre-wrap">{v.purpose}</p>
              {v.link && (
                <a
                  href={v.link}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-xs text-primary hover:underline mt-1"
                >
                  Reference
                  <ExternalLink className="w-3 h-3" />
                </a>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Vouch form (Patron managers, residency open) */}
      {canManage && (
        <div className="mt-5 pt-4 border-t border-border space-y-3">
          <h4 className="text-sm font-semibold text-foreground">
            {existing ? "Update your vouch" : "Vouch this residency"}
          </h4>

          {/* Patron selector */}
          <div>
            <label className="block text-sm font-medium text-foreground mb-1.5">
              Vouch as
            </label>
            <select
              value={patronId}
              onChange={(e) => setPatronId(e.target.value)}
              disabled={busy !== null}
              className="w-full rounded-lg border border-border bg-surface px-3 py-2.5 text-sm text-foreground"
            >
              {manageablePatrons.map((p) => (
                <option key={p.applicationId} value={p.applicationId}>
                  {p.companyName}
                  {p.isOwner ? "" : " (admin)"}
                </option>
              ))}
            </select>
          </div>

          {/* Amount + currency */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Input
              label="Amount"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="1000"
              disabled={busy !== null}
              error={amount && !amountOk ? "Enter a valid amount" : undefined}
            />
            <div>
              <label className="block text-sm font-medium text-foreground mb-1.5">
                Currency type
              </label>
              <select
                value={kind}
                onChange={(e) => setKind(e.target.value as CurrencyKind)}
                disabled={busy !== null}
                className="w-full rounded-lg border border-border bg-surface px-3 py-2.5 text-sm text-foreground"
              >
                <option value="fiat">Fiat</option>
                <option value="crypto">Crypto</option>
                <option value="token">Custom token</option>
              </select>
            </div>
          </div>

          {kind === "fiat" && (
            <select
              value={fiatCode}
              onChange={(e) => setFiatCode(e.target.value)}
              disabled={busy !== null}
              className="w-full rounded-lg border border-border bg-surface px-3 py-2.5 text-sm text-foreground"
            >
              {FIAT_CURRENCIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          )}

          {kind === "crypto" && (
            <select
              value={cryptoSymbol}
              onChange={(e) => setCryptoSymbol(e.target.value)}
              disabled={busy !== null}
              className="w-full rounded-lg border border-border bg-surface px-3 py-2.5 text-sm text-foreground"
            >
              {CRYPTO_CURRENCIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          )}

          {kind === "token" && (
            <div className="space-y-3">
              <Input
                label="Token contract address"
                value={tokenAddress}
                onChange={(e) => setTokenAddress(e.target.value)}
                placeholder="0x…"
                disabled={busy !== null}
                error={tokenAddress && !isAddress(tokenAddress) ? "Invalid address" : undefined}
              />
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1.5">
                    Chain
                  </label>
                  <select
                    value={tokenChainId}
                    onChange={(e) => setTokenChainId(Number(e.target.value))}
                    disabled={busy !== null}
                    className="w-full rounded-lg border border-border bg-surface px-3 py-2.5 text-sm text-foreground"
                  >
                    {VOUCH_CHAINS.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>
                <Input
                  label="Symbol (optional)"
                  value={tokenSymbol}
                  onChange={(e) => setTokenSymbol(e.target.value)}
                  placeholder="e.g. USDT"
                  disabled={busy !== null}
                />
              </div>
            </div>
          )}

          {/* Purpose + link */}
          <div>
            <Textarea
              label="Purpose"
              value={purpose}
              onChange={(e) => setPurpose(e.target.value.slice(0, 250))}
              placeholder="What this support is for."
              rows={3}
              disabled={busy !== null}
            />
            <p className="text-[11px] text-muted mt-1 text-right">
              {purpose.trim().length}/250
            </p>
          </div>
          <Input
            label="Reference link (optional)"
            value={link}
            onChange={(e) => setLink(e.target.value)}
            placeholder="https://…"
            disabled={busy !== null}
          />

          {error && <p className="text-xs text-red-600">{error}</p>}
          {notice && <p className="text-xs text-green-700">{notice}</p>}

          <div className="flex items-center gap-2">
            <Button onClick={submit} disabled={!canSubmit} className="gap-2">
              {busy === "submit" && <Loader2 className="w-4 h-4 animate-spin" />}
              {existing ? "Update vouch" : "Publish vouch"}
            </Button>
            {existing && (
              <Button
                variant="ghost"
                onClick={withdraw}
                disabled={busy !== null}
                className="gap-2 text-red-600"
              >
                {busy === "withdraw" ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <X className="w-4 h-4" />
                )}
                Withdraw
              </Button>
            )}
          </div>
        </div>
      )}
    </Card>
  );
}
