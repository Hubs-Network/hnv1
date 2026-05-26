import { NextRequest, NextResponse } from "next/server";
import { isProfileAdmin } from "@/lib/admin";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const { profile_id, profile_type, wallet_address } = body;

    if (!profile_id || !profile_type || !wallet_address) {
      return NextResponse.json(
        { error: "Missing required fields: profile_id, profile_type, wallet_address" },
        { status: 400 }
      );
    }

    if (!["hub", "pilgrim"].includes(profile_type)) {
      return NextResponse.json(
        { error: "profile_type must be 'hub' or 'pilgrim'" },
        { status: 400 }
      );
    }

    const result = await isProfileAdmin({
      profileId: profile_id,
      profileType: profile_type,
      walletAddress: wallet_address,
    });

    if (result.isAdmin) {
      return NextResponse.json({
        is_admin: true,
        role: result.role,
      });
    }

    return NextResponse.json({ is_admin: false });
  } catch {
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
