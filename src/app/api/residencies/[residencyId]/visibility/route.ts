import { NextRequest, NextResponse } from "next/server";
import { isAddress } from "viem";
import { getResidency } from "@/lib/residencies-contract";
import { parseResidencyMetadataURI } from "@/lib/schemas/residency";
import { verifyHubSigner } from "@/lib/residencies-verify";
import { setResidencyHidden } from "@/lib/data/residencies";

export const dynamic = "force-dynamic";

/**
 * POST /api/residencies/[residencyId]/visibility
 * Body: { signer, hidden }
 *
 * Toggles the OFF-CHAIN `hidden` flag on a residency's metadata so a hub signer
 * can remove a mistaken residency from the public listings even when it can no
 * longer be cancelled on-chain (e.g. already Closed). This touches no on-chain
 * state and never changes the signed `metadataHash`; the residency stays
 * on-chain and reachable by direct link.
 *
 * Authorization mirrors the other off-chain hub mutations: the caller must be a
 * current Safe owner of the (approved) hub that owns the residency. No on-chain
 * transaction / signature is required since nothing on-chain changes.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ residencyId: string }> }
) {
  try {
    const { residencyId } = await params;
    if (!/^\d+$/.test(residencyId)) {
      return NextResponse.json({ error: "Invalid residency id" }, { status: 400 });
    }

    const body = await request.json();
    const signer: string = body.signer || "";
    const hidden = body.hidden;

    if (!isAddress(signer)) {
      return NextResponse.json({ error: "Missing or invalid signer" }, { status: 400 });
    }
    if (typeof hidden !== "boolean") {
      return NextResponse.json({ error: "`hidden` must be a boolean" }, { status: 400 });
    }

    // Resolve the residency + its hub from the authoritative on-chain record.
    const residency = await getResidency(BigInt(residencyId));
    if (!residency) {
      return NextResponse.json({ error: "Residency not found" }, { status: 404 });
    }
    const parsed = parseResidencyMetadataURI(residency.metadataURI);
    if (!parsed) {
      return NextResponse.json(
        { error: "Residency metadata is not off-chain; nothing to hide." },
        { status: 409 }
      );
    }

    // Only a current Safe owner of the (approved) hub may change visibility.
    const hubCheck = await verifyHubSigner(residency.hubSafe, signer);
    if (!hubCheck.ok) {
      return NextResponse.json({ error: hubCheck.error }, { status: 403 });
    }

    const ok = await setResidencyHidden(parsed.hubSafe, parsed.draftId, hidden);
    if (!ok) {
      return NextResponse.json(
        { error: "Residency metadata not found." },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true, hidden });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Internal server error";
    console.error("residency visibility error:", err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
