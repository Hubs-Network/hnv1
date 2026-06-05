import { NextRequest, NextResponse } from "next/server";
import { getAllHubs } from "@/lib/data/hubs";
import { hubProfileSchema } from "@/lib/schemas/hub";
import { saveProfileToRepo } from "@/lib/github/adapter";
import { generateHubId } from "@/lib/utils";
import { isHubAdmin } from "@/lib/safe";
import type { HubProfile } from "@/types";

export async function GET() {
  try {
    const hubs = await getAllHubs();
    const publicHubs = hubs.map(({ admins: _admins, ...hub }) => ({
      ...hub,
      admin_policy: hub.safeAddress
        ? { type: "safe_multisig", safe_address: hub.safeAddress, chain_id: 11155111 }
        : { type: "private_registry" },
    }));
    return NextResponse.json(publicHubs);
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

    const walletAddress: string = (body._wallet_address || "").toLowerCase();
    const safeAddress: string | undefined = body._safe_address;
    delete body._wallet_address;
    delete body._safe_address;

    if (!walletAddress) {
      return NextResponse.json(
        { error: "Authentication required. Connect your wallet to register a hub." },
        { status: 401 }
      );
    }

    let hubId: string;

    if (safeAddress && /^0x[a-fA-F0-9]{40}$/.test(safeAddress)) {
      // Safe-based hub: verify the caller is actually an owner of this Safe
      const isOwner = await isHubAdmin(safeAddress, walletAddress);
      if (!isOwner) {
        return NextResponse.json(
          { error: "You are not an owner of the provided Safe address." },
          { status: 403 }
        );
      }
      hubId = safeAddress.toLowerCase();
    } else {
      // Legacy flow: generate slug-based ID
      hubId = generateHubId(body.name || "", body.location?.city || "");
      if (!hubId) {
        return NextResponse.json(
          { error: "Could not generate hub ID from name and city" },
          { status: 400 }
        );
      }
    }

    const now = new Date().toISOString();
    const profileData: HubProfile = {
      schema_version: "0.3",
      hub_id: hubId,
      ...body,
      admins: [],
      metadata: {
        submitted_at: now,
        updated_at: now,
        submitted_by: body.contact?.contact_name || "Anonymous",
        creator_address: walletAddress,
        language: "en",
      },
      ...(safeAddress
        ? {
            safeAddress: safeAddress.toLowerCase(),
            chainId: 11155111,
            network_id: "sepolia",
          }
        : {}),
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

    // For legacy hubs (no Safe), register in Neon if available
    if (!safeAddress) {
      try {
        const { addAdmin } = await import("@/lib/admin");
        await addAdmin({
          profileId: hubId,
          profileType: "hub",
          walletAddress,
          role: "owner",
        });
      } catch (dbErr) {
        console.error("Failed to register admin in Neon:", dbErr);
      }
    }

    return NextResponse.json(
      {
        success: true,
        hub_id: hubId,
        safe_address: safeAddress || null,
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
