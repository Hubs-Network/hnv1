import { NextRequest, NextResponse } from "next/server";
import { isAddress } from "viem";
import { getPublishedPilgrims, getPilgrimByWallet, savePilgrim } from "@/lib/data/pilgrims";
import type { PilgrimProfile } from "@/types";

export const dynamic = "force-dynamic";

/** List published pilgrims for the public directory. */
export async function GET() {
  try {
    const pilgrims = await getPublishedPilgrims();
    return NextResponse.json({ pilgrims });
  } catch {
    return NextResponse.json({ error: "Failed to load pilgrims" }, { status: 500 });
  }
}

function clean(value: unknown, max: number): string | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  if (!trimmed) return "";
  return trimmed.slice(0, max);
}

/**
 * Upsert the caller's own pilgrim profile (nickname / tagline / link).
 * These can be saved anytime, independent of holding a passport.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const wallet: string = (body._wallet_address || "").toLowerCase();

    if (!wallet || !isAddress(wallet)) {
      return NextResponse.json(
        { error: "Authentication required. Connect your wallet." },
        { status: 401 }
      );
    }

    const nickname = clean(body.nickname, 40);
    const tagline = clean(body.tagline, 140);
    const link = clean(body.link, 300);

    if (link && link.length > 0 && !/^https?:\/\/.+/i.test(link)) {
      return NextResponse.json(
        { error: "Link must be a valid http(s) URL." },
        { status: 400 }
      );
    }

    const now = new Date().toISOString();
    const existing = await getPilgrimByWallet(wallet);

    const profile: PilgrimProfile = {
      wallet,
      // preserve on-chain-derived / publish fields
      passportTokenId: existing?.passportTokenId,
      published: existing?.published,
      skills: existing?.skills,
      publishedAt: existing?.publishedAt,
      createdAt: existing?.createdAt || now,
      updatedAt: now,
      nickname: nickname ?? existing?.nickname,
      tagline: tagline ?? existing?.tagline,
      link: link ?? existing?.link,
    };

    await savePilgrim(profile);
    return NextResponse.json({ profile });
  } catch {
    return NextResponse.json({ error: "Failed to save profile" }, { status: 500 });
  }
}
