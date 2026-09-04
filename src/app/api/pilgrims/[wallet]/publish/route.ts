import { NextRequest, NextResponse } from "next/server";
import { getAddress, isAddress } from "viem";
import { getPilgrimByWallet, savePilgrim } from "@/lib/data/pilgrims";
import { getPassportOwner, getPassportSkills } from "@/lib/pilgrim-passport-sbt";
import { resolveSkillLabelByHash } from "@/lib/pilgrim-skills-catalog";
import type { PilgrimProfile, PilgrimSkillSnapshot } from "@/types";

export const dynamic = "force-dynamic";

/**
 * Publish the pilgrim's passport: writes the passport token id + a skills
 * snapshot onto their profile so it shows up in the public directory.
 *
 * Security: the token id is only written after verifying on-chain that the
 * calling wallet actually owns that passport. Nobody else can write it.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ wallet: string }> }
) {
  try {
    const { wallet: walletParam } = await params;
    const body = await request.json();
    const wallet: string = (body._wallet_address || "").toLowerCase();
    const tokenIdStr: string = String(body.tokenId ?? "");

    if (!wallet || !isAddress(wallet)) {
      return NextResponse.json(
        { error: "Authentication required. Connect your wallet." },
        { status: 401 }
      );
    }
    if (!isAddress(walletParam) || walletParam.toLowerCase() !== wallet) {
      return NextResponse.json(
        { error: "You can only publish your own pilgrim profile." },
        { status: 403 }
      );
    }

    let tokenId: bigint;
    try {
      tokenId = BigInt(tokenIdStr);
    } catch {
      return NextResponse.json({ error: "Invalid token id" }, { status: 400 });
    }

    // On-chain ownership check — the authoritative gate for writing the id.
    const owner = await getPassportOwner(tokenId);
    if (!owner || getAddress(owner) !== getAddress(wallet)) {
      return NextResponse.json(
        { error: "This passport is not owned by your wallet." },
        { status: 403 }
      );
    }

    // Snapshot the attested skills (labels resolved once, for the directory).
    const hashes = await getPassportSkills(tokenId);
    const skills: PilgrimSkillSnapshot[] = await Promise.all(
      hashes.map(async (hash) => ({
        hash,
        label: await resolveSkillLabelByHash(hash),
      }))
    );

    const now = new Date().toISOString();
    const existing = await getPilgrimByWallet(wallet);

    const profile: PilgrimProfile = {
      wallet,
      nickname: existing?.nickname,
      tagline: existing?.tagline,
      link: existing?.link,
      passportTokenId: tokenId.toString(),
      published: true,
      skills,
      createdAt: existing?.createdAt || now,
      updatedAt: now,
      publishedAt: existing?.publishedAt || now,
    };

    await savePilgrim(profile);
    return NextResponse.json({ profile });
  } catch {
    return NextResponse.json({ error: "Failed to publish" }, { status: 500 });
  }
}
