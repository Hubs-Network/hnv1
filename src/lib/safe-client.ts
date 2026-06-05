/**
 * Client-side Safe helpers for Hub creation and owner management.
 *
 * Safe deployment transactions are executed via:
 * - Magic Smart Account (gas-sponsored) for email users
 * - Backend relay (relayer pays gas) for injected wallet users
 */
import { sendSponsoredSepoliaTransaction } from "./magic-smart-account";

const SAFE_TX_SERVICE_URL =
  process.env.NEXT_PUBLIC_SAFE_TX_SERVICE_URL ||
  "https://safe-transaction-sepolia.safe.global";

const RPC_URL = process.env.NEXT_PUBLIC_SEPOLIA_RPC_URL || "https://rpc.sepolia.org";

/**
 * Send a deployment transaction via the relay (for injected wallet users).
 * The relay verifies the owner is valid and submits using the relayer wallet.
 */
async function deployViaRelay(
  to: string,
  data: string,
  ownerAddress: string
): Promise<void> {
  const res = await fetch("/api/relay/deploy", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ to, data, ownerAddress }),
  });
  const result = await res.json();
  if (!res.ok) {
    throw new Error(result.error || "Relay deployment failed");
  }
}

/**
 * Deploy a new Safe on Sepolia with the given owner, using sponsored gas.
 * Uses a unique saltNonce so the same owner can deploy multiple Safes.
 * Returns the deployed Safe address.
 *
 * @param authProvider - "magic" or "injected" to determine gas payment method
 */
export async function deploySafeForHub(
  ownerAddress: string,
  authProvider?: string | null
): Promise<string> {
  const { default: Safe } = await import("@safe-global/protocol-kit");

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

  if (authProvider === "injected") {
    await deployViaRelay(deploymentTx.to, deploymentTx.data, ownerAddress);
  } else {
    await sendSponsoredSepoliaTransaction({
      to: deploymentTx.to,
      value: deploymentTx.value,
      data: deploymentTx.data,
    });
  }

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
