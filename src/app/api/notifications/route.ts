import { NextRequest, NextResponse } from "next/server";
import { isAddress } from "viem";
import { getNotificationsForWallet } from "@/lib/notifications";

export const dynamic = "force-dynamic";

/**
 * GET /api/notifications?owner=0x...
 *
 * Returns the current notifications for a wallet (hub SBT minted, passport
 * minted, admin pending-claims, residency selection). Read-only; never fails
 * the caller — returns an empty list on any error.
 */
export async function GET(request: NextRequest) {
  try {
    const owner = new URL(request.url).searchParams.get("owner") || "";
    if (!owner || !isAddress(owner)) {
      return NextResponse.json({ notifications: [] });
    }
    const notifications = await getNotificationsForWallet(owner);
    return NextResponse.json({ notifications });
  } catch (err) {
    console.error("notifications error:", err);
    return NextResponse.json({ notifications: [] });
  }
}
