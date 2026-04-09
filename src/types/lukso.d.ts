/**
 * Type declarations for the LUKSO Universal Profile Browser Extension.
 * The extension injects a provider at window.lukso (similar to MetaMask's window.ethereum).
 */

interface LuksoProvider {
  request(args: { method: string; params?: unknown[] }): Promise<unknown>;
  on(event: string, handler: (...args: unknown[]) => void): void;
  removeListener(event: string, handler: (...args: unknown[]) => void): void;
  isUniversalProfileExtension?: boolean;
}

interface Window {
  lukso?: LuksoProvider;
}
