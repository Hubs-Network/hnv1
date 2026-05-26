import { getDb } from "./db";

// ─── Future Holons integration type scaffolding ─────────────────────
// TODO: Future Holons integration:
// - Telegram bot gathers consent
// - Holons signs/submits operation to Hubs Network API
// - API verifies HOLONS_WEBHOOK_SECRET or signed payload
// - API checks integration permission in a future profile_access table
export type AdminSubject =
  | { type: "wallet"; address: string }
  | { type: "integration"; provider: "holons"; subjectId: string };

// ─── Active wallet admin logic (uses profile_admins table) ──────────

export type ProfileType = "hub" | "pilgrim";

export async function addAdmin({
  profileId,
  profileType,
  walletAddress,
  role = "admin",
}: {
  profileId: string;
  profileType: ProfileType;
  walletAddress: string;
  role?: string;
}) {
  const sql = getDb();
  const normalized = walletAddress.toLowerCase();
  await sql`
    INSERT INTO profile_admins (profile_id, profile_type, wallet_address, role)
    VALUES (${profileId}, ${profileType}, ${normalized}, ${role})
    ON CONFLICT (profile_id, profile_type, wallet_address)
    DO UPDATE SET role = EXCLUDED.role
  `;
}

export async function removeAdmin({
  profileId,
  profileType,
  walletAddress,
}: {
  profileId: string;
  profileType: ProfileType;
  walletAddress: string;
}) {
  const sql = getDb();
  const normalized = walletAddress.toLowerCase();
  await sql`
    DELETE FROM profile_admins
    WHERE profile_id = ${profileId}
      AND profile_type = ${profileType}
      AND wallet_address = ${normalized}
  `;
}

export async function checkAdmin({
  profileId,
  profileType,
  walletAddress,
}: {
  profileId: string;
  profileType: ProfileType;
  walletAddress: string;
}): Promise<{ isAdmin: boolean; role: string | null }> {
  if (!profileId || !profileType || !walletAddress) {
    return { isAdmin: false, role: null };
  }

  const normalized = walletAddress.toLowerCase();

  try {
    const sql = getDb();
    const rows = await sql`
      SELECT role FROM profile_admins
      WHERE profile_id = ${profileId}
        AND profile_type = ${profileType}
        AND wallet_address = ${normalized}
      LIMIT 1
    `;

    if (rows.length > 0) {
      return { isAdmin: true, role: rows[0].role };
    }
    return { isAdmin: false, role: null };
  } catch (err) {
    console.error("Admin check DB error:", err);
    return { isAdmin: false, role: null };
  }
}

export async function listAdmins({
  profileId,
  profileType,
}: {
  profileId: string;
  profileType: ProfileType;
}) {
  const sql = getDb();
  const rows = await sql`
    SELECT wallet_address, role, created_at
    FROM profile_admins
    WHERE profile_id = ${profileId}
      AND profile_type = ${profileType}
    ORDER BY created_at ASC
  `;
  return rows;
}

/** Convenience alias kept for backward compat */
export const isProfileAdmin = checkAdmin;
