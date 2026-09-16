"use client";

/**
 * Client-side HubsNetworkResidencies flows.
 *
 * Users only SIGN EIP-712 typed-data here (free, off-chain); the relayer submits
 * the on-chain transactions server-side (gasless). Reuses the Pilgrim Passport
 * wallet plumbing (getSigner / signTypedDataV4 / toEip712Json / ensureChain).
 *
 * The signatureDeadline is now + 10 minutes (per the Residencies spec).
 */
import { getAddress, type Hex } from "viem";
import { getSigner, signTypedDataV4 } from "./pilgrim-passport-client";
import { toEip712Json } from "./pilgrim-passport-message";
import { computeSkillHash } from "./pilgrim-skills";
import {
  buildCreateResidencyTypedData,
  buildApplyToResidencyTypedData,
  buildSelectPilgrimsTypedData,
  buildAwardPilgrimTypedData,
  buildAttestSkillsTypedData,
  buildCancelResidencyTypedData,
  type SkillHash,
} from "./residencies-message";

const DEADLINE_SECONDS = 10 * 60; // 10 minutes

function deadline(): string {
  return String(Math.floor(Date.now() / 1000) + DEADLINE_SECONDS);
}

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

async function fetchNonce(signer: string): Promise<bigint> {
  const res = await fetch(`/api/residencies/nonce?signer=${signer}`);
  const data = await res.json();
  if (!res.ok) throw new Error(data?.error || "Could not read signer nonce");
  return BigInt(data.nonce);
}

function jsonPayload(td: {
  domain: unknown;
  types: Record<string, readonly { name: string; type: string }[]>;
  primaryType: string;
  message: unknown;
}): string {
  return toEip712Json({
    domain: td.domain as never,
    types: td.types,
    primaryType: td.primaryType,
    message: td.message as Record<string, unknown>,
  });
}

// ── Create Residency (hub signer) ────────────────────────────────────────
export interface CreateResidencyInput {
  hubSafe: string;
  hubName: string;
  signer: string;
  title: string;
  description: string;
  isCalendarBound: boolean;
  startDate?: string;
  endDate?: string;
  applicationDeadline: string;
  milestones: string[];
  rewardedSkills: string[];
  externalFormLink: string;
  authProvider: string | null;
  onStep?: (msg: string) => void;
}

export async function createResidency(
  input: CreateResidencyInput
): Promise<{ residencyId: string | null; txHash: string }> {
  const step = input.onStep ?? (() => {});
  const signer = getAddress(input.signer);

  // 1. Prepare: server persists draft metadata + returns signing params.
  step("Preparing residency…");
  const prep = await postJson<{
    draftId: string;
    metadataURI: string;
    metadataHash: Hex;
    skillHashes: Hex[];
    applicationDeadline: string;
    startDate: string;
    endDate: string;
    isCalendarBound: boolean;
    nonce: string;
    signatureDeadline: string;
  }>("/api/residencies/prepare", {
    hubSafe: input.hubSafe,
    hubName: input.hubName,
    title: input.title,
    description: input.description,
    isCalendarBound: input.isCalendarBound,
    startDate: input.startDate,
    endDate: input.endDate,
    applicationDeadline: input.applicationDeadline,
    milestones: input.milestones,
    rewardedSkills: input.rewardedSkills,
    externalFormLink: input.externalFormLink,
    createdBy: signer,
  });

  // 2. Sign CreateResidency (signs metadataHash, not the URI).
  const td = buildCreateResidencyTypedData({
    hubSafe: input.hubSafe,
    signer,
    metadataHash: prep.metadataHash,
    skills: prep.skillHashes,
    applicationDeadline: BigInt(prep.applicationDeadline),
    startDate: BigInt(prep.startDate),
    endDate: BigInt(prep.endDate),
    isCalendarBound: prep.isCalendarBound,
    nonce: BigInt(prep.nonce),
    signatureDeadline: BigInt(prep.signatureDeadline),
  });

  step("Waiting for your signature…");
  const { provider, account } = await getSigner(input.authProvider);
  if (getAddress(account) !== signer) {
    throw new Error("Connected wallet does not match the hub signer.");
  }
  const hubSignature = await signTypedDataV4(provider, account, jsonPayload(td));

  // 3. Submit (relayer).
  step("Creating residency on-chain…");
  return postJson<{ residencyId: string | null; txHash: string }>(
    "/api/residencies",
    {
      hubSafe: input.hubSafe,
      signer,
      draftId: prep.draftId,
      nonce: prep.nonce,
      signatureDeadline: prep.signatureDeadline,
      hubSignature,
    }
  );
}

// ── Apply to Residency (pilgrim) ─────────────────────────────────────────
export interface ApplyInput {
  residencyId: string;
  pilgrim: string;
  pilgrimPassportTokenId: string;
  matchingSkillId: string; // canonical/custom skill ID
  authProvider: string | null;
  onStep?: (msg: string) => void;
}

export async function applyToResidency(
  input: ApplyInput
): Promise<{ txHash: string }> {
  const step = input.onStep ?? (() => {});
  const pilgrim = getAddress(input.pilgrim);
  const matchingSkill = computeSkillHash(input.matchingSkillId);

  step("Preparing your application…");
  const nonce = await fetchNonce(pilgrim);
  const signatureDeadline = deadline();

  const td = buildApplyToResidencyTypedData({
    residencyId: BigInt(input.residencyId),
    pilgrim,
    pilgrimPassportTokenId: BigInt(input.pilgrimPassportTokenId),
    matchingSkill,
    nonce,
    signatureDeadline: BigInt(signatureDeadline),
  });

  step("Waiting for your signature…");
  const { provider, account } = await getSigner(input.authProvider);
  if (getAddress(account) !== pilgrim) {
    throw new Error("Connected wallet does not match your Passport wallet.");
  }
  const pilgrimSignature = await signTypedDataV4(provider, account, jsonPayload(td));

  step("Submitting your application…");
  return postJson<{ txHash: string }>(
    `/api/residencies/${input.residencyId}/apply`,
    {
      pilgrim,
      pilgrimPassportTokenId: input.pilgrimPassportTokenId,
      matchingSkill,
      nonce: nonce.toString(),
      signatureDeadline,
      pilgrimSignature,
    }
  );
}

// ── Select pilgrims (hub signer) ─────────────────────────────────────────
export interface SelectInput {
  residencyId: string;
  signer: string;
  pilgrimPassportTokenIds: string[];
  authProvider: string | null;
  onStep?: (msg: string) => void;
}

export async function selectPilgrims(
  input: SelectInput
): Promise<{ txHash: string }> {
  const step = input.onStep ?? (() => {});
  const signer = getAddress(input.signer);
  const tokenIds = input.pilgrimPassportTokenIds.map((t) => BigInt(t));

  step("Preparing selection…");
  const nonce = await fetchNonce(signer);
  const signatureDeadline = deadline();

  const td = buildSelectPilgrimsTypedData({
    residencyId: BigInt(input.residencyId),
    signer,
    pilgrimPassportTokenIds: tokenIds,
    nonce,
    signatureDeadline: BigInt(signatureDeadline),
  });

  step("Waiting for your signature…");
  const { provider, account } = await getSigner(input.authProvider);
  if (getAddress(account) !== signer) {
    throw new Error("Connected wallet does not match the hub signer.");
  }
  const hubSignature = await signTypedDataV4(provider, account, jsonPayload(td));

  step("Closing applications & selecting…");
  return postJson<{ txHash: string }>(
    `/api/residencies/${input.residencyId}/select`,
    {
      signer,
      pilgrimPassportTokenIds: input.pilgrimPassportTokenIds,
      nonce: nonce.toString(),
      signatureDeadline,
      hubSignature,
    }
  );
}

// ── Award pilgrim (hub signer — TWO signatures) ──────────────────────────
export interface AwardInput {
  residencyId: string;
  hubSafe: string;
  signer: string;
  pilgrimPassportTokenId: string;
  skillIds: string[]; // canonical/custom skill IDs (subset of residency skills)
  authProvider: string | null;
  onStep?: (msg: string) => void;
}

export async function awardPilgrim(
  input: AwardInput
): Promise<{ txHash: string }> {
  const step = input.onStep ?? (() => {});
  const signer = getAddress(input.signer);
  const tokenId = BigInt(input.pilgrimPassportTokenId);
  const skillHashes: SkillHash[] = input.skillIds.map((id) => computeSkillHash(id));

  step("Preparing award…");
  const nonce = await fetchNonce(signer);
  const signatureDeadline = deadline();

  const { provider, account } = await getSigner(input.authProvider);
  if (getAddress(account) !== signer) {
    throw new Error("Connected wallet does not match the hub signer.");
  }

  // Signature 1: AwardPilgrim (Residencies domain).
  step("Signature 1 of 2 (award)…");
  const awardTd = buildAwardPilgrimTypedData({
    residencyId: BigInt(input.residencyId),
    pilgrimPassportTokenId: tokenId,
    signer,
    skillIds: skillHashes,
    nonce,
    signatureDeadline: BigInt(signatureDeadline),
  });
  const residencyHubSignature = await signTypedDataV4(
    provider,
    account,
    jsonPayload(awardTd)
  );

  // Signature 2: AttestSkills (Passport domain, same deadline).
  step("Signature 2 of 2 (attest skills)…");
  const attestTd = buildAttestSkillsTypedData({
    tokenId,
    hubSafe: input.hubSafe,
    signer,
    skillIds: skillHashes,
    signatureDeadline: BigInt(signatureDeadline),
  });
  const passportHubSignature = await signTypedDataV4(
    provider,
    account,
    jsonPayload(attestTd)
  );

  step("Awarding skills on-chain…");
  return postJson<{ txHash: string }>(
    `/api/residencies/${input.residencyId}/award`,
    {
      signer,
      pilgrimPassportTokenId: input.pilgrimPassportTokenId,
      skillIds: skillHashes,
      nonce: nonce.toString(),
      signatureDeadline,
      residencyHubSignature,
      passportHubSignature,
    }
  );
}

// ── Cancel residency (hub signer) ────────────────────────────────────────
export interface CancelInput {
  residencyId: string;
  signer: string;
  authProvider: string | null;
  onStep?: (msg: string) => void;
}

export async function cancelResidency(
  input: CancelInput
): Promise<{ txHash: string }> {
  const step = input.onStep ?? (() => {});
  const signer = getAddress(input.signer);

  step("Preparing cancellation…");
  const nonce = await fetchNonce(signer);
  const signatureDeadline = deadline();

  const td = buildCancelResidencyTypedData({
    residencyId: BigInt(input.residencyId),
    signer,
    nonce,
    signatureDeadline: BigInt(signatureDeadline),
  });

  step("Waiting for your signature…");
  const { provider, account } = await getSigner(input.authProvider);
  if (getAddress(account) !== signer) {
    throw new Error("Connected wallet does not match the hub signer.");
  }
  const hubSignature = await signTypedDataV4(provider, account, jsonPayload(td));

  step("Cancelling residency…");
  return postJson<{ txHash: string }>(
    `/api/residencies/${input.residencyId}/cancel`,
    {
      signer,
      nonce: nonce.toString(),
      signatureDeadline,
      hubSignature,
    }
  );
}
