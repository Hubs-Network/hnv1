import { NextRequest, NextResponse } from "next/server";
import { isAddress, getAddress } from "viem";
import { getPatronById, savePatron } from "@/lib/data/patrons";
import {
  resolvePatronOwner,
  getPatronAdmins,
  isPatronOwner,
} from "@/lib/patron-admins";

export const dynamic = "force-dynamic";

function isApplicationId(id: string): boolean {
  return /^0x[a-fA-F0-9]{64}$/.test(id);
}

/**
 * GET /api/patrons/applications/[applicationId]/admins
 * Returns the Patron's on-chain owner + its off-chain admin list.
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ applicationId: string }> }
) {
  try {
    const { applicationId } = await params;
    if (!isApplicationId(applicationId)) {
      return NextResponse.json({ error: "Invalid application id" }, { status: 400 });
    }
    const [owner, admins] = await Promise.all([
      resolvePatronOwner(applicationId),
      getPatronAdmins(applicationId),
    ]);
    if (!owner) {
      return NextResponse.json({ error: "Patron not found" }, { status: 404 });
    }
    return NextResponse.json({ owner, admins });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Internal server error";
    console.error("patron admins GET error:", err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/**
 * POST /api/patrons/applications/[applicationId]/admins
 * Body: { _wallet_address, admin, action: "add" | "remove" }
 *
 * Only the Patron's on-chain owner may edit the admin list. The owner is always
 * an implicit manager, so adding the owner as an admin is rejected as redundant.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ applicationId: string }> }
) {
  try {
    const { applicationId } = await params;
    if (!isApplicationId(applicationId)) {
      return NextResponse.json({ error: "Invalid application id" }, { status: 400 });
    }

    const body = await request.json();
    const caller: string = body._wallet_address || "";
    const admin: string = body.admin || "";
    const action: string = body.action === "remove" ? "remove" : "add";

    if (!isAddress(caller)) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    }
    if (!isAddress(admin)) {
      return NextResponse.json({ error: "Invalid admin address" }, { status: 400 });
    }

    // Only the on-chain owner can manage admins.
    if (!(await isPatronOwner(applicationId, caller))) {
      return NextResponse.json(
        { error: "Only the Patron owner can manage admins." },
        { status: 403 }
      );
    }

    const owner = await resolvePatronOwner(applicationId);
    if (owner && getAddress(owner) === getAddress(admin)) {
      return NextResponse.json(
        { error: "The owner is already a manager and cannot be added as admin." },
        { status: 400 }
      );
    }

    const profile = await getPatronById(applicationId);
    if (!profile) {
      return NextResponse.json({ error: "Patron profile not found" }, { status: 404 });
    }

    const current = (profile.admins ?? []).map((a) => getAddress(a));
    const target = getAddress(admin);
    let next: string[];
    if (action === "add") {
      next = current.some((a) => a === target) ? current : [...current, target];
    } else {
      next = current.filter((a) => a !== target);
    }

    try {
      await savePatron({
        ...profile,
        admins: next,
        updatedAt: new Date().toISOString(),
      });
    } catch (persistErr) {
      const m = persistErr instanceof Error ? persistErr.message : "persist failed";
      return NextResponse.json(
        { error: `Failed to save admins: ${m}` },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true, admins: next });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Internal server error";
    console.error("patron admins POST error:", err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
