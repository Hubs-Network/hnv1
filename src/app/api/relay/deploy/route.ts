import { NextRequest, NextResponse } from "next/server";
import { createPublicClient, createWalletClient, http, Hex } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { sepolia } from "viem/chains";

function getRelayerAccount() {
  const pk = process.env.RELAYER_PRIVATE_KEY;
  if (!pk) throw new Error("RELAYER_PRIVATE_KEY not configured");
  return privateKeyToAccount(pk as Hex);
}

function getRpcUrl() {
  return process.env.SEPOLIA_RPC_URL || process.env.NEXT_PUBLIC_SEPOLIA_RPC_URL || "https://eth-sepolia.g.alchemy.com/v2/demo";
}

/**
 * POST /api/relay/deploy
 *
 * Deploy a Safe contract via the relayer wallet.
 * Used for injected wallet users who can't use Magic Smart Account.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { to, data, ownerAddress } = body;

    if (!to || !data || !ownerAddress) {
      return NextResponse.json(
        { error: "Missing required fields: to, data, ownerAddress" },
        { status: 400 }
      );
    }

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
      to: to as `0x${string}`,
      data: data as Hex,
      value: BigInt(0),
    });

    const receipt = await publicClient.waitForTransactionReceipt({ hash: txHash });

    if (receipt.status === "reverted") {
      return NextResponse.json(
        { error: "Safe deployment transaction reverted" },
        { status: 500 }
      );
    }

    return NextResponse.json({ txHash, status: "deployed" });
  } catch (err: any) {
    console.error("Deploy relay error:", err);
    return NextResponse.json(
      { error: err?.message || "Deployment failed" },
      { status: 500 }
    );
  }
}
