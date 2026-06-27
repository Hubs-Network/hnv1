"use client";

/**
 * Client-side Pilgrim Passport flows.
 *
 * Users only ever SIGN EIP-712 typed-data here (free, off-chain). The relayer
 * submits the on-chain transactions server-side, so users never pay gas. Works
 * for both Magic and injected wallets via eth_signTypedData_v4.
 */
import { getAddress } from "viem";
import {
  buildClaimRequestTypedData,
  buildApproveClaimTypedData,
  toEip712Json,
} from "./pilgrim-passport-message";
import { skillIdToHash } from "./pilgrim-skills";

type Eip1193Provider = {
  request: (args: { method: string; params?: unknown[] }) => Promise<unknown>;
};

async function getSigner(
  authProvider: string | null
): Promise<{ provider: Eip1193Provider; account: string }> {
  if (authProvider === "magic") {
    const { getMagic } = await import("./magic");
    const magic = getMagic();
    // Magic exposes an EIP-1193 provider at `rpcProvider` (this SDK config has
    // no `wallet.getProvider()`). It signs with the user's Magic EOA.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const provider = (magic as any).rpcProvider as Eip1193Provider;
    if (!provider?.request) {
      throw new Error("Magic provider unavailable (rpcProvider missing).");
    }
    const accounts = (await provider.request({ method: "eth_accounts" })) as string[];
    return { provider, account: accounts[0] };
  }

  if (typeof window !== "undefined" && (window as { ethereum?: Eip1193Provider }).ethereum) {
    const provider = (window as unknown as { ethereum: Eip1193Provider }).ethereum;
    const accounts = (await provider.request({
      method: "eth_requestAccounts",
    })) as string[];
    return { provider, account: accounts[0] };
  }

  throw new Error("No wallet provider found");
}

async function signTypedDataV4(
  provider: Eip1193Provider,
  account: string,
  json: string
): Promise<string> {
  return (await provider.request({
    method: "eth_signTypedData_v4",
    params: [account, json],
  })) as string;
}

const CLAIM_DEADLINE_SECONDS = 60 * 60; // 1 hour

async function postJson<T>(url: string, body: unknown): Promise<T> {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data?.error || `Request to ${url} failed (${res.status})`);
  }
  return data as T;
}

export interface RequestPassportInput {
  applicant: string;
  hubSafe: string;
  hubId: string;
  skillIds: string[];
  authProvider: string | null;
}

/**
 * Full claim flow: read nonce → get app authorization → sign ClaimRequest →
 * submit. Returns { claimId, txHash }.
 */
export async function requestPassport(
  input: RequestPassportInput
): Promise<{ claimId: string; txHash: string }> {
  const applicant = getAddress(input.applicant);
  const hubSafe = getAddress(input.hubSafe);

  // 1. Current passport state + claim nonce.
  const state = await fetch(
    `/api/pilgrim-passport/passport?owner=${applicant}`
  ).then((r) => r.json());
  if (state?.hasPassport) {
    throw new Error("You already hold a Pilgrim Passport.");
  }
  const applicantNonce = String(state?.claimNonce ?? "0");
  const signatureDeadline = String(
    Math.floor(Date.now() / 1000) + CLAIM_DEADLINE_SECONDS
  );

  // 2. App authorization (server validates + signs AppAuthorization).
  const auth = await postJson<{
    appSignature: string;
    applicantNonce: string;
    signatureDeadline: string;
    proposedSkills: string[];
  }>("/api/pilgrim-passport/app-authorization", {
    applicant,
    hubSafe,
    proposedSkills: input.skillIds,
    applicantNonce,
    signatureDeadline,
  });

  // 3. Applicant signs the matching ClaimRequest (use server-canonical values).
  const skillHashes = input.skillIds.map((id) => skillIdToHash(id));
  const claimTd = buildClaimRequestTypedData({
    applicant,
    hubSafe,
    proposedSkills: skillHashes,
    applicantNonce: BigInt(auth.applicantNonce),
    signatureDeadline: BigInt(auth.signatureDeadline),
  });

  const { provider, account } = await getSigner(input.authProvider);
  if (getAddress(account) !== applicant) {
    throw new Error("Connected wallet does not match the applicant address.");
  }
  const applicantSignature = await signTypedDataV4(
    provider,
    account,
    toEip712Json({
      domain: claimTd.domain,
      types: claimTd.types,
      primaryType: claimTd.primaryType,
      message: claimTd.message as unknown as Record<string, unknown>,
    })
  );

  // 4. Submit via relayer + persist.
  return postJson<{ claimId: string; txHash: string }>(
    "/api/pilgrim-passport/claims",
    {
      applicant,
      hubSafe,
      hubId: input.hubId,
      proposedSkills: input.skillIds,
      applicantNonce: auth.applicantNonce,
      signatureDeadline: auth.signatureDeadline,
      applicantSignature,
      appSignature: auth.appSignature,
    }
  );
}

export interface ApproveClaimInput {
  claimId: string;
  applicant: string;
  hubSafe: string;
  approvedSkillIds: string[];
  signerAddress: string;
  authProvider: string | null;
}

/**
 * Hub owner approval flow: sign ApproveClaim → submit approveClaimAndMint.
 * Returns { txHash, tokenId }.
 */
export async function approvePassportClaim(
  input: ApproveClaimInput
): Promise<{ txHash: string; tokenId: string | null }> {
  const signatureDeadline = String(
    Math.floor(Date.now() / 1000) + CLAIM_DEADLINE_SECONDS
  );
  const approvedHashes = input.approvedSkillIds.map((id) => skillIdToHash(id));

  const td = buildApproveClaimTypedData({
    claimId: input.claimId as `0x${string}`,
    applicant: input.applicant,
    hubSafe: input.hubSafe,
    approvedSkills: approvedHashes,
    signer: input.signerAddress,
    signatureDeadline: BigInt(signatureDeadline),
  });

  const { provider, account } = await getSigner(input.authProvider);
  if (getAddress(account) !== getAddress(input.signerAddress)) {
    throw new Error("Connected wallet does not match the approving signer.");
  }
  const hubSignature = await signTypedDataV4(
    provider,
    account,
    toEip712Json({
      domain: td.domain,
      types: td.types,
      primaryType: td.primaryType,
      message: td.message as unknown as Record<string, unknown>,
    })
  );

  return postJson<{ txHash: string; tokenId: string | null }>(
    `/api/pilgrim-passport/claims/${input.claimId}/approve`,
    {
      approvedSkills: input.approvedSkillIds,
      signer: input.signerAddress,
      signatureDeadline,
      hubSignature,
    }
  );
}
