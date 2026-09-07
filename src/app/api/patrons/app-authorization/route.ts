import { NextRequest, NextResponse } from "next/server";
import { isAddress, getAddress } from "viem";
import {
  isAllowedSkillId,
  skillIdToHashUniversal,
} from "@/lib/pilgrim-skills-catalog";
import {
  getApplicationNonce,
  getOnChainAppSigner,
  isValidPatronSkill,
} from "@/lib/patron-sbt";
import {
  getPatronAppSignerAddress,
  signPatronAppAuthorization,
} from "@/lib/patron-sbt-app-signer";
import { PATRON_SKILL_MIN, PATRON_SKILL_MAX } from "@/config/patron-sbt";

export const dynamic = "force-dynamic";

/**
 * POST /api/patrons/app-authorization
 * Body: { applicant, proposedSkills: string[10] (canonical/custom IDs) }
 *
 * Validates the Patron application server-side and returns the app signer's
 * EIP-712 AppAuthorization signature + the canonical on-chain nonce/deadline
 * the applicant must sign against. The app signer key is server-only.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const applicant: string = body.applicant || "";
    const proposedSkills: string[] = Array.isArray(body.proposedSkills)
      ? body.proposedSkills
      : [];

    if (!isAddress(applicant)) {
      return NextResponse.json({ error: "Invalid applicant address" }, { status: 400 });
    }

    // Between 1 and 10 unique canonical/custom skills.
    if (
      proposedSkills.length < PATRON_SKILL_MIN ||
      proposedSkills.length > PATRON_SKILL_MAX
    ) {
      return NextResponse.json(
        { error: `Select between ${PATRON_SKILL_MIN} and ${PATRON_SKILL_MAX} skills` },
        { status: 400 }
      );
    }
    if (new Set(proposedSkills).size !== proposedSkills.length) {
      return NextResponse.json({ error: "Duplicate skill selected" }, { status: 400 });
    }
    const allowed = await Promise.all(proposedSkills.map(isAllowedSkillId));
    if (!allowed.every(Boolean)) {
      return NextResponse.json({ error: "Unknown skill in selection" }, { status: 400 });
    }

    const skillHashes = proposedSkills.map((id) => skillIdToHashUniversal(id));

    // Best-effort on-chain validSkill check (contract is the final authority).
    const validity = await Promise.all(skillHashes.map(isValidPatronSkill));
    if (!validity.every(Boolean)) {
      return NextResponse.json(
        { error: "One or more skills are not valid in the Patron contract" },
        { status: 400 }
      );
    }

    // Signature deadline: 1 hour, mirrors the Pilgrim Passport strategy.
    const signatureDeadline = BigInt(Math.floor(Date.now() / 1000) + 60 * 60);

    // Canonical application nonce from chain (authoritative).
    const applicantNonce = await getApplicationNonce(applicant);

    // Sanity: configured app signer must equal the contract's appSigner.
    const localAppSigner = getPatronAppSignerAddress();
    try {
      const onChainAppSigner = await getOnChainAppSigner();
      if (getAddress(onChainAppSigner) !== getAddress(localAppSigner)) {
        return NextResponse.json(
          { error: "App signer misconfiguration (server key != contract appSigner)" },
          { status: 500 }
        );
      }
    } catch {
      // If the read fails we proceed; the contract still enforces the signer.
    }

    const appSignature = await signPatronAppAuthorization({
      applicant,
      proposedSkills: skillHashes,
      applicantNonce,
      signatureDeadline,
    });

    return NextResponse.json({
      appSignature,
      appSigner: localAppSigner,
      applicant: getAddress(applicant),
      proposedSkills,
      applicantNonce: applicantNonce.toString(),
      signatureDeadline: signatureDeadline.toString(),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Internal server error";
    console.error("patron app-authorization error:", err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
