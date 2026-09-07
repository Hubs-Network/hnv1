import { NextRequest, NextResponse } from "next/server";
import { isAddress, type Hex } from "viem";
import { resolveSkillLabelByHash } from "@/lib/pilgrim-skills-catalog";
import {
  getApplicantApplications,
  getOnChainApplication,
  getApplicationSkills,
  getPatronSkills,
  isActivePatron,
  PATRON_STATUS,
} from "@/lib/patron-sbt";
import { getPatronById } from "@/lib/data/patrons";

export const dynamic = "force-dynamic";

/**
 * GET /api/patrons/mine?applicant=0x...
 * Returns every application the wallet ever submitted, reconciled with the
 * contract (Pending / Approved / Rejected / Revoked). Contact is included
 * because this is the applicant viewing their own records.
 */
export async function GET(request: NextRequest) {
  try {
    const applicant = new URL(request.url).searchParams.get("applicant") || "";
    if (!isAddress(applicant)) {
      return NextResponse.json({ error: "Invalid applicant" }, { status: 400 });
    }

    const ids = await getApplicantApplications(applicant);
    const patrons = (
      await Promise.all(
        ids.map(async (id) => {
          const onChain = await getOnChainApplication(id as Hex);
          if (!onChain) return null;

          let status: "pending" | "approved" | "rejected" | "revoked";
          let active = false;
          if (onChain.status === PATRON_STATUS.Pending) {
            status = "pending";
          } else if (onChain.status === PATRON_STATUS.Rejected) {
            status = "rejected";
          } else if (onChain.status === PATRON_STATUS.Minted) {
            active = await isActivePatron(onChain.tokenId);
            status = active ? "approved" : "revoked";
          } else {
            return null;
          }

          // Read skills from the token once minted, else from the application.
          const hashes =
            onChain.status === PATRON_STATUS.Minted
              ? await getPatronSkills(onChain.tokenId)
              : await getApplicationSkills(id as Hex);
          const skills = await Promise.all(
            hashes.map(async (h) => ({
              hash: h,
              label: await resolveSkillLabelByHash(h),
            }))
          );

          const profile = await getPatronById(id);
          return {
            applicationId: id,
            status,
            active,
            tokenId:
              onChain.tokenId > BigInt(0) ? onChain.tokenId.toString() : null,
            companyName: profile?.companyName ?? null,
            description: profile?.description ?? null,
            website: profile?.website ?? null,
            contact: profile?.contact ?? null,
            createdAt: profile?.createdAt ?? null,
            skills,
          };
        })
      )
    ).filter((p): p is NonNullable<typeof p> => p !== null);

    return NextResponse.json({ patrons });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Internal server error";
    console.error("patrons mine error:", err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
