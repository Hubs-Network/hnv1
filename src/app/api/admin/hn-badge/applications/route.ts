import { NextRequest, NextResponse } from "next/server";
import { getAllHubs } from "@/lib/data/hubs";
import { isHNAdmin } from "@/lib/hn-admin";

/**
 * GET /api/admin/hn-badge/applications
 * Header: x-wallet-address
 *
 * Returns hubs with hnBadgeStatus === "pending".
 * Protected: only HN Directors Safe owners (HN admins) may access.
 */
export async function GET(request: NextRequest) {
  try {
    const walletAddress = request.headers.get("x-wallet-address") || "";

    if (!walletAddress) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    }

    const allowed = await isHNAdmin(walletAddress);
    if (!allowed) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const hubs = await getAllHubs();
    const pending = hubs
      .filter((h) => h.hnBadgeStatus === "pending")
      .map((h) => ({
        hub_id: h.hub_id,
        name: h.name,
        safeAddress: h.safeAddress,
        status: h.hnBadgeStatus,
        applicantAddress: h.hnBadgeApplication?.applicantAddress,
        submittedAt: h.hnBadgeApplication?.submittedAt,
      }));

    return NextResponse.json({ applications: pending });
  } catch (err) {
    console.error("HN badge applications error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
