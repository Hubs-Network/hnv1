import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { getAddress } from "viem";
import {
  createResidencyInputSchema,
  computeMetadataHash,
  buildResidencyMetadataURI,
  EXTERNAL_FORM_INSTRUCTIONS,
  RESIDENCY_METADATA_SCHEMA_ID,
  type ResidencyMetadata,
} from "@/lib/schemas/residency";
import {
  HUBS_NETWORK_RESIDENCIES_ADDRESS,
  RESIDENCIES_CHAIN_ID,
  MAX_RESIDENCY_SKILLS,
} from "@/config/residencies";
import { isAllowedSkillId, skillIdToHashUniversal } from "@/lib/pilgrim-skills-catalog";
import { isValidSkillOnChain } from "@/lib/pilgrim-passport-sbt";
import { getSignerNonce } from "@/lib/residencies-contract";
import { verifyHubSigner } from "@/lib/residencies-verify";
import { saveResidencyMetadata } from "@/lib/data/residencies";

export const dynamic = "force-dynamic";

const SIGNATURE_TTL_SECONDS = 10 * 60; // 10 minutes (per spec)

function toUnix(iso: string): bigint {
  return BigInt(Math.floor(Date.parse(iso) / 1000));
}

/**
 * POST /api/residencies/prepare
 *
 * Validates the create-residency form, verifies the hub is approved + the signer
 * is a Safe owner, persists the draft metadata JSON and returns the exact values
 * the hub signer must sign for CreateResidency (metadataHash is signed, not the
 * URI). No transaction is relayed here.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const parsed = createResidencyInputSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || "Invalid residency details" },
        { status: 400 }
      );
    }
    const input = parsed.data;

    // Verify hub approved + signer is a Safe owner.
    const hubCheck = await verifyHubSigner(input.hubSafe, input.createdBy);
    if (!hubCheck.ok) {
      return NextResponse.json({ error: hubCheck.error }, { status: 403 });
    }

    // Validate skills (1..10 unique, allowed, valid on-chain best-effort).
    const skills = input.rewardedSkills;
    if (
      skills.length < 1 ||
      skills.length > MAX_RESIDENCY_SKILLS ||
      new Set(skills).size !== skills.length
    ) {
      return NextResponse.json({ error: "Select 1–10 unique skills" }, { status: 400 });
    }
    const allowed = await Promise.all(skills.map(isAllowedSkillId));
    if (!allowed.every(Boolean)) {
      return NextResponse.json({ error: "Unknown skill in selection" }, { status: 400 });
    }
    const skillHashes = skills.map((id) => skillIdToHashUniversal(id));
    const validity = await Promise.all(skillHashes.map(isValidSkillOnChain));
    if (!validity.every(Boolean)) {
      return NextResponse.json(
        { error: "One or more skills are not valid in the contract" },
        { status: 400 }
      );
    }

    // Build metadata + hash + URI, then persist the draft.
    const draftId = randomUUID();
    const now = new Date().toISOString();
    const metaForHash: Omit<ResidencyMetadata, "residencyId" | "txHash"> = {
      schema: RESIDENCY_METADATA_SCHEMA_ID,
      chainId: RESIDENCIES_CHAIN_ID,
      contractAddress: getAddress(HUBS_NETWORK_RESIDENCIES_ADDRESS),
      hubSafe: getAddress(input.hubSafe),
      hubName: input.hubName,
      title: input.title,
      description: input.description,
      isCalendarBound: input.isCalendarBound,
      startDate: input.isCalendarBound ? input.startDate : undefined,
      endDate: input.isCalendarBound ? input.endDate : undefined,
      applicationDeadline: input.applicationDeadline,
      milestones: input.milestones,
      rewardedSkills: skills,
      externalFormLink: input.externalFormLink,
      externalFormInstructions: EXTERNAL_FORM_INSTRUCTIONS,
      createdBy: getAddress(input.createdBy),
      createdAt: now,
      draftId,
    };
    const metadataHash = computeMetadataHash(metaForHash);
    const metadataURI = buildResidencyMetadataURI(input.hubSafe, draftId);

    await saveResidencyMetadata({ ...metaForHash });

    // Signing params.
    const nonce = await getSignerNonce(input.createdBy);
    const signatureDeadline = BigInt(
      Math.floor(Date.now() / 1000) + SIGNATURE_TTL_SECONDS
    );
    const applicationDeadline = toUnix(input.applicationDeadline);
    const startDate = input.isCalendarBound ? toUnix(input.startDate!) : BigInt(0);
    const endDate = input.isCalendarBound ? toUnix(input.endDate!) : BigInt(0);

    return NextResponse.json({
      draftId,
      metadataURI,
      metadataHash,
      skillHashes,
      applicationDeadline: applicationDeadline.toString(),
      startDate: startDate.toString(),
      endDate: endDate.toString(),
      isCalendarBound: input.isCalendarBound,
      nonce: nonce.toString(),
      signatureDeadline: signatureDeadline.toString(),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Internal server error";
    console.error("residency prepare error:", err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
