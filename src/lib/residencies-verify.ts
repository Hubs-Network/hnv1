/**
 * Server-side EIP-712 signature verification for Residencies (SERVER ONLY).
 *
 * Signers are EOAs (hub Safe owner or pilgrim wallet, per the contract's ECDSA
 * checks), so we recover the address offline and compare. The contract remains
 * the final authority; this just rejects malformed requests before spending
 * relayer gas.
 */
import {
  recoverTypedDataAddress,
  getAddress,
  type Hex,
  type TypedDataDomain,
} from "viem";
import { isHubApprovedOnChain } from "@/lib/hn-badge-sbt";
import { isHubAdmin } from "@/lib/safe";

interface TypedPayload {
  domain: TypedDataDomain;
  types: Record<string, readonly { name: string; type: string }[]>;
  primaryType: string;
  message: Record<string, unknown>;
}

/** Recover the signer of an EIP-712 typed-data payload and compare to expected. */
export async function verifyTypedSigner(
  payload: TypedPayload,
  signature: string,
  expectedSigner: string
): Promise<boolean> {
  try {
    const recovered = await recoverTypedDataAddress({
      domain: payload.domain,
      types: payload.types,
      primaryType: payload.primaryType,
      message: payload.message,
      signature: signature as Hex,
    } as Parameters<typeof recoverTypedDataAddress>[0]);
    return getAddress(recovered) === getAddress(expectedSigner);
  } catch {
    return false;
  }
}

/**
 * Verify a hub action signer: the hub Safe must be an approved Hubs Network hub
 * AND the signer must currently be an owner of that Safe. Mirrors the contract's
 * _validateHubSigner (isApprovedHub + ISafe.isOwner).
 */
export async function verifyHubSigner(
  hubSafe: string,
  signer: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  const approved = await isHubApprovedOnChain(hubSafe);
  if (!approved) {
    return { ok: false, error: "This Hub is not verified yet." };
  }
  const owner = await isHubAdmin(hubSafe, signer);
  if (!owner) {
    return { ok: false, error: "Only a Hub Safe signer can perform this action." };
  }
  return { ok: true };
}
