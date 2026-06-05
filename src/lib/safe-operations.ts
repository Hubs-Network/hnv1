/**
 * Client-side Safe owner management operations.
 *
 * For threshold=1, builds the Safe execTransaction calldata and sends it:
 * - Via Magic Smart Account (sponsored gas, pre-approved sig) if user is logged in with Magic
 * - Via backend relay (EIP-712 signature + relayer pays gas) if connected via injected wallet
 *
 * In both cases the end user pays zero gas.
 */
import { encodeFunctionData, getAddress, keccak256, encodeAbiParameters, concat, toHex, Hex, createPublicClient, http } from "viem";
import { sepolia } from "viem/chains";
import { sendSponsoredSepoliaTransaction } from "./magic-smart-account";

const SENTINEL_ADDRESS = "0x0000000000000000000000000000000000000001";
const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";

const SAFE_ABI = [
  {
    name: "addOwnerWithThreshold",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "owner", type: "address" },
      { name: "_threshold", type: "uint256" },
    ],
    outputs: [],
  },
  {
    name: "removeOwner",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "prevOwner", type: "address" },
      { name: "owner", type: "address" },
      { name: "_threshold", type: "uint256" },
    ],
    outputs: [],
  },
  {
    name: "changeThreshold",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [{ name: "_threshold", type: "uint256" }],
    outputs: [],
  },
  {
    name: "getOwners",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "address[]" }],
  },
  {
    name: "nonce",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    name: "execTransaction",
    type: "function",
    stateMutability: "payable",
    inputs: [
      { name: "to", type: "address" },
      { name: "value", type: "uint256" },
      { name: "data", type: "bytes" },
      { name: "operation", type: "uint8" },
      { name: "safeTxGas", type: "uint256" },
      { name: "baseGas", type: "uint256" },
      { name: "gasPrice", type: "uint256" },
      { name: "gasToken", type: "address" },
      { name: "refundReceiver", type: "address" },
      { name: "signatures", type: "bytes" },
    ],
    outputs: [{ name: "success", type: "bool" }],
  },
] as const;

function getPublicClient() {
  const rpcUrl = process.env.NEXT_PUBLIC_SEPOLIA_RPC_URL || "https://eth-sepolia.g.alchemy.com/v2/demo";
  return createPublicClient({ chain: sepolia, transport: http(rpcUrl) });
}

/**
 * Build a pre-approved signature for execTransaction.
 * Works only when msg.sender == owner (i.e., Magic Smart Account flow).
 */
function buildPreApprovedSignature(ownerAddress: string): Hex {
  const addr = ownerAddress.toLowerCase().replace("0x", "").padStart(64, "0");
  return `0x${addr}${"0".repeat(64)}01` as Hex;
}

/**
 * Get the current nonce of the Safe contract.
 */
async function getSafeNonce(safeAddress: string): Promise<bigint> {
  const client = getPublicClient();
  return await client.readContract({
    address: getAddress(safeAddress) as `0x${string}`,
    abi: SAFE_ABI,
    functionName: "nonce",
  });
}

/**
 * Get the EIP-1193 provider matching the current auth method.
 */
async function getEIP1193Provider(preferMagic?: boolean): Promise<any> {
  if (typeof window === "undefined") throw new Error("No browser environment");

  if (preferMagic) {
    try {
      const { getMagic } = await import("./magic");
      const magic = getMagic();
      if (magic) return magic.rpcProvider;
    } catch {
      // Magic not available
    }
  }

  // Injected wallet (MetaMask/Rabby)
  if (window.ethereum) return window.ethereum;

  // Last resort: try Magic
  try {
    const { getMagic } = await import("./magic");
    const magic = getMagic();
    if (magic) return magic.rpcProvider;
  } catch {
    // Magic not available
  }

  throw new Error("No wallet provider found");
}

/**
 * Sign a Safe transaction using EIP-712 via any available wallet provider.
 * Returns the ECDSA signature (65 bytes).
 */
async function signSafeTxEIP712(
  safeAddress: string,
  safeTx: {
    to: string;
    value: bigint;
    data: Hex;
    operation: number;
    safeTxGas: bigint;
    baseGas: bigint;
    gasPrice: bigint;
    gasToken: string;
    refundReceiver: string;
    nonce: bigint;
  },
  signerAddress: string,
  authProvider?: string | null
): Promise<Hex> {
  const provider = await getEIP1193Provider(authProvider === "magic");

  // Ensure wallet is on Sepolia before signing
  try {
    await provider.request({
      method: "wallet_switchEthereumChain",
      params: [{ chainId: "0xaa36a7" }], // 11155111 in hex
    });
  } catch (switchErr: any) {
    // 4902 = chain not added, try to add it
    if (switchErr?.code === 4902) {
      await provider.request({
        method: "wallet_addEthereumChain",
        params: [{
          chainId: "0xaa36a7",
          chainName: "Sepolia",
          rpcUrls: ["https://eth-sepolia.g.alchemy.com/v2/demo"],
          nativeCurrency: { name: "SepoliaETH", symbol: "ETH", decimals: 18 },
          blockExplorerUrls: ["https://sepolia.etherscan.io"],
        }],
      });
    }
    // If user rejected the switch, the signing will fail with a clear message
  }

  const typedData = {
    types: {
      EIP712Domain: [
        { name: "chainId", type: "uint256" },
        { name: "verifyingContract", type: "address" },
      ],
      SafeTx: [
        { name: "to", type: "address" },
        { name: "value", type: "uint256" },
        { name: "data", type: "bytes" },
        { name: "operation", type: "uint8" },
        { name: "safeTxGas", type: "uint256" },
        { name: "baseGas", type: "uint256" },
        { name: "gasPrice", type: "uint256" },
        { name: "gasToken", type: "address" },
        { name: "refundReceiver", type: "address" },
        { name: "nonce", type: "uint256" },
      ],
    },
    primaryType: "SafeTx",
    domain: {
      chainId: sepolia.id,
      verifyingContract: getAddress(safeAddress),
    },
    message: {
      to: getAddress(safeTx.to),
      value: safeTx.value.toString(),
      data: safeTx.data,
      operation: safeTx.operation,
      safeTxGas: safeTx.safeTxGas.toString(),
      baseGas: safeTx.baseGas.toString(),
      gasPrice: safeTx.gasPrice.toString(),
      gasToken: getAddress(safeTx.gasToken),
      refundReceiver: getAddress(safeTx.refundReceiver),
      nonce: safeTx.nonce.toString(),
    },
  };

  const signature = await provider.request({
    method: "eth_signTypedData_v4",
    params: [signerAddress, JSON.stringify(typedData)],
  });

  return signature as Hex;
}

/**
 * Send a Safe execTransaction via the backend relay with a real EIP-712 signature.
 * Used for threshold=1 Safes with injected wallets.
 */
async function sendViaRelay(
  safeAddress: string,
  innerData: Hex,
  signerAddress: string
): Promise<string> {
  console.log("[sendViaRelay] Starting...", { safeAddress, signerAddress });

  const nonce = await getSafeNonce(safeAddress);
  console.log("[sendViaRelay] Safe nonce:", nonce.toString());

  const safeTx = {
    to: getAddress(safeAddress),
    value: BigInt(0),
    data: innerData,
    operation: 0,
    safeTxGas: BigInt(0),
    baseGas: BigInt(0),
    gasPrice: BigInt(0),
    gasToken: ZERO_ADDRESS,
    refundReceiver: ZERO_ADDRESS,
    nonce,
  };

  const signature = await signSafeTxEIP712(safeAddress, safeTx, signerAddress);
  console.log("[sendViaRelay] Got signature, submitting to relay...");

  const execData = encodeFunctionData({
    abi: SAFE_ABI,
    functionName: "execTransaction",
    args: [
      safeTx.to as `0x${string}`,
      safeTx.value,
      safeTx.data,
      safeTx.operation,
      safeTx.safeTxGas,
      safeTx.baseGas,
      safeTx.gasPrice,
      safeTx.gasToken as `0x${string}`,
      safeTx.refundReceiver as `0x${string}`,
      signature,
    ],
  });

  const res = await fetch("/api/relay", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ safeAddress, execData, signerAddress }),
  });

  const result = await res.json();
  console.log("[sendViaRelay] Relay response:", result);
  if (!res.ok) {
    throw new Error(result.error || "Relay transaction failed");
  }
  return result.txHash;
}

/**
 * Send a Safe operation using the appropriate method based on auth provider.
 * - Magic: pre-approved signature + sponsored gas
 * - Injected: EIP-712 signature + relay pays gas
 */
async function sendSafeOperation(
  safeAddress: string,
  innerData: Hex,
  callerAddress: string,
  authProvider?: string | null
): Promise<string> {
  if (authProvider === "injected") {
    return await sendViaRelay(safeAddress, innerData, callerAddress);
  }

  // Magic flow: build execTransaction with pre-approved signature and send sponsored
  const execData = encodeFunctionData({
    abi: SAFE_ABI,
    functionName: "execTransaction",
    args: [
      getAddress(safeAddress) as `0x${string}`,
      BigInt(0),
      innerData,
      0,
      BigInt(0),
      BigInt(0),
      BigInt(0),
      ZERO_ADDRESS as `0x${string}`,
      ZERO_ADDRESS as `0x${string}`,
      buildPreApprovedSignature(callerAddress),
    ],
  });

  return await sendSponsoredSepoliaTransaction({ to: safeAddress, data: execData });
}

/**
 * Propose a Safe operation to the Safe Transaction Service (for threshold > 1).
 * The user signs EIP-712, and the transaction is submitted as a pending proposal.
 * Other owners must confirm before execution.
 */
export async function proposeSafeOperation(
  safeAddress: string,
  innerData: Hex,
  signerAddress: string,
  description?: string,
  authProvider?: string | null
): Promise<void> {
  if (typeof window === "undefined") {
    throw new Error("Can only propose from the browser.");
  }

  console.log("[proposeSafeOperation] Starting...", { safeAddress, signerAddress });

  let nonce: bigint;
  try {
    nonce = await getSafeNonce(safeAddress);
    console.log("[proposeSafeOperation] Got nonce:", nonce.toString());
  } catch (err) {
    console.error("[proposeSafeOperation] Failed to get nonce:", err);
    throw new Error("Failed to read Safe nonce from blockchain. Check RPC connection.");
  }

  const safeTx = {
    to: getAddress(safeAddress),
    value: BigInt(0),
    data: innerData,
    operation: 0,
    safeTxGas: BigInt(0),
    baseGas: BigInt(0),
    gasPrice: BigInt(0),
    gasToken: ZERO_ADDRESS,
    refundReceiver: ZERO_ADDRESS,
    nonce,
  };

  let signature: Hex;
  try {
    console.log("[proposeSafeOperation] Requesting EIP-712 signature...");
    signature = await signSafeTxEIP712(safeAddress, safeTx, signerAddress, authProvider);
    console.log("[proposeSafeOperation] Got signature:", signature.slice(0, 20) + "...");
  } catch (err: any) {
    console.error("[proposeSafeOperation] Signature failed:", err);
    if (err?.code === 4001 || err?.message?.includes("rejected")) {
      throw new Error("Signature rejected by user.");
    }
    throw new Error(`Signature failed: ${err?.message || "unknown error"}`);
  }

  console.log("[proposeSafeOperation] Submitting proposal to backend...");
  const res = await fetch("/api/relay/propose", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      safeAddress,
      hubId: safeAddress,
      to: safeTx.to,
      data: safeTx.data,
      value: "0",
      operation: 0,
      safeTxGas: "0",
      baseGas: "0",
      gasPrice: "0",
      gasToken: ZERO_ADDRESS,
      refundReceiver: ZERO_ADDRESS,
      nonce: Number(nonce),
      signerAddress,
      signature,
      description,
    }),
  });

  const result = await res.json();
  console.log("[proposeSafeOperation] Backend response:", result);
  if (!res.ok) {
    throw new Error(result.error || "Failed to propose transaction");
  }
}

/**
 * Build inner data for common operations (exported for propose flow).
 */
export function buildAddOwnerData(newOwner: string, newThreshold: number): Hex {
  return encodeFunctionData({
    abi: SAFE_ABI,
    functionName: "addOwnerWithThreshold",
    args: [getAddress(newOwner), BigInt(newThreshold)],
  }) as Hex;
}

export function buildRemoveOwnerData(owners: string[], ownerToRemove: string, newThreshold: number): Hex {
  const normalizedRemove = getAddress(ownerToRemove);
  const idx = owners.findIndex((o) => getAddress(o) === normalizedRemove);
  const prevOwner = idx === 0 ? SENTINEL_ADDRESS : owners[idx - 1];
  return encodeFunctionData({
    abi: SAFE_ABI,
    functionName: "removeOwner",
    args: [getAddress(prevOwner), normalizedRemove, BigInt(newThreshold)],
  }) as Hex;
}

export function buildChangeThresholdData(newThreshold: number): Hex {
  return encodeFunctionData({
    abi: SAFE_ABI,
    functionName: "changeThreshold",
    args: [BigInt(newThreshold)],
  }) as Hex;
}

/**
 * Add an owner to a Safe with threshold=1 (direct execution).
 */
export async function addOwnerSponsored(
  safeAddress: string,
  callerAddress: string,
  newOwner: string,
  newThreshold: number,
  authProvider?: string | null
): Promise<string> {
  const innerData = encodeFunctionData({
    abi: SAFE_ABI,
    functionName: "addOwnerWithThreshold",
    args: [getAddress(newOwner), BigInt(newThreshold)],
  });

  return await sendSafeOperation(safeAddress, innerData as Hex, callerAddress, authProvider);
}

/**
 * Remove an owner from a Safe with threshold=1 (direct execution).
 */
export async function removeOwnerSponsored(
  safeAddress: string,
  callerAddress: string,
  owners: string[],
  ownerToRemove: string,
  newThreshold: number,
  authProvider?: string | null
): Promise<string> {
  const normalizedRemove = getAddress(ownerToRemove);
  const idx = owners.findIndex((o) => getAddress(o) === normalizedRemove);
  const prevOwner = idx === 0 ? SENTINEL_ADDRESS : owners[idx - 1];

  const innerData = encodeFunctionData({
    abi: SAFE_ABI,
    functionName: "removeOwner",
    args: [getAddress(prevOwner), normalizedRemove, BigInt(newThreshold)],
  });

  return await sendSafeOperation(safeAddress, innerData as Hex, callerAddress, authProvider);
}

/**
 * Change threshold on a Safe with current threshold=1 (direct execution).
 */
export async function changeThresholdSponsored(
  safeAddress: string,
  callerAddress: string,
  newThreshold: number,
  authProvider?: string | null
): Promise<string> {
  const innerData = encodeFunctionData({
    abi: SAFE_ABI,
    functionName: "changeThreshold",
    args: [BigInt(newThreshold)],
  });

  return await sendSafeOperation(safeAddress, innerData as Hex, callerAddress, authProvider);
}

/**
 * Sign and confirm a pending proposal (for the Confirm button in PendingTransactions).
 * Signs the same EIP-712 typed data and submits to our backend.
 */
export async function signAndConfirmProposal(
  safeAddress: string,
  proposal: { to_address: string; data: string; nonce: number; safe_tx_hash: string },
  signerAddress: string,
  authProvider?: string | null
): Promise<void> {
  const safeTx = {
    to: getAddress(proposal.to_address),
    value: BigInt(0),
    data: proposal.data as Hex,
    operation: 0,
    safeTxGas: BigInt(0),
    baseGas: BigInt(0),
    gasPrice: BigInt(0),
    gasToken: ZERO_ADDRESS,
    refundReceiver: ZERO_ADDRESS,
    nonce: BigInt(proposal.nonce),
  };

  const signature = await signSafeTxEIP712(safeAddress, safeTx, signerAddress, authProvider);

  const res = await fetch("/api/relay/confirm", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      safeTxHash: proposal.safe_tx_hash,
      signerAddress,
      signature,
    }),
  });

  const result = await res.json();
  if (!res.ok) {
    throw new Error(result.error || "Failed to confirm");
  }
}
