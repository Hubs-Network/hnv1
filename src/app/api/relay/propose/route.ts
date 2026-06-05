import { NextRequest, NextResponse } from "next/server";
import { getAddress, keccak256, encodeAbiParameters, concat } from "viem";
import { sepolia } from "viem/chains";
import { getHubSafeInfoOnChain } from "@/lib/safe";

const DOMAIN_SEPARATOR_TYPEHASH = keccak256(
  new TextEncoder().encode("EIP712Domain(uint256 chainId,address verifyingContract)")
);

const SAFE_TX_TYPEHASH = keccak256(
  new TextEncoder().encode(
    "SafeTx(address to,uint256 value,bytes data,uint8 operation,uint256 safeTxGas,uint256 baseGas,uint256 gasPrice,address gasToken,address refundReceiver,uint256 nonce)"
  )
);

function computeSafeTxHash(
  safeAddress: string,
  tx: { to: string; value: string; data: string; operation: number; safeTxGas: string; baseGas: string; gasPrice: string; gasToken: string; refundReceiver: string; nonce: number }
): string {
  const domainSeparator = keccak256(
    encodeAbiParameters(
      [{ type: "bytes32" }, { type: "uint256" }, { type: "address" }],
      [DOMAIN_SEPARATOR_TYPEHASH, BigInt(sepolia.id), getAddress(safeAddress) as `0x${string}`]
    )
  );

  const safeTxStructHash = keccak256(
    encodeAbiParameters(
      [
        { type: "bytes32" },
        { type: "address" },
        { type: "uint256" },
        { type: "bytes32" },
        { type: "uint8" },
        { type: "uint256" },
        { type: "uint256" },
        { type: "uint256" },
        { type: "address" },
        { type: "address" },
        { type: "uint256" },
      ],
      [
        SAFE_TX_TYPEHASH,
        getAddress(tx.to) as `0x${string}`,
        BigInt(tx.value),
        keccak256(tx.data as `0x${string}`),
        tx.operation,
        BigInt(tx.safeTxGas),
        BigInt(tx.baseGas),
        BigInt(tx.gasPrice),
        getAddress(tx.gasToken) as `0x${string}`,
        getAddress(tx.refundReceiver) as `0x${string}`,
        BigInt(tx.nonce),
      ]
    )
  );

  return keccak256(
    concat(["0x1901" as `0x${string}`, domainSeparator as `0x${string}`, safeTxStructHash as `0x${string}`])
  );
}

/**
 * POST /api/relay/propose
 *
 * Store a Safe transaction proposal in Neon DB.
 * The signer provides their EIP-712 signature. Other owners can then confirm.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      safeAddress,
      to,
      data,
      value,
      operation,
      safeTxGas,
      baseGas,
      gasPrice,
      gasToken,
      refundReceiver,
      nonce,
      signerAddress,
      signature,
      description,
      hubId,
    } = body;

    if (!safeAddress || !to || !data || !signerAddress || !signature) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    // Verify signer is a Safe owner
    const safeInfo = await getHubSafeInfoOnChain(safeAddress);
    if (!safeInfo) {
      return NextResponse.json({ error: "Safe not found on-chain" }, { status: 404 });
    }

    const normalizedSigner = getAddress(signerAddress);
    const isOwner = safeInfo.owners.some((o) => getAddress(o) === normalizedSigner);
    if (!isOwner) {
      return NextResponse.json({ error: "Signer is not a Safe owner" }, { status: 403 });
    }

    const txData = {
      to: getAddress(to),
      value: value || "0",
      data,
      operation: operation || 0,
      safeTxGas: safeTxGas || "0",
      baseGas: baseGas || "0",
      gasPrice: gasPrice || "0",
      gasToken: gasToken || "0x0000000000000000000000000000000000000000",
      refundReceiver: refundReceiver || "0x0000000000000000000000000000000000000000",
      nonce: nonce,
    };

    const safeTxHash = computeSafeTxHash(safeAddress, txData);

    const { getDb } = await import("@/lib/db");
    const sql = getDb();

    // Insert proposal
    await sql`
      INSERT INTO safe_proposals (
        safe_address, hub_id, to_address, value, data, operation,
        safe_tx_gas, base_gas, gas_price, gas_token, refund_receiver,
        nonce, safe_tx_hash, description, proposer, threshold
      ) VALUES (
        ${safeAddress.toLowerCase()},
        ${hubId || safeAddress.toLowerCase()},
        ${txData.to.toLowerCase()},
        ${txData.value},
        ${txData.data},
        ${txData.operation},
        ${txData.safeTxGas},
        ${txData.baseGas},
        ${txData.gasPrice},
        ${txData.gasToken},
        ${txData.refundReceiver},
        ${txData.nonce},
        ${safeTxHash},
        ${description || null},
        ${normalizedSigner.toLowerCase()},
        ${safeInfo.threshold}
      )
      ON CONFLICT (safe_tx_hash) DO NOTHING
    `;

    // Add the proposer's confirmation
    const [proposal] = await sql`
      SELECT id FROM safe_proposals WHERE safe_tx_hash = ${safeTxHash}
    `;

    if (proposal) {
      await sql`
        INSERT INTO safe_confirmations (proposal_id, owner_address, signature)
        VALUES (${proposal.id}, ${normalizedSigner.toLowerCase()}, ${signature})
        ON CONFLICT (proposal_id, owner_address) DO NOTHING
      `;
    }

    return NextResponse.json({ status: "proposed", safeTxHash });
  } catch (err: any) {
    console.error("Propose error:", err);
    return NextResponse.json(
      { error: err?.message || "Failed to propose transaction" },
      { status: 500 }
    );
  }
}
