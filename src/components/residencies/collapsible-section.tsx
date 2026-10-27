"use client";

import { useState, type ReactNode } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Generic collapsible section. The page (a server component) renders the cards
 * and passes them as children, so this client wrapper only owns the open/close
 * state — no server component is imported into client code.
 */
export function CollapsibleSection({
  title,
  count,
  defaultOpen = false,
  children,
}: {
  title: string;
  count?: number;
  defaultOpen?: boolean;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div className="border-t border-border">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="w-full flex items-center justify-between gap-2 py-4 text-left"
      >
        <span className="text-sm font-semibold text-foreground">
          {title}
          {typeof count === "number" && (
            <span className="ml-2 font-normal text-muted">({count})</span>
          )}
        </span>
        <ChevronDown
          className={cn(
            "w-5 h-5 text-muted shrink-0 transition-transform",
            open && "rotate-180"
          )}
        />
      </button>
      {open && <div className="pb-2">{children}</div>}
    </div>
  );
}
