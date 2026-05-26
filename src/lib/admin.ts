import { getDb } from "./db";

interface AdminCheckParams {
  profileId: string;
  profileType: "hub" | "pilgrim";
  walletAddress: string;
}

interface AdminCheckResult {
  isAdmin: boolean;
  role: string | null;
}

export async function isProfileAdmin({
  profileId,
  profileType,
  walletAddress,
}: AdminCheckParams): Promise<AdminCheckResult> {
  if (!profileId || !profileType || !walletAddress) {
    return { isAdmin: false, role: null };
  }

  const normalizedAddress = walletAddress.toLowerCase();

  try {
    const sql = getDb();
    const rows = await sql`
      SELECT role FROM profile_admins
      WHERE profile_id = ${profileId}
        AND profile_type = ${profileType}
        AND wallet_address = ${normalizedAddress}
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
