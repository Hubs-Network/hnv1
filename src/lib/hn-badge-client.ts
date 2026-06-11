"use client";

/**
 * Client-side signing of HN Badge admin actions (approve / reject).
 * Uses personal_sign via the active wallet (Magic or injected).
 */
import { buildHNBadgeActionMessage, type HNBadgeAction } from "./hn-badge-message";

async function getSigner(
  authProvider: string | null
): Promise<{ provider: { request: (args: { method: string; params?: unknown[] }) => Promise<unknown> }; account: string }> {
  if (authProvider === "magic") {
    const { getMagic } = await import("./magic");
    const magic = getMagic();
    const provider = await (magic as any).wallet.getProvider();
    const accounts = (await provider.request({ method: "eth_accounts" })) as string[];
    return { provider, account: accounts[0] };
  }

  if (typeof window !== "undefined" && (window as any).ethereum) {
    const provider = (window as any).ethereum;
    const accounts = (await provider.request({
      method: "eth_requestAccounts",
    })) as string[];
    return { provider, account: accounts[0] };
  }

  throw new Error("No wallet provider found");
}

export async function signHNBadgeAction(params: {
  action: HNBadgeAction;
  hubId: string;
  authProvider: string | null;
}): Promise<{ signature: string; issuedAt: string }> {
  const issuedAt = new Date().toISOString();
  const message = buildHNBadgeActionMessage({
    action: params.action,
    hubId: params.hubId,
    issuedAt,
  });

  const { provider, account } = await getSigner(params.authProvider);
  const signature = (await provider.request({
    method: "personal_sign",
    params: [message, account],
  })) as string;

  return { signature, issuedAt };
}
