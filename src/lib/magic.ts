import { Magic } from "magic-sdk";

let magicInstance: Magic | null = null;

export function getMagic(): Magic {
  if (typeof window === "undefined") {
    throw new Error("Magic can only be used in the browser");
  }

  if (magicInstance) return magicInstance;

  const key = process.env.NEXT_PUBLIC_MAGIC_PUBLISHABLE_KEY;
  if (!key) {
    throw new Error(
      "Missing NEXT_PUBLIC_MAGIC_PUBLISHABLE_KEY environment variable. " +
        "Add it to .env.local to enable Magic authentication."
    );
  }

  magicInstance = new Magic(key, {
    network: "mainnet",
  });

  return magicInstance;
}
