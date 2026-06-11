import { NextRequest, NextResponse } from "next/server";
import { getHubById } from "@/lib/data/hubs";
import { updateProfileInRepo } from "@/lib/github/adapter";
import { checkHubAdmin } from "@/lib/hub-admin";
import { HN_MANIFESTO_URL } from "@/config/hubs-network";
import type { HubProfile } from "@/types";

/**
 * POST /api/hubs/[hubId]/hn-badge/apply
 *
 * A hub owner/admin applies for the Hubs Network Badge.
 * Sets hnBadgeStatus = "pending" and records the application.
 *
 * Security: the requester must be a current owner/admin of the hub Safe.
 * The wallet address from the body is verified on-chain, never trusted blindly.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ hubId: string }> }
) {
  try {
    const { hubId } = await params;
    const body = await request.json();

    const walletAddress: string = (body._wallet_address || "").toLowerCase();
    const manifestoAccepted: boolean = body.manifestoAccepted === true;

    if (!walletAddress) {
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401 }
      );
    }

    if (!manifestoAccepted) {
      return NextResponse.json(
        { error: "You must accept the Hubs Network Manifesto to apply." },
        { status: 400 }
      );
    }

    const existing = await getHubById(hubId);
    if (!existing) {
      return NextResponse.json({ error: "Hub not found" }, { status: 404 });
    }

    // Verify the requester is a current owner/admin of this hub's Safe
    const adminCheck = await checkHubAdmin({
      hubId,
      walletAddress,
      safeAddress: existing.safeAddress,
    });

    if (!adminCheck.isAdmin) {
      return NextResponse.json(
        { error: "You are not authorized to apply for this hub" },
        { status: 403 }
      );
    }

    const currentStatus = existing.hnBadgeStatus || "none";

    // Only allow applying from "none" or "rejected".
    // TODO (re-application policy): refine allowed transitions once review flow lands.
    if (currentStatus === "pending") {
      return NextResponse.json(
        { error: "An application is already pending review." },
        { status: 409 }
      );
    }
    if (currentStatus === "approved") {
      return NextResponse.json(
        { error: "This hub already has the Hubs Network Badge." },
        { status: 409 }
      );
    }

    const updatedProfile: HubProfile = {
      ...existing,
      hnBadgeStatus: "pending",
      hnBadgeApplication: {
        submittedAt: new Date().toISOString(),
        manifestoAccepted: true,
        manifestoUrl: HN_MANIFESTO_URL,
        applicantAddress: walletAddress,
      },
      // Clear any prior rejection metadata on re-application
      hnBadgeRejectedAt: undefined,
      hnBadgeRejectedBy: undefined,
      metadata: {
        ...existing.metadata,
        updated_at: new Date().toISOString(),
      },
    };

    const result = await updateProfileInRepo("hub", updatedProfile);
    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      hnBadgeStatus: "pending",
      message: "Application submitted for Hubs Network Badge review.",
    });
  } catch (err) {
    console.error("HN badge apply error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
