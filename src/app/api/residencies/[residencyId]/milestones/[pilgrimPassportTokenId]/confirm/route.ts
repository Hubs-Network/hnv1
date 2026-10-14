import { NextRequest, NextResponse } from "next/server";
import { getAddress } from "viem";
import { resolveMilestoneAccess } from "@/lib/residency-milestones-authz";
import { getMilestonePlan, upsertMilestonePlan } from "@/lib/data/residency-milestones";
import { MAX_MILESTONES } from "@/lib/schemas/residency-milestones";

export const dynamic = "force-dynamic";

/**
 * POST /confirm — Hub signer confirms the submitted plan.
 * Submitted → confirmed. Locks the milestone list; done-checking opens.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ residencyId: string; pilgrimPassportTokenId: string }> }
) {
  try {
    const { residencyId, pilgrimPassportTokenId } = await params;
    if (!/^\d+$/.test(residencyId) || !/^\d+$/.test(pilgrimPassportTokenId)) {
      return NextResponse.json({ error: "Invalid ids" }, { status: 400 });
    }
    const body = await request.json().catch(() => ({}));
    const wallet: string = body._wallet_address || body.wallet || "";

    const access = await resolveMilestoneAccess(
      BigInt(residencyId),
      BigInt(pilgrimPassportTokenId),
      wallet
    );
    if (!access) return NextResponse.json({ error: "Residency not found" }, { status: 404 });
    if (!access.selected || !access.isHubSigner) {
      return NextResponse.json(
        { error: "Only a Hub Safe signer can confirm milestones." },
        { status: 403 }
      );
    }
    if (access.awarded) {
      return NextResponse.json({ error: "Already awarded." }, { status: 409 });
    }

    const plan = await getMilestonePlan(residencyId, pilgrimPassportTokenId);
    if (!plan || plan.status !== "submitted") {
      return NextResponse.json(
        { error: "Milestone plan must be submitted before it can be confirmed." },
        { status: 409 }
      );
    }
    if (plan.milestones.length < 1 || plan.milestones.length > MAX_MILESTONES) {
      return NextResponse.json(
        { error: `A plan needs between 1 and ${MAX_MILESTONES} milestones.` },
        { status: 400 }
      );
    }

    const now = new Date().toISOString();
    const by = getAddress(wallet).toLowerCase();
    await upsertMilestonePlan({
      ...plan,
      status: "confirmed",
      confirmedAt: now,
      confirmedBy: by,
      updatedAt: now,
      updatedBy: by,
      revision: plan.revision + 1,
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Internal server error";
    console.error("milestone confirm error:", err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
