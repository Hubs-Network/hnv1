/**
 * Active-residency read helpers for the Milestone Dashboard (SERVER ONLY).
 *
 * "Active" = the pilgrim is selected on-chain and NOT yet awarded. Enumerated
 * from the authoritative contract state, enriched with off-chain milestone plan
 * status + residency metadata (title/hub name). Read-only.
 */
import {
  getResidency,
  getTotalResidencies,
  getHubResidencies,
  getSelectedPilgrims,
  isSelected as readIsSelected,
  isAwarded as readIsAwarded,
  type OnChainResidency,
} from "@/lib/residencies-contract";
import { getPassportTokenOfOwner, getPassportOwner } from "@/lib/pilgrim-passport-sbt";
import { getResidencyMetadata } from "@/lib/data/residencies";
import { parseResidencyMetadataURI } from "@/lib/schemas/residency";
import { getMilestonePlan } from "@/lib/data/residency-milestones";
import { getPilgrimByWallet } from "@/lib/data/pilgrims";
import type { MilestonePlanStatus } from "@/lib/schemas/residency-milestones";

async function residencyLabel(
  onChain: OnChainResidency
): Promise<{ title: string | null; hubName: string | null }> {
  const parsed = parseResidencyMetadataURI(onChain.metadataURI);
  if (!parsed) return { title: null, hubName: null };
  const md = await getResidencyMetadata(parsed.hubSafe, parsed.draftId);
  return { title: md?.title ?? null, hubName: md?.hubName ?? null };
}

export interface PilgrimActiveResidency {
  residencyId: string;
  hubSafe: string;
  hubName: string | null;
  title: string | null;
  pilgrimPassportTokenId: string;
  planStatus: MilestonePlanStatus;
}

/** Residencies where this wallet's passport is selected and not yet awarded. */
export async function listPilgrimActiveResidencies(
  owner: string
): Promise<PilgrimActiveResidency[]> {
  const tokenId = await getPassportTokenOfOwner(owner).catch(() => null);
  if (!tokenId) return [];

  const total = Number(await getTotalResidencies());
  if (!total || total < 1) return [];
  const ids = Array.from({ length: total }, (_, i) => BigInt(i + 1));

  const rows = await Promise.all(
    ids.map(async (rid) => {
      try {
        const [selected, awarded] = await Promise.all([
          readIsSelected(rid, tokenId),
          readIsAwarded(rid, tokenId),
        ]);
        if (!selected || awarded) return null;
        const onChain = await getResidency(rid);
        if (!onChain) return null;
        const [{ title, hubName }, plan] = await Promise.all([
          residencyLabel(onChain),
          getMilestonePlan(rid.toString(), tokenId.toString()),
        ]);
        return {
          residencyId: rid.toString(),
          hubSafe: onChain.hubSafe,
          hubName,
          title,
          pilgrimPassportTokenId: tokenId.toString(),
          planStatus: (plan?.status ?? "none") as MilestonePlanStatus,
        } satisfies PilgrimActiveResidency;
      } catch {
        return null;
      }
    })
  );

  return rows.filter((r): r is NonNullable<typeof r> => r !== null);
}

export interface HubActiveResidency {
  residencyId: string;
  title: string | null;
  pilgrimPassportTokenId: string;
  pilgrimOwner: string | null;
  pilgrimNickname: string | null;
  planStatus: MilestonePlanStatus;
}

/** Selected, not-yet-awarded pilgrims across a hub's residencies. */
export async function listHubActiveResidencies(
  hubSafe: string
): Promise<HubActiveResidency[]> {
  const rids = await getHubResidencies(hubSafe);
  if (rids.length === 0) return [];

  const perResidency = await Promise.all(
    rids.map(async (rid) => {
      try {
        const [onChain, selected] = await Promise.all([
          getResidency(rid),
          getSelectedPilgrims(rid),
        ]);
        if (!onChain || selected.length === 0) return [];
        const { title } = await residencyLabel(onChain);

        const rows = await Promise.all(
          selected.map(async (tokenId) => {
            try {
              if (await readIsAwarded(rid, tokenId)) return null;
              const [owner, plan] = await Promise.all([
                getPassportOwner(tokenId).catch(() => null),
                getMilestonePlan(rid.toString(), tokenId.toString()),
              ]);
              let nickname: string | null = null;
              if (owner) {
                try {
                  nickname = (await getPilgrimByWallet(owner))?.nickname ?? null;
                } catch {
                  nickname = null;
                }
              }
              return {
                residencyId: rid.toString(),
                title,
                pilgrimPassportTokenId: tokenId.toString(),
                pilgrimOwner: owner,
                pilgrimNickname: nickname,
                planStatus: (plan?.status ?? "none") as MilestonePlanStatus,
              } satisfies HubActiveResidency;
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
}
