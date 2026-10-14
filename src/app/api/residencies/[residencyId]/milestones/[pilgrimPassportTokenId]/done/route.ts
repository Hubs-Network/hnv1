import { NextRequest, NextResponse } from "next/server";
import { getAddress } from "viem";
import { resolveMilestoneAccess } from "@/lib/residency-milestones-authz";
import { getMilestonePlan, upsertMilestonePlan } from "@/lib/data/residency-milestones";
import {
  doneInputSchema,
  recomputePlanStatusAfterDone,
  isMilestoneValidated,
  type ResidencyMilestoneItem,
} from "@/lib/schemas/residency-milestones";

export const dynamic = "force-dynamic";

/**
 * POST /done — toggle a milestone's done flag for the acting side.
 * Pilgrim toggles `pilgrimDone`, Hub signer toggles `hubDone`.
 * Allowed while `confirmed` or `all_validated`. Unticking is allowed until the
 * residency is awarded (then the plan is read-only).
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
    const parsed = doneInputSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid done payload" }, { status: 400 });
    }
    const { milestoneId, actor, done } = parsed.data;

    const access = await resolveMilestoneAccess(
      BigInt(residencyId),
      BigInt(pilgrimPassportTokenId),
      wallet
    );
    if (!access) return NextResponse.json({ error: "Residency not found" }, { status: 404 });
    if (!access.selected || access.role === "none") {
      return NextResponse.json({ error: "Not authorized." }, { status: 403 });
    }
    if (access.awarded) {
      return NextResponse.json({ error: "Already awarded — plan is read-only." }, { status: 409 });
    }

    // Each side may only toggle its own column.
    if (actor === "pilgrim" && !access.isPilgrim) {
      return NextResponse.json(
        { error: "Only the selected Pilgrim can mark the Pilgrim side." },
        { status: 403 }
      );
    }
    if (actor === "hub" && !access.isHubSigner) {
      return NextResponse.json(
        { error: "Only a Hub Safe signer can mark the Hub side." },
        { status: 403 }
      );
    }

    const plan = await getMilestonePlan(residencyId, pilgrimPassportTokenId);
    if (!plan || (plan.status !== "confirmed" && plan.status !== "all_validated")) {
      return NextResponse.json(
        { error: "Milestones can only be checked once the plan is confirmed." },
        { status: 409 }
      );
    }

    const idx = plan.milestones.findIndex((m) => m.id === milestoneId);
    if (idx === -1) {
      return NextResponse.json({ error: "Milestone not found." }, { status: 404 });
    }

    const now = new Date().toISOString();
    const by = getAddress(wallet).toLowerCase();
    const milestones: ResidencyMilestoneItem[] = plan.milestones.map((m, i) => {
      if (i !== idx) return m;
      const next = { ...m };
      if (actor === "pilgrim") {
        next.pilgrimDone = done;
        next.pilgrimDoneAt = done ? now : undefined;
        next.pilgrimDoneBy = done ? by : undefined;
      } else {
        next.hubDone = done;
        next.hubDoneAt = done ? now : undefined;
        next.hubDoneBy = done ? by : undefined;
      }
      next.validatedAt = isMilestoneValidated(next) ? next.validatedAt || now : undefined;
      return next;
    });

    const status = recomputePlanStatusAfterDone(plan.status, milestones);

    await upsertMilestonePlan({
      ...plan,
      milestones,
      status,
      updatedAt: now,
      updatedBy: by,
      revision: plan.revision + 1,
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Internal server error";
    console.error("milestone done error:", err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
