import { NextRequest, NextResponse } from "next/server";
import { isAddress, getAddress } from "viem";
import { isCanonicalSkillId, skillIdToHash } from "@/lib/pilgrim-skills";
import { isHubApprovedOnChain } from "@/lib/hn-badge-sbt";
import {
  getClaimNonce,
  getPassportTokenOfOwner,
  getOnChainAppSigner,
} from "@/lib/pilgrim-passport-sbt";
import {
  getAppSignerAddress,
  signAppAuthorization,
} from "@/lib/pilgrim-passport-app-signer";
import { MAX_INITIAL_SKILLS, MIN_INITIAL_SKILLS } from "@/config/pilgrim-passport";

export const dynamic = "force-dynamic";

/**
 * POST /api/pilgrim-passport/app-authorization
 * Body: { applicant, hubSafe, proposedSkills: string[] (canonical IDs),
 *         applicantNonce: string, signatureDeadline: string }
 *
 * Validates the claim request server-side and returns the app signer's
 * EIP-712 AppAuthorization signature. The applicant must then sign the matching
 * ClaimRequest and submit both via POST /api/pilgrim-passport/claims.
 *
 * The app signer private key (PILGRIM_PASSPORT_APP_SIGNER_PRIVATE_KEY) is
 * server-only and never leaves the server.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const applicant: string = body.applicant || "";
    const hubSafe: string = body.hubSafe || "";
    const proposedSkills: string[] = Array.isArray(body.proposedSkills)
      ? body.proposedSkills
      : [];
    const applicantNonce: string = String(body.applicantNonce ?? "");
    const signatureDeadline: string = String(body.signatureDeadline ?? "");

    // 1. Valid addresses
    if (!isAddress(applicant)) {
      return NextResponse.json({ error: "Invalid applicant address" }, { status: 400 });
    }
    if (!isAddress(hubSafe)) {
      return NextResponse.json({ error: "Invalid hub Safe address" }, { status: 400 });
    }

    // 2. Skills: 1..3, canonical, no duplicates
    if (
      proposedSkills.length < MIN_INITIAL_SKILLS ||
      proposedSkills.length > MAX_INITIAL_SKILLS
    ) {
      return NextResponse.json(
        { error: `Select between ${MIN_INITIAL_SKILLS} and ${MAX_INITIAL_SKILLS} skills` },
        { status: 400 }
      );
    }
    if (new Set(proposedSkills).size !== proposedSkills.length) {
      return NextResponse.json({ error: "Duplicate skill selected" }, { status: 400 });
    }
    if (!proposedSkills.every(isCanonicalSkillId)) {
      return NextResponse.json({ error: "Non-canonical skill in selection" }, { status: 400 });
    }

    // 3. Deadline not expired
    const deadline = BigInt(signatureDeadline || "0");
    const nowSec = BigInt(Math.floor(Date.now() / 1000));
    if (deadline <= nowSec) {
      return NextResponse.json({ error: "Signature deadline already expired" }, { status: 400 });
    }

    // 4. Hub must be an approved Hub (holds the HN badge SBT)
    if (!(await isHubApprovedOnChain(hubSafe))) {
      return NextResponse.json({ error: "Hub is not approved" }, { status: 403 });
    }

    // 5. Applicant must not already have a Passport
    if ((await getPassportTokenOfOwner(applicant)) !== null) {
      return NextResponse.json({ error: "Applicant already has a Passport" }, { status: 409 });
    }

    // 6. Nonce must match the contract's current claim nonce for the applicant
    const onChainNonce = await getClaimNonce(applicant);
    if (BigInt(applicantNonce || "-1") !== onChainNonce) {
      return NextResponse.json(
        { error: "Stale nonce; refresh and try again", expectedNonce: onChainNonce.toString() },
        { status: 409 }
      );
    }

    // Sanity: the configured app signer must match the contract's appSigner.
    const localAppSigner = getAppSignerAddress();
    try {
      const onChainAppSigner = await getOnChainAppSigner();
      if (getAddress(onChainAppSigner) !== getAddress(localAppSigner)) {
        return NextResponse.json(
          { error: "App signer misconfiguration (server key != contract appSigner)" },
          { status: 500 }
        );
      }
    } catch {
      // If the read fails we proceed; the contract will still enforce the signer.
    }

    const skillHashes = proposedSkills.map((id) => skillIdToHash(id));
    const appSignature = await signAppAuthorization({
      applicant,
      hubSafe,
      proposedSkills: skillHashes,
      applicantNonce: onChainNonce,
      signatureDeadline: deadline,
    });

    return NextResponse.json({
      appSignature,
      appSigner: localAppSigner,
      applicant: getAddress(applicant),
      hubSafe: getAddress(hubSafe),
      proposedSkills,
      applicantNonce: onChainNonce.toString(),
      signatureDeadline: deadline.toString(),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Internal server error";
    console.error("app-authorization error:", err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
