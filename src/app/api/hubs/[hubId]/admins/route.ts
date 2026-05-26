import { NextRequest, NextResponse } from "next/server";
import { checkAdmin, addAdmin, removeAdmin, listAdmins } from "@/lib/admin";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ hubId: string }> }
) {
  try {
    const { hubId } = await params;
    const walletAddress = request.headers.get("x-wallet-address") || "";

    if (!walletAddress) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    }

    const caller = await checkAdmin({
      profileId: hubId,
      profileType: "hub",
      walletAddress,
    });

    if (!caller.isAdmin) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 });
    }

    const entries = await listAdmins({ profileId: hubId, profileType: "hub" });

    return NextResponse.json({ admins: entries, caller_role: caller.role });
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ hubId: string }> }
) {
  try {
    const { hubId } = await params;
    const body = await request.json();

    const callerAddress: string = (body._wallet_address || "").toLowerCase();
    const targetAddress: string = (body.wallet_address || "").trim();

    if (!callerAddress) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    }

    if (!targetAddress || !/^0x[a-fA-F0-9]{40}$/.test(targetAddress)) {
      return NextResponse.json(
        { error: "Invalid wallet address format" },
        { status: 400 }
      );
    }

    const caller = await checkAdmin({
      profileId: hubId,
      profileType: "hub",
      walletAddress: callerAddress,
    });

    if (!caller.isAdmin || caller.role !== "owner") {
      return NextResponse.json(
        { error: "Only the owner can add admins" },
        { status: 403 }
      );
    }

    await addAdmin({
      profileId: hubId,
      profileType: "hub",
      walletAddress: targetAddress,
      role: body.role || "admin",
    });

    return NextResponse.json({ success: true, message: "Admin added" });
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ hubId: string }> }
) {
  try {
    const { hubId } = await params;
    const body = await request.json();

    const callerAddress: string = (body._wallet_address || "").toLowerCase();
    const targetAddress: string = (body.wallet_address || "").trim();

    if (!callerAddress) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    }

    const caller = await checkAdmin({
      profileId: hubId,
      profileType: "hub",
      walletAddress: callerAddress,
    });

    if (!caller.isAdmin || caller.role !== "owner") {
      return NextResponse.json(
        { error: "Only the owner can remove admins" },
        { status: 403 }
      );
    }

    if (targetAddress.toLowerCase() === callerAddress) {
      return NextResponse.json(
        { error: "Cannot remove yourself as owner" },
        { status: 400 }
      );
    }

    await removeAdmin({
      profileId: hubId,
      profileType: "hub",
      walletAddress: targetAddress,
    });

    return NextResponse.json({ success: true, message: "Admin removed" });
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
