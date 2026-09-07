/**
 * EIP-712 typed-data builders for HubsNetworkPatronSBT (client + server safe).
 *
 * Type strings & encodings match the deployed contract EXACTLY:
 *
 *   PatronApplication(address applicant,bytes32 proposedSkillsHash,uint256 applicantNonce,uint256 signatureDeadline)
 *   AppAuthorization(address applicant,bytes32 proposedSkillsHash,uint256 applicantNonce,uint256 signatureDeadline)
 *   ApprovePatronApplication(bytes32 applicationId,address applicant,bytes32 skillsHash,address signer,uint256 signatureDeadline)
 *   RejectPatronApplication(bytes32 applicationId,address applicant,address signer,uint256 signatureDeadline)
 *   RevokePatron(uint256 tokenId,address patronOwner,address signer,uint256 nonce,uint256 signatureDeadline)
 *
 * Skills hashing matches Solidity:
 *   skillsHash    = keccak256(abi.encodePacked(bytes32[] skillIds))
 * Application id matches Solidity:
 *   applicationId = keccak256(abi.encode(applicant, skillsHash, applicantNonce))
 *
 * NOTE: skillsHash uses abi.encodePacked; applicationId uses abi.encode.
 */
import {
  keccak256,
  encodeAbiParameters,
  getAddress,
  type Hex,
  type TypedDataDomain,
} from "viem";
import { buildPatronDomain } from "@/config/patron-sbt";
// Reuse the Pilgrim skills-hash helper: keccak256(abi.encodePacked(bytes32[])).
import { computeSkillsHash, type SkillHash } from "./pilgrim-passport-message";

export type { SkillHash };
export { computeSkillsHash };

// ── EIP-712 type definitions (viem format) ───────────────────────────
export const PATRON_APPLICATION_TYPES = {
  PatronApplication: [
    { name: "applicant", type: "address" },
    { name: "proposedSkillsHash", type: "bytes32" },
    { name: "applicantNonce", type: "uint256" },
    { name: "signatureDeadline", type: "uint256" },
  ],
} as const;

export const PATRON_APP_AUTHORIZATION_TYPES = {
  AppAuthorization: [
    { name: "applicant", type: "address" },
    { name: "proposedSkillsHash", type: "bytes32" },
    { name: "applicantNonce", type: "uint256" },
    { name: "signatureDeadline", type: "uint256" },
  ],
} as const;

export const APPROVE_PATRON_TYPES = {
  ApprovePatronApplication: [
    { name: "applicationId", type: "bytes32" },
    { name: "applicant", type: "address" },
    { name: "skillsHash", type: "bytes32" },
    { name: "signer", type: "address" },
    { name: "signatureDeadline", type: "uint256" },
  ],
} as const;

export const REJECT_PATRON_TYPES = {
  RejectPatronApplication: [
    { name: "applicationId", type: "bytes32" },
    { name: "applicant", type: "address" },
    { name: "signer", type: "address" },
    { name: "signatureDeadline", type: "uint256" },
  ],
} as const;

export const REVOKE_PATRON_TYPES = {
  RevokePatron: [
    { name: "tokenId", type: "uint256" },
    { name: "patronOwner", type: "address" },
    { name: "signer", type: "address" },
    { name: "nonce", type: "uint256" },
    { name: "signatureDeadline", type: "uint256" },
  ],
} as const;

/**
 * keccak256(abi.encode(applicant, skillsHash, applicantNonce))
 * — matches the on-chain applicationId derivation.
 */
export function computePatronApplicationId(params: {
  applicant: string;
  skillsHash: Hex;
  applicantNonce: bigint;
}): Hex {
  return keccak256(
    encodeAbiParameters(
      [{ type: "address" }, { type: "bytes32" }, { type: "uint256" }],
      [getAddress(params.applicant), params.skillsHash, params.applicantNonce]
    )
  );
}

// ── PatronApplication (applicant signs) ──────────────────────────────
export interface PatronApplicationMessage {
  applicant: `0x${string}`;
  proposedSkillsHash: Hex;
  applicantNonce: bigint;
  signatureDeadline: bigint;
}

export function buildPatronApplicationTypedData(input: {
  applicant: string;
  proposedSkills: readonly SkillHash[];
  applicantNonce: bigint;
  signatureDeadline: bigint;
  domain?: TypedDataDomain;
}) {
  const domain = input.domain ?? buildPatronDomain();
  const proposedSkillsHash = computeSkillsHash(input.proposedSkills);
  const message: PatronApplicationMessage = {
    applicant: getAddress(input.applicant),
    proposedSkillsHash,
    applicantNonce: input.applicantNonce,
    signatureDeadline: input.signatureDeadline,
  };
  return {
    domain,
    types: PATRON_APPLICATION_TYPES,
    primaryType: "PatronApplication" as const,
    message,
    proposedSkillsHash,
  };
}

// ── AppAuthorization (app signer co-signs) ───────────────────────────
export function buildPatronAppAuthorizationTypedData(input: {
  applicant: string;
  proposedSkills: readonly SkillHash[];
  applicantNonce: bigint;
  signatureDeadline: bigint;
  domain?: TypedDataDomain;
}) {
  const domain = input.domain ?? buildPatronDomain();
  const proposedSkillsHash = computeSkillsHash(input.proposedSkills);
  const message: PatronApplicationMessage = {
    applicant: getAddress(input.applicant),
    proposedSkillsHash,
    applicantNonce: input.applicantNonce,
    signatureDeadline: input.signatureDeadline,
  };
  return {
    domain,
    types: PATRON_APP_AUTHORIZATION_TYPES,
    primaryType: "AppAuthorization" as const,
    message,
    proposedSkillsHash,
  };
}

// ── ApprovePatronApplication (HN Director signs) ─────────────────────
export interface ApprovePatronMessage {
  applicationId: Hex;
  applicant: `0x${string}`;
  skillsHash: Hex;
  signer: `0x${string}`;
  signatureDeadline: bigint;
}

export function buildApprovePatronTypedData(input: {
  applicationId: Hex;
  applicant: string;
  skills: readonly SkillHash[];
  signer: string;
  signatureDeadline: bigint;
  domain?: TypedDataDomain;
}) {
  const domain = input.domain ?? buildPatronDomain();
  const skillsHash = computeSkillsHash(input.skills);
  const message: ApprovePatronMessage = {
    applicationId: input.applicationId,
    applicant: getAddress(input.applicant),
    skillsHash,
    signer: getAddress(input.signer),
    signatureDeadline: input.signatureDeadline,
  };
  return {
    domain,
    types: APPROVE_PATRON_TYPES,
    primaryType: "ApprovePatronApplication" as const,
    message,
    skillsHash,
  };
}

// ── RejectPatronApplication (HN Director signs) ──────────────────────
export interface RejectPatronMessage {
  applicationId: Hex;
  applicant: `0x${string}`;
  signer: `0x${string}`;
  signatureDeadline: bigint;
}

export function buildRejectPatronTypedData(input: {
  applicationId: Hex;
  applicant: string;
  signer: string;
  signatureDeadline: bigint;
  domain?: TypedDataDomain;
}) {
  const domain = input.domain ?? buildPatronDomain();
  const message: RejectPatronMessage = {
    applicationId: input.applicationId,
    applicant: getAddress(input.applicant),
    signer: getAddress(input.signer),
    signatureDeadline: input.signatureDeadline,
  };
  return {
    domain,
    types: REJECT_PATRON_TYPES,
    primaryType: "RejectPatronApplication" as const,
    message,
  };
}

// ── RevokePatron (HN Director signs) ─────────────────────────────────
export interface RevokePatronMessage {
  tokenId: bigint;
  patronOwner: `0x${string}`;
  signer: `0x${string}`;
  nonce: bigint;
  signatureDeadline: bigint;
}

export function buildRevokePatronTypedData(input: {
  tokenId: bigint;
  patronOwner: string;
  signer: string;
  nonce: bigint;
  signatureDeadline: bigint;
  domain?: TypedDataDomain;
}) {
  const domain = input.domain ?? buildPatronDomain();
  const message: RevokePatronMessage = {
    tokenId: input.tokenId,
    patronOwner: getAddress(input.patronOwner),
    signer: getAddress(input.signer),
    nonce: input.nonce,
    signatureDeadline: input.signatureDeadline,
  };
  return {
    domain,
    types: REVOKE_PATRON_TYPES,
    primaryType: "RevokePatron" as const,
    message,
  };
}
