/**
 * HubsNetworkResidencies — contract config (Sepolia).
 *
 * Single source of truth for the deployed Residencies contract address, chain
 * id, EIP-712 domain and the (curated) ABI used by the app.
 *
 * Like the other Hubs Network SBTs, identity is enforced by EIP-712 signatures
 * (hub Safe owner for hub actions, Pilgrim Passport owner for applications) —
 * NOT msg.sender. The relayer submits every tx so users never pay gas.
 *
 * Unlike the Pilgrim Passport claim flow, Residencies do NOT use an app signer.
 *
 * Verified source: contracts/HubsNetworkResidencies.sol
 * Domain: EIP712("HubsNetworkResidencies", "1").
 */
import { getAddress, type TypedDataDomain } from "viem";

/** Server-side address (reads + relayer writes). */
export const HUBS_NETWORK_RESIDENCIES_ADDRESS =
  process.env.HUBS_NETWORK_RESIDENCIES_ADDRESS ||
  process.env.NEXT_PUBLIC_HUBS_NETWORK_RESIDENCIES_ADDRESS ||
  "0xf50Ef5498489e50bdB7E98C0b917e8132C703a0B";

/** Client mirror (display + EIP-712 verifyingContract on the client). */
export const NEXT_PUBLIC_HUBS_NETWORK_RESIDENCIES_ADDRESS =
  process.env.NEXT_PUBLIC_HUBS_NETWORK_RESIDENCIES_ADDRESS ||
  HUBS_NETWORK_RESIDENCIES_ADDRESS;

export const RESIDENCIES_CHAIN_ID = Number(
  process.env.NEXT_PUBLIC_HN_CHAIN_ID ||
    process.env.NEXT_PUBLIC_CHAIN_ID ||
    "11155111"
);

export const RESIDENCIES_EIP712_NAME = "HubsNetworkResidencies" as const;
export const RESIDENCIES_EIP712_VERSION = "1" as const;

/** Mirrors the on-chain constants. */
export const MAX_RESIDENCY_SKILLS = 10;
export const MAX_AWARD_SKILLS = 10;
export const MAX_SELECTED_PILGRIMS = 20;

/** Mirrors the on-chain enum ResidencyStatus { None, Open, Closed, Cancelled }. */
export const RESIDENCY_STATUS = {
  None: 0,
  Open: 1,
  Closed: 2,
  Cancelled: 3,
} as const;

export type ResidencyStatusValue =
  (typeof RESIDENCY_STATUS)[keyof typeof RESIDENCY_STATUS];

/** UI-facing status derived from on-chain status + isApplicationOpen. */
export type ResidencyUiStatus =
  | "open"
  | "applications_closed"
  | "closed"
  | "cancelled"
  | "none";

export const RESIDENCY_UI_STATUS_LABELS: Record<ResidencyUiStatus, string> = {
  open: "Open",
  applications_closed: "Applications closed",
  closed: "Closed",
  cancelled: "Cancelled",
  none: "Unknown",
};

function resolveContractAddress(): `0x${string}` {
  const addr =
    NEXT_PUBLIC_HUBS_NETWORK_RESIDENCIES_ADDRESS ||
    HUBS_NETWORK_RESIDENCIES_ADDRESS;
  return getAddress(addr) as `0x${string}`;
}

/**
 * Build the EIP-712 domain for the deployed Residencies contract.
 * Used by both client (signing) and server (verification / recovery).
 */
export function buildResidenciesDomain(): TypedDataDomain {
  return {
    name: RESIDENCIES_EIP712_NAME,
    version: RESIDENCIES_EIP712_VERSION,
    chainId: RESIDENCIES_CHAIN_ID,
    verifyingContract: resolveContractAddress(),
  };
}

/**
 * Curated ABI — only the entries the app uses. Function signatures match the
 * deployed HubsNetworkResidencies contract exactly.
 */
export const RESIDENCIES_ABI = [
  // ── Writes ────────────────────────────────────────────────────────────
  {
    name: "createResidency",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      {
        name: "params",
        type: "tuple",
        components: [
          { name: "hubSafe", type: "address" },
          { name: "signer", type: "address" },
          { name: "metadataURI", type: "string" },
          { name: "metadataHash", type: "bytes32" },
          { name: "skills", type: "bytes32[]" },
          { name: "applicationDeadline", type: "uint64" },
          { name: "startDate", type: "uint64" },
          { name: "endDate", type: "uint64" },
          { name: "isCalendarBound", type: "bool" },
          { name: "nonce", type: "uint256" },
          { name: "signatureDeadline", type: "uint256" },
        ],
      },
      { name: "hubSignature", type: "bytes" },
    ],
    outputs: [{ name: "residencyId", type: "uint256" }],
  },
  {
    name: "applyToResidency",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      {
        name: "params",
        type: "tuple",
        components: [
          { name: "residencyId", type: "uint256" },
          { name: "pilgrim", type: "address" },
          { name: "pilgrimPassportTokenId", type: "uint256" },
          { name: "matchingSkill", type: "bytes32" },
          { name: "nonce", type: "uint256" },
          { name: "signatureDeadline", type: "uint256" },
        ],
      },
      { name: "pilgrimSignature", type: "bytes" },
    ],
    outputs: [],
  },
  {
    name: "selectPilgrimsAndClose",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      {
        name: "params",
        type: "tuple",
        components: [
          { name: "residencyId", type: "uint256" },
          { name: "signer", type: "address" },
          { name: "pilgrimPassportTokenIds", type: "uint256[]" },
          { name: "nonce", type: "uint256" },
          { name: "signatureDeadline", type: "uint256" },
        ],
      },
      { name: "hubSignature", type: "bytes" },
    ],
    outputs: [],
  },
  {
    name: "awardPilgrim",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      {
        name: "params",
        type: "tuple",
        components: [
          { name: "residencyId", type: "uint256" },
          { name: "pilgrimPassportTokenId", type: "uint256" },
          { name: "signer", type: "address" },
          { name: "skillIds", type: "bytes32[]" },
          { name: "nonce", type: "uint256" },
          { name: "signatureDeadline", type: "uint256" },
        ],
      },
      { name: "residencyHubSignature", type: "bytes" },
      { name: "passportHubSignature", type: "bytes" },
    ],
    outputs: [],
  },
  {
    name: "cancelResidency",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "residencyId", type: "uint256" },
      { name: "signer", type: "address" },
      { name: "nonce", type: "uint256" },
      { name: "signatureDeadline", type: "uint256" },
      { name: "hubSignature", type: "bytes" },
    ],
    outputs: [],
  },

  // ── Reads ─────────────────────────────────────────────────────────────
  {
    name: "totalResidencies",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    name: "nextResidencyId",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    name: "getResidency",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "residencyId", type: "uint256" }],
    outputs: [
      {
        name: "",
        type: "tuple",
        components: [
          { name: "id", type: "uint256" },
          { name: "hubSafe", type: "address" },
          { name: "metadataURI", type: "string" },
          { name: "metadataHash", type: "bytes32" },
          { name: "createdAt", type: "uint64" },
          { name: "applicationDeadline", type: "uint64" },
          { name: "startDate", type: "uint64" },
          { name: "endDate", type: "uint64" },
          { name: "isCalendarBound", type: "bool" },
          { name: "skillCount", type: "uint8" },
          { name: "status", type: "uint8" },
        ],
      },
    ],
  },
  {
    name: "getResidencySkills",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "residencyId", type: "uint256" }],
    outputs: [{ name: "", type: "bytes32[]" }],
  },
  {
    name: "getHubResidencies",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "hubSafe", type: "address" }],
    outputs: [{ name: "", type: "uint256[]" }],
  },
  {
    name: "getResidencyApplicants",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "residencyId", type: "uint256" }],
    outputs: [{ name: "", type: "uint256[]" }],
  },
  {
    name: "getSelectedPilgrims",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "residencyId", type: "uint256" }],
    outputs: [{ name: "", type: "uint256[]" }],
  },
  {
    name: "isApplicationOpen",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "residencyId", type: "uint256" }],
    outputs: [{ name: "", type: "bool" }],
  },
  {
    name: "canApplyWithSkill",
    type: "function",
    stateMutability: "view",
    inputs: [
      { name: "residencyId", type: "uint256" },
      { name: "pilgrimPassportTokenId", type: "uint256" },
      { name: "skillId", type: "bytes32" },
    ],
    outputs: [{ name: "", type: "bool" }],
  },
  {
    name: "hasAnyMatchingSkill",
    type: "function",
    stateMutability: "view",
    inputs: [
      { name: "residencyId", type: "uint256" },
      { name: "pilgrimPassportTokenId", type: "uint256" },
    ],
    outputs: [{ name: "", type: "bool" }],
  },
  {
    name: "hasApplied",
    type: "function",
    stateMutability: "view",
    inputs: [
      { name: "", type: "uint256" },
      { name: "", type: "uint256" },
    ],
    outputs: [{ name: "", type: "bool" }],
  },
  {
    name: "isSelected",
    type: "function",
    stateMutability: "view",
    inputs: [
      { name: "", type: "uint256" },
      { name: "", type: "uint256" },
    ],
    outputs: [{ name: "", type: "bool" }],
  },
  {
    name: "isAwarded",
    type: "function",
    stateMutability: "view",
    inputs: [
      { name: "", type: "uint256" },
      { name: "", type: "uint256" },
    ],
    outputs: [{ name: "", type: "bool" }],
  },
  {
    name: "signerNonces",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "", type: "address" }],
    outputs: [{ name: "", type: "uint256" }],
  },

  // ── Events ────────────────────────────────────────────────────────────
  {
    name: "ResidencyCreated",
    type: "event",
    inputs: [
      { name: "residencyId", type: "uint256", indexed: true },
      { name: "hubSafe", type: "address", indexed: true },
      { name: "signer", type: "address", indexed: true },
      { name: "metadataURI", type: "string", indexed: false },
      { name: "metadataHash", type: "bytes32", indexed: false },
    ],
    anonymous: false,
  },
  {
    name: "ResidencyApplied",
    type: "event",
    inputs: [
      { name: "residencyId", type: "uint256", indexed: true },
      { name: "pilgrimPassportTokenId", type: "uint256", indexed: true },
      { name: "pilgrim", type: "address", indexed: true },
      { name: "matchingSkill", type: "bytes32", indexed: false },
    ],
    anonymous: false,
  },
  {
    name: "ResidencyClosed",
    type: "event",
    inputs: [
      { name: "residencyId", type: "uint256", indexed: true },
      { name: "hubSafe", type: "address", indexed: true },
      { name: "signer", type: "address", indexed: true },
    ],
    anonymous: false,
  },
  {
    name: "PilgrimSelected",
    type: "event",
    inputs: [
      { name: "residencyId", type: "uint256", indexed: true },
      { name: "pilgrimPassportTokenId", type: "uint256", indexed: true },
    ],
    anonymous: false,
  },
  {
    name: "PilgrimAwarded",
    type: "event",
    inputs: [
      { name: "residencyId", type: "uint256", indexed: true },
      { name: "pilgrimPassportTokenId", type: "uint256", indexed: true },
      { name: "hubSafe", type: "address", indexed: true },
      { name: "signer", type: "address", indexed: false },
      { name: "skillIds", type: "bytes32[]", indexed: false },
    ],
    anonymous: false,
  },
  {
    name: "ResidencyCancelled",
    type: "event",
    inputs: [
      { name: "residencyId", type: "uint256", indexed: true },
      { name: "hubSafe", type: "address", indexed: true },
      { name: "signer", type: "address", indexed: true },
    ],
    anonymous: false,
  },
] as const;
