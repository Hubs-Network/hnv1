/**
 * PilgrimPassportSBT contract helpers (Sepolia) — SERVER ONLY.
 *
 * - Reads use SEPOLIA_RPC_URL (public client), same convention as hn-badge-sbt.ts.
 * - Writes (requestPassportClaim / approveClaimAndMint) are submitted by the
 *   relayer (RELAYER_PRIVATE_KEY) so users never pay gas. This is safe because
 *   the contract verifies identity via EIP-712 signatures, not msg.sender.
 * - Chain is forced to Sepolia (11155111).
 *
 * Server-only module: only import from API routes / server components.
 */
import {
  createPublicClient,
  createWalletClient,
  http,
  getAddress,
  decodeEventLog,
  decodeFunctionData,
  parseAbiItem,
  type Hex,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { sepolia } from "viem/chains";
import {
  PILGRIM_PASSPORT_SBT_ADDRESS,
  PILGRIM_PASSPORT_SBT_ABI,
} from "@/config/pilgrim-passport";
import type { SkillHash } from "./pilgrim-passport-message";

/** Mirrors the on-chain enum ClaimStatus { None, Pending, Minted, Cancelled, Rejected }. */
export const CLAIM_STATUS = {
  None: 0,
  Pending: 1,
  Minted: 2,
  Cancelled: 3,
  Rejected: 4,
} as const;

export interface OnChainClaim {
  applicant: `0x${string}`;
  hubSafe: `0x${string}`;
  skillCount: number;
  status: number;
  createdAt: number;
}

export interface OnChainAttestation {
  hubSafe: `0x${string}`;
  signer: `0x${string}`;
  timestamp: number;
  revoked: boolean;
}

function getRpcUrl(): string {
  return (
    process.env.SEPOLIA_RPC_URL ||
    process.env.NEXT_PUBLIC_SEPOLIA_RPC_URL ||
    "https://rpc.sepolia.org"
  );
}

function getContractAddress(): `0x${string}` {
  return getAddress(PILGRIM_PASSPORT_SBT_ADDRESS) as `0x${string}`;
}

function getPublicClient() {
  return createPublicClient({ chain: sepolia, transport: http(getRpcUrl()) });
}

function getRelayerAccount() {
  const pk = process.env.RELAYER_PRIVATE_KEY;
  if (!pk) throw new Error("RELAYER_PRIVATE_KEY not configured");
  return privateKeyToAccount(pk as Hex);
}

function read<T>(functionName: string, args: unknown[]): Promise<T> {
  return getPublicClient().readContract({
    address: getContractAddress(),
    abi: PILGRIM_PASSPORT_SBT_ABI,
    functionName: functionName as never,
    args: args as never,
  }) as Promise<T>;
}

// ── Reads ─────────────────────────────────────────────────────────────

/** tokenOf(owner); returns null when the owner has no passport (tokenId 0). */
export async function getPassportTokenOfOwner(
  owner: string
): Promise<bigint | null> {
  try {
    const id = await read<bigint>("tokenOf", [getAddress(owner)]);
    return id && id > BigInt(0) ? id : null;
  } catch {
    return null;
  }
}

export async function isPassportHolder(owner: string): Promise<boolean> {
  return (await getPassportTokenOfOwner(owner)) !== null;
}

export async function getPassportOwner(
  tokenId: bigint
): Promise<`0x${string}` | null> {
  try {
    return await read<`0x${string}`>("ownerOf", [tokenId]);
  } catch {
    return null;
  }
}

export async function getPassportSkills(tokenId: bigint): Promise<SkillHash[]> {
  try {
    const skills = await read<readonly Hex[]>("getSkills", [tokenId]);
    return [...skills] as SkillHash[];
  } catch {
    return [];
  }
}

export async function getSkillAttestations(
  tokenId: bigint,
  skillHash: SkillHash
): Promise<OnChainAttestation[]> {
  try {
    const rows = await read<
      readonly {
        hubSafe: `0x${string}`;
        signer: `0x${string}`;
        timestamp: bigint;
        revoked: boolean;
      }[]
    >("getSkillAttestations", [tokenId, skillHash]);
    return rows.map((r) => ({
      hubSafe: getAddress(r.hubSafe),
      signer: getAddress(r.signer),
      timestamp: Number(r.timestamp),
      revoked: r.revoked,
    }));
  } catch {
    return [];
  }
}

export async function hasActiveAttestation(
  tokenId: bigint,
  skillHash: SkillHash,
  hubSafe: string
): Promise<boolean> {
  try {
    return await read<boolean>("hasActiveAttestation", [
      tokenId,
      skillHash,
      getAddress(hubSafe),
    ]);
  } catch {
    return false;
  }
}

export async function getApplicantClaims(applicant: string): Promise<Hex[]> {
  try {
    const ids = await read<readonly Hex[]>("getApplicantClaims", [
      getAddress(applicant),
    ]);
    return [...ids];
  } catch {
    return [];
  }
}

export async function getHubClaims(hubSafe: string): Promise<Hex[]> {
  try {
    const ids = await read<readonly Hex[]>("getHubClaims", [
      getAddress(hubSafe),
    ]);
    return [...ids];
  } catch {
    return [];
  }
}

export async function getClaimNonce(applicant: string): Promise<bigint> {
  return read<bigint>("claimNonces", [getAddress(applicant)]);
}

/** Current SetSkillStatus nonce for an HN Director signer. */
export async function getHNDirectorNonce(signer: string): Promise<bigint> {
  return read<bigint>("hnDirectorNonces", [getAddress(signer)]);
}

/** Whether a skill hash is currently active (validSkill) on-chain. */
export async function isValidSkillOnChain(skillHash: Hex): Promise<boolean> {
  try {
    return await read<boolean>("validSkill", [skillHash]);
  } catch {
    return false;
  }
}

export async function getOnChainAppSigner(): Promise<`0x${string}`> {
  return read<`0x${string}`>("appSigner", []);
}

/**
 * Read claimRequests(claimId). NOTE: the auto-generated getter omits the fixed
 * `bytes32[3] proposedSkills` array, so proposed skills must come from the
 * off-chain claim store. Returns null if the claim does not exist (status None).
 */
export async function getOnChainClaim(
  claimId: Hex
): Promise<OnChainClaim | null> {
  try {
    const r = await read<
      readonly [`0x${string}`, `0x${string}`, number, number, bigint]
    >("claimRequests", [claimId]);
    const [applicant, hubSafe, skillCount, status, createdAt] = r;
    if (status === CLAIM_STATUS.None) return null;
    return {
      applicant: getAddress(applicant),
      hubSafe: getAddress(hubSafe),
      skillCount: Number(skillCount),
      status: Number(status),
      createdAt: Number(createdAt),
    };
  } catch {
    return null;
  }
}

export interface DetailedClaim {
  claimId: Hex;
  applicant: `0x${string}`;
  hubSafe: `0x${string}`;
  status: number;
  proposedSkillHashes: SkillHash[];
}

const PASSPORT_CLAIM_REQUESTED_EVENT = parseAbiItem(
  "event PassportClaimRequested(bytes32 indexed claimId, address indexed applicant, address indexed hubSafe)"
);

/**
 * Preferred path: read proposed skills directly via the getClaimProposedSkills
 * view. Returns null if the deployed contract doesn't have it (older deploy),
 * so callers can fall back to log reconstruction.
 */
export async function getClaimProposedSkills(
  claimId: Hex
): Promise<SkillHash[] | null> {
  try {
    const skills = await read<readonly Hex[]>("getClaimProposedSkills", [claimId]);
    return [...skills] as SkillHash[];
  } catch {
    return null;
  }
}

/**
 * Find the largest block whose timestamp is <= target (the claim's block).
 * Binary search keeps this within the RPC free-tier limits (no wide scans).
 */
async function findBlockByTimestamp(
  client: ReturnType<typeof getPublicClient>,
  targetTs: bigint
): Promise<bigint> {
  let lo = BigInt(0);
  let hi = await client.getBlockNumber();
  while (lo < hi) {
    const mid = (lo + hi + BigInt(1)) / BigInt(2);
    const blk = await client.getBlock({ blockNumber: mid });
    if (blk.timestamp <= targetTs) lo = mid;
    else hi = mid - BigInt(1);
  }
  return lo;
}

/**
 * Fallback for contracts without getClaimProposedSkills: locate the claim's
 * block via its createdAt timestamp, then read PassportClaimRequested logs in a
 * tight (<=10 block) window — within Alchemy free-tier eth_getLogs limits — and
 * decode the proposed skills from the request tx calldata.
 */
export async function reconstructProposedSkillsFromChain(
  claimId: Hex,
  createdAt: number
): Promise<SkillHash[] | null> {
  if (!createdAt) return null;
  try {
    const client = getPublicClient();
    const block = await findBlockByTimestamp(client, BigInt(createdAt));
    const fromBlock = block > BigInt(5) ? block - BigInt(5) : BigInt(0);
    const toBlock = block + BigInt(4); // 10-block inclusive window
    const logs = await client.getLogs({
      address: getContractAddress(),
      event: PASSPORT_CLAIM_REQUESTED_EVENT,
      args: { claimId },
      fromBlock,
      toBlock,
    });
    if (logs.length === 0) return null;

    const tx = await client.getTransaction({ hash: logs[0].transactionHash });
    const decoded = decodeFunctionData({
      abi: PILGRIM_PASSPORT_SBT_ABI,
      data: tx.input,
    });
    if (decoded.functionName !== "requestPassportClaim") return null;
    const params = (decoded.args as readonly unknown[])[0] as {
      proposedSkills: readonly Hex[];
    };
    return [...params.proposedSkills] as SkillHash[];
  } catch {
    return null;
  }
}

/**
 * List a hub's claims from chain (authoritative), optionally filtered by status,
 * reconstructing proposed skill hashes for each. Does not depend on the DB.
 */
export async function getDetailedClaimsForHub(
  hubSafe: string,
  onlyStatus?: number
): Promise<DetailedClaim[]> {
  const ids = await getHubClaims(hubSafe);
  const detailed = await Promise.all(ids.map((id) => getDetailedClaim(id)));
  return detailed.filter(
    (c): c is DetailedClaim =>
      c !== null && (onlyStatus === undefined || c.status === onlyStatus)
  );
}

/** Build a DetailedClaim from chain for a single claimId, or null if missing. */
export async function getDetailedClaim(
  claimId: Hex
): Promise<DetailedClaim | null> {
  const onChain = await getOnChainClaim(claimId);
  if (!onChain) return null;
  // Prefer the direct getter (one read); fall back to log reconstruction for
  // contracts deployed without it.
  const proposedSkillHashes =
    (await getClaimProposedSkills(claimId)) ??
    (await reconstructProposedSkillsFromChain(claimId, onChain.createdAt)) ??
    [];
  return {
    claimId,
    applicant: onChain.applicant,
    hubSafe: onChain.hubSafe,
    status: onChain.status,
    proposedSkillHashes,
  };
}

// ── Writes (relayer-submitted) ─────────────────────────────────────────

export interface ClaimRequestParams {
  applicant: string;
  hubSafe: string;
  proposedSkills: SkillHash[];
  applicantNonce: bigint;
  signatureDeadline: bigint;
}

/**
 * Submit requestPassportClaim via the relayer. Returns the tx hash and the
 * claimId extracted from the PassportClaimRequested event.
 */
export async function submitRequestPassportClaim(
  params: ClaimRequestParams,
  applicantSignature: Hex,
  appSignature: Hex
): Promise<{ txHash: string; claimId: string | null }> {
  const walletClient = createWalletClient({
    account: getRelayerAccount(),
    chain: sepolia,
    transport: http(getRpcUrl()),
  });
  const publicClient = getPublicClient();

  const txHash = await walletClient.writeContract({
    address: getContractAddress(),
    abi: PILGRIM_PASSPORT_SBT_ABI,
    functionName: "requestPassportClaim",
    args: [
      {
        applicant: getAddress(params.applicant),
        hubSafe: getAddress(params.hubSafe),
        proposedSkills: params.proposedSkills,
        applicantNonce: params.applicantNonce,
        signatureDeadline: params.signatureDeadline,
      },
      applicantSignature,
      appSignature,
    ],
    chain: sepolia,
  });

  const receipt = await publicClient.waitForTransactionReceipt({ hash: txHash });
  if (receipt.status === "reverted") {
    throw new Error("requestPassportClaim reverted on-chain");
  }

  let claimId: string | null = null;
  for (const log of receipt.logs) {
    if (log.address.toLowerCase() !== getContractAddress().toLowerCase()) continue;
    try {
      const decoded = decodeEventLog({
        abi: PILGRIM_PASSPORT_SBT_ABI,
        data: log.data,
        topics: log.topics,
      });
      if (decoded.eventName === "PassportClaimRequested") {
        claimId = (decoded.args as { claimId: string }).claimId;
        break;
      }
    } catch {
      // not our event
    }
  }
  return { txHash, claimId };
}

export interface ApproveClaimParams {
  claimId: Hex;
  signer: string;
  approvedSkills: SkillHash[];
  signatureDeadline: bigint;
}

/**
 * Submit approveClaimAndMint via the relayer. Returns the tx hash and the
 * minted tokenId (from the PassportMinted event, with a tokenOf fallback).
 */
export async function submitApproveClaimAndMint(
  params: ApproveClaimParams,
  hubSignature: Hex,
  applicant: string
): Promise<{ txHash: string; tokenId: string | null }> {
  const walletClient = createWalletClient({
    account: getRelayerAccount(),
    chain: sepolia,
    transport: http(getRpcUrl()),
  });
  const publicClient = getPublicClient();

  const txHash = await walletClient.writeContract({
    address: getContractAddress(),
    abi: PILGRIM_PASSPORT_SBT_ABI,
    functionName: "approveClaimAndMint",
    args: [
      {
        claimId: params.claimId,
        signer: getAddress(params.signer),
        approvedSkills: params.approvedSkills,
        signatureDeadline: params.signatureDeadline,
      },
      hubSignature,
    ],
    chain: sepolia,
  });

  const receipt = await publicClient.waitForTransactionReceipt({ hash: txHash });
  if (receipt.status === "reverted") {
    throw new Error("approveClaimAndMint reverted on-chain");
  }

  let tokenId: string | null = null;
  for (const log of receipt.logs) {
    if (log.address.toLowerCase() !== getContractAddress().toLowerCase()) continue;
    try {
      const decoded = decodeEventLog({
        abi: PILGRIM_PASSPORT_SBT_ABI,
        data: log.data,
        topics: log.topics,
      });
      if (decoded.eventName === "PassportMinted") {
        tokenId = (decoded.args as { tokenId: bigint }).tokenId.toString();
        break;
      }
    } catch {
      // not our event
    }
  }

  if (tokenId === null) {
    const id = await getPassportTokenOfOwner(applicant);
    tokenId = id !== null ? id.toString() : null;
  }
  return { txHash, tokenId };
}

export interface SetSkillStatusParams {
  skillId: Hex;
  active: boolean;
  signer: string;
  nonce: bigint;
  signatureDeadline: bigint;
}

/**
 * Submit setSkillStatusByHNDirector via the relayer (gasless). The contract
 * verifies the HN Director's EIP-712 signature + Safe ownership, not msg.sender.
 */
export async function submitSetSkillStatus(
  params: SetSkillStatusParams,
  signature: Hex
): Promise<{ txHash: string }> {
  const walletClient = createWalletClient({
    account: getRelayerAccount(),
    chain: sepolia,
    transport: http(getRpcUrl()),
  });
  const publicClient = getPublicClient();

  const txHash = await walletClient.writeContract({
    address: getContractAddress(),
    abi: PILGRIM_PASSPORT_SBT_ABI,
    functionName: "setSkillStatusByHNDirector",
    args: [
      {
        skillId: params.skillId,
        active: params.active,
        signer: getAddress(params.signer),
        nonce: params.nonce,
        signatureDeadline: params.signatureDeadline,
      },
      signature,
    ],
    chain: sepolia,
  });

  const receipt = await publicClient.waitForTransactionReceipt({ hash: txHash });
  if (receipt.status === "reverted") {
    throw new Error("setSkillStatusByHNDirector reverted on-chain");
  }
  return { txHash };
}
