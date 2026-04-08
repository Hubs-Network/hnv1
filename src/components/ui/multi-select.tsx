"use client";

import { useState, useRef, useEffect } from "react";
import { cn, formatLabel } from "@/lib/utils";
import { Badge } from "./badge";
import { X, ChevronDown } from "lucide-react";

interface MultiSelectProps {
  label?: string;
  options: readonly string[];
  value: string[];
  onChange: (value: string[]) => void;
  error?: string;
  placeholder?: string;
  max?: number;
}

export function MultiSelect({
  label,
  options,
  value,
  onChange,
  error,
  placeholder = "Select options…",
  max,
}: MultiSelectProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  function toggle(option: string) {
    if (value.includes(option)) {
      onChange(value.filter((v) => v !== option));
    } else {
      if (max && value.length >= max) return;
      onChange([...value, option]);
    }
  }

  function remove(option: string) {
    onChange(value.filter((v) => v !== option));
  }

  return (
    <div className="relative space-y-1.5" ref={ref}>
      {label && (
        <label className="block text-sm font-medium text-foreground">
          {label}
        </label>
      )}
      <div
        className={cn(
          "relative w-full rounded-lg border bg-surface px-3 py-2 text-sm cursor-pointer",
          "transition-colors duration-150",
          error ? "border-danger" : "border-border",
          open && "border-primary ring-2 ring-primary/10"
        )}
        onClick={() => setOpen(!open)}
      >
        <div className="flex items-center justify-between gap-2">
          <div className="flex flex-wrap gap-1.5 flex-1 min-h-[24px]">
            {value.length === 0 && (
              <span className="text-muted-light">{placeholder}</span>
            )}
            {value.map((v) => (
              <Badge
                key={v}
                label={v}
                variant="primary"
                size="sm"
                onClick={() => remove(v)}
                className="pr-1 gap-1"
              />
            ))}
          </div>
          <ChevronDown
            className={cn(
              "w-4 h-4 text-muted shrink-0 transition-transform",
              open && "rotate-180"
            )}
          />
        </div>
      </div>

      {open && (
        <div className="absolute z-50 mt-1 max-h-48 w-full overflow-auto rounded-lg border border-border bg-surface shadow-lg">
          <div className="p-1">
            {options.map((option) => {
              const selected = value.includes(option);
              return (
                <button
                  key={option}
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    toggle(option);
                  }}
                  className={cn(
                    "w-full text-left px-3 py-2 text-sm rounded-md transition-colors",
                    selected
                      ? "bg-primary-bg text-primary font-medium"
                      : "hover:bg-stone-50 text-foreground"
                  )}
                >
                  {formatLabel(option)}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {error && <p className="text-xs text-danger">{error}</p>}
    </div>
  );
}
