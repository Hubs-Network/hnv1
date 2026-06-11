/**
 * Hubs Network — central configuration.
 *
 * Single source of truth for HN-level constants (Directors Safe, chain, manifesto).
 * Do not hardcode these values elsewhere; import from here.
 */

export const HN_DIRECTORS_SAFE_ADDRESS =
  process.env.NEXT_PUBLIC_HN_DIRECTORS_SAFE_ADDRESS ||
  process.env.HN_DIRECTORS_SAFE_ADDRESS ||
  "0xc770755f793197C34Fd5b8F86b50d73D943C98a3";

export const HN_CHAIN_ID = Number(
  process.env.NEXT_PUBLIC_HN_CHAIN_ID || "11155111"
);

export const HN_MANIFESTO_URL = "https://www.hubsnetwork.org/manifesto" as const;

/**
 * HubsNetworkBadgeSBT contract address on Sepolia.
 * Server-side reads/mints use HUBS_NETWORK_BADGE_SBT_ADDRESS;
 * the client mirror (NEXT_PUBLIC_) is used only for display/links.
 */
export const HN_BADGE_SBT_ADDRESS =
  process.env.HUBS_NETWORK_BADGE_SBT_ADDRESS ||
  process.env.NEXT_PUBLIC_HUBS_NETWORK_BADGE_SBT_ADDRESS ||
  "0x16453D889f19eCB30bbc47e423DcF0F2A531Cc4B";
