import { NextRequest, NextResponse } from "next/server";
import { isAddress, getAddress } from "viem";
import { getHubById } from "@/lib/data/hubs";
import { updateProfileInRepo } from "@/lib/github/adapter";
import { isHNAdmin } from "@/lib/hn-admin";
import { isHubApprovedOnChain, mintHNBadgeToHub } from "@/lib/hn-badge-sbt";
import { recoverHNBadgeSigner } from "@/lib/hn-badge-verify";
import type { HubProfile } from "@/types";

/**
 * POST /api/admin/hn-badge/applications/[hubId]/approve
 * Body: { signature: string, issuedAt: string }
 *
 * HN admin approves a pending badge application. The approver must sign the
 * action; the server recovers the signer and verifies it is an HN Directors
 * Safe owner. The relayer then mints the SBT and the hub JSON is set "approved".
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ hubId: string }> }
) {
  try {
    const { hubId } = await params;
    const body = await request.json();
    const signature: string = body.signature || "";
    const issuedAt: string = body.issuedAt || "";

    if (!signature || !issuedAt) {
      return NextResponse.json(
        { error: "Signed approval required (signature, issuedAt)" },
        { status: 400 }
      );
    }

    // Recover signer from the signed action (never trust a client-supplied address)
    const approverAddress = await recoverHNBadgeSigner({
      action: "approve",
      hubId,
      issuedAt,
      signature,
    });

    if (!approverAddress) {
      return NextResponse.json(
        { error: "Invalid or expired approval signature" },
        { status: 401 }
      );
    }

    // 1. Hub exists
    const hub = await getHubById(hubId);
    if (!hub) {
      return NextResponse.json({ error: "Hub not found" }, { status: 404 });
    }

    // 2. Hub Safe address valid
    const hubSafe = hub.safeAddress || hubId;
    if (!isAddress(hubSafe)) {
      return NextResponse.json(
        { error: "Hub does not have a valid Safe address" },
        { status: 400 }
      );
    }

    // 3. Pending application
    if ((hub.hnBadgeStatus || "none") !== "pending") {
      return NextResponse.json(
        { error: "Hub does not have a pending application" },
        { status: 409 }
      );
    }

    // 4. Recovered signer is an HN Directors Safe owner (server-side, on-chain)
    const allowed = await isHNAdmin(approverAddress);
    if (!allowed) {
      return NextResponse.json(
        { error: "Approver is not an HN Directors Safe owner" },
        { status: 403 }
      );
    }

    // 5. Hub must not already hold the SBT
    const alreadyApproved = await isHubApprovedOnChain(hubSafe);
    if (alreadyApproved) {
      return NextResponse.json(
        { error: "Hub already has the Hubs Network Badge on-chain" },
        { status: 409 }
      );
    }

    // 6. Relayer mints the badge
    const { txHash, tokenId } = await mintHNBadgeToHub(hubSafe, approverAddress);

    // 7. Update hub JSON
    const now = new Date().toISOString();
    const updatedProfile: HubProfile = {
      ...hub,
      hnBadgeStatus: "approved",
      ...(tokenId ? { hnBadgeTokenId: tokenId } : {}),
      hnBadgeApprovedAt: now,
      hnBadgeApprovedBy: getAddress(approverAddress),
      hnBadgeTxHash: txHash,
      metadata: { ...hub.metadata, updated_at: now },
    };

    const result = await updateProfileInRepo("hub", updatedProfile);
    if (!result.success) {
      // SBT was minted but JSON failed; surface so it can be retried/reconciled.
      return NextResponse.json(
        {
          error: `Badge minted (tx ${txHash}) but failed to persist hub status: ${result.error}`,
          txHash,
          tokenId,
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      hnBadgeStatus: "approved",
      txHash,
      tokenId,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Internal server error";
    console.error("HN badge approve error:", err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
