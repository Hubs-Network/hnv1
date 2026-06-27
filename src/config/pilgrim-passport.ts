/**
 * PilgrimPassportSBT — contract config (Sepolia).
 *
 * Single source of truth for the deployed Passport contract address, chain id,
 * EIP-712 domain and the (curated) ABI used by the app.
 *
 * The contract enforces identity via EIP-712 signatures (applicant + app signer
 * for claims, hub Safe owner for approvals), NOT msg.sender. This is why claims
 * and approvals can be submitted by the relayer on the user's behalf (gasless).
 *
 * Verified source: contracts/PilgrimPassportSBT3.sol
 * Domain: EIP712("PilgrimPassportSBT", "1").
 */
import { getAddress, type TypedDataDomain } from "viem";

/** Server-side address (reads + relayer writes). */
export const PILGRIM_PASSPORT_SBT_ADDRESS =
  process.env.PILGRIM_PASSPORT_SBT_ADDRESS ||
  process.env.NEXT_PUBLIC_PILGRIM_PASSPORT_SBT_ADDRESS ||
  "0x763aE5E630251684eA37dA57368074301cAf07c6";

/** Client mirror (display + EIP-712 verifyingContract on the client). */
export const NEXT_PUBLIC_PILGRIM_PASSPORT_SBT_ADDRESS =
  process.env.NEXT_PUBLIC_PILGRIM_PASSPORT_SBT_ADDRESS ||
  PILGRIM_PASSPORT_SBT_ADDRESS;

export const PILGRIM_PASSPORT_CHAIN_ID = Number(
  process.env.NEXT_PUBLIC_HN_CHAIN_ID ||
    process.env.NEXT_PUBLIC_CHAIN_ID ||
    "11155111"
);

export const PILGRIM_PASSPORT_EIP712_NAME = "PilgrimPassportSBT" as const;
export const PILGRIM_PASSPORT_EIP712_VERSION = "1" as const;

/** Max skills selectable at claim time (matches MAX_INITIAL_SKILLS on-chain). */
export const MAX_INITIAL_SKILLS = 10;
/** Min skills required at claim time (contract: _validateSkillList min = 1). */
export const MIN_INITIAL_SKILLS = 1;

function resolveContractAddress(): `0x${string}` {
  // Prefer the client mirror so the same domain is produced on both sides.
  const addr =
    NEXT_PUBLIC_PILGRIM_PASSPORT_SBT_ADDRESS || PILGRIM_PASSPORT_SBT_ADDRESS;
  return getAddress(addr) as `0x${string}`;
}

/**
 * Build the EIP-712 domain for the deployed Passport contract.
 * Used by both client (signing) and server (app-signer signing / verification).
 */
export function buildPilgrimPassportDomain(): TypedDataDomain {
  return {
    name: PILGRIM_PASSPORT_EIP712_NAME,
    version: PILGRIM_PASSPORT_EIP712_VERSION,
    chainId: PILGRIM_PASSPORT_CHAIN_ID,
    verifyingContract: resolveContractAddress(),
  };
}

/**
 * Curated ABI — only the entries the app uses. Generated from the verified
 * Sourcify ABI; function signatures match the deployed contract exactly.
 */
export const PILGRIM_PASSPORT_SBT_ABI = [
  {
    name: "requestPassportClaim",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      {
        name: "params",
        type: "tuple",
        components: [
          { name: "applicant", type: "address" },
          { name: "hubSafe", type: "address" },
          { name: "proposedSkills", type: "bytes32[]" },
          { name: "applicantNonce", type: "uint256" },
          { name: "signatureDeadline", type: "uint256" },
        ],
      },
      { name: "applicantSignature", type: "bytes" },
      { name: "appSignature", type: "bytes" },
    ],
    outputs: [{ name: "claimId", type: "bytes32" }],
  },
  {
    name: "approveClaimAndMint",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      {
        name: "params",
        type: "tuple",
        components: [
          { name: "claimId", type: "bytes32" },
          { name: "signer", type: "address" },
          { name: "approvedSkills", type: "bytes32[]" },
          { name: "signatureDeadline", type: "uint256" },
        ],
      },
      { name: "hubSignature", type: "bytes" },
    ],
    outputs: [{ name: "tokenId", type: "uint256" }],
  },
  {
    name: "appSigner",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "address" }],
  },
  {
    name: "claimNonces",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "", type: "address" }],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    name: "claimRequests",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "", type: "bytes32" }],
    outputs: [
      { name: "applicant", type: "address" },
      { name: "hubSafe", type: "address" },
      { name: "skillCount", type: "uint8" },
      { name: "status", type: "uint8" },
      { name: "createdAt", type: "uint64" },
    ],
  },
  {
    name: "getApplicantClaims",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "applicant", type: "address" }],
    outputs: [{ name: "", type: "bytes32[]" }],
  },
  {
    name: "getHubClaims",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "hubSafe", type: "address" }],
    outputs: [{ name: "", type: "bytes32[]" }],
  },
  {
    // Optional getter (present only on contracts deployed with it). Reads revert
    // gracefully on older deploys; the app falls back to log reconstruction.
    name: "getClaimProposedSkills",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "claimId", type: "bytes32" }],
    outputs: [{ name: "", type: "bytes32[]" }],
  },
  {
    name: "getSkillAttestations",
    type: "function",
    stateMutability: "view",
    inputs: [
      { name: "tokenId", type: "uint256" },
      { name: "skillId", type: "bytes32" },
    ],
    outputs: [
      {
        name: "",
        type: "tuple[]",
        components: [
          { name: "hubSafe", type: "address" },
          { name: "signer", type: "address" },
          { name: "timestamp", type: "uint64" },
          { name: "revoked", type: "bool" },
        ],
      },
    ],
  },
  {
    name: "getSkills",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "tokenId", type: "uint256" }],
    outputs: [{ name: "", type: "bytes32[]" }],
  },
  {
    name: "hasActiveAttestation",
    type: "function",
    stateMutability: "view",
    inputs: [
      { name: "tokenId", type: "uint256" },
      { name: "skillId", type: "bytes32" },
      { name: "hubSafe", type: "address" },
    ],
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
    name: "tokenOf",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "owner", type: "address" }],
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
    name: "PassportClaimRequested",
    type: "event",
    inputs: [
      { name: "claimId", type: "bytes32", indexed: true },
      { name: "applicant", type: "address", indexed: true },
      { name: "hubSafe", type: "address", indexed: true },
    ],
    anonymous: false,
  },
  {
    name: "PassportMinted",
    type: "event",
    inputs: [
      { name: "pilgrim", type: "address", indexed: true },
      { name: "tokenId", type: "uint256", indexed: true },
      { name: "hubSafe", type: "address", indexed: true },
      { name: "signer", type: "address", indexed: false },
    ],
    anonymous: false,
  },
  {
    name: "SkillAttested",
    type: "event",
    inputs: [
      { name: "tokenId", type: "uint256", indexed: true },
      { name: "skillId", type: "bytes32", indexed: true },
      { name: "hubSafe", type: "address", indexed: true },
      { name: "signer", type: "address", indexed: false },
    ],
    anonymous: false,
  },
] as const;
