import { NextRequest, NextResponse } from "next/server";
import { isAddress } from "viem";
import { listPilgrimActiveResidencies } from "@/lib/residency-milestones-directory";

export const dynamic = "force-dynamic";

/**
 * GET /api/residencies/active/pilgrim?owner=0x...
 * Residencies where the wallet's Passport is selected and not yet awarded.
 */
export async function GET(request: NextRequest) {
  try {
    const owner = new URL(request.url).searchParams.get("owner") || "";
    if (!owner || !isAddress(owner)) {
      return NextResponse.json({ residencies: [] });
    }
    const residencies = await listPilgrimActiveResidencies(owner);
    return NextResponse.json({ residencies });
  } catch (err) {
    console.error("active pilgrim residencies error:", err);
    return NextResponse.json({ residencies: [] });
  }
}
