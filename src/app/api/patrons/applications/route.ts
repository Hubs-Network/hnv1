import { NextRequest, NextResponse } from "next/server";
import {
  isAddress,
  getAddress,
  recoverTypedDataAddress,
  type Hex,
} from "viem";
import {
  isAllowedSkillId,
  skillIdToHashUniversal,
  resolveSkillIds,
  resolveSkillLabelByHash,
} from "@/lib/pilgrim-skills-catalog";
import {
  getApplicationNonce,
  getOnChainApplication,
  getApplicationSkills,
  submitRequestPatronApplication,
  PATRON_STATUS,
} from "@/lib/patron-sbt";
import { getPatronAppSignerAddress } from "@/lib/patron-sbt-app-signer";
import {
  buildPatronApplicationTypedData,
  buildPatronAppAuthorizationTypedData,
  computePatronApplicationId,
  computeSkillsHash,
} from "@/lib/patron-sbt-message";
import { PATRON_SKILL_MIN, PATRON_SKILL_MAX, PATRON_SBT_ADDRESS, PATRON_SBT_CHAIN_ID } from "@/config/patron-sbt";
import { patronFormSchema, type PatronProfile } from "@/lib/schemas/patron";
import { getAllPatrons, getPatronById, savePatron } from "@/lib/data/patrons";
import { isHNAdmin } from "@/lib/hn-admin";

export const dynamic = "force-dynamic";

/**
 * GET /api/patrons/applications  (HN admin only)
 * Lists PENDING patron applications reconciled against the contract. Company
 * metadata comes from GitHub JSON; applicant + skills come from chain.
 */
export async function GET(request: NextRequest) {
  try {
    const wallet = request.headers.get("x-wallet-address") || "";
    if (!isAddress(wallet) || !(await isHNAdmin(wallet))) {
      return NextResponse.json(
        { error: "Not an HN Directors Safe owner" },
        { status: 403 }
      );
    }

    const profiles = await getAllPatrons();
    const applications = (
      await Promise.all(
        profiles.map(async (p) => {
          const onChain = await getOnChainApplication(p.applicationId as Hex);
          // Only status Pending (1) is actionable; contract is authoritative.
          if (!onChain || onChain.status !== PATRON_STATUS.Pending) return null;

          const hashes = await getApplicationSkills(p.applicationId as Hex);
          const skillIds = await resolveSkillIds(hashes);
          const skills = await Promise.all(
            hashes.map(async (h) => ({
              hash: h,
              label: await resolveSkillLabelByHash(h),
            }))
          );

          return {
            applicationId: p.applicationId,
            applicant: onChain.applicant,
            companyName: p.companyName,
            description: p.description,
            website: p.website,
            contact: p.contact,
            createdAt: p.createdAt,
            skillIds,
            skills, // [{ hash, label }] in on-chain order
            skillHashes: hashes,
          };
        })
      )
    ).filter((a): a is NonNullable<typeof a> => a !== null);

    return NextResponse.json({ applications });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Internal server error";
    console.error("patron applications GET error:", err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/**
 * POST /api/patrons/applications
 * Body: { applicant, proposedSkills: string[10], applicantNonce, signatureDeadline,
 *         applicantSignature, appSignature, companyName, description, website, contact }
 *
 * Verifies both EIP-712 signatures, submits requestPatronApplication via the
 * relayer (gasless), then persists the company JSON.
 *
 * Idempotent: if the application already exists on-chain (e.g. a retry after a
 * GitHub write failure), it does NOT resubmit — it only (re)persists the JSON.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const applicant: string = body.applicant || "";
    const proposedSkills: string[] = Array.isArray(body.proposedSkills)
      ? body.proposedSkills
      : [];
    const applicantSignature: string = body.applicantSignature || "";
    const appSignature: string = body.appSignature || "";

    if (!isAddress(applicant)) {
      return NextResponse.json({ error: "Invalid applicant" }, { status: 400 });
    }

    // Company fields
    const parsed = patronFormSchema.safeParse({
      companyName: body.companyName,
      description: body.description,
      website: body.website,
      contact: body.contact,
    });
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || "Invalid company details" },
        { status: 400 }
      );
    }
    const company = parsed.data;

    // Between 1 and 10 unique allowed skills.
    const allowed = await Promise.all(proposedSkills.map(isAllowedSkillId));
    if (
      proposedSkills.length < PATRON_SKILL_MIN ||
      proposedSkills.length > PATRON_SKILL_MAX ||
      new Set(proposedSkills).size !== proposedSkills.length ||
      !allowed.every(Boolean)
    ) {
      return NextResponse.json({ error: "Invalid skill selection" }, { status: 400 });
    }

    const deadline = BigInt(String(body.signatureDeadline ?? "0"));
    if (deadline <= BigInt(Math.floor(Date.now() / 1000))) {
      return NextResponse.json({ error: "Signature deadline expired" }, { status: 400 });
    }

    const applicantNonce = BigInt(String(body.applicantNonce ?? "-1"));
    const skillHashes = proposedSkills.map((id) => skillIdToHashUniversal(id));
    const skillsHash = computeSkillsHash(skillHashes);
    const applicationId = computePatronApplicationId({
      applicant,
      skillsHash,
      applicantNonce,
    });

    const now = new Date().toISOString();

    function buildProfile(
      overrides: Partial<PatronProfile>,
      existing: PatronProfile | null
    ): PatronProfile {
      return {
        applicationId,
        applicant: getAddress(applicant),
        companyName: company.companyName,
        description: company.description,
        website: company.website,
        contact: company.contact,
        chainId: PATRON_SBT_CHAIN_ID,
        contractAddress: getAddress(PATRON_SBT_ADDRESS),
        status: "pending",
        createdAt: existing?.createdAt || now,
        applicationTxHash: existing?.applicationTxHash,
        // preserve lifecycle fields if a later state somehow exists
        tokenId: existing?.tokenId,
        approvedAt: existing?.approvedAt,
        approvedBy: existing?.approvedBy,
        approvalTxHash: existing?.approvalTxHash,
        rejectedAt: existing?.rejectedAt,
        rejectedBy: existing?.rejectedBy,
        rejectionTxHash: existing?.rejectionTxHash,
        updatedAt: now,
        ...overrides,
      };
    }

    // ── Idempotency: application already on-chain (retry path) ──────────
    const existingOnChain = await getOnChainApplication(applicationId);
    const existingProfile = await getPatronById(applicationId);
    if (existingOnChain) {
      // Do NOT resubmit (nonce/digest already consumed). Just (re)persist JSON.
      try {
        await savePatron(buildProfile({}, existingProfile));
      } catch (persistErr) {
        const m = persistErr instanceof Error ? persistErr.message : "persist failed";
        return NextResponse.json(
          {
            error: `Application exists on-chain but JSON persistence failed: ${m}`,
            applicationId,
            applicationTxHash: existingProfile?.applicationTxHash ?? null,
            persisted: false,
          },
          { status: 500 }
        );
      }
      return NextResponse.json({
        success: true,
        applicationId,
        applicationTxHash: existingProfile?.applicationTxHash ?? null,
        alreadyOnChain: true,
      });
    }

    // ── New application: verify both signatures before spending gas ─────
    if (!applicantSignature || !appSignature) {
      return NextResponse.json(
        { error: "Missing applicantSignature or appSignature" },
        { status: 400 }
      );
    }

    // Nonce must match the contract.
    const onChainNonce = await getApplicationNonce(applicant);
    if (applicantNonce !== onChainNonce) {
      return NextResponse.json(
        { error: "Stale nonce; refresh and try again", expectedNonce: onChainNonce.toString() },
        { status: 409 }
      );
    }

    const appTd = buildPatronApplicationTypedData({
      applicant,
      proposedSkills: skillHashes,
      applicantNonce: onChainNonce,
      signatureDeadline: deadline,
    });
    const recoveredApplicant = await recoverTypedDataAddress({
      domain: appTd.domain,
      types: appTd.types,
      primaryType: "PatronApplication",
      message: appTd.message,
      signature: applicantSignature as Hex,
    });
    if (getAddress(recoveredApplicant) !== getAddress(applicant)) {
      return NextResponse.json({ error: "Applicant signature does not match" }, { status: 401 });
    }

    const authTd = buildPatronAppAuthorizationTypedData({
      applicant,
      proposedSkills: skillHashes,
      applicantNonce: onChainNonce,
      signatureDeadline: deadline,
    });
    const recoveredAppSigner = await recoverTypedDataAddress({
      domain: authTd.domain,
      types: authTd.types,
      primaryType: "AppAuthorization",
      message: authTd.message,
      signature: appSignature as Hex,
    });
    if (getAddress(recoveredAppSigner) !== getAddress(getPatronAppSignerAddress())) {
      return NextResponse.json({ error: "App signature invalid" }, { status: 401 });
    }

    // Submit via relayer.
    const { txHash, applicationId: eventId } = await submitRequestPatronApplication(
      {
        applicant,
        proposedSkills: skillHashes,
        applicantNonce: onChainNonce,
        signatureDeadline: deadline,
      },
      applicantSignature as Hex,
      appSignature as Hex
    );

    const finalId = (eventId as Hex) || applicationId;

    // Persist JSON. If this fails, the on-chain application already succeeded,
    // so return enough info to retry persistence (idempotent POST above).
    try {
      await savePatron(
        buildProfile({ applicationId: finalId, applicationTxHash: txHash }, existingProfile)
      );
    } catch (persistErr) {
      const m = persistErr instanceof Error ? persistErr.message : "persist failed";
      return NextResponse.json(
        {
          error: `Application created on-chain (tx ${txHash}) but JSON persistence failed: ${m}. Retry to persist without recreating.`,
          applicationId: finalId,
          applicationTxHash: txHash,
          persisted: false,
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      applicationId: finalId,
      applicationTxHash: txHash,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Internal server error";
    console.error("patron applications POST error:", err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
