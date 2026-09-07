/**
 * HubsNetworkPatronSBT contract helpers (Sepolia) — SERVER ONLY.
 *
 * - Reads use SEPOLIA_RPC_URL (public client), same convention as the other SBTs.
 * - Writes (request / approve / reject / revoke) are submitted by the relayer
 *   (RELAYER_PRIVATE_KEY) so users never pay gas. Safe because the contract
 *   verifies identity via EIP-712 signatures, not msg.sender.
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
  type Hex,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { sepolia } from "viem/chains";
import { PATRON_SBT_ADDRESS, PATRON_SBT_ABI } from "@/config/patron-sbt";
import type { SkillHash } from "./patron-sbt-message";

/** Mirrors the on-chain enum PatronStatus { None, Pending, Minted, Rejected }. */
export const PATRON_STATUS = {
  None: 0,
  Pending: 1,
  Minted: 2,
  Rejected: 3,
} as const;

export interface OnChainApplication {
  applicant: `0x${string}`;
  skillCount: number;
  status: number;
  createdAt: number;
  tokenId: bigint;
}

function getRpcUrl(): string {
  return (
    process.env.SEPOLIA_RPC_URL ||
    process.env.NEXT_PUBLIC_SEPOLIA_RPC_URL ||
    "https://rpc.sepolia.org"
  );
}

function getContractAddress(): `0x${string}` {
  return getAddress(PATRON_SBT_ADDRESS) as `0x${string}`;
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
    abi: PATRON_SBT_ABI,
    functionName: functionName as never,
    args: args as never,
  }) as Promise<T>;
}

// ── Reads ─────────────────────────────────────────────────────────────

export async function getApplicationNonce(applicant: string): Promise<bigint> {
  return read<bigint>("applicationNonces", [getAddress(applicant)]);
}

export async function getHNDirectorNonce(signer: string): Promise<bigint> {
  return read<bigint>("hnDirectorNonces", [getAddress(signer)]);
}

export async function getOnChainAppSigner(): Promise<`0x${string}`> {
  return read<`0x${string}`>("appSigner", []);
}

export async function getHnDirectorsSafe(): Promise<`0x${string}`> {
  return read<`0x${string}`>("hnDirectorsSafe", []);
}

export async function isValidPatronSkill(skillHash: Hex): Promise<boolean> {
  try {
    return await read<boolean>("validSkill", [skillHash]);
  } catch {
    return false;
  }
}

/** applications(applicationId); returns null when the application does not exist. */
export async function getOnChainApplication(
  applicationId: Hex
): Promise<OnChainApplication | null> {
  try {
    const r = await read<
      readonly [`0x${string}`, number, number, bigint, bigint]
    >("applications", [applicationId]);
    const [applicant, skillCount, status, createdAt, tokenId] = r;
    if (Number(status) === PATRON_STATUS.None) return null;
    return {
      applicant: getAddress(applicant),
      skillCount: Number(skillCount),
      status: Number(status),
      createdAt: Number(createdAt),
      tokenId: tokenId as bigint,
    };
  } catch {
    return null;
  }
}

export async function getApplicationSkills(
  applicationId: Hex
): Promise<SkillHash[]> {
  try {
    const skills = await read<readonly Hex[]>("getApplicationSkills", [
      applicationId,
    ]);
    return [...skills] as SkillHash[];
  } catch {
    return [];
  }
}

export async function getPatronSkills(tokenId: bigint): Promise<SkillHash[]> {
  try {
    const skills = await read<readonly Hex[]>("getSkills", [tokenId]);
    return [...skills] as SkillHash[];
  } catch {
    return [];
  }
}

export async function getApplicantApplications(
  applicant: string
): Promise<Hex[]> {
  try {
    const ids = await read<readonly Hex[]>("getApplicantApplications", [
      getAddress(applicant),
    ]);
    return [...ids];
  } catch {
    return [];
  }
}

export async function getActivePatronTokens(
  owner: string
): Promise<bigint[]> {
  try {
    const ids = await read<readonly bigint[]>("getActivePatronTokens", [
      getAddress(owner),
    ]);
    return [...ids];
  } catch {
    return [];
  }
}

export async function getPatronTokens(owner: string): Promise<bigint[]> {
  try {
    const ids = await read<readonly bigint[]>("getPatronTokens", [
      getAddress(owner),
    ]);
    return [...ids];
  } catch {
    return [];
  }
}

export async function isActivePatron(tokenId: bigint): Promise<boolean> {
  try {
    return await read<boolean>("isActivePatron", [tokenId]);
  } catch {
    return false;
  }
}

export async function getPatronOwner(
  tokenId: bigint
): Promise<`0x${string}` | null> {
  try {
    return await read<`0x${string}`>("ownerOf", [tokenId]);
  } catch {
    return null;
  }
}

// ── Batch active check (public directory) ──────────────────────────────
let activeSetCache: { key: string; at: number; set: Set<string> } | null = null;
const ACTIVE_SET_TTL_MS = 60_000;

/**
 * Batch-check isActivePatron for many token ids in a single multicall.
 * Returns a Set of active token-id strings, or null if the RPC failed entirely
 * (so callers can fall back to the cached JSON status).
 */
export async function getActivePatronSet(
  tokenIds: (string | bigint)[]
): Promise<Set<string> | null> {
  const ids = tokenIds.map((t) => BigInt(t));
  if (ids.length === 0) return new Set();
  try {
    const contract = getContractAddress();
    const results = await getPublicClient().multicall({
      allowFailure: true,
      contracts: ids.map((id) => ({
        address: contract,
        abi: PATRON_SBT_ABI,
        functionName: "isActivePatron" as const,
        args: [id],
      })),
    });
    const set = new Set<string>();
    results.forEach((r, i) => {
      if (r.status === "success" && r.result === true) {
        set.add(ids[i].toString());
      }
    });
    return set;
  } catch {
    return null;
  }
}

export async function getCachedActivePatronSet(
  tokenIds: (string | bigint)[]
): Promise<Set<string> | null> {
  const key = tokenIds
    .map((t) => t.toString())
    .sort()
    .join(",");
  if (
    activeSetCache &&
    activeSetCache.key === key &&
    Date.now() - activeSetCache.at < ACTIVE_SET_TTL_MS
  ) {
    return activeSetCache.set;
  }
  const set = await getActivePatronSet(tokenIds);
  if (set) activeSetCache = { key, at: Date.now(), set };
  return set;
}

// ── Writes (relayer-submitted) ─────────────────────────────────────────

export interface RequestApplicationParams {
  applicant: string;
  proposedSkills: SkillHash[];
  applicantNonce: bigint;
  signatureDeadline: bigint;
}

/** Submit requestPatronApplication via the relayer. Returns tx + applicationId. */
export async function submitRequestPatronApplication(
  params: RequestApplicationParams,
  applicantSignature: Hex,
  appSignature: Hex
): Promise<{ txHash: string; applicationId: string | null }> {
  const walletClient = createWalletClient({
    account: getRelayerAccount(),
    chain: sepolia,
    transport: http(getRpcUrl()),
  });
  const publicClient = getPublicClient();

  const txHash = await walletClient.writeContract({
    address: getContractAddress(),
    abi: PATRON_SBT_ABI,
    functionName: "requestPatronApplication",
    args: [
      {
        applicant: getAddress(params.applicant),
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
    throw new Error("requestPatronApplication reverted on-chain");
  }

  let applicationId: string | null = null;
  for (const log of receipt.logs) {
    if (log.address.toLowerCase() !== getContractAddress().toLowerCase()) continue;
    try {
      const decoded = decodeEventLog({
        abi: PATRON_SBT_ABI,
        data: log.data,
        topics: log.topics,
      });
      if (decoded.eventName === "PatronApplicationRequested") {
        applicationId = (decoded.args as { applicationId: string }).applicationId;
        break;
      }
    } catch {
      // not our event
    }
  }
  return { txHash, applicationId };
}

export interface ApproveApplicationParams {
  applicationId: Hex;
  signer: string;
  signatureDeadline: bigint;
}

/** Submit approveApplicationAndMint via the relayer. Returns tx + minted tokenId. */
export async function submitApproveApplicationAndMint(
  params: ApproveApplicationParams,
  directorSignature: Hex
): Promise<{ txHash: string; tokenId: string | null; patronOwner: string | null }> {
  const walletClient = createWalletClient({
    account: getRelayerAccount(),
    chain: sepolia,
    transport: http(getRpcUrl()),
  });
  const publicClient = getPublicClient();

  const txHash = await walletClient.writeContract({
    address: getContractAddress(),
    abi: PATRON_SBT_ABI,
    functionName: "approveApplicationAndMint",
    args: [
      {
        applicationId: params.applicationId,
        signer: getAddress(params.signer),
        signatureDeadline: params.signatureDeadline,
      },
      directorSignature,
    ],
    chain: sepolia,
  });

  const receipt = await publicClient.waitForTransactionReceipt({ hash: txHash });
  if (receipt.status === "reverted") {
    throw new Error("approveApplicationAndMint reverted on-chain");
  }

  let tokenId: string | null = null;
  let patronOwner: string | null = null;
  for (const log of receipt.logs) {
    if (log.address.toLowerCase() !== getContractAddress().toLowerCase()) continue;
    try {
      const decoded = decodeEventLog({
        abi: PATRON_SBT_ABI,
        data: log.data,
        topics: log.topics,
      });
      if (decoded.eventName === "PatronMinted") {
        const a = decoded.args as { tokenId: bigint; patronOwner: string };
        tokenId = a.tokenId.toString();
        patronOwner = a.patronOwner;
        break;
      }
    } catch {
      // not our event
    }
  }

  // Fallback: derive tokenId from the on-chain application record.
  if (tokenId === null) {
    const app = await getOnChainApplication(params.applicationId);
    if (app && app.tokenId > BigInt(0)) tokenId = app.tokenId.toString();
  }
  return { txHash, tokenId, patronOwner };
}

export interface RejectApplicationParams {
  applicationId: Hex;
  signer: string;
  signatureDeadline: bigint;
}

/** Submit rejectApplication via the relayer. */
export async function submitRejectApplication(
  params: RejectApplicationParams,
  directorSignature: Hex
): Promise<{ txHash: string }> {
  const walletClient = createWalletClient({
    account: getRelayerAccount(),
    chain: sepolia,
    transport: http(getRpcUrl()),
  });
  const publicClient = getPublicClient();

  const txHash = await walletClient.writeContract({
    address: getContractAddress(),
    abi: PATRON_SBT_ABI,
    functionName: "rejectApplication",
    args: [
      {
        applicationId: params.applicationId,
        signer: getAddress(params.signer),
        signatureDeadline: params.signatureDeadline,
      },
      directorSignature,
    ],
    chain: sepolia,
  });

  const receipt = await publicClient.waitForTransactionReceipt({ hash: txHash });
  if (receipt.status === "reverted") {
    throw new Error("rejectApplication reverted on-chain");
  }
  return { txHash };
}

export interface RevokePatronParams {
  tokenId: bigint;
  signer: string;
  nonce: bigint;
  signatureDeadline: bigint;
}

/** Submit revokePatron via the relayer. */
export async function submitRevokePatron(
  params: RevokePatronParams,
  directorSignature: Hex
): Promise<{ txHash: string }> {
  const walletClient = createWalletClient({
    account: getRelayerAccount(),
    chain: sepolia,
    transport: http(getRpcUrl()),
  });
  const publicClient = getPublicClient();

  const txHash = await walletClient.writeContract({
    address: getContractAddress(),
    abi: PATRON_SBT_ABI,
    functionName: "revokePatron",
    args: [
      {
        tokenId: params.tokenId,
        signer: getAddress(params.signer),
        nonce: params.nonce,
        signatureDeadline: params.signatureDeadline,
      },
      directorSignature,
    ],
    chain: sepolia,
  });

  const receipt = await publicClient.waitForTransactionReceipt({ hash: txHash });
  if (receipt.status === "reverted") {
    throw new Error("revokePatron reverted on-chain");
  }
  return { txHash };
}
