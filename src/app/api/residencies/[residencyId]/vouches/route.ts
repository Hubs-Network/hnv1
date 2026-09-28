import { NextRequest, NextResponse } from "next/server";
import { isAddress, getAddress, type Hex } from "viem";
import { randomUUID } from "crypto";
import { createVouchInputSchema, type Vouch } from "@/lib/schemas/vouch";
import {
  getVouch,
  saveVouch,
  listActiveVouches,
} from "@/lib/data/residency-vouches";
import { getResidency } from "@/lib/residencies-contract";
import {
  getOnChainApplication,
  isActivePatron,
  PATRON_STATUS,
} from "@/lib/patron-sbt";
import { isPatronManager } from "@/lib/patron-admins";
import { getPatronById } from "@/lib/data/patrons";
import { RESIDENCY_STATUS } from "@/config/residencies";

export const dynamic = "force-dynamic";

/**
 * GET /api/residencies/[residencyId]/vouches
 * Public list of ACTIVE vouches for a residency (Patron support).
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ residencyId: string }> }
) {
  try {
    const { residencyId } = await params;
    if (!/^\d+$/.test(residencyId)) {
      return NextResponse.json({ error: "Invalid residency id" }, { status: 400 });
    }
    const vouches = await listActiveVouches(residencyId);
    // Do not expose the creator wallet publicly; keep patron-attributed fields.
    const publicVouches = vouches.map((v) => ({
      patronApplicationId: v.patronApplicationId,
      patronTokenId: v.patronTokenId,
      patronName: v.patronName,
      amount: v.amount,
      currency: v.currency,
      purpose: v.purpose,
      link: v.link || null,
      createdAt: v.createdAt,
    }));
    return NextResponse.json({ vouches: publicVouches });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Internal server error";
    console.error("vouches GET error:", err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/**
 * POST /api/residencies/[residencyId]/vouches
 * Body: { _wallet_address, action?: "create" | "withdraw", ...createVouchInput }
 *
 * Only a manager (owner or delegated admin) of an ACTIVE Patron may vouch, and
 * only while the residency is OPEN. One active vouch per (patron, residency);
 * re-submitting upserts. "withdraw" marks the vouch withdrawn.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ residencyId: string }> }
) {
  try {
    const { residencyId } = await params;
    if (!/^\d+$/.test(residencyId)) {
      return NextResponse.json({ error: "Invalid residency id" }, { status: 400 });
    }
    const body = await request.json();
    const caller: string = body._wallet_address || "";
    const action: "create" | "withdraw" =
      body.action === "withdraw" ? "withdraw" : "create";

    if (!isAddress(caller)) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    }

    // Residency must exist and be OPEN.
    const residency = await getResidency(BigInt(residencyId));
    if (!residency) {
      return NextResponse.json({ error: "Residency not found" }, { status: 404 });
    }
    if (residency.status !== RESIDENCY_STATUS.Open) {
      return NextResponse.json(
        { error: "You can only vouch an open residency." },
        { status: 409 }
      );
    }

    // ── Withdraw ──────────────────────────────────────────────────────────
    if (action === "withdraw") {
      const patronApplicationId: string = body.patronApplicationId || "";
      if (!/^0x[a-fA-F0-9]{64}$/.test(patronApplicationId)) {
        return NextResponse.json({ error: "Invalid patron id" }, { status: 400 });
      }
      if (!(await isPatronManager(patronApplicationId, caller))) {
        return NextResponse.json(
          { error: "Only a manager of this Patron can withdraw its vouch." },
          { status: 403 }
        );
      }
      const existing = await getVouch(residencyId, patronApplicationId);
      if (!existing) {
        return NextResponse.json({ error: "Vouch not found" }, { status: 404 });
      }
      await saveVouch({
        ...existing,
        status: "withdrawn",
        withdrawnAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
      return NextResponse.json({ success: true, status: "withdrawn" });
    }

    // ── Create / update ─────────────────────────────────────────────────
    const parsed = createVouchInputSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || "Invalid vouch" },
        { status: 400 }
      );
    }
    const input = parsed.data;

    // Caller must manage the Patron.
    if (!(await isPatronManager(input.patronApplicationId, caller))) {
      return NextResponse.json(
        { error: "You are not a manager of this Patron." },
        { status: 403 }
      );
    }

    // Patron must be active/approved on-chain.
    const onChain = await getOnChainApplication(input.patronApplicationId as Hex);
    if (!onChain || onChain.status !== PATRON_STATUS.Minted) {
      return NextResponse.json(
        { error: "This Patron is not approved." },
        { status: 409 }
      );
    }
    if (!(await isActivePatron(onChain.tokenId))) {
      return NextResponse.json(
        { error: "This Patron is no longer active." },
        { status: 409 }
      );
    }

    const profile = await getPatronById(input.patronApplicationId);
    const now = new Date().toISOString();
    const existing = await getVouch(residencyId, input.patronApplicationId);

    const vouch: Vouch = {
      vouchId: existing?.vouchId || randomUUID(),
      residencyId,
      patronApplicationId: input.patronApplicationId as `0x${string}`,
      patronTokenId: onChain.tokenId.toString(),
      patronName: profile?.companyName || "Patron",
      createdBy: getAddress(caller),
      amount: input.amount,
      currency: input.currency,
      purpose: input.purpose,
      link: input.link || "",
      status: "active",
      createdAt: existing?.createdAt || now,
      updatedAt: now,
    };

    try {
      await saveVouch(vouch);
    } catch (persistErr) {
      const m = persistErr instanceof Error ? persistErr.message : "persist failed";
      return NextResponse.json({ error: `Failed to save vouch: ${m}` }, { status: 500 });
    }

    return NextResponse.json({ success: true, status: "active" });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Internal server error";
    console.error("vouches POST error:", err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
