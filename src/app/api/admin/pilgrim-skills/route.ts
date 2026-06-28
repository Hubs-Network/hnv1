import { NextRequest, NextResponse } from "next/server";
import { isAddress, getAddress, recoverTypedDataAddress, type Hex } from "viem";
import { isHNAdmin } from "@/lib/hn-admin";
import {
  computeSkillHash,
  slugifySkillId,
  isCanonicalSkillId,
} from "@/lib/pilgrim-skills";
import {
  isAllowedSkillId,
  isValidCategoryId,
} from "@/lib/pilgrim-skills-catalog";
import {
  getHNDirectorNonce,
  isValidSkillOnChain,
  submitSetSkillStatus,
} from "@/lib/pilgrim-passport-sbt";
import { buildSetSkillStatusTypedData } from "@/lib/pilgrim-passport-message";
import { addCustomSkill } from "@/lib/data/pilgrim-skills-store";

export const dynamic = "force-dynamic";

/**
 * GET /api/admin/pilgrim-skills?signer=0x...
 * Returns the HN Director's current SetSkillStatus nonce (needed to sign).
 */
export async function GET(request: NextRequest) {
  try {
    const signer = new URL(request.url).searchParams.get("signer");
    if (!signer || !isAddress(signer)) {
      return NextResponse.json({ error: "Invalid signer" }, { status: 400 });
    }
    if (!(await isHNAdmin(signer))) {
      return NextResponse.json({ error: "Not an HN Director" }, { status: 403 });
    }
    const nonce = await getHNDirectorNonce(signer);
    return NextResponse.json({ nonce: nonce.toString() });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Internal server error";
    console.error("pilgrim-skills nonce error:", err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/**
 * POST /api/admin/pilgrim-skills
 * Body: { label, categoryId, signer, nonce, signatureDeadline, signature }
 *
 * Adds a new skill to the PilgrimPassportSBT: relays setSkillStatusByHNDirector
 * (active=true) on the HN Director's behalf (gasless) and persists the off-chain
 * metadata (id/label/category) so the new skill renders as text in the frontend.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const label: string = typeof body.label === "string" ? body.label.trim() : "";
    const categoryId: string = body.categoryId || "";
    const signer: string = body.signer || "";
    const signature: string = body.signature || "";
    const nonce = BigInt(String(body.nonce ?? "-1"));
    const signatureDeadline = BigInt(String(body.signatureDeadline ?? "0"));

    if (!label) {
      return NextResponse.json({ error: "Skill label is required" }, { status: 400 });
    }
    if (!isValidCategoryId(categoryId)) {
      return NextResponse.json({ error: "Invalid category" }, { status: 400 });
    }
    if (!isAddress(signer) || !signature) {
      return NextResponse.json({ error: "Missing signer or signature" }, { status: 400 });
    }
    if (signatureDeadline <= BigInt(Math.floor(Date.now() / 1000))) {
      return NextResponse.json({ error: "Signature deadline expired" }, { status: 400 });
    }

    // Derive id + hash server-side (do not trust client-provided values).
    const id = slugifySkillId(label);
    if (!id) {
      return NextResponse.json(
        { error: "Label must contain letters or numbers" },
        { status: 400 }
      );
    }
    const skillHash = computeSkillHash(id);

    // Authorization: signer must be an HN Directors Safe owner.
    if (!(await isHNAdmin(signer))) {
      return NextResponse.json({ error: "Not an HN Director" }, { status: 403 });
    }

    // Uniqueness: not a canonical id, not an existing custom skill, not already
    // active on-chain.
    if (isCanonicalSkillId(id) || (await isAllowedSkillId(id))) {
      return NextResponse.json(
        { error: `Skill "${id}" already exists` },
        { status: 409 }
      );
    }
    if (await isValidSkillOnChain(skillHash)) {
      return NextResponse.json(
        { error: `Skill "${id}" is already active on-chain` },
        { status: 409 }
      );
    }

    // Nonce must match the contract's current HN Director nonce.
    const onChainNonce = await getHNDirectorNonce(signer);
    if (nonce !== onChainNonce) {
      return NextResponse.json(
        { error: "Stale nonce; refresh and try again", expectedNonce: onChainNonce.toString() },
        { status: 409 }
      );
    }

    // Pre-verify the HN Director's EIP-712 signature (the contract re-checks).
    const td = buildSetSkillStatusTypedData({
      skillId: skillHash,
      active: true,
      signer,
      nonce: onChainNonce,
      signatureDeadline,
    });
    const recovered = await recoverTypedDataAddress({
      domain: td.domain,
      types: td.types,
      primaryType: "SetSkillStatus",
      message: td.message,
      signature: signature as Hex,
    });
    if (getAddress(recovered) !== getAddress(signer)) {
      return NextResponse.json({ error: "Signature does not match signer" }, { status: 401 });
    }

    // Relay the on-chain activation.
    const { txHash } = await submitSetSkillStatus(
      {
        skillId: skillHash,
        active: true,
        signer,
        nonce: onChainNonce,
        signatureDeadline,
      },
      signature as Hex
    );

    // Persist off-chain metadata so the skill renders as text.
    const stored = await addCustomSkill({
      id,
      label,
      categoryId,
      hash: skillHash,
      addedBy: getAddress(signer),
      addedAt: new Date().toISOString(),
      txHash,
    });
    if (!stored) {
      // On-chain succeeded but a concurrent add already stored the id; not fatal.
      console.warn(`Custom skill ${id} on-chain but metadata already present`);
    }

    return NextResponse.json({ success: true, id, label, hash: skillHash, txHash });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Internal server error";
    console.error("pilgrim-skills add error:", err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
