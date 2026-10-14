/**
 * Notification aggregation (SERVER ONLY).
 *
 * Derives the current set of notifications for a wallet purely from existing
 * authoritative sources (hub profiles, on-chain passport claims, on-chain
 * residency selection/award, and off-chain milestone plan JSON). It writes
 * nothing and does not touch any flow — it only reads. Every category is
 * isolated in try/catch so a single failing data source can never break the
 * others (or the UI consuming them).
 *
 * Milestone notifications are state-driven (not dismissible): they reflect the
 * current milestone plan status and clear on their own as the plan advances.
 */
import { getAddress } from "viem";
import type { AppNotification } from "@/types/notifications";
import type { HubProfile } from "@/types";
import { getAllHubs } from "@/lib/data/hubs";
import { isHubAdmin } from "@/lib/safe";
import { isSafeBasedHub } from "@/lib/hub-admin";
import { isHNAdmin } from "@/lib/hn-admin";
import {
  getApplicantClaims,
  getDetailedClaim,
  getPassportTokenOfOwner,
  CLAIM_STATUS,
} from "@/lib/pilgrim-passport-sbt";
import {
  getTotalResidencies,
  getSelectedPilgrims,
  getHubResidencies,
  getResidency,
  isAwarded as readIsAwarded,
} from "@/lib/residencies-contract";
import { getResidencyMetadata } from "@/lib/data/residencies";
import { parseResidencyMetadataURI } from "@/lib/schemas/residency";
import { getMilestonePlan } from "@/lib/data/residency-milestones";

/** Resolve the residency title (metadata) for nicer notification copy. */
async function residencyTitle(residencyId: bigint): Promise<string | null> {
  try {
    const onChain = await getResidency(residencyId);
    if (!onChain) return null;
    const parsed = parseResidencyMetadataURI(onChain.metadataURI);
    if (!parsed) return null;
    const md = await getResidencyMetadata(parsed.hubSafe, parsed.draftId);
    return md?.title ?? null;
  } catch {
    return null;
  }
}

function residencyLabel(residencyId: bigint, title: string | null): string {
  return title ? `"${title}"` : `residency #${residencyId.toString()}`;
}

/** Hubs the wallet is a Safe signer of (on-chain ownership check). */
async function computeOwnedHubs(
  owner: string,
  hubs: HubProfile[]
): Promise<HubProfile[]> {
  const checks = await Promise.all(
    hubs.map(async (h) => {
      const safe = h.safeAddress;
      if (!safe || !isSafeBasedHub(safe)) return null;
      try {
        return (await isHubAdmin(safe, owner)) ? h : null;
      } catch {
        return null;
      }
    })
  );
  return checks.filter((h): h is HubProfile => h !== null);
}

/** Case 1 — hubs the wallet manages whose HN Badge SBT has been minted. */
function computeHubSbtMinted(ownedHubs: HubProfile[]): AppNotification[] {
  return ownedHubs
    .filter((h) => h.hnBadgeStatus === "approved" && !!h.hnBadgeTokenId)
    .map((h) => ({
      id: `hub_sbt_minted:${h.hub_id}:${h.hnBadgeTokenId}`,
      type: "hub_sbt_minted" as const,
      channel: "menu" as const,
      title: "Hub SBT minted",
      message: `${h.name} received its Hubs Network Badge (token #${h.hnBadgeTokenId}).`,
      href: `/hubs/${h.hub_id}`,
      dismissible: true,
    }));
}

/** Case 2 — the wallet's Pilgrim Passport claim has been minted. */
async function computePassportMinted(owner: string): Promise<AppNotification[]> {
  const ids = await getApplicantClaims(owner);
  if (ids.length === 0) return [];
  const detailed = await Promise.all(ids.map((id) => getDetailedClaim(id)));
  const minted = detailed.filter(
    (d): d is NonNullable<typeof d> => d !== null && d.status === CLAIM_STATUS.Minted
  );
  if (minted.length === 0) return [];

  const token = await getPassportTokenOfOwner(owner).catch(() => null);
  return minted.map((d) => ({
    id: `passport_minted:${d.claimId}`,
    type: "passport_minted" as const,
    channel: "menu" as const,
    title: "Passport minted",
    message: "Your Pilgrim Passport has been minted.",
    href: token ? `/passport/${token.toString()}` : undefined,
    dismissible: true,
  }));
}

/** Case 3 — HN admins: one notification per hub with a pending SBT claim. */
function computeAdminHubClaims(hubs: HubProfile[]): AppNotification[] {
  return hubs
    .filter((h) => h.hnBadgeStatus === "pending")
    .map((h) => ({
      id: `admin_hub_claim:${h.hub_id}`,
      type: "admin_hub_claim" as const,
      channel: "menu" as const,
      title: "Hub SBT claim pending",
      message: `${h.name} claimed the Hubs Network Badge and is awaiting mint.`,
      href: "/admin",
      dismissible: false,
    }));
}

/**
 * Case 4 + milestone pilgrim notifications. For every residency where the
 * wallet's passport is selected, emit:
 *  - residency_selected (passport channel) while not awarded;
 *  - the current milestone action notification (menu channel).
 */
async function computePilgrimResidencyNotifications(
  passportToken: bigint
): Promise<AppNotification[]> {
  const total = Number(await getTotalResidencies());
  if (!total || total < 1) return [];
  const ids = Array.from({ length: total }, (_, i) => BigInt(i + 1));
  const tokenStr = passportToken.toString();

  const perResidency = await Promise.all(
    ids.map(async (rid) => {
      try {
        const selected = await getSelectedPilgrims(rid);
        if (!selected.some((t) => t === passportToken)) return [];

        const [awarded, title, plan] = await Promise.all([
          readIsAwarded(rid, passportToken),
          residencyTitle(rid),
          getMilestonePlan(rid.toString(), tokenStr),
        ]);
        const href = `/residencies/${rid.toString()}/milestones/${tokenStr}`;
        const label = residencyLabel(rid, title);
        const out: AppNotification[] = [];

        if (awarded) {
          out.push({
            id: `residency_awarded:${rid.toString()}:${tokenStr}`,
            type: "residency_awarded",
            channel: "menu",
            title: "Residency awarded",
            message: `Your skills for ${label} have been attested.`,
            href,
            dismissible: true,
          });
          return out;
        }

        // Keep the existing passport-section "selected" notice (non-awarded).
        out.push({
          id: `residency_selected:${rid.toString()}:${tokenStr}`,
          type: "residency_selected",
          channel: "passport",
          title: "Selected for a residency",
          message: `You were selected for ${label}.`,
          href,
          dismissible: false,
        });

        const status = plan?.status ?? "none";
        const hubName = title; // best-effort; title doubles as context
        if (status === "none" || status === "draft") {
          out.push({
            id: `milestones_required:${rid.toString()}:${tokenStr}`,
            type: "milestones_required",
            channel: "menu",
            title: "Milestones needed",
            message: `Create milestones for your selected residency ${
              hubName ? `(${hubName})` : `#${rid.toString()}`
            }.`,
            href,
            dismissible: false,
          });
        } else if (status === "confirmed") {
          const everyUnmarked = (plan?.milestones ?? []).every((m) => !m.pilgrimDone);
          if (everyUnmarked) {
            out.push({
              id: `milestones_confirmed:${rid.toString()}:${tokenStr}`,
              type: "milestones_confirmed",
              channel: "menu",
              title: "Milestones confirmed",
              message: `Milestones confirmed for ${label}. Start marking them done.`,
              href,
              dismissible: false,
            });
          } else {
            out.push({
              id: `milestone_waiting_pilgrim_done:${rid.toString()}:${tokenStr}`,
              type: "milestone_waiting_pilgrim_done",
              channel: "menu",
              title: "Mark milestones done",
              message: "Mark your completed residency milestones as done.",
              href,
              dismissible: false,
            });
          }
        } else if (status === "all_validated") {
          out.push({
            id: `residency_ready_for_attestation:${rid.toString()}:${tokenStr}`,
            type: "residency_ready_for_attestation",
            channel: "menu",
            title: "Ready for attestation",
            message: "All milestones are validated. Waiting for Hub attestation.",
            href,
            dismissible: false,
          });
        }
        return out;
      } catch {
        return [];
      }
    })
  );

  return perResidency.flat();
}

/** Hub signer milestone notifications across the hubs the wallet signs for. */
async function computeHubMilestoneNotifications(
  ownedHubs: HubProfile[]
): Promise<AppNotification[]> {
  const perHub = await Promise.all(
    ownedHubs.map(async (hub) => {
      const hubSafe = hub.safeAddress;
      if (!hubSafe) return [];
      try {
        const rids = await getHubResidencies(hubSafe);
        const perResidency = await Promise.all(
          rids.map(async (rid) => {
            try {
              const selected = await getSelectedPilgrims(rid);
              if (selected.length === 0) return [];
              const title = await residencyTitle(rid);
              const label = residencyLabel(rid, title);

              const rows = await Promise.all(
                selected.map(async (tokenId) => {
                  try {
                    if (await readIsAwarded(rid, tokenId)) return null;
                    const plan = await getMilestonePlan(
                      rid.toString(),
                      tokenId.toString()
                    );
                    if (!plan) return null;
                    const href = `/residencies/${rid.toString()}/milestones/${tokenId.toString()}`;
                    if (plan.status === "submitted") {
                      return {
                        id: `milestones_pending_hub_review:${rid.toString()}:${tokenId.toString()}`,
                        type: "milestones_pending_hub_review" as const,
                        channel: "menu" as const,
                        title: "Milestones to review",
                        message: `A selected Pilgrim submitted milestones for ${label}.`,
                        href,
                        dismissible: false,
                      };
                    }
                    if (
                      plan.status === "confirmed" &&
                      plan.milestones.some((m) => !m.hubDone)
                    ) {
                      return {
                        id: `milestone_waiting_hub_done:${rid.toString()}:${tokenId.toString()}`,
                        type: "milestone_waiting_hub_done" as const,
                        channel: "menu" as const,
                        title: "Confirm milestones",
                        message: `Confirm completed milestones for ${label}.`,
                        href,
                        dismissible: false,
                      };
                    }
                    if (plan.status === "all_validated") {
                      return {
                        id: `milestones_ready_to_award:${rid.toString()}:${tokenId.toString()}`,
                        type: "milestones_ready_to_award" as const,
                        channel: "menu" as const,
                        title: "Ready to award",
                        message: `All milestones validated. Award skills to the Pilgrim for ${label}.`,
                        href,
                        dismissible: false,
                      };
                    }
                    return null;
                  } catch {
                    return null;
                  }
                })
              );
              return rows.filter((r): r is NonNullable<typeof r> => r !== null);
            } catch {
              return [];
            }
          })
        );
        return perResidency.flat();
      } catch {
        return [];
      }
    })
  );
  return perHub.flat();
}

/**
 * Build the full notification set for a wallet. Returns [] on any top-level
 * failure so callers can render safely without special-casing errors.
 */
export async function getNotificationsForWallet(
  owner: string
): Promise<AppNotification[]> {
  if (!owner) return [];
  let addr: string;
  try {
    addr = getAddress(owner);
  } catch {
    return [];
  }

  try {
    const [hubs, admin, passportToken] = await Promise.all([
      getAllHubs().catch(() => [] as HubProfile[]),
      isHNAdmin(addr).catch(() => false),
      getPassportTokenOfOwner(addr).catch(() => null),
    ]);

    const ownedHubs = await computeOwnedHubs(addr, hubs).catch(
      () => [] as HubProfile[]
    );

    const [
      hubMinted,
      passportMinted,
      adminClaims,
      pilgrimResidency,
      hubMilestones,
    ] = await Promise.all([
      Promise.resolve(computeHubSbtMinted(ownedHubs)),
      computePassportMinted(addr).catch(() => []),
      admin ? Promise.resolve(computeAdminHubClaims(hubs)) : Promise.resolve([]),
      passportToken
        ? computePilgrimResidencyNotifications(passportToken).catch(() => [])
        : Promise.resolve([]),
      ownedHubs.length > 0
        ? computeHubMilestoneNotifications(ownedHubs).catch(() => [])
        : Promise.resolve([]),
    ]);

    return [
      ...hubMinted,
      ...passportMinted,
      ...adminClaims,
      ...pilgrimResidency,
      ...hubMilestones,
    ];
  } catch {
    return [];
  }
}
