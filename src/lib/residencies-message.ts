/**
 * EIP-712 typed-data builders for HubsNetworkResidencies (client + server safe).
 *
 * Type strings & encodings match the deployed contract EXACTLY
 * (contracts/HubsNetworkResidencies.sol):
 *
 *   CreateResidency(address hubSafe,address signer,bytes32 metadataHash,bytes32 skillsHash,uint64 applicationDeadline,uint64 startDate,uint64 endDate,bool isCalendarBound,uint256 nonce,uint256 signatureDeadline)
 *   ApplyToResidency(uint256 residencyId,address pilgrim,uint256 pilgrimPassportTokenId,bytes32 matchingSkill,uint256 nonce,uint256 signatureDeadline)
 *   SelectPilgrims(uint256 residencyId,address signer,bytes32 pilgrimIdsHash,uint256 nonce,uint256 signatureDeadline)
 *   AwardPilgrim(uint256 residencyId,uint256 pilgrimPassportTokenId,address signer,bytes32 skillIdsHash,uint256 nonce,uint256 signatureDeadline)
 *   CancelResidency(uint256 residencyId,address signer,uint256 nonce,uint256 signatureDeadline)
 *
 * Array hashing matches Solidity keccak256(abi.encodePacked(values)):
 *   skillsHash / skillIdsHash = keccak256(abi.encodePacked(bytes32[]))
 *   pilgrimIdsHash            = keccak256(abi.encodePacked(uint256[]))
 *
 * IMPORTANT: the contract signs `metadataHash`, NOT `metadataURI`.
 *
 * The award flow ALSO needs the PilgrimPassportSBT `AttestSkills` signature; the
 * builder for it lives here too because it is only used by the award flow.
 */
import {
  keccak256,
  encodePacked,
  getAddress,
  type Hex,
  type TypedDataDomain,
} from "viem";
import { buildResidenciesDomain } from "@/config/residencies";
import { buildPilgrimPassportDomain } from "@/config/pilgrim-passport";

export type SkillHash = `0x${string}`;

// ── Hash helpers (match Solidity abi.encodePacked) ───────────────────────

/** keccak256(abi.encodePacked(bytes32[] values)). */
export function hashBytes32Array(values: readonly Hex[]): Hex {
  return keccak256(encodePacked(["bytes32[]"], [values as Hex[]]));
}

/** keccak256(abi.encodePacked(uint256[] ids)). */
export function hashUint256Array(ids: readonly bigint[]): Hex {
  return keccak256(encodePacked(["uint256[]"], [ids as bigint[]]));
}

// ── EIP-712 type definitions (viem format) ───────────────────────────────
export const CREATE_RESIDENCY_TYPES = {
  CreateResidency: [
    { name: "hubSafe", type: "address" },
    { name: "signer", type: "address" },
    { name: "metadataHash", type: "bytes32" },
    { name: "skillsHash", type: "bytes32" },
    { name: "applicationDeadline", type: "uint64" },
    { name: "startDate", type: "uint64" },
    { name: "endDate", type: "uint64" },
    { name: "isCalendarBound", type: "bool" },
    { name: "nonce", type: "uint256" },
    { name: "signatureDeadline", type: "uint256" },
  ],
} as const;

export const APPLY_TO_RESIDENCY_TYPES = {
  ApplyToResidency: [
    { name: "residencyId", type: "uint256" },
    { name: "pilgrim", type: "address" },
    { name: "pilgrimPassportTokenId", type: "uint256" },
    { name: "matchingSkill", type: "bytes32" },
    { name: "nonce", type: "uint256" },
    { name: "signatureDeadline", type: "uint256" },
  ],
} as const;

export const SELECT_PILGRIMS_TYPES = {
  SelectPilgrims: [
    { name: "residencyId", type: "uint256" },
    { name: "signer", type: "address" },
    { name: "pilgrimIdsHash", type: "bytes32" },
    { name: "nonce", type: "uint256" },
    { name: "signatureDeadline", type: "uint256" },
  ],
} as const;

export const AWARD_PILGRIM_TYPES = {
  AwardPilgrim: [
    { name: "residencyId", type: "uint256" },
    { name: "pilgrimPassportTokenId", type: "uint256" },
    { name: "signer", type: "address" },
    { name: "skillIdsHash", type: "bytes32" },
    { name: "nonce", type: "uint256" },
    { name: "signatureDeadline", type: "uint256" },
  ],
} as const;

export const CANCEL_RESIDENCY_TYPES = {
  CancelResidency: [
    { name: "residencyId", type: "uint256" },
    { name: "signer", type: "address" },
    { name: "nonce", type: "uint256" },
    { name: "signatureDeadline", type: "uint256" },
  ],
} as const;

/** PilgrimPassportSBT AttestSkills type (award second signature). */
export const ATTEST_SKILLS_TYPES = {
  AttestSkills: [
    { name: "tokenId", type: "uint256" },
    { name: "hubSafe", type: "address" },
    { name: "signer", type: "address" },
    { name: "skillIdsHash", type: "bytes32" },
    { name: "signatureDeadline", type: "uint256" },
  ],
} as const;

// ── CreateResidency (hub Safe owner signs) ───────────────────────────────
export interface CreateResidencyMessage {
  hubSafe: `0x${string}`;
  signer: `0x${string}`;
  metadataHash: Hex;
  skillsHash: Hex;
  applicationDeadline: bigint;
  startDate: bigint;
  endDate: bigint;
  isCalendarBound: boolean;
  nonce: bigint;
  signatureDeadline: bigint;
}

export function buildCreateResidencyTypedData(input: {
  hubSafe: string;
  signer: string;
  metadataHash: Hex;
  skills: readonly SkillHash[];
  applicationDeadline: bigint;
  startDate: bigint;
  endDate: bigint;
  isCalendarBound: boolean;
  nonce: bigint;
  signatureDeadline: bigint;
  domain?: TypedDataDomain;
}) {
  const domain = input.domain ?? buildResidenciesDomain();
  const skillsHash = hashBytes32Array(input.skills);
  const message: CreateResidencyMessage = {
    hubSafe: getAddress(input.hubSafe),
    signer: getAddress(input.signer),
    metadataHash: input.metadataHash,
    skillsHash,
    applicationDeadline: input.applicationDeadline,
    startDate: input.startDate,
    endDate: input.endDate,
    isCalendarBound: input.isCalendarBound,
    nonce: input.nonce,
    signatureDeadline: input.signatureDeadline,
  };
  return {
    domain,
    types: CREATE_RESIDENCY_TYPES,
    primaryType: "CreateResidency" as const,
    message,
    skillsHash,
  };
}

// ── ApplyToResidency (pilgrim signs) ─────────────────────────────────────
export interface ApplyToResidencyMessage {
  residencyId: bigint;
  pilgrim: `0x${string}`;
  pilgrimPassportTokenId: bigint;
  matchingSkill: Hex;
  nonce: bigint;
  signatureDeadline: bigint;
}

export function buildApplyToResidencyTypedData(input: {
  residencyId: bigint;
  pilgrim: string;
  pilgrimPassportTokenId: bigint;
  matchingSkill: Hex;
  nonce: bigint;
  signatureDeadline: bigint;
  domain?: TypedDataDomain;
}) {
  const domain = input.domain ?? buildResidenciesDomain();
  const message: ApplyToResidencyMessage = {
    residencyId: input.residencyId,
    pilgrim: getAddress(input.pilgrim),
    pilgrimPassportTokenId: input.pilgrimPassportTokenId,
    matchingSkill: input.matchingSkill,
    nonce: input.nonce,
    signatureDeadline: input.signatureDeadline,
  };
  return {
    domain,
    types: APPLY_TO_RESIDENCY_TYPES,
    primaryType: "ApplyToResidency" as const,
    message,
  };
}

// ── SelectPilgrims (hub Safe owner signs) ────────────────────────────────
export interface SelectPilgrimsMessage {
  residencyId: bigint;
  signer: `0x${string}`;
  pilgrimIdsHash: Hex;
  nonce: bigint;
  signatureDeadline: bigint;
}

export function buildSelectPilgrimsTypedData(input: {
  residencyId: bigint;
  signer: string;
  pilgrimPassportTokenIds: readonly bigint[];
  nonce: bigint;
  signatureDeadline: bigint;
  domain?: TypedDataDomain;
}) {
  const domain = input.domain ?? buildResidenciesDomain();
  const pilgrimIdsHash = hashUint256Array(input.pilgrimPassportTokenIds);
  const message: SelectPilgrimsMessage = {
    residencyId: input.residencyId,
    signer: getAddress(input.signer),
    pilgrimIdsHash,
    nonce: input.nonce,
    signatureDeadline: input.signatureDeadline,
  };
  return {
    domain,
    types: SELECT_PILGRIMS_TYPES,
    primaryType: "SelectPilgrims" as const,
    message,
    pilgrimIdsHash,
  };
}

// ── AwardPilgrim (hub Safe owner signs — Residencies domain) ─────────────
export interface AwardPilgrimMessage {
  residencyId: bigint;
  pilgrimPassportTokenId: bigint;
  signer: `0x${string}`;
  skillIdsHash: Hex;
  nonce: bigint;
  signatureDeadline: bigint;
}

export function buildAwardPilgrimTypedData(input: {
  residencyId: bigint;
  pilgrimPassportTokenId: bigint;
  signer: string;
  skillIds: readonly SkillHash[];
  nonce: bigint;
  signatureDeadline: bigint;
  domain?: TypedDataDomain;
}) {
  const domain = input.domain ?? buildResidenciesDomain();
  const skillIdsHash = hashBytes32Array(input.skillIds);
  const message: AwardPilgrimMessage = {
    residencyId: input.residencyId,
    pilgrimPassportTokenId: input.pilgrimPassportTokenId,
    signer: getAddress(input.signer),
    skillIdsHash,
    nonce: input.nonce,
    signatureDeadline: input.signatureDeadline,
  };
  return {
    domain,
    types: AWARD_PILGRIM_TYPES,
    primaryType: "AwardPilgrim" as const,
    message,
    skillIdsHash,
  };
}

// ── AttestSkills (hub Safe owner signs — PilgrimPassport domain) ─────────
export interface AttestSkillsMessage {
  tokenId: bigint;
  hubSafe: `0x${string}`;
  signer: `0x${string}`;
  skillIdsHash: Hex;
  signatureDeadline: bigint;
}

export function buildAttestSkillsTypedData(input: {
  tokenId: bigint;
  hubSafe: string;
  signer: string;
  skillIds: readonly SkillHash[];
  signatureDeadline: bigint;
  domain?: TypedDataDomain;
}) {
  const domain = input.domain ?? buildPilgrimPassportDomain();
  const skillIdsHash = hashBytes32Array(input.skillIds);
  const message: AttestSkillsMessage = {
    tokenId: input.tokenId,
    hubSafe: getAddress(input.hubSafe),
    signer: getAddress(input.signer),
    skillIdsHash,
    signatureDeadline: input.signatureDeadline,
  };
  return {
    domain,
    types: ATTEST_SKILLS_TYPES,
    primaryType: "AttestSkills" as const,
    message,
    skillIdsHash,
  };
}

// ── CancelResidency (hub Safe owner signs) ───────────────────────────────
export interface CancelResidencyMessage {
  residencyId: bigint;
  signer: `0x${string}`;
  nonce: bigint;
  signatureDeadline: bigint;
}

export function buildCancelResidencyTypedData(input: {
  residencyId: bigint;
  signer: string;
  nonce: bigint;
  signatureDeadline: bigint;
  domain?: TypedDataDomain;
}) {
  const domain = input.domain ?? buildResidenciesDomain();
  const message: CancelResidencyMessage = {
    residencyId: input.residencyId,
    signer: getAddress(input.signer),
    nonce: input.nonce,
    signatureDeadline: input.signatureDeadline,
  };
  return {
    domain,
    types: CANCEL_RESIDENCY_TYPES,
    primaryType: "CancelResidency" as const,
    message,
  };
}
