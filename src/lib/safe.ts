/**
 * Safe SDK helpers for Hub multisig management on Sepolia.
 *
 * Each Hub is identified by its Safe address.
 * Owners of the Safe are admins of the Hub.
 */
import SafeApiKit from "@safe-global/api-kit";
import Safe from "@safe-global/protocol-kit";
import { createPublicClient, http, getAddress } from "viem";
import { sepolia } from "viem/chains";

const SAFE_TX_SERVICE_URL =
  process.env.NEXT_PUBLIC_SAFE_TX_SERVICE_URL ||
  "https://safe-transaction-sepolia.safe.global";

const RPC_URL =
  process.env.NEXT_PUBLIC_SEPOLIA_RPC_URL ||
  process.env.SEPOLIA_RPC_URL ||
  "https://rpc.sepolia.org";

export interface SafeInfo {
  address: string;
  owners: string[];
  threshold: number;
  nonce: number;
  version?: string;
}

/**
 * Get a public viem client for Sepolia reads.
 */
export function getSepoliaClient() {
  return createPublicClient({
    chain: sepolia,
    transport: http(RPC_URL),
  });
}

/**
 * Get Safe API Kit (for Safe Transaction Service interactions).
 */
export function getSafeApiKit() {
  return new SafeApiKit({
    chainId: BigInt(11155111),
    txServiceUrl: SAFE_TX_SERVICE_URL,
  });
}

/**
 * Fetch Safe info (owners, threshold, nonce) from the Safe Transaction Service.
 */
export async function getHubSafeInfo(safeAddress: string): Promise<SafeInfo | null> {
  try {
    const apiKit = getSafeApiKit();
    const info = await apiKit.getSafeInfo(getAddress(safeAddress));
    return {
      address: info.address,
      owners: info.owners.map((o) => getAddress(o)),
      threshold: info.threshold,
      nonce: Number(info.nonce),
      version: info.version,
    };
  } catch {
    // Safe Transaction Service hasn't indexed this Safe yet (common for new Safes).
    // Callers should use the on-chain fallback.
    return null;
  }
}

/**
 * Read Safe info directly from the chain (always up-to-date, bypasses Transaction Service cache).
 */
export async function getHubSafeInfoOnChain(safeAddress: string): Promise<SafeInfo | null> {
  try {
    const client = getSepoliaClient();
    const addr = getAddress(safeAddress) as `0x${string}`;

    const safeAbi = [
      { name: "getOwners", type: "function", stateMutability: "view", inputs: [], outputs: [{ type: "address[]" }] },
      { name: "getThreshold", type: "function", stateMutability: "view", inputs: [], outputs: [{ type: "uint256" }] },
      { name: "nonce", type: "function", stateMutability: "view", inputs: [], outputs: [{ type: "uint256" }] },
    ] as const;

    const [owners, threshold, nonce] = await Promise.all([
      client.readContract({ address: addr, abi: safeAbi, functionName: "getOwners" }),
      client.readContract({ address: addr, abi: safeAbi, functionName: "getThreshold" }),
      client.readContract({ address: addr, abi: safeAbi, functionName: "nonce" }),
    ]);

    return {
      address: getAddress(safeAddress),
      owners: (owners as string[]).map((o) => getAddress(o)),
      threshold: Number(threshold),
      nonce: Number(nonce),
    };
  } catch {
    return null;
  }
}

/**
 * Check if a wallet address is an owner/signer of a Hub's Safe.
 * First tries Safe Transaction Service, then falls back to on-chain read
 * (needed for newly deployed Safes not yet indexed by the Service).
 */
export async function isHubAdmin(
  safeAddress: string,
  walletAddress: string
): Promise<boolean> {
  const normalized = getAddress(walletAddress);

  // Try Transaction Service first (fast, cached)
  const info = await getHubSafeInfo(safeAddress);
  if (info) {
    return info.owners.some((owner) => getAddress(owner) === normalized);
  }

  // Fallback: read owners directly from chain (for newly deployed Safes)
  try {
    const isOwnerOnChain = await isOwnerOnChainDirect(safeAddress, walletAddress);
    return isOwnerOnChain;
  } catch {
    return false;
  }
}

/**
 * Read Safe owners directly from the contract on Sepolia.
 * Used when Safe Transaction Service hasn't indexed a new Safe yet.
 */
async function isOwnerOnChainDirect(
  safeAddress: string,
  walletAddress: string
): Promise<boolean> {
  const client = getSepoliaClient();
  const normalized = getAddress(walletAddress);

  try {
    const owners = await client.readContract({
      address: getAddress(safeAddress) as `0x${string}`,
      abi: [
        {
          name: "getOwners",
          type: "function",
          stateMutability: "view",
          inputs: [],
          outputs: [{ type: "address[]" }],
        },
      ],
      functionName: "getOwners",
    });

    return (owners as string[]).some(
      (owner) => getAddress(owner) === normalized
    );
  } catch {
    return false;
  }
}

/**
 * Deploy a new Safe on Sepolia. Returns the predicted Safe address.
 *
 * NOTE: The actual deployment transaction must be sent via the sponsored tx helper.
 * This function prepares the Safe deployment data.
 */
export async function prepareSafeDeployment(ownerAddress: string): Promise<{
  safeAddress: string;
  deploymentTransaction: { to: string; value: string; data: string };
}> {
  const protocolKit = await Safe.init({
    provider: RPC_URL,
    predictedSafe: {
      safeAccountConfig: {
        owners: [getAddress(ownerAddress)],
        threshold: 1,
      },
    },
  });

  const safeAddress = await protocolKit.getAddress();
  const deploymentTx = await protocolKit.createSafeDeploymentTransaction();

  return {
    safeAddress,
    deploymentTransaction: {
      to: deploymentTx.to,
      value: deploymentTx.value,
      data: deploymentTx.data,
    },
  };
}

/**
 * Create a Safe transaction to add an owner.
 */
export async function prepareAddOwnerTx(
  safeAddress: string,
  signerAddress: string,
  newOwner: string,
  newThreshold?: number
) {
  const protocolKit = await Safe.init({
    provider: RPC_URL,
    safeAddress: getAddress(safeAddress),
    signer: signerAddress,
  });

  const tx = await protocolKit.createAddOwnerTx({
    ownerAddress: getAddress(newOwner),
    threshold: newThreshold,
  });

  return { protocolKit, tx };
}

/**
 * Create a Safe transaction to remove an owner.
 */
export async function prepareRemoveOwnerTx(
  safeAddress: string,
  signerAddress: string,
  ownerToRemove: string,
  newThreshold?: number
) {
  const protocolKit = await Safe.init({
    provider: RPC_URL,
    safeAddress: getAddress(safeAddress),
    signer: signerAddress,
  });

  const tx = await protocolKit.createRemoveOwnerTx({
    ownerAddress: getAddress(ownerToRemove),
    threshold: newThreshold,
  });

  return { protocolKit, tx };
}

/**
 * Create a Safe transaction to change the threshold.
 */
export async function prepareChangeThresholdTx(
  safeAddress: string,
  signerAddress: string,
  newThreshold: number
) {
  const protocolKit = await Safe.init({
    provider: RPC_URL,
    safeAddress: getAddress(safeAddress),
    signer: signerAddress,
  });

  const tx = await protocolKit.createChangeThresholdTx(newThreshold);

  return { protocolKit, tx };
}

// TODO: Future Holons integration:
// - Holons bot could be added as a Safe module or owner
// - Operations would go through the same multisig flow
// - Threshold > 1 would require human confirmation
