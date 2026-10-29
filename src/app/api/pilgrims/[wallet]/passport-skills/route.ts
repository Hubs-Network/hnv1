import { NextResponse } from "next/server";
import { isAddress } from "viem";
import {
  getPassportTokenOfOwner,
  getPassportSkills,
} from "@/lib/pilgrim-passport-sbt";

export const dynamic = "force-dynamic";

/**
 * GET /api/pilgrims/[wallet]/passport-skills
 *
 * Returns the on-chain attested skill hashes for the wallet's Pilgrim Passport
 * (lowercased), or hasPassport:false if it holds none. Used by the Residencies
 * board to offer the "only residencies for my skills" filter. Reads only; the
 * same on-chain skills drive apply eligibility, so the filter stays consistent.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ wallet: string }> }
) {
  try {
    const { wallet } = await params;
    if (!wallet || !isAddress(wallet)) {
      return NextResponse.json({ error: "Invalid wallet" }, { status: 400 });
    }

    const tokenId = await getPassportTokenOfOwner(wallet);
    if (tokenId === null) {
      return NextResponse.json({ hasPassport: false, skillHashes: [] });
    }

    const skills = await getPassportSkills(tokenId);
    return NextResponse.json({
      hasPassport: true,
      tokenId: tokenId.toString(),
      skillHashes: skills.map((s) => s.toLowerCase()),
    });
  } catch {
    // Never block the board on a read failure — just no filter.
    return NextResponse.json({ hasPassport: false, skillHashes: [] });
  }
}
