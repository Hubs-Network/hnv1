import { NextResponse } from "next/server";
import { getHubById } from "@/lib/data/hubs";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ hubId: string }> }
) {
  try {
    const { hubId } = await params;
    const hub = await getHubById(hubId);

    if (!hub) {
      return NextResponse.json(
        { error: "Hub not found" },
        { status: 404 }
      );
    }

    return NextResponse.json(hub);
  } catch {
    return NextResponse.json(
      { error: "Failed to load hub" },
      { status: 500 }
    );
  }
}
