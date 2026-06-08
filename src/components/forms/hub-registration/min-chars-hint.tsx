"use client";

/**
 * Live character-count hint that turns from red to green
 * once the minimum required characters are reached.
 */
export function MinCharsHint({ value, min }: { value: string; min: number }) {
  const current = (value || "").trim().length;
  const met = current >= min;
  return (
    <p
      className={`text-xs mt-1 transition-colors ${
        met ? "text-green-600" : "text-red-500"
      }`}
    >
      {met
        ? `Minimum reached (${current}/${min} characters)`
        : `Minimum ${min} characters (${current}/${min})`}
    </p>
  );
}
