import { NextRequest, NextResponse } from "next/server";
import { getAllHubs } from "@/lib/data/hubs";
import { isHubAdmin } from "@/lib/safe";
import { isSafeBasedHub } from "@/lib/hub-admin";

export async function GET(request: NextRequest) {
  try {
    const walletAddress = request.headers.get("x-wallet-address") || "";

    if (!walletAddress) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    }

    const normalized = walletAddress.toLowerCase();
    const results: { profile_id: string; role: string; safe_based: boolean; name?: string }[] = [];

    // Check Safe-based hubs: load all hubs and check ownership on-chain
    const allHubs = await getAllHubs();
    for (const hub of allHubs) {
      const safeAddr = (hub as any).safeAddress;
      const hubId = hub.hub_id;

      if (safeAddr && isSafeBasedHub(safeAddr)) {
        const isOwner = await isHubAdmin(safeAddr, walletAddress);
        if (isOwner) {
          results.push({ profile_id: hubId, role: "owner", safe_based: true, name: hub.name });
        }
      }
    }

    // Also check legacy Neon-based hubs
    try {
      const { getDb } = await import("@/lib/db");
      const sql = getDb();
      const rows = await sql`
        SELECT profile_id, role
        FROM profile_admins
        WHERE wallet_address = ${normalized}
          AND profile_type = 'hub'
        ORDER BY created_at DESC
      `;
      for (const row of rows) {
        // Avoid duplicates from Safe check
        if (!results.some((r) => r.profile_id === row.profile_id)) {
          const hubData = allHubs.find((h) => h.hub_id === row.profile_id);
          results.push({
            profile_id: row.profile_id,
            role: row.role,
            safe_based: false,
            name: hubData?.name,
          });
        }
      }
    } catch {
      // Neon not configured — that's fine
    }

    return NextResponse.json({ hubs: results });
  } catch (err) {
    console.error("My hubs error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
