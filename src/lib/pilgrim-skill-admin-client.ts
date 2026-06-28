"use client";

/**
 * Client flow for HN Directors to add a new Pilgrim skill.
 *
 * The director only SIGNS an EIP-712 SetSkillStatus message (free, off-chain);
 * the relayer submits setSkillStatusByHNDirector server-side (gasless).
 */
import { getAddress } from "viem";
import {
  buildSetSkillStatusTypedData,
  toEip712Json,
} from "./pilgrim-passport-message";
import { computeSkillHash, slugifySkillId } from "./pilgrim-skills";
import { getSigner, signTypedDataV4 } from "./pilgrim-passport-client";

const DEADLINE_SECONDS = 60 * 60; // 1 hour

export interface AddSkillInput {
  label: string;
  categoryId: string;
  signerAddress: string;
  authProvider: string | null;
}

export async function addPilgrimSkill(
  input: AddSkillInput
): Promise<{ id: string; label: string; txHash: string }> {
  const signerAddress = getAddress(input.signerAddress);
  const id = slugifySkillId(input.label);
  if (!id) throw new Error("Label must contain letters or numbers.");
  const skillHash = computeSkillHash(id);

  // 1. Current HN Director nonce (server also re-checks ownership).
  const nonceRes = await fetch(
    `/api/admin/pilgrim-skills?signer=${signerAddress}`
  );
  const nonceData = await nonceRes.json();
  if (!nonceRes.ok) {
    throw new Error(nonceData?.error || "Could not read director nonce");
  }
  const nonce = BigInt(String(nonceData.nonce ?? "0"));
  const signatureDeadline = BigInt(
    Math.floor(Date.now() / 1000) + DEADLINE_SECONDS
  );

  // 2. Sign the SetSkillStatus message.
  const td = buildSetSkillStatusTypedData({
    skillId: skillHash,
    active: true,
    signer: signerAddress,
    nonce,
    signatureDeadline,
  });

  const { provider, account } = await getSigner(input.authProvider);
  if (getAddress(account) !== signerAddress) {
    throw new Error("Connected wallet does not match the signer.");
  }
  const signature = await signTypedDataV4(
    provider,
    account,
    toEip712Json({
      domain: td.domain,
      types: td.types,
      primaryType: td.primaryType,
      message: td.message as unknown as Record<string, unknown>,
    })
  );

  // 3. Submit via the relayer + persist metadata.
  const res = await fetch("/api/admin/pilgrim-skills", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      label: input.label,
      categoryId: input.categoryId,
      signer: signerAddress,
      nonce: nonce.toString(),
      signatureDeadline: signatureDeadline.toString(),
      signature,
    }),
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data?.error || "Failed to add skill");
  }
  return { id: data.id, label: data.label, txHash: data.txHash };
}
