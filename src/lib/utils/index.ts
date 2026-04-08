import { clsx, type ClassValue } from "clsx";
import slugifyLib from "slugify";

export function cn(...inputs: ClassValue[]) {
  return clsx(inputs);
}

export function generateHubId(name: string, city: string): string {
  const raw = `${name} ${city}`;
  return slugifyLib(raw, { lower: true, strict: true, trim: true });
}

export function formatLabel(value: string): string {
  return value
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

export function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString("en-GB", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  } catch {
    return iso;
  }
}

export function truncate(text: string, length: number): string {
  if (text.length <= length) return text;
  return text.slice(0, length).trimEnd() + "…";
}
