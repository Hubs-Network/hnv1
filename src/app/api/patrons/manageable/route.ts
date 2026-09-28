import { NextRequest, NextResponse } from "next/server";
import { isAddress, getAddress, type Hex } from "viem";
import {
  getOnChainApplication,
  isActivePatron,
  PATRON_STATUS,
} from "@/lib/patron-sbt";
import { getAllPatrons } from "@/lib/data/patrons";

export const dynamic = "force-dynamic";

/**
 * GET /api/patrons/manageable?wallet=0x...
 *
 * Active, approved Patrons the wallet can act as — i.e. it is the owner OR a
 * delegated admin. Used to populate the Patron selector when vouching a
 * residency. Minimal shape (no contact / company internals).
 */
export async function GET(request: NextRequest) {
  try {
    const wallet = request.nextUrl.searchParams.get("wallet") || "";
    if (!isAddress(wallet)) {
      return NextResponse.json({ error: "Invalid wallet" }, { status: 400 });
    }
    const w = getAddress(wallet).toLowerCase();

    const all = await getAllPatrons();
    const candidates = all.filter((p) => {
      const isOwner = (p.applicant || "").toLowerCase() === w;
      const isAdmin = (p.admins ?? []).map((a) => a.toLowerCase()).includes(w);
      return isOwner || isAdmin;
    });

    const patrons = (
      await Promise.all(
        candidates.map(async (p) => {
          const onChain = await getOnChainApplication(p.applicationId as Hex);
          if (!onChain || onChain.status !== PATRON_STATUS.Minted) return null;
          if (!(await isActivePatron(onChain.tokenId))) return null;
          return {
            applicationId: p.applicationId,
            tokenId: onChain.tokenId.toString(),
            companyName: p.companyName ?? "Patron",
            isOwner: (p.applicant || "").toLowerCase() === w,
          };
        })
      )
    ).filter((p): p is NonNullable<typeof p> => p !== null);

    return NextResponse.json({ patrons });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Internal server error";
    console.error("patrons manageable error:", err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
