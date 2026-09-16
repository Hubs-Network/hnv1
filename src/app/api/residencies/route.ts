import { NextRequest, NextResponse } from "next/server";
import { isAddress, type Hex } from "viem";
import {
  computeMetadataHash,
  buildResidencyMetadataURI,
} from "@/lib/schemas/residency";
import { skillIdToHashUniversal } from "@/lib/pilgrim-skills-catalog";
import {
  getSignerNonce,
  submitCreateResidency,
} from "@/lib/residencies-contract";
import { buildCreateResidencyTypedData } from "@/lib/residencies-message";
import { verifyHubSigner, verifyTypedSigner } from "@/lib/residencies-verify";
import { getResidencyMetadata, saveResidencyMetadata } from "@/lib/data/residencies";
import { listResidencyViews } from "@/lib/residencies-directory";

export const dynamic = "force-dynamic";

function toUnix(iso: string): bigint {
  return BigInt(Math.floor(Date.parse(iso) / 1000));
}

/** GET /api/residencies — list all residencies for the Bulletin Board. */
export async function GET() {
  try {
    const residencies = await listResidencyViews();
    return NextResponse.json({ residencies });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Internal server error";
    console.error("residencies list error:", err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/**
 * POST /api/residencies — submit a signed CreateResidency.
 *
 * Body: { hubSafe, signer, draftId, nonce, signatureDeadline, hubSignature }.
 * Authoritative values (skills, deadlines, metadataHash) are reconstructed from
 * the persisted draft metadata — never trusted from the client. The relayer
 * submits createResidency; the JSON is then updated with residencyId + txHash.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const hubSafe: string = body.hubSafe || "";
    const signer: string = body.signer || "";
    const draftId: string = body.draftId || "";
    const hubSignature: string = body.hubSignature || "";
    const nonce = BigInt(String(body.nonce ?? "-1"));
    const signatureDeadline = BigInt(String(body.signatureDeadline ?? "0"));

    if (!isAddress(hubSafe) || !isAddress(signer) || !draftId || !hubSignature) {
      return NextResponse.json(
        { error: "Missing required fields (hubSafe, signer, draftId, hubSignature)" },
        { status: 400 }
      );
    }
    if (signatureDeadline <= BigInt(Math.floor(Date.now() / 1000))) {
      return NextResponse.json({ error: "Signature deadline expired" }, { status: 400 });
    }

    // 1. Load the persisted draft metadata (authoritative for hash + skills).
    const metadata = await getResidencyMetadata(hubSafe, draftId);
    if (!metadata) {
      return NextResponse.json({ error: "Residency draft not found" }, { status: 404 });
    }

    // 2. Verify hub approved + signer is a Safe owner.
    const hubCheck = await verifyHubSigner(hubSafe, signer);
    if (!hubCheck.ok) {
      return NextResponse.json({ error: hubCheck.error }, { status: 403 });
    }

    // 3. Reconstruct authoritative values from metadata.
    const skillHashes = metadata.rewardedSkills.map((id) =>
      skillIdToHashUniversal(id)
    ) as Hex[];
    const metadataHash = computeMetadataHash(metadata);
    const metadataURI = buildResidencyMetadataURI(hubSafe, draftId);
    const applicationDeadline = toUnix(metadata.applicationDeadline);
    const startDate =
      metadata.isCalendarBound && metadata.startDate
        ? toUnix(metadata.startDate)
        : BigInt(0);
    const endDate =
      metadata.isCalendarBound && metadata.endDate
        ? toUnix(metadata.endDate)
        : BigInt(0);

    // 4. Verify the hub signature over the reconstructed CreateResidency data.
    const td = buildCreateResidencyTypedData({
      hubSafe,
      signer,
      metadataHash,
      skills: skillHashes,
      applicationDeadline,
      startDate,
      endDate,
      isCalendarBound: metadata.isCalendarBound,
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

    // 5. Nonce must match the current on-chain nonce (freshness).
    const onChainNonce = await getSignerNonce(signer);
    if (onChainNonce !== nonce) {
      return NextResponse.json(
        { error: "Your action expired or was already used. Refresh and try again." },
        { status: 409 }
      );
    }

    // 6. Relay createResidency.
    const { txHash, residencyId } = await submitCreateResidency(
      {
        hubSafe,
        signer,
        metadataURI,
        metadataHash,
        skills: skillHashes,
        applicationDeadline,
        startDate,
        endDate,
        isCalendarBound: metadata.isCalendarBound,
        nonce,
        signatureDeadline,
      },
      hubSignature as Hex
    );

    // 7. Update the JSON with residencyId + txHash (best-effort; metadata already
    //    persisted at prepare so the residency still resolves without this).
    try {
      await saveResidencyMetadata({
        ...metadata,
        ...(residencyId ? { residencyId } : {}),
        txHash,
      });
    } catch (persistErr) {
      const m = persistErr instanceof Error ? persistErr.message : "persist failed";
      return NextResponse.json({
        success: true,
        residencyId,
        txHash,
        persisted: false,
        warning: `Residency created on-chain but metadata update failed: ${m}`,
      });
    }

    return NextResponse.json({ success: true, residencyId, txHash });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Internal server error";
    console.error("residency create error:", err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
