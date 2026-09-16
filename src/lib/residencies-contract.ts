/**
 * HubsNetworkResidencies contract helpers (Sepolia) — SERVER ONLY.
 *
 * - Reads use SEPOLIA_RPC_URL (public client), same convention as the other SBTs.
 * - Writes (create / apply / select / award / cancel) are submitted by the
 *   relayer (RELAYER_PRIVATE_KEY) so users never pay gas. Safe because the
 *   contract verifies identity via EIP-712 signatures, not msg.sender.
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
import {
  HUBS_NETWORK_RESIDENCIES_ADDRESS,
  RESIDENCIES_ABI,
  RESIDENCY_STATUS,
} from "@/config/residencies";

export interface OnChainResidency {
  id: bigint;
  hubSafe: `0x${string}`;
  metadataURI: string;
  metadataHash: `0x${string}`;
  createdAt: number;
  applicationDeadline: number;
  startDate: number;
  endDate: number;
  isCalendarBound: boolean;
  skillCount: number;
  status: number;
}

function getRpcUrl(): string {
  return (
    process.env.SEPOLIA_RPC_URL ||
    process.env.NEXT_PUBLIC_SEPOLIA_RPC_URL ||
    "https://rpc.sepolia.org"
  );
}

function getContractAddress(): `0x${string}` {
  return getAddress(HUBS_NETWORK_RESIDENCIES_ADDRESS) as `0x${string}`;
}

function getPublicClient() {
  return createPublicClient({ chain: sepolia, transport: http(getRpcUrl()) });
}

function getRelayerAccount() {
  const pk = process.env.RELAYER_PRIVATE_KEY;
  if (!pk) throw new Error("RELAYER_PRIVATE_KEY not configured");
  return privateKeyToAccount(pk as Hex);
}

function getWalletClient() {
  return createWalletClient({
    account: getRelayerAccount(),
    chain: sepolia,
    transport: http(getRpcUrl()),
  });
}

function read<T>(functionName: string, args: unknown[]): Promise<T> {
  return getPublicClient().readContract({
    address: getContractAddress(),
    abi: RESIDENCIES_ABI,
    functionName: functionName as never,
    args: args as never,
  }) as Promise<T>;
}

// ── Reads ─────────────────────────────────────────────────────────────

export async function getSignerNonce(signer: string): Promise<bigint> {
  return read<bigint>("signerNonces", [getAddress(signer)]);
}

export async function getTotalResidencies(): Promise<bigint> {
  try {
    return await read<bigint>("totalResidencies", []);
  } catch {
    return BigInt(0);
  }
}

export async function getNextResidencyId(): Promise<bigint> {
  return read<bigint>("nextResidencyId", []);
}

export async function getResidency(
  residencyId: bigint
): Promise<OnChainResidency | null> {
  try {
    const r = await read<{
      id: bigint;
      hubSafe: `0x${string}`;
      metadataURI: string;
      metadataHash: `0x${string}`;
      createdAt: bigint;
      applicationDeadline: bigint;
      startDate: bigint;
      endDate: bigint;
      isCalendarBound: boolean;
      skillCount: number;
      status: number;
    }>("getResidency", [residencyId]);
    if (Number(r.status) === RESIDENCY_STATUS.None) return null;
    return {
      id: r.id,
      hubSafe: getAddress(r.hubSafe),
      metadataURI: r.metadataURI,
      metadataHash: r.metadataHash,
      createdAt: Number(r.createdAt),
      applicationDeadline: Number(r.applicationDeadline),
      startDate: Number(r.startDate),
      endDate: Number(r.endDate),
      isCalendarBound: r.isCalendarBound,
      skillCount: Number(r.skillCount),
      status: Number(r.status),
    };
  } catch {
    return null;
  }
}

export async function getResidencySkills(residencyId: bigint): Promise<Hex[]> {
  try {
    const skills = await read<readonly Hex[]>("getResidencySkills", [residencyId]);
    return [...skills];
  } catch {
    return [];
  }
}

export async function getHubResidencies(hubSafe: string): Promise<bigint[]> {
  try {
    const ids = await read<readonly bigint[]>("getHubResidencies", [
      getAddress(hubSafe),
    ]);
    return [...ids];
  } catch {
    return [];
  }
}

export async function getResidencyApplicants(
  residencyId: bigint
): Promise<bigint[]> {
  try {
    const ids = await read<readonly bigint[]>("getResidencyApplicants", [
      residencyId,
    ]);
    return [...ids];
  } catch {
    return [];
  }
}

export async function getSelectedPilgrims(
  residencyId: bigint
): Promise<bigint[]> {
  try {
    const ids = await read<readonly bigint[]>("getSelectedPilgrims", [residencyId]);
    return [...ids];
  } catch {
    return [];
  }
}

export async function isApplicationOpen(residencyId: bigint): Promise<boolean> {
  try {
    return await read<boolean>("isApplicationOpen", [residencyId]);
  } catch {
    return false;
  }
}

export async function hasApplied(
  residencyId: bigint,
  tokenId: bigint
): Promise<boolean> {
  try {
    return await read<boolean>("hasApplied", [residencyId, tokenId]);
  } catch {
    return false;
  }
}

export async function isSelected(
  residencyId: bigint,
  tokenId: bigint
): Promise<boolean> {
  try {
    return await read<boolean>("isSelected", [residencyId, tokenId]);
  } catch {
    return false;
  }
}

export async function isAwarded(
  residencyId: bigint,
  tokenId: bigint
): Promise<boolean> {
  try {
    return await read<boolean>("isAwarded", [residencyId, tokenId]);
  } catch {
    return false;
  }
}

export async function canApplyWithSkill(
  residencyId: bigint,
  tokenId: bigint,
  skillHash: Hex
): Promise<boolean> {
  try {
    return await read<boolean>("canApplyWithSkill", [
      residencyId,
      tokenId,
      skillHash,
    ]);
  } catch {
    return false;
  }
}

export async function hasAnyMatchingSkill(
  residencyId: bigint,
  tokenId: bigint
): Promise<boolean> {
  try {
    return await read<boolean>("hasAnyMatchingSkill", [residencyId, tokenId]);
  } catch {
    return false;
  }
}

// ── Writes (relayer-submitted) ─────────────────────────────────────────

export interface CreateResidencyOnChainParams {
  hubSafe: string;
  signer: string;
  metadataURI: string;
  metadataHash: Hex;
  skills: Hex[];
  applicationDeadline: bigint;
  startDate: bigint;
  endDate: bigint;
  isCalendarBound: boolean;
  nonce: bigint;
  signatureDeadline: bigint;
}

/** Submit createResidency via the relayer. Returns tx + residencyId. */
export async function submitCreateResidency(
  params: CreateResidencyOnChainParams,
  hubSignature: Hex
): Promise<{ txHash: string; residencyId: string | null }> {
  const publicClient = getPublicClient();
  const txHash = await getWalletClient().writeContract({
    address: getContractAddress(),
    abi: RESIDENCIES_ABI,
    functionName: "createResidency",
    args: [
      {
        hubSafe: getAddress(params.hubSafe),
        signer: getAddress(params.signer),
        metadataURI: params.metadataURI,
        metadataHash: params.metadataHash,
        skills: params.skills,
        applicationDeadline: params.applicationDeadline,
        startDate: params.startDate,
        endDate: params.endDate,
        isCalendarBound: params.isCalendarBound,
        nonce: params.nonce,
        signatureDeadline: params.signatureDeadline,
      },
      hubSignature,
    ],
    chain: sepolia,
  });

  const receipt = await publicClient.waitForTransactionReceipt({ hash: txHash });
  if (receipt.status === "reverted") {
    throw new Error("createResidency reverted on-chain");
  }

  let residencyId: string | null = null;
  for (const log of receipt.logs) {
    if (log.address.toLowerCase() !== getContractAddress().toLowerCase()) continue;
    try {
      const decoded = decodeEventLog({
        abi: RESIDENCIES_ABI,
        data: log.data,
        topics: log.topics,
      });
      if (decoded.eventName === "ResidencyCreated") {
        residencyId = (decoded.args as { residencyId: bigint }).residencyId.toString();
        break;
      }
    } catch {
      // not our event
    }
  }

  // Fallback: totalResidencies() (the just-created id is the max).
  if (residencyId === null) {
    const total = await getTotalResidencies();
    if (total > BigInt(0)) residencyId = total.toString();
  }
  return { txHash, residencyId };
}

export interface ApplyToResidencyOnChainParams {
  residencyId: bigint;
  pilgrim: string;
  pilgrimPassportTokenId: bigint;
  matchingSkill: Hex;
  nonce: bigint;
  signatureDeadline: bigint;
}

export async function submitApplyToResidency(
  params: ApplyToResidencyOnChainParams,
  pilgrimSignature: Hex
): Promise<{ txHash: string }> {
  const publicClient = getPublicClient();
  const txHash = await getWalletClient().writeContract({
    address: getContractAddress(),
    abi: RESIDENCIES_ABI,
    functionName: "applyToResidency",
    args: [
      {
        residencyId: params.residencyId,
        pilgrim: getAddress(params.pilgrim),
        pilgrimPassportTokenId: params.pilgrimPassportTokenId,
        matchingSkill: params.matchingSkill,
        nonce: params.nonce,
        signatureDeadline: params.signatureDeadline,
      },
      pilgrimSignature,
    ],
    chain: sepolia,
  });
  const receipt = await publicClient.waitForTransactionReceipt({ hash: txHash });
  if (receipt.status === "reverted") throw new Error("applyToResidency reverted on-chain");
  return { txHash };
}

export interface SelectPilgrimsOnChainParams {
  residencyId: bigint;
  signer: string;
  pilgrimPassportTokenIds: bigint[];
  nonce: bigint;
  signatureDeadline: bigint;
}

export async function submitSelectPilgrimsAndClose(
  params: SelectPilgrimsOnChainParams,
  hubSignature: Hex
): Promise<{ txHash: string }> {
  const publicClient = getPublicClient();
  const txHash = await getWalletClient().writeContract({
    address: getContractAddress(),
    abi: RESIDENCIES_ABI,
    functionName: "selectPilgrimsAndClose",
    args: [
      {
        residencyId: params.residencyId,
        signer: getAddress(params.signer),
        pilgrimPassportTokenIds: params.pilgrimPassportTokenIds,
        nonce: params.nonce,
        signatureDeadline: params.signatureDeadline,
      },
      hubSignature,
    ],
    chain: sepolia,
  });
  const receipt = await publicClient.waitForTransactionReceipt({ hash: txHash });
  if (receipt.status === "reverted") throw new Error("selectPilgrimsAndClose reverted on-chain");
  return { txHash };
}

export interface AwardPilgrimOnChainParams {
  residencyId: bigint;
  pilgrimPassportTokenId: bigint;
  signer: string;
  skillIds: Hex[];
  nonce: bigint;
  signatureDeadline: bigint;
}

export async function submitAwardPilgrim(
  params: AwardPilgrimOnChainParams,
  residencyHubSignature: Hex,
  passportHubSignature: Hex
): Promise<{ txHash: string }> {
  const publicClient = getPublicClient();
  const txHash = await getWalletClient().writeContract({
    address: getContractAddress(),
    abi: RESIDENCIES_ABI,
    functionName: "awardPilgrim",
    args: [
      {
        residencyId: params.residencyId,
        pilgrimPassportTokenId: params.pilgrimPassportTokenId,
        signer: getAddress(params.signer),
        skillIds: params.skillIds,
        nonce: params.nonce,
        signatureDeadline: params.signatureDeadline,
      },
      residencyHubSignature,
      passportHubSignature,
    ],
    chain: sepolia,
  });
  const receipt = await publicClient.waitForTransactionReceipt({ hash: txHash });
  if (receipt.status === "reverted") throw new Error("awardPilgrim reverted on-chain");
  return { txHash };
}

export interface CancelResidencyOnChainParams {
  residencyId: bigint;
  signer: string;
  nonce: bigint;
  signatureDeadline: bigint;
}

export async function submitCancelResidency(
  params: CancelResidencyOnChainParams,
  hubSignature: Hex
): Promise<{ txHash: string }> {
  const publicClient = getPublicClient();
  const txHash = await getWalletClient().writeContract({
    address: getContractAddress(),
    abi: RESIDENCIES_ABI,
    functionName: "cancelResidency",
    args: [
      params.residencyId,
      getAddress(params.signer),
      params.nonce,
      params.signatureDeadline,
      hubSignature,
    ],
    chain: sepolia,
  });
  const receipt = await publicClient.waitForTransactionReceipt({ hash: txHash });
  if (receipt.status === "reverted") throw new Error("cancelResidency reverted on-chain");
  return { txHash };
}
