/**
 * Hubs Network admin helpers.
 *
 * An HN admin is any wallet that is a current owner of the HN Directors Safe
 * on Sepolia. Reuses the same on-chain Safe reading approach as hub admin checks.
 */
import { getAddress } from "viem";
import { getHubSafeInfoOnChain } from "./safe";
import { HN_DIRECTORS_SAFE_ADDRESS, HN_CHAIN_ID } from "@/config/hubs-network";

export interface HNDirectorsSafeInfo {
  safeAddress: string;
  owners: string[];
  threshold: number;
  chainId: number;
}

/**
 * Read the HN Directors Safe info (owners, threshold) from chain.
 * Returns null if the Safe cannot be read.
 */
export async function getHNDirectorsSafeInfo(): Promise<HNDirectorsSafeInfo | null> {
  const info = await getHubSafeInfoOnChain(HN_DIRECTORS_SAFE_ADDRESS);
  if (!info) return null;

  return {
    safeAddress: getAddress(HN_DIRECTORS_SAFE_ADDRESS),
    owners: info.owners.map((o) => getAddress(o)),
    threshold: info.threshold,
    chainId: HN_CHAIN_ID,
  };
}

/**
 * Returns true only if the given wallet is a current owner of the HN Directors Safe.
 */
export async function isHNAdmin(walletAddress: string): Promise<boolean> {
  if (!walletAddress) return false;

  let normalized: string;
  try {
    normalized = getAddress(walletAddress);
  } catch {
    return false;
  }

  const info = await getHNDirectorsSafeInfo();
  if (!info) return false;

  return info.owners.some((owner) => getAddress(owner) === normalized);
}
