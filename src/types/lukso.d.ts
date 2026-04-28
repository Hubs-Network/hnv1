/**
 * Type declarations for wallet browser extensions.
 * Supports LUKSO UP extension (window.lukso) and standard EIP-1193 (window.ethereum).
 */

interface LuksoProvider {
  request(args: { method: string; params?: unknown[] }): Promise<unknown>;
  on(event: string, handler: (...args: unknown[]) => void): void;
  removeListener(event: string, handler: (...args: unknown[]) => void): void;
  isUniversalProfileExtension?: boolean;
}

interface Window {
  lukso?: LuksoProvider;
  ethereum?: LuksoProvider;
}
