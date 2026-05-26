import { NextRequest, NextResponse } from "next/server";
import { addAdmin } from "@/lib/admin";

function isValidEthAddress(addr: string): boolean {
  return /^0x[a-fA-F0-9]{40}$/.test(addr);
}

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
    const { profile_id, profile_type, wallet_address, role } = await request.json();

    if (!profile_id || !profile_type || !wallet_address) {
      return NextResponse.json(
        { error: "Missing required fields: profile_id, profile_type, wallet_address" },
        { status: 400 }
      );
    }

    if (!["hub", "pilgrim"].includes(profile_type)) {
      return NextResponse.json({ error: "profile_type must be 'hub' or 'pilgrim'" }, { status: 400 });
    }

    if (!isValidEthAddress(wallet_address)) {
      return NextResponse.json({ error: "Invalid Ethereum address format" }, { status: 400 });
    }

    await addAdmin({
      profileId: profile_id,
      profileType: profile_type,
      walletAddress: wallet_address,
      role: role || "admin",
    });

    return NextResponse.json({ success: true, message: "Admin added" });
  } catch (err) {
    console.error("Admin add error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
