import { NextRequest, NextResponse } from "next/server";
import { getHubById } from "@/lib/data/hubs";
import { hubProfileSchema } from "@/lib/schemas/hub";
import { updateProfileInRepo, deleteProfileFromRepo } from "@/lib/github/adapter";
import { checkHubAdmin } from "@/lib/hub-admin";
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
      admin_policy: hub.safeAddress
        ? { type: "safe_multisig", safe_address: hub.safeAddress, chain_id: 11155111 }
        : { type: "private_registry" },
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

    const existing = await getHubById(hubId);
    if (!existing) {
      return NextResponse.json({ error: "Hub not found" }, { status: 404 });
    }

    // Server-side admin check (Safe on-chain or legacy Neon)
    const adminCheck = await checkHubAdmin({
      hubId,
      walletAddress,
      safeAddress: (existing as any).safeAddress,
    });

    if (!adminCheck.isAdmin) {
      return NextResponse.json(
        { error: "You are not authorized to edit this hub" },
        { status: 403 }
      );
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

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ hubId: string }> }
) {
  try {
    const { hubId } = await params;
    const body = await request.json();

    const walletAddress: string = (body._wallet_address || "").toLowerCase();

    if (!walletAddress) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    }

    const hub = await getHubById(hubId);
    const adminCheck = await checkHubAdmin({
      hubId,
      walletAddress,
      safeAddress: (hub as any)?.safeAddress,
    });

    if (!adminCheck.isAdmin || adminCheck.role !== "owner") {
      return NextResponse.json(
        { error: "Only the owner can delete this hub" },
        { status: 403 }
      );
    }

    const result = await deleteProfileFromRepo("hub", hubId);

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 500 });
    }

    // Clean up legacy Neon admin entries if they exist
    try {
      const { deleteAdminsForProfile } = await import("@/lib/admin");
      await deleteAdminsForProfile({ profileId: hubId, profileType: "hub" });
    } catch { /* Neon may not be configured */ }

    return NextResponse.json({
      success: true,
      message: "Hub deleted successfully",
    });
  } catch (err) {
    console.error("Hub delete error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
