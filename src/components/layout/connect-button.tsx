"use client";

import { useUP } from "@/context/up-context";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Loader2, LogOut, UserCircle } from "lucide-react";
import { useState, useRef, useEffect } from "react";

function shortenAddress(address: string): string {
  return `${address.slice(0, 6)}…${address.slice(-4)}`;
}

export function ConnectButton() {
  const { address, isConnected, isConnecting, connect, disconnect, error } =
    useUP();
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

  if (isConnected && address) {
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
          <span className="w-2 h-2 rounded-full bg-primary-lighter animate-pulse" />
          {shortenAddress(address)}
        </button>

        {menuOpen && (
          <div className="absolute right-0 mt-2 w-56 rounded-lg border border-border bg-surface shadow-lg z-50">
            <div className="p-3 border-b border-border-light">
              <p className="text-xs text-muted">Connected as</p>
              <p className="text-xs font-mono text-foreground mt-0.5 break-all">
                {address}
              </p>
            </div>
            <div className="p-1">
              <a
                href="/my-hubs"
                className="flex items-center gap-2 px-3 py-2 text-sm text-foreground hover:bg-stone-50 rounded-md transition-colors"
              >
                <UserCircle className="w-4 h-4" />
                My Hubs
              </a>
              <button
                onClick={() => {
                  disconnect();
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

  return (
    <div>
      <Button
        variant="primary"
        size="sm"
        onClick={connect}
        disabled={isConnecting}
        title={error || undefined}
      >
        {isConnecting ? (
          <Loader2 className="w-4 h-4 animate-spin" />
        ) : (
          "Connect UP"
        )}
      </Button>
    </div>
  );
}
