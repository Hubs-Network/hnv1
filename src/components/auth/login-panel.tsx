"use client";

import { useState } from "react";
import { useAuth } from "@/context/auth-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2, Mail, Wallet } from "lucide-react";

export function LoginPanel() {
  const { loginWithEmail, connectInjected, isLoading, error } = useAuth();
  const [email, setEmail] = useState("");
  const [mode, setMode] = useState<"idle" | "email" | "wallet">("idle");

  async function handleEmailLogin(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim()) return;
    setMode("email");
    await loginWithEmail(email.trim());
    setMode("idle");
  }

  async function handleWalletConnect() {
    setMode("wallet");
    await connectInjected();
    setMode("idle");
  }

  return (
    <div className="w-72 p-4 rounded-xl border border-border bg-surface shadow-lg space-y-4">
      <h3 className="text-sm font-semibold text-foreground text-center">
        Access Hubs Network
      </h3>

      <form onSubmit={handleEmailLogin} className="space-y-2">
        <Input
          type="email"
          name="email"
          placeholder="you@email.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          disabled={isLoading}
        />
        <Button
          type="submit"
          className="w-full"
          disabled={isLoading || !email.trim()}
        >
          {mode === "email" && isLoading ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Mail className="w-4 h-4" />
          )}
          Continue with email
        </Button>
      </form>

      <div className="flex items-center gap-3">
        <div className="flex-1 h-px bg-border" />
        <span className="text-xs text-muted">or</span>
        <div className="flex-1 h-px bg-border" />
      </div>

      <Button
        variant="secondary"
        className="w-full"
        onClick={handleWalletConnect}
        disabled={isLoading}
      >
        {mode === "wallet" && isLoading ? (
          <Loader2 className="w-4 h-4 animate-spin" />
        ) : (
          <Wallet className="w-4 h-4" />
        )}
        Connect wallet
      </Button>

      {error && (
        <p className="text-xs text-danger text-center leading-relaxed">
          {error}
        </p>
      )}
    </div>
  );
}
