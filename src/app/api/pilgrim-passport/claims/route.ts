import { NextRequest, NextResponse } from "next/server";
import {
  isAddress,
  getAddress,
  recoverTypedDataAddress,
  type Hex,
} from "viem";
import {
  isCanonicalSkillId,
  skillIdToHash,
  skillHashToId,
} from "@/lib/pilgrim-skills";
import { isHubApprovedOnChain } from "@/lib/hn-badge-sbt";
import {
  getClaimNonce,
  getPassportTokenOfOwner,
  getApplicantClaims,
  getDetailedClaim,
  getDetailedClaimsForHub,
  submitRequestPassportClaim,
  CLAIM_STATUS,
} from "@/lib/pilgrim-passport-sbt";
import { getAppSignerAddress } from "@/lib/pilgrim-passport-app-signer";
import {
  buildClaimRequestTypedData,
  buildAppAuthorizationTypedData,
  computeClaimId,
  computeSkillsHash,
} from "@/lib/pilgrim-passport-message";
import { MAX_INITIAL_SKILLS, MIN_INITIAL_SKILLS } from "@/config/pilgrim-passport";

function statusLabel(status: number): string {
  switch (status) {
    case CLAIM_STATUS.Pending:
      return "pending";
    case CLAIM_STATUS.Minted:
      return "minted";
    case CLAIM_STATUS.Cancelled:
      return "cancelled";
    case CLAIM_STATUS.Rejected:
      return "rejected";
    default:
      return "none";
  }
}

function hashesToSkillIds(hashes: readonly string[]): string[] {
  return hashes
    .map((h) => skillHashToId(h))
    .filter((id): id is NonNullable<ReturnType<typeof skillHashToId>> => id !== null);
}

export const dynamic = "force-dynamic";

/**
 * GET /api/pilgrim-passport/claims?hubSafe=0x...
 * GET /api/pilgrim-passport/claims?applicant=0x...
 *
 * Claim listings are read authoritatively FROM CHAIN (status via claimRequests,
 * proposed skills reconstructed from the request tx calldata), so they work even
 * if the off-chain DB cache is empty/unavailable.
 * TODO: replace per-claim reads with an indexer / multicall batch for scale.
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const hubSafe = searchParams.get("hubSafe");
    const applicant = searchParams.get("applicant");

    if (hubSafe) {
      if (!isAddress(hubSafe)) {
        return NextResponse.json({ error: "Invalid hubSafe" }, { status: 400 });
      }
      const detailed = await getDetailedClaimsForHub(hubSafe, CLAIM_STATUS.Pending);
      const claims = detailed.map((d) => ({
        claimId: d.claimId,
        applicant: d.applicant,
        hubSafe: d.hubSafe,
        proposedSkills: hashesToSkillIds(d.proposedSkillHashes),
        status: "pending",
      }));
      return NextResponse.json({ claims });
    }

    if (applicant) {
      if (!isAddress(applicant)) {
        return NextResponse.json({ error: "Invalid applicant" }, { status: 400 });
      }
      const ids = await getApplicantClaims(applicant);
      const detailed = await Promise.all(ids.map((id) => getDetailedClaim(id)));
      const claims = detailed
        .filter((d) => d !== null)
        .map((d) => ({
          claimId: d!.claimId,
          applicant: d!.applicant,
          hubSafe: d!.hubSafe,
          proposedSkills: hashesToSkillIds(d!.proposedSkillHashes),
          status: statusLabel(d!.status),
        }));
      return NextResponse.json({ claims });
    }

    return NextResponse.json({ error: "Provide hubSafe or applicant" }, { status: 400 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Internal server error";
    console.error("claims GET error:", err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/**
 * POST /api/pilgrim-passport/claims
 * Body: { applicant, hubSafe, hubId, proposedSkills: string[] (IDs),
 *         applicantNonce, signatureDeadline, applicantSignature, appSignature }
 *
 * Re-validates, verifies both EIP-712 signatures, then submits
 * requestPassportClaim via the relayer (gasless) and persists the claim.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const applicant: string = body.applicant || "";
    const hubSafe: string = body.hubSafe || "";
    const proposedSkills: string[] = Array.isArray(body.proposedSkills)
      ? body.proposedSkills
      : [];
    const applicantSignature: string = body.applicantSignature || "";
    const appSignature: string = body.appSignature || "";

    if (!isAddress(applicant) || !isAddress(hubSafe)) {
      return NextResponse.json({ error: "Invalid applicant or hub Safe" }, { status: 400 });
    }
    if (!applicantSignature || !appSignature) {
      return NextResponse.json(
        { error: "Missing applicantSignature or appSignature" },
        { status: 400 }
      );
    }
    if (
      proposedSkills.length < MIN_INITIAL_SKILLS ||
      proposedSkills.length > MAX_INITIAL_SKILLS ||
      new Set(proposedSkills).size !== proposedSkills.length ||
      !proposedSkills.every(isCanonicalSkillId)
    ) {
      return NextResponse.json({ error: "Invalid skill selection" }, { status: 400 });
    }

    const deadline = BigInt(String(body.signatureDeadline ?? "0"));
    if (deadline <= BigInt(Math.floor(Date.now() / 1000))) {
      return NextResponse.json({ error: "Signature deadline expired" }, { status: 400 });
    }

    // Hub approved + applicant has no passport
    if (!(await isHubApprovedOnChain(hubSafe))) {
      return NextResponse.json({ error: "Hub is not approved" }, { status: 403 });
    }
    if ((await getPassportTokenOfOwner(applicant)) !== null) {
      return NextResponse.json({ error: "Applicant already has a Passport" }, { status: 409 });
    }

    // Nonce must match the contract.
    const onChainNonce = await getClaimNonce(applicant);
    if (BigInt(String(body.applicantNonce ?? "-1")) !== onChainNonce) {
      return NextResponse.json(
        { error: "Stale nonce; refresh and try again", expectedNonce: onChainNonce.toString() },
        { status: 409 }
      );
    }

    const skillHashes = proposedSkills.map((id) => skillIdToHash(id));

    // Pre-verify both signatures (the contract enforces this too, but failing
    // early avoids wasting relayer gas and yields clearer errors).
    const claimTd = buildClaimRequestTypedData({
      applicant,
      hubSafe,
      proposedSkills: skillHashes,
      applicantNonce: onChainNonce,
      signatureDeadline: deadline,
    });
    const recoveredApplicant = await recoverTypedDataAddress({
      domain: claimTd.domain,
      types: claimTd.types,
      primaryType: "ClaimRequest",
      message: claimTd.message,
      signature: applicantSignature as Hex,
    });
    if (getAddress(recoveredApplicant) !== getAddress(applicant)) {
      return NextResponse.json({ error: "Applicant signature does not match" }, { status: 401 });
    }

    const appTd = buildAppAuthorizationTypedData({
      applicant,
      hubSafe,
      proposedSkills: skillHashes,
      applicantNonce: onChainNonce,
      signatureDeadline: deadline,
    });
    const recoveredAppSigner = await recoverTypedDataAddress({
      domain: appTd.domain,
      types: appTd.types,
      primaryType: "AppAuthorization",
      message: appTd.message,
      signature: appSignature as Hex,
    });
    if (getAddress(recoveredAppSigner) !== getAddress(getAppSignerAddress())) {
      return NextResponse.json({ error: "App signature invalid" }, { status: 401 });
    }

    // Submit via relayer.
    const { txHash, claimId: eventClaimId } = await submitRequestPassportClaim(
      {
        applicant,
        hubSafe,
        proposedSkills: skillHashes,
        applicantNonce: onChainNonce,
        signatureDeadline: deadline,
      },
      applicantSignature as Hex,
      appSignature as Hex
    );

    // claimId is deterministic; the claim itself now lives entirely on-chain
    // (status via claimRequests, proposed skills recoverable from this tx).
    const claimId =
      eventClaimId ||
      computeClaimId({
        applicant,
        hubSafe,
        skillsHash: computeSkillsHash(skillHashes),
        applicantNonce: onChainNonce,
      });

    return NextResponse.json({ success: true, claimId, txHash });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Internal server error";
    console.error("claims POST error:", err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
