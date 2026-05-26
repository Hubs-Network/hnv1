import { NextRequest, NextResponse } from "next/server";
import { getHubById } from "@/lib/data/hubs";
import { hubProfileSchema } from "@/lib/schemas/hub";
import { updateProfileInRepo } from "@/lib/github/adapter";
import { checkAdmin } from "@/lib/admin";
import type { HubProfile } from "@/types";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ hubId: string }> }
) {
  try {
    const { hubId } = await params;
    const hub = await getHubById(hubId);

    if (!hub) {
      return NextResponse.json(
        { error: "Hub not found" },
        { status: 404 }
      );
    }

    // Strip admins array from public response
    const { admins: _admins, ...publicHub } = hub;
    return NextResponse.json({
      ...publicHub,
      admin_policy: { type: "private_registry" },
    });
  } catch {
    return NextResponse.json(
      { error: "Failed to load hub" },
      { status: 500 }
    );
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ hubId: string }> }
) {
  try {
    const { hubId } = await params;
    const body = await request.json();

    const walletAddress: string = (body._wallet_address || "").toLowerCase();
    delete body._wallet_address;

    if (!walletAddress) {
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401 }
      );
    }

    // Server-side admin check via Neon
    const adminCheck = await checkAdmin({
      profileId: hubId,
      profileType: "hub",
      walletAddress,
    });

    if (!adminCheck.isAdmin) {
      return NextResponse.json(
        { error: "You are not authorized to edit this hub" },
        { status: 403 }
      );
    }

    const existing = await getHubById(hubId);
    if (!existing) {
      return NextResponse.json({ error: "Hub not found" }, { status: 404 });
    }

    const now = new Date().toISOString();
    const updatedProfile: HubProfile = {
      ...existing,
      ...body,
      schema_version: existing.schema_version,
      hub_id: existing.hub_id,
      admins: existing.admins,
      metadata: {
        ...existing.metadata,
        updated_at: now,
      },
    };

    const validation = hubProfileSchema.safeParse(updatedProfile);
    if (!validation.success) {
      return NextResponse.json(
        { error: "Validation failed", issues: validation.error.issues },
        { status: 400 }
      );
    }

    const result = await updateProfileInRepo(
      "hub",
      validation.data as HubProfile
    );

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      hub_id: hubId,
      message: "Hub updated successfully",
    });
  } catch (err) {
    console.error("Hub update error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
