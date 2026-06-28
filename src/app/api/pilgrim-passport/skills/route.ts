import { NextResponse } from "next/server";
import {
  getMergedCategories,
  getAllCatalogSkills,
} from "@/lib/pilgrim-skills-catalog";

export const dynamic = "force-dynamic";

/**
 * GET /api/pilgrim-passport/skills
 *
 * Returns the full skill catalog (static taxonomy + runtime custom skills added
 * by HN Directors), grouped by category and as a flat list with bytes32 hashes.
 * Used by the claim selector, the admin "Add New Skill" panel, and any client
 * that needs to render labels for custom skills.
 */
export async function GET() {
  try {
    const [categories, skills] = await Promise.all([
      getMergedCategories(),
      getAllCatalogSkills(),
    ]);
    return NextResponse.json({ categories, skills });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Internal server error";
    console.error("skills catalog error:", err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
