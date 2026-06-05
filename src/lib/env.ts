/**
 * Environment variable validation for Sepolia / Safe / Magic configuration.
 *
 * Next.js inlines NEXT_PUBLIC_* vars at build time via static analysis.
 * Dynamic access (process.env[key]) does NOT work client-side.
 * We must reference each var explicitly.
 */

export interface EnvValidationResult {
  valid: boolean;
  missing: { key: string; description: string }[];
  warnings: { key: string; description: string }[];
}

/**
 * Validate that required Sepolia/Safe/Magic env vars are set.
 * Uses explicit references so Next.js can inline them at build time.
 */
export function validateSepoliaEnv(): EnvValidationResult {
  const missing: { key: string; description: string }[] = [];
  const warnings: { key: string; description: string }[] = [];

  if (!process.env.NEXT_PUBLIC_MAGIC_PUBLISHABLE_KEY) {
    missing.push({
      key: "NEXT_PUBLIC_MAGIC_PUBLISHABLE_KEY",
      description: "Magic publishable API key (from dashboard.magic.link)",
    });
  }

  if (!process.env.NEXT_PUBLIC_ALCHEMY_API_KEY) {
    missing.push({
      key: "NEXT_PUBLIC_ALCHEMY_API_KEY",
      description: "Alchemy API key for Smart Wallets + Gas Manager",
    });
  }

  if (!process.env.NEXT_PUBLIC_ALCHEMY_GAS_POLICY_ID) {
    missing.push({
      key: "NEXT_PUBLIC_ALCHEMY_GAS_POLICY_ID",
      description: "Alchemy Gas Manager policy ID for sponsoring Sepolia transactions",
    });
  }

  if (!process.env.NEXT_PUBLIC_SEPOLIA_RPC_URL) {
    missing.push({
      key: "NEXT_PUBLIC_SEPOLIA_RPC_URL",
      description: "Sepolia RPC URL (e.g. https://eth-sepolia.g.alchemy.com/v2/YOUR_KEY)",
    });
  }

  if (!process.env.NEXT_PUBLIC_SAFE_TX_SERVICE_URL) {
    warnings.push({
      key: "NEXT_PUBLIC_SAFE_TX_SERVICE_URL",
      description: "Safe Transaction Service URL (defaults to https://safe-transaction-sepolia.safe.global)",
    });
  }

  return {
    valid: missing.length === 0,
    missing,
    warnings,
  };
}

/**
 * Throws a descriptive error if required env vars are missing.
 */
export function assertSepoliaEnv(): void {
  const result = validateSepoliaEnv();
  if (!result.valid) {
    const details = result.missing
      .map((m) => `  - ${m.key}: ${m.description}`)
      .join("\n");
    throw new Error(
      `Missing required environment variables for Sepolia/Safe/Magic:\n${details}\n\nAdd them to .env.local (dev) or Vercel env vars (production).`
    );
  }
}
