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
