import { NextRequest, NextResponse } from "next/server";
import { getAddress } from "viem";
import { getHubById } from "@/lib/data/hubs";
import { updateProfileInRepo } from "@/lib/github/adapter";
import { isHNAdmin } from "@/lib/hn-admin";
import { recoverHNBadgeSigner } from "@/lib/hn-badge-verify";
import type { HubProfile } from "@/types";

/**
 * POST /api/admin/hn-badge/applications/[hubId]/reject
 * Body: { signature: string, issuedAt: string }
 *
 * HN admin rejects a pending badge application. The approver must sign the
 * action; the server recovers the signer and verifies HN admin ownership.
 * No on-chain tx is needed.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ hubId: string }> }
) {
  try {
    const { hubId } = await params;
    const body = await request.json();
    const signature: string = body.signature || "";
    const issuedAt: string = body.issuedAt || "";

    if (!signature || !issuedAt) {
      return NextResponse.json(
        { error: "Signed rejection required (signature, issuedAt)" },
        { status: 400 }
      );
    }

    const approverAddress = await recoverHNBadgeSigner({
      action: "reject",
      hubId,
      issuedAt,
      signature,
    });

    if (!approverAddress) {
      return NextResponse.json(
        { error: "Invalid or expired rejection signature" },
        { status: 401 }
      );
    }

    const hub = await getHubById(hubId);
    if (!hub) {
      return NextResponse.json({ error: "Hub not found" }, { status: 404 });
    }

    if ((hub.hnBadgeStatus || "none") !== "pending") {
      return NextResponse.json(
        { error: "Hub does not have a pending application" },
        { status: 409 }
      );
    }

    const allowed = await isHNAdmin(approverAddress);
    if (!allowed) {
      return NextResponse.json(
        { error: "Approver is not an HN Directors Safe owner" },
        { status: 403 }
      );
    }

    const now = new Date().toISOString();
    const updatedProfile: HubProfile = {
      ...hub,
      hnBadgeStatus: "rejected",
      hnBadgeRejectedAt: now,
      hnBadgeRejectedBy: getAddress(approverAddress),
      metadata: { ...hub.metadata, updated_at: now },
    };

    const result = await updateProfileInRepo("hub", updatedProfile);
    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 500 });
    }

    return NextResponse.json({ success: true, hnBadgeStatus: "rejected" });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Internal server error";
    console.error("HN badge reject error:", err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
