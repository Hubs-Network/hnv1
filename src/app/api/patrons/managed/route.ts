import { NextRequest, NextResponse } from "next/server";
import { isAddress, getAddress, type Hex } from "viem";
import { resolveSkillLabelByHash } from "@/lib/pilgrim-skills-catalog";
import {
  getOnChainApplication,
  getPatronSkills,
  isActivePatron,
  PATRON_STATUS,
} from "@/lib/patron-sbt";
import { getAllPatrons } from "@/lib/data/patrons";

export const dynamic = "force-dynamic";

/**
 * GET /api/patrons/managed?wallet=0x...
 *
 * Patrons the wallet ADMINISTERS (present in the off-chain `admins` list) but
 * does NOT own — owned Patrons already show under /api/patrons/mine. Only active,
 * approved Patrons are returned, reconciled against the contract. Contact is NOT
 * included (that's owner/HN-Director profile data).
 */
export async function GET(request: NextRequest) {
  try {
    const wallet = request.nextUrl.searchParams.get("wallet") || "";
    if (!isAddress(wallet)) {
      return NextResponse.json({ error: "Invalid wallet" }, { status: 400 });
    }
    const w = getAddress(wallet);

    const all = await getAllPatrons();
    const candidates = all.filter((p) => {
      const admins = (p.admins ?? []).map((a) => a.toLowerCase());
      const isAdmin = admins.includes(w.toLowerCase());
      const isOwner = (p.applicant || "").toLowerCase() === w.toLowerCase();
      return isAdmin && !isOwner;
    });

    const patrons = (
      await Promise.all(
        candidates.map(async (p) => {
          const onChain = await getOnChainApplication(p.applicationId as Hex);
          if (!onChain || onChain.status !== PATRON_STATUS.Minted) return null;
          const active = await isActivePatron(onChain.tokenId);
          if (!active) return null;

          const hashes = await getPatronSkills(onChain.tokenId);
          const skills = await Promise.all(
            hashes.map(async (h) => ({
              hash: h,
              label: await resolveSkillLabelByHash(h),
            }))
          );

          return {
            applicationId: p.applicationId,
            tokenId: onChain.tokenId.toString(),
            owner: getAddress(onChain.applicant),
            companyName: p.companyName ?? null,
            description: p.description ?? null,
            website: p.website ?? null,
            skills,
          };
        })
      )
    ).filter((p): p is NonNullable<typeof p> => p !== null);

    return NextResponse.json({ patrons });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Internal server error";
    console.error("patrons managed error:", err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
