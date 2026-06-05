import { NextRequest, NextResponse } from "next/server";
import { createPublicClient, createWalletClient, http, getAddress, Hex } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { sepolia } from "viem/chains";

const SAFE_ABI = [
  {
    name: "getOwners",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "address[]" }],
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

function getRelayerAccount() {
  const pk = process.env.RELAYER_PRIVATE_KEY;
  if (!pk) throw new Error("RELAYER_PRIVATE_KEY not configured");
  return privateKeyToAccount(pk as Hex);
}

function getRpcUrl() {
  return process.env.SEPOLIA_RPC_URL || process.env.NEXT_PUBLIC_SEPOLIA_RPC_URL || "https://eth-sepolia.g.alchemy.com/v2/demo";
}

/**
 * POST /api/relay
 *
 * Receives a pre-built execTransaction calldata + signer address,
 * verifies the signer is a Safe owner, then submits the tx via the relayer wallet.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { safeAddress, execData, signerAddress } = body;

    if (!safeAddress || !execData || !signerAddress) {
      return NextResponse.json(
        { error: "Missing required fields: safeAddress, execData, signerAddress" },
        { status: 400 }
      );
    }

    const normalizedSafe = getAddress(safeAddress);
    const normalizedSigner = getAddress(signerAddress);

    const rpcUrl = getRpcUrl();
    const publicClient = createPublicClient({
      chain: sepolia,
      transport: http(rpcUrl),
    });

    // Verify the signer is actually an owner of this Safe
    const owners = await publicClient.readContract({
      address: normalizedSafe,
      abi: SAFE_ABI,
      functionName: "getOwners",
    });

    const isOwner = (owners as string[]).some(
      (o) => getAddress(o) === normalizedSigner
    );

    if (!isOwner) {
      return NextResponse.json(
        { error: "Signer is not an owner of this Safe" },
        { status: 403 }
      );
    }

    // Send the transaction via the relayer
    const account = getRelayerAccount();
    const walletClient = createWalletClient({
      account,
      chain: sepolia,
      transport: http(rpcUrl),
    });

    const txHash = await walletClient.sendTransaction({
      to: normalizedSafe,
      data: execData as Hex,
      value: BigInt(0),
    });

    // Wait for receipt
    const receipt = await publicClient.waitForTransactionReceipt({ hash: txHash });

    if (receipt.status === "reverted") {
      return NextResponse.json(
        { error: "Transaction reverted on-chain" },
        { status: 500 }
      );
    }

    return NextResponse.json({ txHash, status: "success" });
  } catch (err: any) {
    console.error("Relay error:", err);
    return NextResponse.json(
      { error: err?.message || "Relay failed" },
      { status: 500 }
    );
  }
}
