import { NextRequest, NextResponse } from "next/server";
import { isAddress } from "viem";
import { getSignerNonce } from "@/lib/residencies-contract";

export const dynamic = "force-dynamic";

/**
 * GET /api/residencies/nonce?signer=0x...
 *
 * Returns the current shared signerNonces(signer) from the Residencies contract.
 * The client must fetch this immediately before building typed data for any
 * residency action (apply / select / award / cancel).
 */
export async function GET(request: NextRequest) {
  try {
    const signer = request.nextUrl.searchParams.get("signer") || "";
    if (!isAddress(signer)) {
      return NextResponse.json({ error: "Invalid signer address" }, { status: 400 });
    }
    const nonce = await getSignerNonce(signer);
    return NextResponse.json({ nonce: nonce.toString() });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Internal server error";
    console.error("residency nonce error:", err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
