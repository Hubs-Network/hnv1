/**
 * App-signer EIP-712 signing — SERVER ONLY.
 *
 * The app signer is a dedicated backend EOA whose private key
 * (PILGRIM_PASSPORT_APP_SIGNER_PRIVATE_KEY) lives only in server env. It signs
 * AppAuthorization typed-data to co-authorize a Passport claim. NEVER expose the
 * key client-side and NEVER use a NEXT_PUBLIC_ mirror of it.
 *
 * Server-only module: only import from API routes.
 */
import { privateKeyToAccount } from "viem/accounts";
import { getAddress, type Hex } from "viem";
import {
  buildAppAuthorizationTypedData,
  type SkillHash,
} from "./pilgrim-passport-message";

function getAppSignerAccount() {
  const pk = process.env.PILGRIM_PASSPORT_APP_SIGNER_PRIVATE_KEY;
  if (!pk) {
    throw new Error("PILGRIM_PASSPORT_APP_SIGNER_PRIVATE_KEY not configured");
  }
  const normalized = pk.startsWith("0x") ? pk : `0x${pk}`;
  return privateKeyToAccount(normalized as Hex);
}

/** Returns the app signer address derived from the server private key. */
export function getAppSignerAddress(): `0x${string}` {
  return getAddress(getAppSignerAccount().address);
}

/**
 * Sign the AppAuthorization typed-data with the app signer key.
 * The values MUST match what the applicant signs in the ClaimRequest.
 */
export async function signAppAuthorization(input: {
  applicant: string;
  hubSafe: string;
  proposedSkills: SkillHash[];
  applicantNonce: bigint;
  signatureDeadline: bigint;
}): Promise<Hex> {
  const account = getAppSignerAccount();
  const { domain, types, message } = buildAppAuthorizationTypedData(input);

  return account.signTypedData({
    domain,
    types,
    primaryType: "AppAuthorization",
    message,
  });
}
