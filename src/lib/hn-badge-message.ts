/**
 * Shared (client + server) builder for the HN Badge admin action message.
 *
 * The approver signs this exact message with personal_sign; the server
 * reconstructs it and recovers the signer to verify authenticity.
 * Pure module: no client/server-only imports so both sides can use it.
 */
export type HNBadgeAction = "approve" | "reject";

/** Signatures older than this are rejected (replay/freshness guard). */
export const HN_BADGE_ACTION_MAX_AGE_MS = 10 * 60 * 1000;

export function buildHNBadgeActionMessage(params: {
  action: HNBadgeAction;
  hubId: string;
  issuedAt: string;
}): string {
  return [
    "Hubs Network Badge — admin action",
    `Action: ${params.action}`,
    `Hub: ${params.hubId}`,
    `Issued At: ${params.issuedAt}`,
  ].join("\n");
}
