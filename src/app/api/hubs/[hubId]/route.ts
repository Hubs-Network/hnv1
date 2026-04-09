import { NextRequest, NextResponse } from "next/server";
import { getHubById } from "@/lib/data/hubs";
import { hubProfileSchema } from "@/lib/schemas/hub";
import { updateProfileInRepo } from "@/lib/github/adapter";
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

    return NextResponse.json(hub);
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

    const callerAddress: string = (body._caller_address || "").toLowerCase();
    delete body._caller_address;

    if (!callerAddress) {
      return NextResponse.json(
        { error: "Universal Profile address is required" },
        { status: 401 }
      );
    }

    // Load existing hub to verify admin access
    const existing = await getHubById(hubId);
    if (!existing) {
      return NextResponse.json({ error: "Hub not found" }, { status: 404 });
    }

    const admins = (existing.admins || []).map((a) => a.toLowerCase());
    if (!admins.includes(callerAddress)) {
      return NextResponse.json(
        { error: "You are not an admin of this hub" },
        { status: 403 }
      );
    }

    const now = new Date().toISOString();
    const updatedProfile: HubProfile = {
      ...existing,
      ...body,
      schema_version: existing.schema_version,
      hub_id: existing.hub_id,
      admins: body.admins
        ? (body.admins as string[]).map((a: string) => a.toLowerCase())
        : existing.admins,
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
