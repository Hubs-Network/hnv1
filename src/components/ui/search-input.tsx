"use client";

import { cn } from "@/lib/utils";
import { Search } from "lucide-react";
import type { InputHTMLAttributes } from "react";

interface SearchInputProps extends InputHTMLAttributes<HTMLInputElement> {
  onSearch?: (value: string) => void;
}

export function SearchInput({
  onSearch,
  className,
  ...props
}: SearchInputProps) {
  return (
    <div className="relative">
      <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-light" />
      <input
        type="search"
        className={cn(
          "w-full rounded-lg border border-border bg-surface pl-10 pr-4 py-2.5 text-sm text-foreground",
          "placeholder:text-muted-light transition-colors duration-150",
          className
        )}
        onChange={(e) => onSearch?.(e.target.value)}
        {...props}
      />
    </div>
  );
}
