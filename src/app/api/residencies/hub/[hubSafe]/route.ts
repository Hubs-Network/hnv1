import { NextResponse } from "next/server";
import { isAddress } from "viem";
import { listHubResidencyViews } from "@/lib/residencies-directory";

export const dynamic = "force-dynamic";

/** GET /api/residencies/hub/[hubSafe] — residencies created by a hub. */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ hubSafe: string }> }
) {
  try {
    const { hubSafe } = await params;
    if (!isAddress(hubSafe)) {
      return NextResponse.json({ error: "Invalid hub Safe address" }, { status: 400 });
    }
    const residencies = await listHubResidencyViews(hubSafe);
    return NextResponse.json({ residencies });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Internal server error";
    console.error("hub residencies error:", err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
