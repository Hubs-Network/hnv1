/**
 * Magic Smart Account helpers for gas-sponsored transactions on Sepolia.
 *
 * Uses the unified Magic instance from ./magic.ts (configured with SmartAccountExtension).
 * The user's EOA address remains the identity (EIP-7702 style).
 */
import { getMagic } from "./magic";

/**
 * Login with email OTP using the Smart Account Magic instance.
 * Returns the user's wallet address.
 */
export async function loginWithEmailOtp(email: string): Promise<string | null> {
  const magic = getMagic();
  await (magic as any).auth.loginWithEmailOTP({ email });
  const metadata = await (magic as any).user.getInfo();
  return metadata?.publicAddress || metadata?.wallets?.ethereum?.publicAddress || null;
}

/**
 * Get the current user's wallet address from the Magic instance.
 */
export async function getCurrentUserAddress(): Promise<string | null> {
  const magic = getMagic();
  const isLoggedIn = await (magic as any).user.isLoggedIn();
  if (!isLoggedIn) return null;
  const metadata = await (magic as any).user.getInfo();
  return metadata?.publicAddress || metadata?.wallets?.ethereum?.publicAddress || null;
}

/**
 * Send a gas-sponsored transaction on Sepolia via Magic Smart Account.
 * Users never need Sepolia ETH.
 *
 * Uses the `calls` array format per Magic Smart Account SDK docs:
 * magic.smartAccount.sendTransaction({ chainId, calls: [{ to, value, data }] })
 *
 * Returns the transaction hash.
 */
export async function sendSponsoredSepoliaTransaction(tx: {
  to: string;
  value?: string | bigint;
  data?: string;
}): Promise<string> {
  const magic = getMagic();

  if (!(magic as any).smartAccount) {
    throw new Error(
      "Magic SmartAccountExtension not available. " +
        "Ensure NEXT_PUBLIC_ALCHEMY_API_KEY and NEXT_PUBLIC_ALCHEMY_GAS_POLICY_ID are set."
    );
  }

  const result = await (magic as any).smartAccount.sendTransaction({
    chainId: 11155111,
    calls: [
      {
        to: tx.to,
        value: tx.value?.toString() ?? "0",
        data: tx.data ?? "0x",
      },
    ],
  });

  // SDK returns { transactionHash, id, chainId }
  return result?.transactionHash || result;
}

/**
 * Sign a message using the Magic wallet signer.
 */
export async function signMessage(message: string): Promise<string> {
  const magic = getMagic();
  const provider = await (magic as any).wallet.getProvider();
  const accounts = await provider.request({ method: "eth_accounts" });
  const signature = await provider.request({
    method: "personal_sign",
    params: [message, accounts[0]],
  });
  return signature as string;
}
