"use client";

/**
 * Client-side Patron SBT flows.
 *
 * Users only SIGN EIP-712 typed-data here (free, off-chain); the relayer submits
 * the on-chain transactions server-side (gasless). Reuses the Pilgrim Passport
 * wallet plumbing (getSigner / signTypedDataV4 / toEip712Json / ensureChain).
 */
import { getAddress, type Hex } from "viem";
import { getSigner, signTypedDataV4 } from "./pilgrim-passport-client";
import { toEip712Json } from "./pilgrim-passport-message";
import { computeSkillHash } from "./pilgrim-skills";
import {
  buildPatronApplicationTypedData,
  buildApprovePatronTypedData,
  buildRejectPatronTypedData,
  buildRevokePatronTypedData,
  type SkillHash,
} from "./patron-sbt-message";

const DEADLINE_SECONDS = 60 * 60; // 1 hour

async function postJson<T>(url: string, body: unknown): Promise<T> {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await res.json();
  if (!res.ok) {
    const err = new Error(data?.error || `Request to ${url} failed (${res.status})`);
    // Attach recovery info for the chain-succeeded / persist-failed edge case.
    (err as { applicationId?: string }).applicationId = data?.applicationId;
    (err as { persisted?: boolean }).persisted = data?.persisted;
    throw err;
  }
  return data as T;
}

export interface RequestPatronInput {
  applicant: string;
  skillIds: string[]; // 1..10 canonical/custom ids, in selection order
  authProvider: string | null;
  company: {
    companyName: string;
    description: string;
    website: string;
    contact: string;
  };
  onStep?: (msg: string) => void;
}

/**
 * Full application flow: app authorization → applicant signs PatronApplication →
 * submit (relayer). Idempotent retry: if the on-chain application succeeded but
 * JSON persistence failed, resubmitting re-persists without recreating it.
 */
export async function requestPatronApplication(
  input: RequestPatronInput
): Promise<{ applicationId: string; txHash: string | null }> {
  const applicant = getAddress(input.applicant);
  const step = input.onStep ?? (() => {});

  // 1. App authorization (server validates + signs AppAuthorization, returns
  //    the canonical on-chain nonce + deadline to sign against).
  step("Requesting app authorization…");
  const auth = await postJson<{
    appSignature: string;
    applicantNonce: string;
    signatureDeadline: string;
  }>("/api/patrons/app-authorization", {
    applicant,
    proposedSkills: input.skillIds,
  });

  // 2. Applicant signs the matching PatronApplication.
  const skillHashes: SkillHash[] = input.skillIds.map((id) => computeSkillHash(id));
  const td = buildPatronApplicationTypedData({
    applicant,
    proposedSkills: skillHashes,
    applicantNonce: BigInt(auth.applicantNonce),
    signatureDeadline: BigInt(auth.signatureDeadline),
  });

  step("Waiting for your signature…");
  const { provider, account } = await getSigner(input.authProvider);
  if (getAddress(account) !== applicant) {
    throw new Error("Connected wallet does not match the applicant address.");
  }
  const applicantSignature = await signTypedDataV4(
    provider,
    account,
    toEip712Json({
      domain: td.domain,
      types: td.types,
      primaryType: td.primaryType,
      message: td.message as unknown as Record<string, unknown>,
    })
  );

  // 3. Submit via relayer + persist. Retry once on persist failure (idempotent).
  step("Submitting your application on-chain…");
  const submitBody = {
    applicant,
    proposedSkills: input.skillIds,
    applicantNonce: auth.applicantNonce,
    signatureDeadline: auth.signatureDeadline,
    applicantSignature,
    appSignature: auth.appSignature,
    companyName: input.company.companyName,
    description: input.company.description,
    website: input.company.website,
    contact: input.company.contact,
  };

  try {
    return await postJson<{ applicationId: string; txHash: string | null }>(
      "/api/patrons/applications",
      submitBody
    );
  } catch (err) {
    // On-chain succeeded but persistence failed → retry (idempotent re-persist).
    if ((err as { persisted?: boolean }).persisted === false) {
      step("Finalizing your application…");
      return await postJson<{ applicationId: string; txHash: string | null }>(
        "/api/patrons/applications",
        submitBody
      );
    }
    throw err;
  }
}

// ── HN Director actions ────────────────────────────────────────────────

export interface ApprovePatronInput {
  applicationId: string;
  applicant: string;
  skillHashes: string[]; // on-chain order, from the admin listing
  signerAddress: string;
  authProvider: string | null;
}

export async function approvePatronApplication(
  input: ApprovePatronInput
): Promise<{ txHash: string; tokenId: string | null }> {
  const signatureDeadline = String(
    Math.floor(Date.now() / 1000) + DEADLINE_SECONDS
  );
  const td = buildApprovePatronTypedData({
    applicationId: input.applicationId as Hex,
    applicant: input.applicant,
    skills: input.skillHashes as SkillHash[],
    signer: input.signerAddress,
    signatureDeadline: BigInt(signatureDeadline),
  });

  const { provider, account } = await getSigner(input.authProvider);
  if (getAddress(account) !== getAddress(input.signerAddress)) {
    throw new Error("Connected wallet does not match the approving signer.");
  }
  const directorSignature = await signTypedDataV4(
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
    `/api/patrons/applications/${input.applicationId}/approve`,
    { signer: input.signerAddress, signatureDeadline, directorSignature }
  );
}

export interface RejectPatronInput {
  applicationId: string;
  applicant: string;
  signerAddress: string;
  authProvider: string | null;
}

export async function rejectPatronApplication(
  input: RejectPatronInput
): Promise<{ txHash: string }> {
  const signatureDeadline = String(
    Math.floor(Date.now() / 1000) + DEADLINE_SECONDS
  );
  const td = buildRejectPatronTypedData({
    applicationId: input.applicationId as Hex,
    applicant: input.applicant,
    signer: input.signerAddress,
    signatureDeadline: BigInt(signatureDeadline),
  });

  const { provider, account } = await getSigner(input.authProvider);
  if (getAddress(account) !== getAddress(input.signerAddress)) {
    throw new Error("Connected wallet does not match the signer.");
  }
  const directorSignature = await signTypedDataV4(
    provider,
    account,
    toEip712Json({
      domain: td.domain,
      types: td.types,
      primaryType: td.primaryType,
      message: td.message as unknown as Record<string, unknown>,
    })
  );

  return postJson<{ txHash: string }>(
    `/api/patrons/applications/${input.applicationId}/reject`,
    { signer: input.signerAddress, signatureDeadline, directorSignature }
  );
}

export interface RevokePatronInput {
  tokenId: string;
  signerAddress: string;
  authProvider: string | null;
}

export async function revokePatron(
  input: RevokePatronInput
): Promise<{ txHash: string }> {
  // Fetch the current owner + Director revoke nonce to build the exact message.
  const info = await fetch(
    `/api/patrons/${input.tokenId}/revoke?signer=${input.signerAddress}`
  ).then((r) => r.json());
  if (!info?.patronOwner || info?.nonce === undefined) {
    throw new Error(info?.error || "Could not load revoke parameters.");
  }

  const signatureDeadline = String(
    Math.floor(Date.now() / 1000) + DEADLINE_SECONDS
  );
  const td = buildRevokePatronTypedData({
    tokenId: BigInt(input.tokenId),
    patronOwner: info.patronOwner,
    signer: input.signerAddress,
    nonce: BigInt(info.nonce),
    signatureDeadline: BigInt(signatureDeadline),
  });

  const { provider, account } = await getSigner(input.authProvider);
  if (getAddress(account) !== getAddress(input.signerAddress)) {
    throw new Error("Connected wallet does not match the signer.");
  }
  const directorSignature = await signTypedDataV4(
    provider,
    account,
    toEip712Json({
      domain: td.domain,
      types: td.types,
      primaryType: td.primaryType,
      message: td.message as unknown as Record<string, unknown>,
    })
  );

  return postJson<{ txHash: string }>(`/api/patrons/${input.tokenId}/revoke`, {
    signer: input.signerAddress,
    nonce: info.nonce,
    signatureDeadline,
    directorSignature,
  });
}
