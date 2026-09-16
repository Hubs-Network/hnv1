import { NextRequest, NextResponse } from "next/server";
import { isAddress, type Hex } from "viem";
import {
  getResidency,
  getResidencySkills,
  isSelected,
  isAwarded,
  getSignerNonce,
  submitAwardPilgrim,
} from "@/lib/residencies-contract";
import { hasActiveAttestation } from "@/lib/pilgrim-passport-sbt";
import {
  buildAwardPilgrimTypedData,
  buildAttestSkillsTypedData,
} from "@/lib/residencies-message";
import { verifyHubSigner, verifyTypedSigner } from "@/lib/residencies-verify";
import { RESIDENCY_STATUS, MAX_AWARD_SKILLS } from "@/config/residencies";

export const dynamic = "force-dynamic";

/**
 * POST /api/residencies/[residencyId]/award
 * Body: { signer, pilgrimPassportTokenId, skillIds: bytes32[], nonce,
 *         signatureDeadline, residencyHubSignature, passportHubSignature }
 *
 * awardPilgrim internally calls PilgrimPassportSBT.attestSkills, so TWO hub
 * signatures are required (AwardPilgrim on the Residencies domain + AttestSkills
 * on the Passport domain), both over the SAME signatureDeadline.
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
    const tokenId = BigInt(String(body.pilgrimPassportTokenId ?? "0"));
    const rawSkills: unknown = body.skillIds;
    const nonce = BigInt(String(body.nonce ?? "-1"));
    const signatureDeadline = BigInt(String(body.signatureDeadline ?? "0"));
    const residencyHubSignature: string = body.residencyHubSignature || "";
    const passportHubSignature: string = body.passportHubSignature || "";

    if (
      !isAddress(signer) ||
      !residencyHubSignature ||
      !passportHubSignature ||
      !Array.isArray(rawSkills)
    ) {
      return NextResponse.json(
        { error: "Missing signer, skills or signatures" },
        { status: 400 }
      );
    }
    const skillIds = rawSkills.map((v) => String(v)) as Hex[];
    if (
      skillIds.length < 1 ||
      skillIds.length > MAX_AWARD_SKILLS ||
      !skillIds.every((s) => /^0x[a-fA-F0-9]{64}$/.test(s))
    ) {
      return NextResponse.json({ error: "Select 1–10 valid skills" }, { status: 400 });
    }
    if (new Set(skillIds.map((s) => s.toLowerCase())).size !== skillIds.length) {
      return NextResponse.json({ error: "Duplicate skill selected" }, { status: 400 });
    }
    if (tokenId <= BigInt(0)) {
      return NextResponse.json({ error: "Invalid passport token id" }, { status: 400 });
    }
    if (signatureDeadline <= BigInt(Math.floor(Date.now() / 1000))) {
      return NextResponse.json({ error: "Signature deadline expired" }, { status: 400 });
    }

    // Residency must exist and be Closed.
    const residency = await getResidency(id);
    if (!residency) {
      return NextResponse.json({ error: "Residency not found" }, { status: 404 });
    }
    if (residency.status !== RESIDENCY_STATUS.Closed) {
      return NextResponse.json(
        { error: "Awarding opens after the residency is closed." },
        { status: 409 }
      );
    }

    // Signer must be a Safe owner of the residency's hub.
    const hubCheck = await verifyHubSigner(residency.hubSafe, signer);
    if (!hubCheck.ok) {
      return NextResponse.json({ error: hubCheck.error }, { status: 403 });
    }

    // Pilgrim must be selected and not already awarded.
    if (!(await isSelected(id, tokenId))) {
      return NextResponse.json(
        { error: "This Pilgrim was not selected for this residency." },
        { status: 409 }
      );
    }
    if (await isAwarded(id, tokenId)) {
      return NextResponse.json(
        { error: "This Pilgrim has already been awarded for this residency." },
        { status: 409 }
      );
    }

    // Skills must be a subset of the residency skillset.
    const residencySkills = (await getResidencySkills(id)).map((s) => s.toLowerCase());
    const residencySet = new Set(residencySkills);
    if (!skillIds.every((s) => residencySet.has(s.toLowerCase()))) {
      return NextResponse.json(
        { error: "This skill is not part of the residency reward skillset." },
        { status: 409 }
      );
    }

    // Reject skills this hub has already actively attested (attestSkills would
    // revert with DuplicateAttestation).
    const activeFlags = await Promise.all(
      skillIds.map((s) => hasActiveAttestation(tokenId, s, residency.hubSafe))
    );
    if (activeFlags.some(Boolean)) {
      return NextResponse.json(
        {
          error:
            "One or more selected skills were already attested to this Passport by your Hub. Remove them and try again.",
        },
        { status: 409 }
      );
    }

    // Verify BOTH hub signatures (same signatureDeadline).
    const awardTd = buildAwardPilgrimTypedData({
      residencyId: id,
      pilgrimPassportTokenId: tokenId,
      signer,
      skillIds,
      nonce,
      signatureDeadline,
    });
    const awardOk = await verifyTypedSigner(
      {
        domain: awardTd.domain,
        types: awardTd.types,
        primaryType: awardTd.primaryType,
        message: awardTd.message as unknown as Record<string, unknown>,
      },
      residencyHubSignature,
      signer
    );
    if (!awardOk) {
      return NextResponse.json(
        { error: "Award signature verification failed. Please try again." },
        { status: 401 }
      );
    }

    const attestTd = buildAttestSkillsTypedData({
      tokenId,
      hubSafe: residency.hubSafe,
      signer,
      skillIds,
      signatureDeadline,
    });
    const attestOk = await verifyTypedSigner(
      {
        domain: attestTd.domain,
        types: attestTd.types,
        primaryType: attestTd.primaryType,
        message: attestTd.message as unknown as Record<string, unknown>,
      },
      passportHubSignature,
      signer
    );
    if (!attestOk) {
      return NextResponse.json(
        { error: "Attestation signature verification failed. Please try again." },
        { status: 401 }
      );
    }

    // Nonce freshness (AwardPilgrim uses the Residencies signerNonces).
    const onChainNonce = await getSignerNonce(signer);
    if (onChainNonce !== nonce) {
      return NextResponse.json(
        { error: "Your action expired or was already used. Refresh and try again." },
        { status: 409 }
      );
    }

    const { txHash } = await submitAwardPilgrim(
      {
        residencyId: id,
        pilgrimPassportTokenId: tokenId,
        signer,
        skillIds,
        nonce,
        signatureDeadline,
      },
      residencyHubSignature as Hex,
      passportHubSignature as Hex
    );

    return NextResponse.json({ success: true, txHash });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Internal server error";
    console.error("residency award error:", err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
