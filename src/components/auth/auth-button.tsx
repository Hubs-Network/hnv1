"use client";

import { useAuth } from "@/context/auth-context";
import { LoginPanel } from "./login-panel";
import { UserWalletBadge } from "./user-wallet-badge";
import { Button } from "@/components/ui/button";
import { useState, useRef, useEffect } from "react";
import { User } from "lucide-react";

export function AuthButton() {
  const { isAuthenticated, isLoading } = useAuth();
  const [panelOpen, setPanelOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setPanelOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  if (isLoading) return null;

  if (isAuthenticated) {
    return <UserWalletBadge />;
  }

  return (
    <div className="relative" ref={ref}>
      <Button
        variant="primary"
        size="sm"
        onClick={() => setPanelOpen(!panelOpen)}
      >
        <User className="w-4 h-4" />
        Login
      </Button>

      {panelOpen && (
        <div className="absolute right-0 mt-2 z-50">
          <LoginPanel />
        </div>
      )}
    </div>
  );
}
