import { NextRequest, NextResponse } from "next/server";
import { getAddress } from "viem";
import { getHubSafeInfoOnChain } from "@/lib/safe";

/**
 * POST /api/relay/confirm
 *
 * Add a confirmation (signature) to a pending proposal.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { safeTxHash, signerAddress, signature } = body;

    if (!safeTxHash || !signerAddress || !signature) {
      return NextResponse.json(
        { error: "Missing required fields: safeTxHash, signerAddress, signature" },
        { status: 400 }
      );
    }

    const { getDb } = await import("@/lib/db");
    const sql = getDb();

    // Get the proposal
    const [proposal] = await sql`
      SELECT id, safe_address, threshold FROM safe_proposals
      WHERE safe_tx_hash = ${safeTxHash} AND status = 'pending'
    `;

    if (!proposal) {
      return NextResponse.json({ error: "Proposal not found" }, { status: 404 });
    }

    // Verify the signer is a Safe owner
    const safeInfo = await getHubSafeInfoOnChain(proposal.safe_address);
    if (!safeInfo) {
      return NextResponse.json({ error: "Safe not found on-chain" }, { status: 404 });
    }

    const normalizedSigner = getAddress(signerAddress);
    const isOwner = safeInfo.owners.some((o) => getAddress(o) === normalizedSigner);
    if (!isOwner) {
      return NextResponse.json({ error: "Signer is not a Safe owner" }, { status: 403 });
    }

    // Add confirmation
    await sql`
      INSERT INTO safe_confirmations (proposal_id, owner_address, signature)
      VALUES (${proposal.id}, ${normalizedSigner.toLowerCase()}, ${signature})
      ON CONFLICT (proposal_id, owner_address) DO UPDATE SET signature = EXCLUDED.signature
    `;

    // Count confirmations
    const [{ count }] = await sql`
      SELECT COUNT(*) as count FROM safe_confirmations WHERE proposal_id = ${proposal.id}
    `;

    return NextResponse.json({
      status: "confirmed",
      confirmations: Number(count),
      threshold: proposal.threshold,
      canExecute: Number(count) >= proposal.threshold,
    });
  } catch (err: any) {
    console.error("Confirm error:", err);
    return NextResponse.json(
      { error: err?.message || "Failed to confirm" },
      { status: 500 }
    );
  }
}
