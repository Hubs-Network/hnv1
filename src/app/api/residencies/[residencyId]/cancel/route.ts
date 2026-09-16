import { NextRequest, NextResponse } from "next/server";
import { isAddress, type Hex } from "viem";
import {
  getResidency,
  getSignerNonce,
  submitCancelResidency,
} from "@/lib/residencies-contract";
import { buildCancelResidencyTypedData } from "@/lib/residencies-message";
import { verifyHubSigner, verifyTypedSigner } from "@/lib/residencies-verify";
import { RESIDENCY_STATUS } from "@/config/residencies";

export const dynamic = "force-dynamic";

/**
 * POST /api/residencies/[residencyId]/cancel
 * Body: { signer, nonce, signatureDeadline, hubSignature }
 *
 * Cancels an OPEN residency. Hub signer must be a Safe owner of the hub.
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
    const id = BigInt(residencyId);

    const body = await request.json();
    const signer: string = body.signer || "";
    const nonce = BigInt(String(body.nonce ?? "-1"));
    const signatureDeadline = BigInt(String(body.signatureDeadline ?? "0"));
    const hubSignature: string = body.hubSignature || "";

    if (!isAddress(signer) || !hubSignature) {
      return NextResponse.json({ error: "Missing signer or signature" }, { status: 400 });
    }
    if (signatureDeadline <= BigInt(Math.floor(Date.now() / 1000))) {
      return NextResponse.json({ error: "Signature deadline expired" }, { status: 400 });
    }

    const residency = await getResidency(id);
    if (!residency) {
      return NextResponse.json({ error: "Residency not found" }, { status: 404 });
    }
    if (residency.status !== RESIDENCY_STATUS.Open) {
      return NextResponse.json(
        { error: "Only an open residency can be cancelled." },
        { status: 409 }
      );
    }

    const hubCheck = await verifyHubSigner(residency.hubSafe, signer);
    if (!hubCheck.ok) {
      return NextResponse.json({ error: hubCheck.error }, { status: 403 });
    }

    const td = buildCancelResidencyTypedData({
      residencyId: id,
      signer,
      nonce,
      signatureDeadline,
    });
    const sigOk = await verifyTypedSigner(
      {
        domain: td.domain,
        types: td.types,
        primaryType: td.primaryType,
        message: td.message as unknown as Record<string, unknown>,
      },
      hubSignature,
      signer
    );
    if (!sigOk) {
      return NextResponse.json(
        { error: "Signature verification failed. Please try again." },
        { status: 401 }
      );
    }

    const onChainNonce = await getSignerNonce(signer);
    if (onChainNonce !== nonce) {
      return NextResponse.json(
        { error: "Your action expired or was already used. Refresh and try again." },
        { status: 409 }
      );
    }

    const { txHash } = await submitCancelResidency(
      { residencyId: id, signer, nonce, signatureDeadline },
      hubSignature as Hex
    );

    return NextResponse.json({ success: true, txHash });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Internal server error";
    console.error("residency cancel error:", err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
