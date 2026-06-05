/**
 * Hub admin helpers — Safe-based.
 *
 * A Hub admin is any wallet that is a Safe owner on the Hub's Safe (Sepolia).
 * The first owner (deployer) is conceptually the "owner" with threshold=1.
 *
 * For legacy hubs (no safeAddress), falls back to Neon Postgres if available.
 */
import { getHubSafeInfo, getHubSafeInfoOnChain, isHubAdmin as safeIsHubAdmin } from "./safe";
import type { SafeInfo } from "./safe";

export interface AdminCheckResult {
  isAdmin: boolean;
  role?: "owner" | "admin";
  safeInfo?: SafeInfo;
}

/**
 * Check if a wallet is admin for a given hub.
 *
 * For hubs with a safeAddress: checks Safe owners on-chain.
 * For legacy hubs (slug-based ID, no safe): falls back to Neon admin check.
 */
export async function checkHubAdmin({
  hubId,
  walletAddress,
  safeAddress,
}: {
  hubId: string;
  walletAddress: string;
  safeAddress?: string;
}): Promise<AdminCheckResult> {
  const target = safeAddress || hubId;

  // If it looks like an Ethereum address, treat it as Safe-based hub
  if (/^0x[a-fA-F0-9]{40}$/.test(target)) {
    // isHubAdmin handles both Transaction Service and on-chain fallback
    const isOwner = await safeIsHubAdmin(target, walletAddress);
    if (!isOwner) return { isAdmin: false };

    // Read directly from chain for always-fresh data (bypasses TX Service cache)
    const info = await getHubSafeInfoOnChain(target) || await getHubSafeInfo(target);

    // Determine role: first owner = "owner", others = "admin"
    const normalizedWallet = walletAddress.toLowerCase();
    const isFirstOwner = info
      ? info.owners.length > 0 && info.owners[0].toLowerCase() === normalizedWallet
      : true; // If no info yet, assume creator is owner

    return {
      isAdmin: true,
      role: isFirstOwner ? "owner" : "admin",
      safeInfo: info || undefined,
    };
  }

  // Legacy hub: fallback to Neon admin check
  try {
    const { checkAdmin } = await import("./admin");
    const result = await checkAdmin({
      profileId: hubId,
      profileType: "hub",
      walletAddress,
    });
    return {
      isAdmin: result.isAdmin,
      role: result.role as "owner" | "admin" | undefined,
    };
  } catch {
    return { isAdmin: false };
  }
}

/**
 * List admins for a hub.
 * For Safe-based hubs: returns Safe owners.
 * For legacy hubs: falls back to Neon.
 */
export async function listHubAdmins({
  hubId,
  safeAddress,
}: {
  hubId: string;
  safeAddress?: string;
}): Promise<{ wallet_address: string; role: string }[]> {
  const target = safeAddress || hubId;

  if (/^0x[a-fA-F0-9]{40}$/.test(target)) {
    // Always read directly from chain for fresh data
    const info = await getHubSafeInfoOnChain(target) || await getHubSafeInfo(target);
    if (info) {
      return info.owners.map((addr, i) => ({
        wallet_address: addr,
        role: i === 0 ? "owner" : "admin",
      }));
    }
    return [];
  }

  // Legacy fallback
  try {
    const { listAdmins } = await import("./admin");
    const rows = await listAdmins({ profileId: hubId, profileType: "hub" });
    return rows as unknown as { wallet_address: string; role: string }[];
  } catch {
    return [];
  }
}

/**
 * Check if a hub uses on-chain Safe admin model.
 */
export function isSafeBasedHub(hubIdOrAddress: string): boolean {
  return /^0x[a-fA-F0-9]{40}$/.test(hubIdOrAddress);
}
