import { NextRequest, NextResponse } from "next/server";
import { isAddress, type Hex } from "viem";
import {
  getResidency,
  hasApplied,
  getSignerNonce,
  submitSelectPilgrimsAndClose,
} from "@/lib/residencies-contract";
import { buildSelectPilgrimsTypedData } from "@/lib/residencies-message";
import { verifyHubSigner, verifyTypedSigner } from "@/lib/residencies-verify";
import { RESIDENCY_STATUS, MAX_SELECTED_PILGRIMS } from "@/config/residencies";

export const dynamic = "force-dynamic";

/**
 * POST /api/residencies/[residencyId]/select
 * Body: { signer, pilgrimPassportTokenIds: string[], nonce, signatureDeadline, hubSignature }
 *
 * Only after the application deadline has passed. Hub signer must be a Safe
 * owner of the residency's hub. Each selected id must have applied.
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
    const rawIds: unknown = body.pilgrimPassportTokenIds;
    const nonce = BigInt(String(body.nonce ?? "-1"));
    const signatureDeadline = BigInt(String(body.signatureDeadline ?? "0"));
    const hubSignature: string = body.hubSignature || "";

    if (!isAddress(signer) || !hubSignature || !Array.isArray(rawIds)) {
      return NextResponse.json(
        { error: "Missing signer, selection or signature" },
        { status: 400 }
      );
    }
    const tokenIds = rawIds.map((v) => BigInt(String(v)));
    if (tokenIds.length < 1 || tokenIds.length > MAX_SELECTED_PILGRIMS) {
      return NextResponse.json(
        { error: `Select between 1 and ${MAX_SELECTED_PILGRIMS} applicants` },
        { status: 400 }
      );
    }
    if (new Set(tokenIds.map((t) => t.toString())).size !== tokenIds.length) {
      return NextResponse.json({ error: "Duplicate applicant selected" }, { status: 400 });
    }
    if (signatureDeadline <= BigInt(Math.floor(Date.now() / 1000))) {
      return NextResponse.json({ error: "Signature deadline expired" }, { status: 400 });
    }

    // Residency must exist, be open, and its application deadline must have passed.
    const residency = await getResidency(id);
    if (!residency) {
      return NextResponse.json({ error: "Residency not found" }, { status: 404 });
    }
    if (residency.status !== RESIDENCY_STATUS.Open) {
      return NextResponse.json(
        { error: "This residency is not open." },
        { status: 409 }
      );
    }
    if (Math.floor(Date.now() / 1000) <= residency.applicationDeadline) {
      return NextResponse.json(
        { error: "Selection opens after the application deadline." },
        { status: 409 }
      );
    }

    // Signer must be a Safe owner of the residency's hub.
    const hubCheck = await verifyHubSigner(residency.hubSafe, signer);
    if (!hubCheck.ok) {
      return NextResponse.json({ error: hubCheck.error }, { status: 403 });
    }

    // Each selected id must have applied.
    const appliedFlags = await Promise.all(tokenIds.map((t) => hasApplied(id, t)));
    if (!appliedFlags.every(Boolean)) {
      return NextResponse.json(
        { error: "You can only select applicants who applied." },
        { status: 409 }
      );
    }

    // Verify hub signature.
    const td = buildSelectPilgrimsTypedData({
      residencyId: id,
      signer,
      pilgrimPassportTokenIds: tokenIds,
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

    // Nonce freshness.
    const onChainNonce = await getSignerNonce(signer);
    if (onChainNonce !== nonce) {
      return NextResponse.json(
        { error: "Your action expired or was already used. Refresh and try again." },
        { status: 409 }
      );
    }

    const { txHash } = await submitSelectPilgrimsAndClose(
      {
        residencyId: id,
        signer,
        pilgrimPassportTokenIds: tokenIds,
        nonce,
        signatureDeadline,
      },
      hubSignature as Hex
    );

    return NextResponse.json({ success: true, txHash });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Internal server error";
    console.error("residency select error:", err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
