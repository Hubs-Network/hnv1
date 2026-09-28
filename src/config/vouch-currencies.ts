/**
 * Currency + chain presets for Patron residency vouches (client + server safe).
 *
 * Vouches are off-chain pledges; the currency is descriptive metadata, not an
 * on-chain transfer. A vouch currency is one of:
 *  - fiat  (a code from FIAT_CURRENCIES)
 *  - crypto (a well-known symbol from CRYPTO_CURRENCIES, chain-agnostic)
 *  - token (an arbitrary ERC-20: address + chain from VOUCH_CHAINS)
 */

export const FIAT_CURRENCIES = ["EUR", "USD", "GBP", "CHF"] as const;
export type FiatCurrency = (typeof FIAT_CURRENCIES)[number];

export const CRYPTO_CURRENCIES = ["ETH", "BTC", "USDC", "USDT"] as const;
export type CryptoCurrency = (typeof CRYPTO_CURRENCIES)[number];

export interface VouchChain {
  id: number;
  name: string;
}

/** Chains offered for the custom-token option. */
export const VOUCH_CHAINS: readonly VouchChain[] = [
  { id: 1, name: "Ethereum" },
  { id: 42161, name: "Arbitrum" },
  { id: 10, name: "Optimism" },
  { id: 8453, name: "Base" },
  { id: 137, name: "Polygon" },
  { id: 100, name: "Gnosis" },
] as const;

export const VOUCH_CHAIN_IDS = VOUCH_CHAINS.map((c) => c.id);

export function chainName(chainId: number): string {
  return VOUCH_CHAINS.find((c) => c.id === chainId)?.name ?? `Chain ${chainId}`;
}

/** Normalized currency stored on a vouch and rendered in the UI. */
export type VouchCurrency =
  | { kind: "fiat"; code: FiatCurrency }
  | { kind: "crypto"; symbol: CryptoCurrency }
  | { kind: "token"; address: string; chainId: number; symbol?: string };

/** Human-readable label for a vouch currency (e.g. "USDT · Arbitrum"). */
export function formatVouchCurrency(c: VouchCurrency): string {
  if (c.kind === "fiat") return c.code;
  if (c.kind === "crypto") return c.symbol;
  const sym = c.symbol && c.symbol.trim() ? c.symbol.trim() : "Token";
  return `${sym} · ${chainName(c.chainId)}`;
}
