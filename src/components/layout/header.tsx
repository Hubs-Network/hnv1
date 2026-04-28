"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { useUP } from "@/context/up-context";
import { ConnectButton } from "./connect-button";
import { Menu, X } from "lucide-react";
import { useState } from "react";

export function Header() {
  const pathname = usePathname();
  const { isConnected } = useUP();
  const [mobileOpen, setMobileOpen] = useState(false);

  const navigation = [
    { name: "Home", href: "/" },
    { name: "Hubs", href: "/hubs" },
    { name: "Register", href: "/register/hub" },
    ...(isConnected ? [{ name: "My Hubs", href: "/my-hubs" }] : []),
    { name: "Pilgrims", href: "/pilgrims", disabled: true },
    { name: "Patrons", href: "/patrons", disabled: true },
  ];

  return (
    <header className="sticky top-0 z-50 bg-surface/80 backdrop-blur-lg border-b border-border">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          <Link href="/" className="flex items-center gap-2.5">
            <Image
              src="/HN-magent.png"
              alt="Hubs Network"
              width={32}
              height={32}
              className="w-8 h-8 rounded-lg"
            />
            <div className="flex flex-col">
              <span className="text-sm font-semibold text-foreground leading-tight">
                Hubs Network
              </span>
              <span className="text-[10px] text-muted leading-tight tracking-wide uppercase">
                Residencies
              </span>
            </div>
          </Link>

          <div className="hidden md:flex items-center gap-1">
            <nav className="flex items-center gap-1 mr-3">
              {navigation.map((item) => {
                const active =
                  item.href === "/"
                    ? pathname === "/"
                    : pathname.startsWith(item.href);

                if ("disabled" in item && item.disabled) {
                  return (
                    <span
                      key={item.name}
                      className="px-3 py-2 text-sm text-muted-light cursor-default"
                      title="Coming soon"
                    >
                      {item.name}
                    </span>
                  );
                }

                return (
                  <Link
                    key={item.name}
                    href={item.href}
                    className={cn(
                      "px-3 py-2 rounded-md text-sm font-medium transition-colors",
                      active
                        ? "text-primary bg-primary-bg"
                        : "text-muted hover:text-foreground hover:bg-stone-50"
                    )}
                  >
                    {item.name}
                  </Link>
                );
              })}
            </nav>

            <ConnectButton />
          </div>

          <div className="flex items-center gap-2 md:hidden">
            <ConnectButton />
            <button
              className="p-2 rounded-md text-muted hover:text-foreground"
              onClick={() => setMobileOpen(!mobileOpen)}
            >
              {mobileOpen ? (
                <X className="w-5 h-5" />
              ) : (
                <Menu className="w-5 h-5" />
              )}
            </button>
          </div>
        </div>

        {mobileOpen && (
          <nav className="md:hidden pb-4 border-t border-border-light pt-3 space-y-1">
            {navigation.map((item) => {
              if ("disabled" in item && item.disabled) {
                return (
                  <span
                    key={item.name}
                    className="block px-3 py-2 text-sm text-muted-light"
                  >
                    {item.name} — coming soon
                  </span>
                );
              }

              const active =
                item.href === "/"
                  ? pathname === "/"
                  : pathname.startsWith(item.href);

              return (
                <Link
                  key={item.name}
                  href={item.href}
                  onClick={() => setMobileOpen(false)}
                  className={cn(
                    "block px-3 py-2 rounded-md text-sm font-medium",
                    active
                      ? "text-primary bg-primary-bg"
                      : "text-muted hover:text-foreground"
                  )}
                >
                  {item.name}
                </Link>
              );
            })}
          </nav>
        )}
      </div>
    </header>
  );
}
