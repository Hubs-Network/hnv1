/**
 * Singleton Magic SDK instance for the app.
 *
 * Configured with SmartAccountExtension for Sepolia gas-sponsored transactions.
 * This is the SINGLE Magic instance used for both auth (login/logout) and
 * on-chain operations (sponsored tx). Do not create separate instances.
 */
import { Magic } from "magic-sdk";
import { SmartAccountExtension } from "@magic-ext/smart-account";

let magicInstance: InstanceType<typeof Magic> | null = null;

export function getMagic(): InstanceType<typeof Magic> {
  if (typeof window === "undefined") {
    throw new Error("Magic can only be used in the browser");
  }

  if (magicInstance) return magicInstance;

  const key = process.env.NEXT_PUBLIC_MAGIC_PUBLISHABLE_KEY;
  if (!key) {
    throw new Error(
      "Missing NEXT_PUBLIC_MAGIC_PUBLISHABLE_KEY environment variable. " +
        "Add it to .env.local to enable Magic authentication."
    );
  }

  const rpcUrl = process.env.NEXT_PUBLIC_SEPOLIA_RPC_URL;
  const alchemyKey = process.env.NEXT_PUBLIC_ALCHEMY_API_KEY;
  const gasPolicyId = process.env.NEXT_PUBLIC_ALCHEMY_GAS_POLICY_ID;

  if (!rpcUrl || !alchemyKey || !gasPolicyId) {
    // Fallback: Magic without SmartAccountExtension (login-only mode)
    // Sponsored transactions will fail but login will work.
    magicInstance = new Magic(key);
    return magicInstance;
  }

  magicInstance = new Magic(key, {
    extensions: [
      new SmartAccountExtension({
        apiKey: alchemyKey,
        paymasterPolicyId: gasPolicyId,
      }),
    ],
  }) as unknown as InstanceType<typeof Magic>;

  return magicInstance;
}
