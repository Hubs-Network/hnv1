import { NextResponse } from "next/server";
import {
  getResidencyView,
  getResidencyApplicantViews,
} from "@/lib/residencies-directory";

export const dynamic = "force-dynamic";

/** GET /api/residencies/[residencyId] — full residency detail + applicants. */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ residencyId: string }> }
) {
  try {
    const { residencyId } = await params;
    if (!/^\d+$/.test(residencyId)) {
      return NextResponse.json({ error: "Invalid residency id" }, { status: 400 });
    }
    const id = BigInt(residencyId);
    const view = await getResidencyView(id);
    if (!view) {
      return NextResponse.json({ error: "Residency not found" }, { status: 404 });
    }
    const applicants = await getResidencyApplicantViews(id);
    return NextResponse.json({ residency: view, applicants });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Internal server error";
    console.error("residency detail error:", err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
