/**
 * HubsNetworkPatronSBT — contract config (Sepolia).
 *
 * Single source of truth for the deployed Patron contract address, chain id,
 * EIP-712 domain and the (curated) ABI used by the app.
 *
 * Business model differs from the Pilgrim Passport:
 *  - one wallet may hold zero, one, or MANY Patron SBTs (no one-per-wallet).
 *  - every application proposes between 1 and 10 canonical skills.
 *
 * Identity is enforced by EIP-712 signatures (applicant + app signer for
 * applications, HN Directors Safe owner for approve/reject/revoke), NOT
 * msg.sender — so the relayer submits every tx and users never pay gas.
 *
 * Domain: EIP712("HubsNetworkPatronSBT", "1").
 */
import { getAddress, type TypedDataDomain } from "viem";

/** Server-side address (reads + relayer writes). */
export const PATRON_SBT_ADDRESS =
  process.env.PATRON_SBT_ADDRESS ||
  process.env.NEXT_PUBLIC_PATRON_SBT_ADDRESS ||
  "0x75F0764AF4466bf77CB325C7c4a5DF4ee44C3326";

/** Client mirror (display + EIP-712 verifyingContract on the client). */
export const NEXT_PUBLIC_PATRON_SBT_ADDRESS =
  process.env.NEXT_PUBLIC_PATRON_SBT_ADDRESS || PATRON_SBT_ADDRESS;

export const PATRON_SBT_CHAIN_ID = Number(
  process.env.NEXT_PUBLIC_HN_CHAIN_ID ||
    process.env.NEXT_PUBLIC_CHAIN_ID ||
    "11155111"
);

export const PATRON_SBT_EIP712_NAME = "HubsNetworkPatronSBT" as const;
export const PATRON_SBT_EIP712_VERSION = "1" as const;

/** A Patron application proposes between 1 and 10 canonical skills. */
export const PATRON_SKILL_MIN = 1;
export const PATRON_SKILL_MAX = 10;

/**
 * @deprecated Use PATRON_SKILL_MIN / PATRON_SKILL_MAX. Kept as the max for
 * back-compat with the skill selector cap.
 */
export const PATRON_SKILL_COUNT = PATRON_SKILL_MAX;

function resolveContractAddress(): `0x${string}` {
  const addr = NEXT_PUBLIC_PATRON_SBT_ADDRESS || PATRON_SBT_ADDRESS;
  return getAddress(addr) as `0x${string}`;
}

/**
 * EIP-712 domain for the deployed Patron contract. Used by both client
 * (signing) and server (app-signer signing / verification / recovery).
 */
export function buildPatronDomain(): TypedDataDomain {
  return {
    name: PATRON_SBT_EIP712_NAME,
    version: PATRON_SBT_EIP712_VERSION,
    chainId: PATRON_SBT_CHAIN_ID,
    verifyingContract: resolveContractAddress(),
  };
}

/**
 * Curated ABI — only the entries the app uses. Function signatures match the
 * deployed HubsNetworkPatronSBT contract exactly.
 */
export const PATRON_SBT_ABI = [
  // ── Writes ──────────────────────────────────────────────────────────
  {
    name: "requestPatronApplication",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      {
        name: "params",
        type: "tuple",
        components: [
          { name: "applicant", type: "address" },
          { name: "proposedSkills", type: "bytes32[]" },
          { name: "applicantNonce", type: "uint256" },
          { name: "signatureDeadline", type: "uint256" },
        ],
      },
      { name: "applicantSignature", type: "bytes" },
      { name: "appSignature", type: "bytes" },
    ],
    outputs: [{ name: "applicationId", type: "bytes32" }],
  },
  {
    name: "approveApplicationAndMint",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      {
        name: "params",
        type: "tuple",
        components: [
          { name: "applicationId", type: "bytes32" },
          { name: "signer", type: "address" },
          { name: "signatureDeadline", type: "uint256" },
        ],
      },
      { name: "directorSignature", type: "bytes" },
    ],
    outputs: [{ name: "tokenId", type: "uint256" }],
  },
  {
    name: "rejectApplication",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      {
        name: "params",
        type: "tuple",
        components: [
          { name: "applicationId", type: "bytes32" },
          { name: "signer", type: "address" },
          { name: "signatureDeadline", type: "uint256" },
        ],
      },
      { name: "directorSignature", type: "bytes" },
    ],
    outputs: [],
  },
  {
    name: "revokePatron",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      {
        name: "params",
        type: "tuple",
        components: [
          { name: "tokenId", type: "uint256" },
          { name: "signer", type: "address" },
          { name: "nonce", type: "uint256" },
          { name: "signatureDeadline", type: "uint256" },
        ],
      },
      { name: "directorSignature", type: "bytes" },
    ],
    outputs: [],
  },

  // ── Reads ───────────────────────────────────────────────────────────
  {
    name: "applicationNonces",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "", type: "address" }],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    name: "applications",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "", type: "bytes32" }],
    outputs: [
      { name: "applicant", type: "address" },
      { name: "skillCount", type: "uint8" },
      { name: "status", type: "uint8" },
      { name: "createdAt", type: "uint64" },
      { name: "tokenId", type: "uint256" },
    ],
  },
  {
    name: "appSigner",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "address" }],
  },
  {
    name: "hnDirectorsSafe",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "address" }],
  },
  {
    name: "hnDirectorNonces",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "", type: "address" }],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    name: "validSkill",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "", type: "bytes32" }],
    outputs: [{ name: "", type: "bool" }],
  },
  {
    name: "getApplicantApplications",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "", type: "address" }],
    outputs: [{ name: "", type: "bytes32[]" }],
  },
  {
    name: "getApplicationSkills",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "applicationId", type: "bytes32" }],
    outputs: [{ name: "", type: "bytes32[]" }],
  },
  {
    name: "getPatronTokens",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "", type: "address" }],
    outputs: [{ name: "", type: "uint256[]" }],
  },
  {
    name: "getActivePatronTokens",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "", type: "address" }],
    outputs: [{ name: "", type: "uint256[]" }],
  },
  {
    name: "getSkills",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "tokenId", type: "uint256" }],
    outputs: [{ name: "", type: "bytes32[]" }],
  },
  {
    name: "isActivePatron",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "tokenId", type: "uint256" }],
    outputs: [{ name: "", type: "bool" }],
  },
  {
    name: "ownerOf",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "tokenId", type: "uint256" }],
    outputs: [{ name: "", type: "address" }],
  },
  {
    name: "balanceOf",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "owner", type: "address" }],
    outputs: [{ name: "", type: "uint256" }],
  },

  // ── Events ──────────────────────────────────────────────────────────
  {
    name: "PatronApplicationRequested",
    type: "event",
    inputs: [
      { name: "applicationId", type: "bytes32", indexed: true },
      { name: "applicant", type: "address", indexed: true },
    ],
    anonymous: false,
  },
  {
    name: "PatronApplicationRejected",
    type: "event",
    inputs: [
      { name: "applicationId", type: "bytes32", indexed: true },
      { name: "applicant", type: "address", indexed: true },
      { name: "rejectedBy", type: "address", indexed: true },
    ],
    anonymous: false,
  },
  {
    name: "PatronMinted",
    type: "event",
    inputs: [
      { name: "applicationId", type: "bytes32", indexed: true },
      { name: "tokenId", type: "uint256", indexed: true },
      { name: "patronOwner", type: "address", indexed: true },
      { name: "approver", type: "address", indexed: false },
    ],
    anonymous: false,
  },
  {
    name: "PatronRevoked",
    type: "event",
    inputs: [
      { name: "tokenId", type: "uint256", indexed: true },
      { name: "patronOwner", type: "address", indexed: true },
      { name: "revokedBy", type: "address", indexed: true },
    ],
    anonymous: false,
  },
] as const;
