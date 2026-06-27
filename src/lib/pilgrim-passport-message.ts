/**
 * EIP-712 typed-data builders for PilgrimPassportSBT (client + server safe).
 *
 * Type strings & encodings match the deployed contract EXACTLY
 * (contracts/PilgrimPassportSBT3.sol):
 *
 *   ClaimRequest(address applicant,address hubSafe,bytes32 proposedSkillsHash,uint256 applicantNonce,uint256 signatureDeadline)
 *   AppAuthorization(address applicant,address hubSafe,bytes32 proposedSkillsHash,uint256 applicantNonce,uint256 signatureDeadline)
 *   ApproveClaim(bytes32 claimId,address applicant,address hubSafe,bytes32 approvedSkillsHash,address signer,uint256 signatureDeadline)
 *
 * The contract computes the skills hash as keccak256(abi.encodePacked(bytes32[])),
 * and the claimId as keccak256(abi.encode(applicant, hubSafe, skillsHash, applicantNonce)).
 */
import {
  keccak256,
  encodePacked,
  encodeAbiParameters,
  getAddress,
  type Hex,
  type TypedDataDomain,
} from "viem";
import { buildPilgrimPassportDomain } from "@/config/pilgrim-passport";

export type SkillHash = `0x${string}`;

// ── EIP-712 type definitions (viem format) ───────────────────────────
export const CLAIM_REQUEST_TYPES = {
  ClaimRequest: [
    { name: "applicant", type: "address" },
    { name: "hubSafe", type: "address" },
    { name: "proposedSkillsHash", type: "bytes32" },
    { name: "applicantNonce", type: "uint256" },
    { name: "signatureDeadline", type: "uint256" },
  ],
} as const;

export const APP_AUTHORIZATION_TYPES = {
  AppAuthorization: [
    { name: "applicant", type: "address" },
    { name: "hubSafe", type: "address" },
    { name: "proposedSkillsHash", type: "bytes32" },
    { name: "applicantNonce", type: "uint256" },
    { name: "signatureDeadline", type: "uint256" },
  ],
} as const;

export const APPROVE_CLAIM_TYPES = {
  ApproveClaim: [
    { name: "claimId", type: "bytes32" },
    { name: "applicant", type: "address" },
    { name: "hubSafe", type: "address" },
    { name: "approvedSkillsHash", type: "bytes32" },
    { name: "signer", type: "address" },
    { name: "signatureDeadline", type: "uint256" },
  ],
} as const;

const EIP712_DOMAIN_TYPE = [
  { name: "name", type: "string" },
  { name: "version", type: "string" },
  { name: "chainId", type: "uint256" },
  { name: "verifyingContract", type: "address" },
] as const;

/**
 * keccak256(abi.encodePacked(bytes32[] skillIds)) — matches _hashSkills().
 * Each bytes32 is exactly 32 bytes, so packed encoding == concatenation.
 */
export function computeSkillsHash(skills: readonly SkillHash[]): Hex {
  return keccak256(encodePacked(["bytes32[]"], [skills as SkillHash[]]));
}

/**
 * keccak256(abi.encode(applicant, hubSafe, skillsHash, applicantNonce))
 * — matches the on-chain claimId derivation.
 */
export function computeClaimId(params: {
  applicant: string;
  hubSafe: string;
  skillsHash: Hex;
  applicantNonce: bigint;
}): Hex {
  return keccak256(
    encodeAbiParameters(
      [
        { type: "address" },
        { type: "address" },
        { type: "bytes32" },
        { type: "uint256" },
      ],
      [
        getAddress(params.applicant),
        getAddress(params.hubSafe),
        params.skillsHash,
        params.applicantNonce,
      ]
    )
  );
}

export interface ClaimMessage {
  applicant: `0x${string}`;
  hubSafe: `0x${string}`;
  proposedSkillsHash: Hex;
  applicantNonce: bigint;
  signatureDeadline: bigint;
}

/** Build the full typed-data payload for ClaimRequest (applicant signs this). */
export function buildClaimRequestTypedData(input: {
  applicant: string;
  hubSafe: string;
  proposedSkills: readonly SkillHash[];
  applicantNonce: bigint;
  signatureDeadline: bigint;
  domain?: TypedDataDomain;
}) {
  const domain = input.domain ?? buildPilgrimPassportDomain();
  const proposedSkillsHash = computeSkillsHash(input.proposedSkills);
  const message: ClaimMessage = {
    applicant: getAddress(input.applicant),
    hubSafe: getAddress(input.hubSafe),
    proposedSkillsHash,
    applicantNonce: input.applicantNonce,
    signatureDeadline: input.signatureDeadline,
  };
  return {
    domain,
    types: CLAIM_REQUEST_TYPES,
    primaryType: "ClaimRequest" as const,
    message,
    proposedSkillsHash,
  };
}

/** Build the full typed-data payload for AppAuthorization (app signer signs). */
export function buildAppAuthorizationTypedData(input: {
  applicant: string;
  hubSafe: string;
  proposedSkills: readonly SkillHash[];
  applicantNonce: bigint;
  signatureDeadline: bigint;
  domain?: TypedDataDomain;
}) {
  const domain = input.domain ?? buildPilgrimPassportDomain();
  const proposedSkillsHash = computeSkillsHash(input.proposedSkills);
  const message: ClaimMessage = {
    applicant: getAddress(input.applicant),
    hubSafe: getAddress(input.hubSafe),
    proposedSkillsHash,
    applicantNonce: input.applicantNonce,
    signatureDeadline: input.signatureDeadline,
  };
  return {
    domain,
    types: APP_AUTHORIZATION_TYPES,
    primaryType: "AppAuthorization" as const,
    message,
    proposedSkillsHash,
  };
}

export interface ApproveClaimMessage {
  claimId: Hex;
  applicant: `0x${string}`;
  hubSafe: `0x${string}`;
  approvedSkillsHash: Hex;
  signer: `0x${string}`;
  signatureDeadline: bigint;
}

/** Build the full typed-data payload for ApproveClaim (hub Safe owner signs). */
export function buildApproveClaimTypedData(input: {
  claimId: Hex;
  applicant: string;
  hubSafe: string;
  approvedSkills: readonly SkillHash[];
  signer: string;
  signatureDeadline: bigint;
  domain?: TypedDataDomain;
}) {
  const domain = input.domain ?? buildPilgrimPassportDomain();
  const approvedSkillsHash = computeSkillsHash(input.approvedSkills);
  const message: ApproveClaimMessage = {
    claimId: input.claimId,
    applicant: getAddress(input.applicant),
    hubSafe: getAddress(input.hubSafe),
    approvedSkillsHash,
    signer: getAddress(input.signer),
    signatureDeadline: input.signatureDeadline,
  };
  return {
    domain,
    types: APPROVE_CLAIM_TYPES,
    primaryType: "ApproveClaim" as const,
    message,
    approvedSkillsHash,
  };
}

/**
 * Serialize a viem typed-data payload into the JSON shape expected by
 * `eth_signTypedData_v4` (adds the EIP712Domain type entry, stringifies bigints).
 */
export function toEip712Json(payload: {
  domain: TypedDataDomain;
  types: Record<string, readonly { name: string; type: string }[]>;
  primaryType: string;
  message: Record<string, unknown>;
}): string {
  const replacer = (_key: string, value: unknown) =>
    typeof value === "bigint" ? value.toString() : value;

  return JSON.stringify(
    {
      domain: {
        name: payload.domain.name,
        version: payload.domain.version,
        chainId: Number(payload.domain.chainId),
        verifyingContract: payload.domain.verifyingContract,
      },
      types: {
        EIP712Domain: EIP712_DOMAIN_TYPE,
        ...payload.types,
      },
      primaryType: payload.primaryType,
      message: payload.message,
    },
    replacer
  );
}
