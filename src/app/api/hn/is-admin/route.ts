import { NextRequest, NextResponse } from "next/server";
import { isHNAdmin } from "@/lib/hn-admin";

/**
 * POST /api/hn/is-admin
 * Body: { wallet_address: string }
 * Returns: { is_hn_admin: boolean }
 *
 * Checks whether the wallet is a current owner of the HN Directors Safe.
 */
export async function POST(request: NextRequest) {
  try {
    const { wallet_address } = await request.json();

    if (!wallet_address) {
      return NextResponse.json({ is_hn_admin: false });
    }

    const result = await isHNAdmin(wallet_address);
    return NextResponse.json({ is_hn_admin: result });
  } catch {
    return NextResponse.json({ is_hn_admin: false });
  }
}
