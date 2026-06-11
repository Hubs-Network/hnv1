/**
 * Server-side verification of HN Badge admin action signatures.
 *
 * Recovers the signer from a personal_sign signature so callers can verify the
 * signer is an actual HN Directors Safe owner — we never trust a client-supplied
 * address. Includes a freshness guard against stale/replayed signatures.
 */
import { recoverMessageAddress, getAddress, type Hex } from "viem";
import {
  buildHNBadgeActionMessage,
  HN_BADGE_ACTION_MAX_AGE_MS,
  type HNBadgeAction,
} from "./hn-badge-message";

/**
 * Recover the checksummed signer address for a given action, or null if the
 * signature is invalid or expired.
 */
export async function recoverHNBadgeSigner(params: {
  action: HNBadgeAction;
  hubId: string;
  issuedAt: string;
  signature: string;
}): Promise<string | null> {
  const ts = Date.parse(params.issuedAt);
  if (Number.isNaN(ts)) return null;
  if (Math.abs(Date.now() - ts) > HN_BADGE_ACTION_MAX_AGE_MS) return null;

  try {
    const message = buildHNBadgeActionMessage({
      action: params.action,
      hubId: params.hubId,
      issuedAt: params.issuedAt,
    });
    const recovered = await recoverMessageAddress({
      message,
      signature: params.signature as Hex,
    });
    return getAddress(recovered);
  } catch {
    return null;
  }
}
