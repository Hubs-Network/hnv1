import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";

export async function GET(request: NextRequest) {
  try {
    const walletAddress = request.headers.get("x-wallet-address") || "";

    if (!walletAddress) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    }

    const normalized = walletAddress.toLowerCase();
    const sql = getDb();

    const rows = await sql`
      SELECT profile_id, role
      FROM profile_admins
      WHERE wallet_address = ${normalized}
        AND profile_type = 'hub'
      ORDER BY created_at DESC
    `;

    return NextResponse.json({ hubs: rows });
  } catch (err) {
    console.error("My hubs error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
