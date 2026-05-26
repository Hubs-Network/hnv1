import { NextRequest, NextResponse } from "next/server";
import { listAdmins } from "@/lib/admin";

export async function GET(request: NextRequest) {
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
    const url = new URL(request.url);
    const profileId = url.searchParams.get("profile_id");
    const profileType = url.searchParams.get("profile_type") as "hub" | "pilgrim" | null;

    if (!profileId || !profileType) {
      return NextResponse.json(
        { error: "Missing query params: profile_id, profile_type" },
        { status: 400 }
      );
    }

    if (!["hub", "pilgrim"].includes(profileType)) {
      return NextResponse.json({ error: "profile_type must be 'hub' or 'pilgrim'" }, { status: 400 });
    }

    const admins = await listAdmins({ profileId, profileType });

    return NextResponse.json({ admins });
  } catch (err) {
    console.error("Admin list error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
