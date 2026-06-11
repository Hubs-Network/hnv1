/**
 * HubsNetworkBadgeSBT contract helpers (Sepolia).
 *
 * The SBT is a non-transferable badge minted to approved Hub Safe addresses.
 * - Reads use SEPOLIA_RPC_URL (public client).
 * - Mints use RELAYER_PRIVATE_KEY (relayer pays gas).
 * - Chain is forced to Sepolia (11155111).
 */
import {
  createPublicClient,
  createWalletClient,
  http,
  getAddress,
  isAddress,
  decodeEventLog,
  type Hex,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { sepolia } from "viem/chains";
import { HN_BADGE_SBT_ADDRESS, HN_CHAIN_ID } from "@/config/hubs-network";

export const HN_BADGE_SBT_ABI = [
  {
    name: "mintBadge",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "hubSafe", type: "address" },
      { name: "approver", type: "address" },
    ],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    name: "isApprovedHub",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "hubSafe", type: "address" }],
    outputs: [{ name: "", type: "bool" }],
  },
  {
    name: "badgeOf",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "hubSafe", type: "address" }],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    name: "hasBadge",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "hubSafe", type: "address" }],
    outputs: [{ name: "", type: "bool" }],
  },
  // Standard ERC-721 Transfer event, used to extract tokenId from mint receipt.
  {
    name: "Transfer",
    type: "event",
    inputs: [
      { name: "from", type: "address", indexed: true },
      { name: "to", type: "address", indexed: true },
      { name: "tokenId", type: "uint256", indexed: true },
    ],
  },
] as const;

function getRpcUrl(): string {
  return (
    process.env.SEPOLIA_RPC_URL ||
    process.env.NEXT_PUBLIC_SEPOLIA_RPC_URL ||
    "https://rpc.sepolia.org"
  );
}

function getContractAddress(): `0x${string}` {
  return getAddress(HN_BADGE_SBT_ADDRESS) as `0x${string}`;
}

function getPublicClient() {
  return createPublicClient({ chain: sepolia, transport: http(getRpcUrl()) });
}

function getRelayerAccount() {
  const pk = process.env.RELAYER_PRIVATE_KEY;
  if (!pk) throw new Error("RELAYER_PRIVATE_KEY not configured");
  return privateKeyToAccount(pk as Hex);
}

/**
 * Returns true if the hub Safe is approved on-chain (has the SBT).
 * Falls back to hasBadge if isApprovedHub is unavailable.
 */
export async function isHubApprovedOnChain(hubSafe: string): Promise<boolean> {
  try {
    const addr = getAddress(hubSafe) as `0x${string}`;
    const client = getPublicClient();
    try {
      const approved = await client.readContract({
        address: getContractAddress(),
        abi: HN_BADGE_SBT_ABI,
        functionName: "isApprovedHub",
        args: [addr],
      });
      return Boolean(approved);
    } catch {
      const has = await client.readContract({
        address: getContractAddress(),
        abi: HN_BADGE_SBT_ABI,
        functionName: "hasBadge",
        args: [addr],
      });
      return Boolean(has);
    }
  } catch {
    return false;
  }
}

/**
 * Batch-check on-chain approval for many hub Safes in a single multicall.
 * Returns a Set of lowercased approved addresses, or null if the RPC call
 * failed entirely (so callers can fall back to the cached JSON status).
 */
export async function getOnChainApprovedSet(
  hubSafes: string[]
): Promise<Set<string> | null> {
  const valid = hubSafes.filter((a) => isAddress(a));
  if (valid.length === 0) return new Set();

  try {
    const client = getPublicClient();
    const contract = getContractAddress();
    const results = await client.multicall({
      allowFailure: true,
      contracts: valid.map((a) => ({
        address: contract,
        abi: HN_BADGE_SBT_ABI,
        functionName: "isApprovedHub" as const,
        args: [getAddress(a)],
      })),
    });

    const set = new Set<string>();
    results.forEach((r, i) => {
      if (r.status === "success" && r.result === true) {
        set.add(valid[i].toLowerCase());
      }
    });
    return set;
  } catch {
    return null;
  }
}

// Short-lived cache so public listings don't hit RPC on every render.
let approvedSetCache: { key: string; at: number; set: Set<string> } | null = null;
const APPROVED_SET_TTL_MS = 60_000;

/**
 * Cached variant of getOnChainApprovedSet (60s TTL keyed by the address set).
 */
export async function getCachedOnChainApprovedSet(
  hubSafes: string[]
): Promise<Set<string> | null> {
  const key = [...hubSafes].map((a) => a.toLowerCase()).sort().join(",");
  if (
    approvedSetCache &&
    approvedSetCache.key === key &&
    Date.now() - approvedSetCache.at < APPROVED_SET_TTL_MS
  ) {
    return approvedSetCache.set;
  }

  const set = await getOnChainApprovedSet(hubSafes);
  if (set) {
    approvedSetCache = { key, at: Date.now(), set };
  }
  return set;
}

/**
 * Returns the SBT token id held by the hub Safe, or null if none / unreadable.
 */
export async function getHubBadgeTokenId(hubSafe: string): Promise<bigint | null> {
  try {
    const addr = getAddress(hubSafe) as `0x${string}`;
    const client = getPublicClient();
    const tokenId = await client.readContract({
      address: getContractAddress(),
      abi: HN_BADGE_SBT_ABI,
      functionName: "badgeOf",
      args: [addr],
    });
    return tokenId as bigint;
  } catch {
    return null;
  }
}

/**
 * Mint the HN badge SBT to a hub Safe via the relayer wallet.
 * Returns the tx hash and (best-effort) minted token id.
 */
export async function mintHNBadgeToHub(
  hubSafe: string,
  approver: string
): Promise<{ txHash: string; tokenId: string | null }> {
  const hubAddr = getAddress(hubSafe) as `0x${string}`;
  const approverAddr = getAddress(approver) as `0x${string}`;

  const account = getRelayerAccount();
  const rpcUrl = getRpcUrl();

  const walletClient = createWalletClient({
    account,
    chain: sepolia,
    transport: http(rpcUrl),
  });
  const publicClient = getPublicClient();

  const txHash = await walletClient.writeContract({
    address: getContractAddress(),
    abi: HN_BADGE_SBT_ABI,
    functionName: "mintBadge",
    args: [hubAddr, approverAddr],
    chain: sepolia,
  });

  const receipt = await publicClient.waitForTransactionReceipt({ hash: txHash });
  if (receipt.status === "reverted") {
    throw new Error("Mint transaction reverted on-chain");
  }

  // Best-effort: extract tokenId from the ERC-721 Transfer event.
  let tokenId: string | null = null;
  for (const log of receipt.logs) {
    if (log.address.toLowerCase() !== getContractAddress().toLowerCase()) continue;
    try {
      const decoded = decodeEventLog({
        abi: HN_BADGE_SBT_ABI,
        data: log.data,
        topics: log.topics,
      });
      if (decoded.eventName === "Transfer") {
        tokenId = (decoded.args as { tokenId: bigint }).tokenId.toString();
        break;
      }
    } catch {
      // not a Transfer event; ignore
    }
  }

  // Fallback: read badgeOf after mint
  if (tokenId === null) {
    const id = await getHubBadgeTokenId(hubAddr);
    tokenId = id !== null ? id.toString() : null;
  }

  return { txHash, tokenId };
}

export { HN_CHAIN_ID };
