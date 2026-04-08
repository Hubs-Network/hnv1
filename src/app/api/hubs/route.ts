import { NextRequest, NextResponse } from "next/server";
import { getAllHubs } from "@/lib/data/hubs";
import { hubProfileSchema } from "@/lib/schemas/hub";
import { saveProfileToRepo, serializeProfile } from "@/lib/github/adapter";
import { generateHubId } from "@/lib/utils";
import type { HubProfile } from "@/types";

export async function GET() {
  try {
    const hubs = await getAllHubs();
    return NextResponse.json(hubs);
  } catch {
    return NextResponse.json(
      { error: "Failed to load hubs" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const hubId = generateHubId(body.name || "", body.location?.city || "");
    if (!hubId) {
      return NextResponse.json(
        { error: "Could not generate hub ID from name and city" },
        { status: 400 }
      );
    }

    const now = new Date().toISOString();
    const profileData: HubProfile = {
      schema_version: "0.2",
      hub_id: hubId,
      ...body,
      metadata: {
        submitted_at: now,
        updated_at: now,
        submitted_by: body.contact?.contact_name || "Anonymous",
        language: "en",
      },
    };

    const validation = hubProfileSchema.safeParse(profileData);
    if (!validation.success) {
      return NextResponse.json(
        {
          error: "Validation failed",
          issues: validation.error.issues,
        },
        { status: 400 }
      );
    }

    const result = await saveProfileToRepo("hub", validation.data as HubProfile);

    if (!result.success) {
      return NextResponse.json(
        { error: result.error },
        { status: 409 }
      );
    }

    return NextResponse.json(
      {
        success: true,
        hub_id: hubId,
        message: "Hub registered successfully",
      },
      { status: 201 }
    );
  } catch (err) {
    console.error("Hub registration error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
