import { NextRequest, NextResponse } from "next/server";
import { createPublicClient, createWalletClient, http, getAddress, encodeFunctionData, Hex, concat } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { sepolia } from "viem/chains";

const SAFE_EXEC_ABI = [
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
 * Sort signatures by owner address (ascending) as required by Safe contract.
 */
function buildCombinedSignatures(confirmations: { owner: string; signature: string }[]): Hex {
  const sorted = [...confirmations].sort((a, b) =>
    a.owner.toLowerCase().localeCompare(b.owner.toLowerCase())
  );
  const combined = sorted.map((c) => c.signature.replace("0x", "")).join("");
  return `0x${combined}` as Hex;
}

/**
 * POST /api/relay/execute
 *
 * Execute a proposal that has enough confirmations.
 * The relayer wallet submits the transaction on-chain.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { safeTxHash } = body;

    if (!safeTxHash) {
      return NextResponse.json({ error: "safeTxHash required" }, { status: 400 });
    }

    const { getDb } = await import("@/lib/db");
    const sql = getDb();

    // Get proposal with confirmations
    const [proposal] = await sql`
      SELECT * FROM safe_proposals WHERE safe_tx_hash = ${safeTxHash} AND status = 'pending'
    `;

    if (!proposal) {
      return NextResponse.json({ error: "Proposal not found or already executed" }, { status: 404 });
    }

    const confirmations = await sql`
      SELECT owner_address as owner, signature FROM safe_confirmations WHERE proposal_id = ${proposal.id}
    `;

    if (confirmations.length < proposal.threshold) {
      return NextResponse.json(
        { error: `Not enough confirmations. Have ${confirmations.length}, need ${proposal.threshold}` },
        { status: 400 }
      );
    }

    // Build combined signatures (sorted by address)
    const signatures = buildCombinedSignatures(
      confirmations.map((c: any) => ({ owner: c.owner, signature: c.signature }))
    );

    // Build execTransaction calldata
    const execData = encodeFunctionData({
      abi: SAFE_EXEC_ABI,
      functionName: "execTransaction",
      args: [
        getAddress(proposal.to_address) as `0x${string}`,
        BigInt(proposal.value),
        proposal.data as Hex,
        proposal.operation,
        BigInt(proposal.safe_tx_gas),
        BigInt(proposal.base_gas),
        BigInt(proposal.gas_price),
        getAddress(proposal.gas_token) as `0x${string}`,
        getAddress(proposal.refund_receiver) as `0x${string}`,
        signatures,
      ],
    });

    // Send via relayer
    const rpcUrl = getRpcUrl();
    const account = getRelayerAccount();
    const walletClient = createWalletClient({
      account,
      chain: sepolia,
      transport: http(rpcUrl),
    });
    const publicClient = createPublicClient({
      chain: sepolia,
      transport: http(rpcUrl),
    });

    const txHash = await walletClient.sendTransaction({
      to: getAddress(proposal.safe_address) as `0x${string}`,
      data: execData,
      value: BigInt(0),
    });

    const receipt = await publicClient.waitForTransactionReceipt({ hash: txHash });

    if (receipt.status === "reverted") {
      return NextResponse.json({ error: "Transaction reverted on-chain" }, { status: 500 });
    }

    // Mark as executed
    await sql`
      UPDATE safe_proposals
      SET status = 'executed', tx_hash = ${txHash}, executed_at = NOW()
      WHERE id = ${proposal.id}
    `;

    return NextResponse.json({ status: "executed", txHash });
  } catch (err: any) {
    console.error("Execute error:", err);
    return NextResponse.json(
      { error: err?.message || "Failed to execute" },
      { status: 500 }
    );
  }
}
