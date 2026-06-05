import { NextRequest, NextResponse } from "next/server";

/**
 * GET /api/relay/pending?safeAddress=0x...
 *
 * Fetch pending proposals for a Safe multisig.
 */
export async function GET(request: NextRequest) {
  try {
    const safeAddress = request.nextUrl.searchParams.get("safeAddress");
    if (!safeAddress) {
      return NextResponse.json({ error: "safeAddress required" }, { status: 400 });
    }

    const { getDb } = await import("@/lib/db");
    const sql = getDb();

    const proposals = await sql`
      SELECT
        p.id,
        p.safe_address,
        p.hub_id,
        p.to_address,
        p.value,
        p.data,
        p.operation,
        p.nonce,
        p.safe_tx_hash,
        p.description,
        p.proposer,
        p.status,
        p.threshold,
        p.created_at,
        COALESCE(
          json_agg(
            json_build_object(
              'owner', c.owner_address,
              'signature', c.signature
            )
          ) FILTER (WHERE c.id IS NOT NULL),
          '[]'
        ) as confirmations
      FROM safe_proposals p
      LEFT JOIN safe_confirmations c ON c.proposal_id = p.id
      WHERE p.safe_address = ${safeAddress.toLowerCase()}
        AND p.status = 'pending'
      GROUP BY p.id
      ORDER BY p.created_at DESC
    `;

    return NextResponse.json({ proposals });
  } catch (err: any) {
    console.error("Pending proposals error:", err);
    return NextResponse.json(
      { error: err?.message || "Failed to fetch proposals" },
      { status: 500 }
    );
  }
}
