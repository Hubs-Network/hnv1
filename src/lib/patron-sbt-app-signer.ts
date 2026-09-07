/**
 * Patron app-signer EIP-712 signing — SERVER ONLY.
 *
 * The app signer is a dedicated backend EOA whose private key
 * (PATRON_SBT_APP_SIGNER_PRIVATE_KEY) lives only in server env. It co-signs the
 * AppAuthorization typed-data for a Patron application. NEVER expose the key
 * client-side and NEVER create a NEXT_PUBLIC_ mirror of it.
 *
 * Kept explicitly separate from the Pilgrim Passport app signer even if the
 * same EOA/key is used, so the two features stay decoupled.
 */
import { privateKeyToAccount } from "viem/accounts";
import { getAddress, type Hex } from "viem";
import {
  buildPatronAppAuthorizationTypedData,
  type SkillHash,
} from "./patron-sbt-message";

function getPatronAppSignerAccount() {
  const pk = process.env.PATRON_SBT_APP_SIGNER_PRIVATE_KEY;
  if (!pk) {
    throw new Error("PATRON_SBT_APP_SIGNER_PRIVATE_KEY not configured");
  }
  const normalized = pk.startsWith("0x") ? pk : `0x${pk}`;
  return privateKeyToAccount(normalized as Hex);
}

/** Address derived from the server Patron app-signer private key. */
export function getPatronAppSignerAddress(): `0x${string}` {
  return getAddress(getPatronAppSignerAccount().address);
}

/**
 * Sign the Patron AppAuthorization typed-data. The values MUST match what the
 * applicant signs in the PatronApplication.
 */
export async function signPatronAppAuthorization(input: {
  applicant: string;
  proposedSkills: SkillHash[];
  applicantNonce: bigint;
  signatureDeadline: bigint;
}): Promise<Hex> {
  const account = getPatronAppSignerAccount();
  const { domain, types, message } = buildPatronAppAuthorizationTypedData(input);
  return account.signTypedData({
    domain,
    types,
    primaryType: "AppAuthorization",
    message,
  });
}
