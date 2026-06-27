import { NextRequest, NextResponse } from "next/server";
import { isAddress } from "viem";
import {
  getClaimNonce,
  getPassportTokenOfOwner,
} from "@/lib/pilgrim-passport-sbt";

export const dynamic = "force-dynamic";

/**
 * GET /api/pilgrim-passport/passport?owner=0x...
 *
 * Lightweight client helper returning the owner's Passport state and the
 * current claim nonce (needed to build a ClaimRequest before signing).
 */
export async function GET(request: NextRequest) {
  try {
    const owner = new URL(request.url).searchParams.get("owner");
    if (!owner || !isAddress(owner)) {
      return NextResponse.json({ error: "Invalid owner address" }, { status: 400 });
    }

    const [tokenId, claimNonce] = await Promise.all([
      getPassportTokenOfOwner(owner),
      getClaimNonce(owner),
    ]);

    return NextResponse.json({
      hasPassport: tokenId !== null,
      tokenId: tokenId !== null ? tokenId.toString() : null,
      claimNonce: claimNonce.toString(),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Internal server error";
    console.error("passport state error:", err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
