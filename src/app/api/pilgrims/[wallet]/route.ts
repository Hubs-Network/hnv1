import { NextResponse } from "next/server";
import { isAddress } from "viem";
import { getPilgrimByWallet } from "@/lib/data/pilgrims";

export const dynamic = "force-dynamic";

/** Fetch a single pilgrim profile by wallet (public read). */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ wallet: string }> }
) {
  try {
    const { wallet } = await params;
    if (!wallet || !isAddress(wallet)) {
      return NextResponse.json({ error: "Invalid wallet" }, { status: 400 });
    }
    const profile = await getPilgrimByWallet(wallet);
    return NextResponse.json({ profile: profile ?? null });
  } catch {
    return NextResponse.json({ error: "Failed to load profile" }, { status: 500 });
  }
}
