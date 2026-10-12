/**
 * Notification aggregation (SERVER ONLY).
 *
 * Derives the current set of notifications for a wallet purely from existing
 * authoritative sources (hub profiles, on-chain passport claims, on-chain
 * residency selection). It writes nothing and does not touch any flow — it only
 * reads. Every category is isolated in try/catch so a single failing data
 * source can never break the others (or the UI consuming them).
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
  getResidency,
} from "@/lib/residencies-contract";
import { getResidencyMetadata } from "@/lib/data/residencies";
import { parseResidencyMetadataURI } from "@/lib/schemas/residency";

/** Case 1 — hubs the wallet manages whose HN Badge SBT has been minted. */
async function computeHubSbtMinted(
  owner: string,
  hubs: HubProfile[]
): Promise<AppNotification[]> {
  const owned = await Promise.all(
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

  return owned
    .filter((h): h is HubProfile => h !== null)
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
async function computePassportMinted(
  owner: string
): Promise<AppNotification[]> {
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

/**
 * Case 3 — HN admins get one notification per hub whose SBT claim is pending.
 * Not dismissible: it clears automatically once the hub is minted (status
 * leaves "pending"), whether by this admin or another.
 */
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

/** Case 4 — residencies where the wallet's passport has been selected. */
async function computeResidencySelected(
  passportToken: bigint
): Promise<AppNotification[]> {
  const total = Number(await getTotalResidencies());
  if (!total || total < 1) return [];
  const ids = Array.from({ length: total }, (_, i) => BigInt(i + 1));

  const results = await Promise.all(
    ids.map(async (rid) => {
      try {
        const selected = await getSelectedPilgrims(rid);
        if (!selected.some((t) => t === passportToken)) return null;

        let title: string | null = null;
        const onChain = await getResidency(rid);
        if (onChain) {
          const parsed = parseResidencyMetadataURI(onChain.metadataURI);
          if (parsed) {
            const md = await getResidencyMetadata(parsed.hubSafe, parsed.draftId);
            title = md?.title ?? null;
          }
        }
        return { rid, title };
      } catch {
        return null;
      }
    })
  );

  return results
    .filter((r): r is { rid: bigint; title: string | null } => r !== null)
    .map(({ rid, title }) => ({
      id: `residency_selected:${rid.toString()}:${passportToken.toString()}`,
      type: "residency_selected" as const,
      channel: "passport" as const,
      title: "Selected for a residency",
      message: `You were selected for ${
        title ? `"${title}"` : `residency #${rid.toString()}`
      }.`,
      href: `/residencies/${rid.toString()}`,
      dismissible: false,
    }));
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

    const [hubMinted, passportMinted, adminClaims, selected] = await Promise.all([
      computeHubSbtMinted(addr, hubs).catch(() => []),
      computePassportMinted(addr).catch(() => []),
      admin ? Promise.resolve(computeAdminHubClaims(hubs)) : Promise.resolve([]),
      passportToken
        ? computeResidencySelected(passportToken).catch(() => [])
        : Promise.resolve([]),
    ]);

    return [...hubMinted, ...passportMinted, ...adminClaims, ...selected];
  } catch {
    return [];
  }
}
