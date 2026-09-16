import { NextRequest, NextResponse } from "next/server";
import { isAddress, getAddress, type Hex } from "viem";
import {
  getResidency,
  isApplicationOpen,
  hasApplied,
  canApplyWithSkill,
  getSignerNonce,
  submitApplyToResidency,
} from "@/lib/residencies-contract";
import {
  getPassportTokenOfOwner,
  getPassportOwner,
} from "@/lib/pilgrim-passport-sbt";
import { buildApplyToResidencyTypedData } from "@/lib/residencies-message";
import { verifyTypedSigner } from "@/lib/residencies-verify";
import { RESIDENCY_STATUS } from "@/config/residencies";

export const dynamic = "force-dynamic";

/**
 * POST /api/residencies/[residencyId]/apply
 * Body: { pilgrim, pilgrimPassportTokenId, matchingSkill, nonce, signatureDeadline, pilgrimSignature }
 *
 * The pilgrim signs ApplyToResidency; the relayer submits. All critical checks
 * (passport ownership, matching skill, not-already-applied, open) are re-run
 * server-side before relaying.
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
    const pilgrim: string = body.pilgrim || "";
    const tokenId = BigInt(String(body.pilgrimPassportTokenId ?? "0"));
    const matchingSkill: string = body.matchingSkill || "";
    const nonce = BigInt(String(body.nonce ?? "-1"));
    const signatureDeadline = BigInt(String(body.signatureDeadline ?? "0"));
    const pilgrimSignature: string = body.pilgrimSignature || "";

    if (!isAddress(pilgrim) || !pilgrimSignature) {
      return NextResponse.json({ error: "Missing pilgrim or signature" }, { status: 400 });
    }
    if (!/^0x[a-fA-F0-9]{64}$/.test(matchingSkill)) {
      return NextResponse.json({ error: "Invalid matching skill" }, { status: 400 });
    }
    if (tokenId <= BigInt(0)) {
      return NextResponse.json({ error: "Invalid passport token id" }, { status: 400 });
    }
    if (signatureDeadline <= BigInt(Math.floor(Date.now() / 1000))) {
      return NextResponse.json({ error: "Signature deadline expired" }, { status: 400 });
    }

    // Residency must exist, be open and accepting applications.
    const residency = await getResidency(id);
    if (!residency) {
      return NextResponse.json({ error: "Residency not found" }, { status: 404 });
    }
    if (residency.status !== RESIDENCY_STATUS.Open) {
      return NextResponse.json(
        { error: "This residency is not open for applications." },
        { status: 409 }
      );
    }
    if (!(await isApplicationOpen(id))) {
      return NextResponse.json(
        { error: "Applications are closed for this residency." },
        { status: 409 }
      );
    }

    // Passport ownership: tokenOf(pilgrim) == tokenId AND ownerOf(tokenId) == pilgrim.
    const owned = await getPassportTokenOfOwner(pilgrim);
    if (owned === null || owned !== tokenId) {
      return NextResponse.json(
        { error: "Your wallet does not own this Pilgrim Passport." },
        { status: 403 }
      );
    }
    const owner = await getPassportOwner(tokenId);
    if (!owner || getAddress(owner) !== getAddress(pilgrim)) {
      return NextResponse.json(
        { error: "Passport ownership mismatch." },
        { status: 403 }
      );
    }

    // Must not have already applied.
    if (await hasApplied(id, tokenId)) {
      return NextResponse.json(
        { error: "You already applied to this residency." },
        { status: 409 }
      );
    }

    // Matching skill must be required by the residency AND held by the pilgrim.
    if (!(await canApplyWithSkill(id, tokenId, matchingSkill as Hex))) {
      return NextResponse.json(
        { error: "Your Passport does not include a matching skill for this residency." },
        { status: 409 }
      );
    }

    // Verify the pilgrim signature.
    const td = buildApplyToResidencyTypedData({
      residencyId: id,
      pilgrim,
      pilgrimPassportTokenId: tokenId,
      matchingSkill: matchingSkill as Hex,
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
      pilgrimSignature,
      pilgrim
    );
    if (!sigOk) {
      return NextResponse.json(
        { error: "Signature verification failed. Please try again." },
        { status: 401 }
      );
    }

    // Nonce freshness.
    const onChainNonce = await getSignerNonce(pilgrim);
    if (onChainNonce !== nonce) {
      return NextResponse.json(
        { error: "Your action expired or was already used. Refresh and try again." },
        { status: 409 }
      );
    }

    const { txHash } = await submitApplyToResidency(
      {
        residencyId: id,
        pilgrim,
        pilgrimPassportTokenId: tokenId,
        matchingSkill: matchingSkill as Hex,
        nonce,
        signatureDeadline,
      },
      pilgrimSignature as Hex
    );

    return NextResponse.json({ success: true, txHash });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Internal server error";
    console.error("residency apply error:", err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
