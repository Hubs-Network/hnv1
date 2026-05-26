"use client";

import { useAuth } from "@/context/auth-context";
import { LogOut, Wallet, Sparkles, Building2 } from "lucide-react";
import { useState, useRef, useEffect } from "react";
import { cn } from "@/lib/utils";
import Link from "next/link";

function shortenAddress(address: string): string {
  return `${address.slice(0, 6)}…${address.slice(-4)}`;
}

export function UserWalletBadge() {
  const { address, ensName, authProvider, logout } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  if (!address) return null;

  const displayName = ensName || shortenAddress(address);
  const providerLabel =
    authProvider === "magic" ? "Magic wallet" : "External wallet";

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setMenuOpen(!menuOpen)}
        className={cn(
          "flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium",
          "bg-primary-bg text-primary border border-primary/20",
          "hover:border-primary/40 transition-colors"
        )}
      >
        {authProvider === "magic" ? (
          <Sparkles className="w-3.5 h-3.5" />
        ) : (
          <Wallet className="w-3.5 h-3.5" />
        )}
        {displayName}
      </button>

      {menuOpen && (
        <div className="absolute right-0 mt-2 w-64 rounded-lg border border-border bg-surface shadow-lg z-50">
          <div className="p-3 border-b border-border-light">
            <p className="text-xs text-muted">Connected as</p>
            <p className="text-xs font-mono text-foreground mt-0.5 break-all">
              {ensName && (
                <span className="block text-sm font-sans font-medium mb-0.5">
                  {ensName}
                </span>
              )}
              {address}
            </p>
            <p className="text-[10px] text-muted-light mt-1.5 uppercase tracking-wide">
              {providerLabel}
            </p>
          </div>
          <div className="p-1 space-y-0.5">
            <Link
              href="/my-hubs"
              onClick={() => setMenuOpen(false)}
              className="flex items-center gap-2 px-3 py-2 text-sm text-foreground hover:bg-stone-50 rounded-md transition-colors w-full"
            >
              <Building2 className="w-4 h-4" />
              My Hubs
            </Link>
            <button
              onClick={() => {
                logout();
                setMenuOpen(false);
              }}
              className="flex items-center gap-2 px-3 py-2 text-sm text-danger hover:bg-danger-bg rounded-md transition-colors w-full text-left"
            >
              <LogOut className="w-4 h-4" />
              Disconnect
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
