import { NextRequest, NextResponse } from "next/server";
import { removeAdmin } from "@/lib/admin";

export async function POST(request: NextRequest) {
  const secret = process.env.ADMIN_MANAGEMENT_SECRET;
  if (!secret) {
    return NextResponse.json({ error: "Admin management not configured" }, { status: 503 });
  }

  const authHeader = request.headers.get("authorization") || "";
  const token = authHeader.replace(/^Bearer\s+/i, "");

  if (!token || token !== secret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { profile_id, profile_type, wallet_address } = await request.json();

    if (!profile_id || !profile_type || !wallet_address) {
      return NextResponse.json(
        { error: "Missing required fields: profile_id, profile_type, wallet_address" },
        { status: 400 }
      );
    }

    if (!["hub", "pilgrim"].includes(profile_type)) {
      return NextResponse.json({ error: "profile_type must be 'hub' or 'pilgrim'" }, { status: 400 });
    }

    await removeAdmin({
      profileId: profile_id,
      profileType: profile_type,
      walletAddress: wallet_address,
    });

    return NextResponse.json({ success: true, message: "Admin removed" });
  } catch (err) {
    console.error("Admin remove error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
