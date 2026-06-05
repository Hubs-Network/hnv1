import { NextRequest, NextResponse } from "next/server";
import { checkHubAdmin } from "@/lib/hub-admin";

export async function POST(request: NextRequest) {
  try {
    const { profile_id, profile_type, wallet_address, safe_address } = await request.json();

    if (!profile_id || !profile_type || !wallet_address) {
      return NextResponse.json(
        { error: "Missing required fields: profile_id, profile_type, wallet_address" },
        { status: 400 }
      );
    }

    if (profile_type !== "hub") {
      // For non-hub profiles, fallback to legacy Neon check
      try {
        const { checkAdmin } = await import("@/lib/admin");
        const result = await checkAdmin({
          profileId: profile_id,
          profileType: profile_type,
          walletAddress: wallet_address,
        });
        if (result.isAdmin) {
          return NextResponse.json({ is_admin: true, role: result.role });
        }
        return NextResponse.json({ is_admin: false });
      } catch {
        return NextResponse.json({ is_admin: false });
      }
    }

    const result = await checkHubAdmin({
      hubId: profile_id,
      walletAddress: wallet_address,
      safeAddress: safe_address,
    });

    if (result.isAdmin) {
      return NextResponse.json({ is_admin: true, role: result.role });
    }

    return NextResponse.json({ is_admin: false });
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
