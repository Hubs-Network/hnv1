import { NextRequest, NextResponse } from "next/server";
import { getAddress, recoverTypedDataAddress, type Hex } from "viem";
import { isHubAdmin } from "@/lib/safe";
import {
  isCanonicalSkillId,
  skillIdToHash,
  skillHashToId,
} from "@/lib/pilgrim-skills";
import {
  getDetailedClaim,
  submitApproveClaimAndMint,
  CLAIM_STATUS,
} from "@/lib/pilgrim-passport-sbt";
import { buildApproveClaimTypedData } from "@/lib/pilgrim-passport-message";
import { MAX_INITIAL_SKILLS, MIN_INITIAL_SKILLS } from "@/config/pilgrim-passport";

export const dynamic = "force-dynamic";

/**
 * POST /api/pilgrim-passport/claims/[claimId]/approve
 * Body: { approvedSkills: string[] (canonical IDs), signer, signatureDeadline,
 *         hubSignature }
 *
 * A Hub Safe owner approves a pending claim. The signer must be an owner of the
 * claim's hub Safe and must have signed the ApproveClaim EIP-712 message. The
 * relayer then submits approveClaimAndMint (gasless). The contract independently
 * enforces signer ownership and that approved skills were proposed.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ claimId: string }> }
) {
  try {
    const { claimId } = await params;
    const body = await request.json();
    const approvedSkills: string[] = Array.isArray(body.approvedSkills)
      ? body.approvedSkills
      : [];
    const signer: string = body.signer || "";
    const hubSignature: string = body.hubSignature || "";
    const signatureDeadline = BigInt(String(body.signatureDeadline ?? "0"));

    if (!claimId || !claimId.startsWith("0x")) {
      return NextResponse.json({ error: "Invalid claimId" }, { status: 400 });
    }
    if (!signer || !hubSignature) {
      return NextResponse.json({ error: "Missing signer or hubSignature" }, { status: 400 });
    }
    if (signatureDeadline <= BigInt(Math.floor(Date.now() / 1000))) {
      return NextResponse.json({ error: "Signature deadline expired" }, { status: 400 });
    }

    // 1. Read the claim authoritatively from chain (status + proposed skills
    //    reconstructed from the request tx). No DB dependency.
    const claim = await getDetailedClaim(claimId as Hex);
    if (!claim) {
      return NextResponse.json({ error: "Claim not found on-chain" }, { status: 404 });
    }
    if (claim.status !== CLAIM_STATUS.Pending) {
      return NextResponse.json({ error: "Claim is not pending on-chain" }, { status: 409 });
    }

    // 2. approvedSkills: 1..3, canonical, unique, subset of proposed.
    if (
      approvedSkills.length < MIN_INITIAL_SKILLS ||
      approvedSkills.length > MAX_INITIAL_SKILLS ||
      new Set(approvedSkills).size !== approvedSkills.length ||
      !approvedSkills.every(isCanonicalSkillId)
    ) {
      return NextResponse.json({ error: "Invalid approved skill selection" }, { status: 400 });
    }
    // Subset check against the reconstructed proposed skills (when available).
    // If reconstruction failed, the contract still enforces the subset rule.
    const proposedIds = claim.proposedSkillHashes
      .map((h) => skillHashToId(h))
      .filter(
        (id): id is NonNullable<ReturnType<typeof skillHashToId>> => id !== null
      );
    if (
      proposedIds.length > 0 &&
      !approvedSkills.every((s) => proposedIds.includes(s))
    ) {
      return NextResponse.json(
        { error: "Approved skills must be a subset of the proposed skills" },
        { status: 400 }
      );
    }

    // 3. Signer must be a current owner of the claim's hub Safe.
    if (!(await isHubAdmin(claim.hubSafe, signer))) {
      return NextResponse.json(
        { error: "Signer is not an owner of the hub Safe" },
        { status: 403 }
      );
    }

    // 4. Verify the hub owner's EIP-712 ApproveClaim signature.
    const approvedHashes = approvedSkills.map((id) => skillIdToHash(id));
    const td = buildApproveClaimTypedData({
      claimId: claimId as Hex,
      applicant: claim.applicant,
      hubSafe: claim.hubSafe,
      approvedSkills: approvedHashes,
      signer,
      signatureDeadline,
    });
    const recovered = await recoverTypedDataAddress({
      domain: td.domain,
      types: td.types,
      primaryType: "ApproveClaim",
      message: td.message,
      signature: hubSignature as Hex,
    });
    if (getAddress(recovered) !== getAddress(signer)) {
      return NextResponse.json({ error: "Approval signature does not match signer" }, { status: 401 });
    }

    // 6. Submit approveClaimAndMint via the relayer.
    const { txHash, tokenId } = await submitApproveClaimAndMint(
      {
        claimId: claimId as Hex,
        signer,
        approvedSkills: approvedHashes,
        signatureDeadline,
      },
      hubSignature as Hex,
      claim.applicant
    );

    // Minted state lives on-chain (claim.status = Minted, tokenOfOwner, getSkills).
    return NextResponse.json({ success: true, txHash, tokenId });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Internal server error";
    console.error("claim approve error:", err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
