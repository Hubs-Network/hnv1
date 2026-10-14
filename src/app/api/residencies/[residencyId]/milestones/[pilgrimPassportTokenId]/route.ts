import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { getAddress } from "viem";
import { resolveMilestoneAccess, computeMilestonePermissions } from "@/lib/residency-milestones-authz";
import { getMilestonePlan, upsertMilestonePlan } from "@/lib/data/residency-milestones";
import {
  updateMilestonesInputSchema,
  allMilestonesValidated,
  MAX_MILESTONES,
  type MilestoneInputItem,
  type ResidencyMilestoneItem,
  type ResidencyMilestonePlan,
} from "@/lib/schemas/residency-milestones";
import { getResidencyView } from "@/lib/residencies-directory";
import { getPassportOwner } from "@/lib/pilgrim-passport-sbt";
import { getPilgrimByWallet } from "@/lib/data/pilgrims";

export const dynamic = "force-dynamic";

function parseIds(residencyId: string, tokenId: string) {
  if (!/^\d+$/.test(residencyId) || !/^\d+$/.test(tokenId)) return null;
  return { rid: BigInt(residencyId), tid: BigInt(tokenId) };
}

/** Build the "selected pilgrim" summary (owner + nickname) for the dashboard. */
async function pilgrimSummary(tokenId: bigint) {
  const owner = await getPassportOwner(tokenId).catch(() => null);
  let nickname: string | null = null;
  if (owner) {
    try {
      nickname = (await getPilgrimByWallet(owner))?.nickname ?? null;
    } catch {
      nickname = null;
    }
  }
  return { tokenId: tokenId.toString(), owner, nickname };
}

/**
 * GET /api/residencies/[residencyId]/milestones/[pilgrimPassportTokenId]
 * Returns residency summary, selected pilgrim summary, the milestone plan,
 * the caller's role and the per-action permission booleans.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ residencyId: string; pilgrimPassportTokenId: string }> }
) {
  try {
    const { residencyId, pilgrimPassportTokenId } = await params;
    const ids = parseIds(residencyId, pilgrimPassportTokenId);
    if (!ids) return NextResponse.json({ error: "Invalid ids" }, { status: 400 });

    const wallet = new URL(request.url).searchParams.get("wallet") || "";
    const access = await resolveMilestoneAccess(ids.rid, ids.tid, wallet);
    if (!access) {
      return NextResponse.json({ error: "Residency not found" }, { status: 404 });
    }

    // Access rule: only the selected pilgrim or a hub signer may view.
    if (!access.selected || access.role === "none") {
      return NextResponse.json(
        { error: "You are not authorized to view this milestone dashboard." },
        { status: 403 }
      );
    }

    const [view, pilgrim, plan] = await Promise.all([
      getResidencyView(ids.rid),
      pilgrimSummary(ids.tid),
      getMilestonePlan(residencyId, pilgrimPassportTokenId),
    ]);

    const status = plan?.status ?? "none";
    const milestones = plan?.milestones ?? [];
    const permissions = computeMilestonePermissions({
      access,
      status,
      allValidated: allMilestonesValidated(milestones),
      hasMinimumMilestones: milestones.length >= 1 && milestones.length <= MAX_MILESTONES,
    });

    return NextResponse.json({
      residency: {
        id: residencyId,
        hubSafe: access.residency.hubSafe,
        title: view?.title ?? null,
        hubName: view?.hubName ?? null,
        uiStatus: view?.uiStatus ?? "none",
        status: access.residency.status,
        // Milestones the hub pre-defined on the residency (off-chain metadata only;
        // on-chain the contract anchors just the metadata hash). Used to seed the
        // pilgrim's draft — they can keep, reorder or delete them.
        predefinedMilestones: view?.milestones ?? [],
      },
      pilgrim,
      plan,
      role: access.role,
      permissions,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Internal server error";
    console.error("milestone GET error:", err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/** Rebuild milestone items: assign ids/order, preserve done-state by id. */
function normalizeMilestones(
  input: MilestoneInputItem[],
  existing: ResidencyMilestoneItem[]
): ResidencyMilestoneItem[] {
  const byId = new Map(existing.map((m) => [m.id, m]));
  return input.map((item, idx) => {
    const prev = item.id ? byId.get(item.id) : undefined;
    const description = item.description?.trim();
    return {
      id: item.id || randomUUID(),
      title: item.title.trim(),
      description: description ? description : undefined,
      order: idx,
      pilgrimDone: prev?.pilgrimDone ?? false,
      pilgrimDoneAt: prev?.pilgrimDoneAt,
      pilgrimDoneBy: prev?.pilgrimDoneBy,
      hubDone: prev?.hubDone ?? false,
      hubDoneAt: prev?.hubDoneAt,
      hubDoneBy: prev?.hubDoneBy,
      validatedAt: prev?.validatedAt,
    };
  });
}

/**
 * PUT /api/residencies/[residencyId]/milestones/[pilgrimPassportTokenId]
 * Pilgrim edits in `none`/`draft`; Hub signer edits in `submitted`.
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ residencyId: string; pilgrimPassportTokenId: string }> }
) {
  try {
    const { residencyId, pilgrimPassportTokenId } = await params;
    const ids = parseIds(residencyId, pilgrimPassportTokenId);
    if (!ids) return NextResponse.json({ error: "Invalid ids" }, { status: 400 });

    const body = await request.json();
    const wallet: string = body._wallet_address || body.wallet || "";
    const parsed = updateMilestonesInputSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid milestones", issues: parsed.error.issues },
        { status: 400 }
      );
    }

    const access = await resolveMilestoneAccess(ids.rid, ids.tid, wallet);
    if (!access) return NextResponse.json({ error: "Residency not found" }, { status: 404 });
    if (!access.selected || access.role === "none") {
      return NextResponse.json({ error: "Not authorized." }, { status: 403 });
    }
    if (access.awarded) {
      return NextResponse.json({ error: "This residency has already been awarded." }, { status: 409 });
    }

    const existing = await getMilestonePlan(residencyId, pilgrimPassportTokenId);
    const status = existing?.status ?? "none";

    // Pilgrim may edit while none/draft; hub signer may edit while submitted.
    const pilgrimEdit = access.isPilgrim && (status === "none" || status === "draft");
    const hubEdit = access.isHubSigner && status === "submitted";
    if (!pilgrimEdit && !hubEdit) {
      return NextResponse.json(
        { error: "Milestones can't be edited in the current state." },
        { status: 409 }
      );
    }

    const now = new Date().toISOString();
    const by = getAddress(wallet).toLowerCase();
    const milestones = normalizeMilestones(parsed.data.milestones, existing?.milestones ?? []);

    const plan: ResidencyMilestonePlan = existing
      ? {
          ...existing,
          milestones,
          // pilgrim editing keeps draft; hub editing keeps submitted
          status: pilgrimEdit ? "draft" : existing.status,
          updatedAt: now,
          updatedBy: by,
          revision: existing.revision + 1,
        }
      : {
          residencyId: Number(ids.rid),
          hubSafe: access.residency.hubSafe.toLowerCase(),
          pilgrimPassportTokenId: Number(ids.tid),
          pilgrimAddress: by,
          status: "draft",
          milestones,
          createdAt: now,
          createdBy: by,
          updatedAt: now,
          updatedBy: by,
          revision: 1,
        };

    await upsertMilestonePlan(plan);
    return NextResponse.json({ success: true, plan });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Internal server error";
    console.error("milestone PUT error:", err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
