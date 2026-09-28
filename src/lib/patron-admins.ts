/**
 * Patron admin resolution (SERVER ONLY).
 *
 * A Patron's "manager" set is: the on-chain SBT owner (authoritative) + an
 * off-chain, owner-managed `admins` list stored in the Patron JSON. This lets a
 * verified Patron delegate management of its residency actions to other wallets
 * WITHOUT any on-chain change.
 *
 * The on-chain owner is always an implicit manager and is the only party allowed
 * to edit the `admins` list.
 */
import { getAddress, type Hex } from "viem";
import { getOnChainApplication, getPatronOwner } from "@/lib/patron-sbt";
import { getPatronById } from "@/lib/data/patrons";

/**
 * Authoritative owner of a Patron: the on-chain token owner once minted, else the
 * applicant recorded on-chain. Returns null if the application does not exist.
 */
export async function resolvePatronOwner(
  applicationId: string
): Promise<string | null> {
  const onChain = await getOnChainApplication(applicationId as Hex);
  if (!onChain) return null;
  if (onChain.tokenId > BigInt(0)) {
    const owner = await getPatronOwner(onChain.tokenId);
    if (owner) return getAddress(owner);
  }
  return getAddress(onChain.applicant);
}

/** Off-chain admin addresses (checksummed) for a Patron. */
export async function getPatronAdmins(applicationId: string): Promise<string[]> {
  const profile = await getPatronById(applicationId);
  return (profile?.admins ?? []).map((a) => getAddress(a));
}

/** True if `wallet` is the authoritative on-chain owner of the Patron. */
export async function isPatronOwner(
  applicationId: string,
  wallet: string
): Promise<boolean> {
  const owner = await resolvePatronOwner(applicationId);
  return owner ? getAddress(owner) === getAddress(wallet) : false;
}

/** True if `wallet` is the owner OR a delegated admin of the Patron. */
export async function isPatronManager(
  applicationId: string,
  wallet: string
): Promise<boolean> {
  if (await isPatronOwner(applicationId, wallet)) return true;
  const admins = await getPatronAdmins(applicationId);
  const w = getAddress(wallet);
  return admins.some((a) => getAddress(a) === w);
}
