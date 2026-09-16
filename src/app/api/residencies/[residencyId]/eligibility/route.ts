import { NextRequest, NextResponse } from "next/server";
import { isAddress, type Hex } from "viem";
import {
  getResidency,
  getResidencySkills,
  isApplicationOpen,
  hasApplied,
} from "@/lib/residencies-contract";
import {
  getPassportTokenOfOwner,
  getPassportSkills,
} from "@/lib/pilgrim-passport-sbt";
import { resolveSkillId, resolveSkillLabelByHash } from "@/lib/pilgrim-skills-catalog";
import { RESIDENCY_STATUS } from "@/config/residencies";

export const dynamic = "force-dynamic";

/**
 * GET /api/residencies/[residencyId]/eligibility?owner=0x...
 *
 * Viewer-specific apply eligibility: does the wallet hold a Passport, which of
 * the residency's skills does it have (matching skills), and has it already
 * applied. Used by the residency detail page to gate + drive the Apply flow.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ residencyId: string }> }
) {
  try {
    const { residencyId } = await params;
    if (!/^\d+$/.test(residencyId)) {
      return NextResponse.json({ error: "Invalid residency id" }, { status: 400 });
    }
    const owner = request.nextUrl.searchParams.get("owner") || "";
    if (!isAddress(owner)) {
      return NextResponse.json({ error: "Invalid owner address" }, { status: 400 });
    }
    const id = BigInt(residencyId);

    const residency = await getResidency(id);
    if (!residency) {
      return NextResponse.json({ error: "Residency not found" }, { status: 404 });
    }

    const tokenId = await getPassportTokenOfOwner(owner);
    if (tokenId === null) {
      return NextResponse.json({
        hasPassport: false,
        tokenId: null,
        alreadyApplied: false,
        matchingSkills: [],
        canApply: false,
      });
    }

    const [residencySkills, passportSkills, applied, appOpen] = await Promise.all([
      getResidencySkills(id),
      getPassportSkills(tokenId),
      hasApplied(id, tokenId),
      isApplicationOpen(id),
    ]);

    const passportSet = new Set(passportSkills.map((s) => s.toLowerCase()));
    const matchingHashes = residencySkills.filter((s) =>
      passportSet.has(s.toLowerCase())
    );
    const matchingSkills = await Promise.all(
      matchingHashes.map(async (hash) => ({
        hash,
        id: await resolveSkillId(hash),
        label: await resolveSkillLabelByHash(hash),
      }))
    );

    const canApply =
      residency.status === RESIDENCY_STATUS.Open &&
      appOpen &&
      !applied &&
      matchingSkills.length > 0;

    return NextResponse.json({
      hasPassport: true,
      tokenId: tokenId.toString(),
      alreadyApplied: applied,
      matchingSkills: matchingSkills.filter(
        (m): m is { hash: Hex; id: string; label: string } => m.id !== null
      ),
      canApply,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Internal server error";
    console.error("residency eligibility error:", err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
