/**
 * Client-side Safe helpers for Hub creation and owner management.
 *
 * Safe deployment and owner management transactions are executed via
 * Magic Smart Account (gas-sponsored on Sepolia).
 */
import { sendSponsoredSepoliaTransaction } from "./magic-smart-account";

const SAFE_TX_SERVICE_URL =
  process.env.NEXT_PUBLIC_SAFE_TX_SERVICE_URL ||
  "https://safe-transaction-sepolia.safe.global";

const RPC_URL = process.env.NEXT_PUBLIC_SEPOLIA_RPC_URL || "https://rpc.sepolia.org";

/**
 * Deploy a new Safe on Sepolia with the given owner, using sponsored gas.
 * Uses a unique saltNonce so the same owner can deploy multiple Safes.
 * Returns the deployed Safe address.
 */
export async function deploySafeForHub(ownerAddress: string): Promise<string> {
  // Dynamic import to avoid SSR issues with Safe SDK
  const { default: Safe } = await import("@safe-global/protocol-kit");

  // Unique salt per deployment: timestamp + random to avoid collisions
  const saltNonce = `${Date.now()}${Math.floor(Math.random() * 1000000)}`;

  const protocolKit = await Safe.init({
    provider: RPC_URL,
    predictedSafe: {
      safeAccountConfig: {
        owners: [ownerAddress],
        threshold: 1,
      },
      safeDeploymentConfig: {
        saltNonce,
      },
    },
  });

  const safeAddress = await protocolKit.getAddress();
  const deploymentTx = await protocolKit.createSafeDeploymentTransaction();

  // Send the deployment transaction with gas sponsorship
  await sendSponsoredSepoliaTransaction({
    to: deploymentTx.to,
    value: deploymentTx.value,
    data: deploymentTx.data,
  });

  return safeAddress;
}

/**
 * Fetch Safe info from the Safe Transaction Service (client-side).
 */
export async function fetchSafeInfo(safeAddress: string) {
  const res = await fetch(`${SAFE_TX_SERVICE_URL}/api/v1/safes/${safeAddress}/`);
  if (!res.ok) return null;
  return await res.json();
}

/**
 * Fetch pending multisig transactions for a Safe.
 */
export async function fetchPendingTransactions(safeAddress: string) {
  const res = await fetch(
    `${SAFE_TX_SERVICE_URL}/api/v1/safes/${safeAddress}/multisig-transactions/?executed=false`
  );
  if (!res.ok) return [];
  const data = await res.json();
  return data.results || [];
}
