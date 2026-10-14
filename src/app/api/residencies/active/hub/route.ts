import { NextRequest, NextResponse } from "next/server";
import { isAddress } from "viem";
import { listHubActiveResidencies } from "@/lib/residency-milestones-directory";
import { isHubAdmin } from "@/lib/safe";

export const dynamic = "force-dynamic";

/**
 * GET /api/residencies/active/hub?hubSafe=0x...&wallet=0x...
 * Selected, not-yet-awarded pilgrims across the hub's residencies.
 * Authorized only for current Safe signers of the hub.
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const hubSafe = searchParams.get("hubSafe") || "";
    const wallet = searchParams.get("wallet") || "";
    if (!hubSafe || !isAddress(hubSafe)) {
      return NextResponse.json({ error: "Invalid hubSafe" }, { status: 400 });
    }
    if (!wallet || !isAddress(wallet)) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    }

    const signer = await isHubAdmin(hubSafe, wallet).catch(() => false);
    if (!signer) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const residencies = await listHubActiveResidencies(hubSafe);
    return NextResponse.json({ residencies });
  } catch (err) {
    console.error("active hub residencies error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
