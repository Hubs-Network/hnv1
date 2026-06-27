/**
 * prepare-pilgrim-passport-deploy.ts
 *
 * LOCAL-ONLY deployment-prep helper for the PilgrimPassportSBT contract (Sepolia).
 *
 * This script does NOT deploy anything and does NOT touch the chain.
 * It only prepares the data you need to deploy from Remix or a deploy script:
 *
 *   1. Resolves (or generates) the dedicated `appSigner` backend EOA.
 *   2. Computes the `initialSkills` bytes32[] from the canonical skill IDs.
 *   3. Prints a clean, Remix-ready constructor block + a verification table.
 *
 * Run with:  npm run prepare:pilgrim-passport-deploy
 *
 * SECURITY:
 * - `appSigner` is a backend-only signer used to sign Passport claim authorizations.
 *   It is NOT the relayer, NOT a user wallet, and NOT the HN Directors Safe.
 * - Its private key must live ONLY in `.env.local` (local) and Vercel server env.
 * - NEVER commit the private key. NEVER expose it client-side (no NEXT_PUBLIC_).
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  keccak256,
  toBytes,
  isHex,
  type Hex,
} from "viem";
import {
  privateKeyToAccount,
  generatePrivateKey,
} from "viem/accounts";
import {
  PILGRIM_SKILL_IDS,
  PILGRIM_SKILL_HASHES,
  INITIAL_PILGRIM_SKILL_HASHES,
} from "../src/config/pilgrim-skills";
import {
  HN_BADGE_SBT_ADDRESS,
  HN_DIRECTORS_SAFE_ADDRESS,
} from "../src/config/hubs-network";

const ENV_KEY = "PILGRIM_PASSPORT_APP_SIGNER_PRIVATE_KEY";

/**
 * Minimal .env.local reader (no external dep). Returns the value for `key`
 * or undefined. We read .env.local directly instead of process.env so the
 * script behaves the same whether or not a dotenv loader is wired up.
 */
function readEnvLocal(key: string): string | undefined {
  // process.env wins if the caller already exported it.
  if (process.env[key]) return process.env[key];

  try {
    const raw = readFileSync(join(process.cwd(), ".env.local"), "utf8");
    for (const line of raw.split("\n")) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const eq = trimmed.indexOf("=");
      if (eq === -1) continue;
      const k = trimmed.slice(0, eq).trim();
      if (k !== key) continue;
      let v = trimmed.slice(eq + 1).trim();
      // strip optional surrounding quotes
      if (
        (v.startsWith('"') && v.endsWith('"')) ||
        (v.startsWith("'") && v.endsWith("'"))
      ) {
        v = v.slice(1, -1);
      }
      return v || undefined;
    }
  } catch {
    // .env.local may not exist; that's fine.
  }
  return undefined;
}

function normalizePrivateKey(pk: string): Hex {
  const withPrefix = pk.startsWith("0x") ? pk : `0x${pk}`;
  if (!isHex(withPrefix) || withPrefix.length !== 66) {
    throw new Error(
      `${ENV_KEY} is set but is not a valid 32-byte hex private key.`
    );
  }
  return withPrefix as Hex;
}

function line(char = "─", n = 64): string {
  return char.repeat(n);
}

function main() {
  // ── 1. Resolve or generate appSigner ────────────────────────────────
  const existing = readEnvLocal(ENV_KEY);

  let privateKey: Hex;
  let generated = false;

  if (existing) {
    privateKey = normalizePrivateKey(existing);
  } else {
    privateKey = generatePrivateKey();
    generated = true;
  }

  const appSigner = privateKeyToAccount(privateKey);
  const appSignerAddress = appSigner.address;

  // ── 2. Verify initialSkills hashes (recompute live, compare to config) ─
  const recomputed = PILGRIM_SKILL_IDS.map(
    (id) => keccak256(toBytes(id))
  );
  const mismatches: string[] = [];
  PILGRIM_SKILL_IDS.forEach((id, i) => {
    if (recomputed[i] !== PILGRIM_SKILL_HASHES[id]) {
      mismatches.push(id);
    }
  });
  if (mismatches.length > 0) {
    throw new Error(
      `Skill hash mismatch in src/config/pilgrim-skills.ts for: ${mismatches.join(", ")}`
    );
  }
  const initialSkills = INITIAL_PILGRIM_SKILL_HASHES;

  // ── 3. Output ────────────────────────────────────────────────────────
  console.log("\n" + line("="));
  console.log("  PilgrimPassportSBT — deployment preparation (Sepolia)");
  console.log(line("=") + "\n");

  // appSigner section
  console.log("appSigner (dedicated backend signer EOA)");
  console.log(line());
  console.log(`PILGRIM_PASSPORT_APP_SIGNER_ADDRESS=${appSignerAddress}`);
  console.log(`PILGRIM_PASSPORT_APP_SIGNER_PRIVATE_KEY=${privateKey}`);
  console.log("");

  if (generated) {
    console.log("⚠️  A NEW appSigner wallet was just generated.");
    console.log("⚠️  This private key is printed ONLY ONCE. Store it now:");
    console.log("     1. Add it to .env.local (server-side, NOT committed):");
    console.log(`        ${ENV_KEY}=${privateKey}`);
    console.log("     2. Add the SAME value to Vercel → Project → Settings →");
    console.log("        Environment Variables (Production + Preview), server-side only.");
    console.log("     3. NEVER commit it. NEVER add a NEXT_PUBLIC_ mirror of the key.");
  } else {
    console.log(`ℹ️  Derived from existing ${ENV_KEY} in .env.local.`);
    console.log("    (Private key shown above so you can mirror it to Vercel if needed.)");
  }
  console.log("");

  // Constructor args, Remix-ready
  console.log("PilgrimPassportSBT constructor args:");
  console.log(line());
  console.log("\nhubBadgeSBTAddress:");
  console.log(HN_BADGE_SBT_ADDRESS);
  console.log("\nhnDirectorsSafeAddress:");
  console.log(HN_DIRECTORS_SAFE_ADDRESS);
  console.log("\nappSigner:");
  console.log(appSignerAddress);
  console.log("\ninitialSkills:");
  console.log("[");
  initialSkills.forEach((h, i) => {
    const comma = i < initialSkills.length - 1 ? "," : "";
    console.log(`  "${h}"${comma}`);
  });
  console.log("]");
  console.log("");

  // Single-line array (easy to paste into Remix's array field)
  console.log("initialSkills (single-line, paste into Remix):");
  console.log(line());
  console.log(JSON.stringify(initialSkills));
  console.log("");

  // Verification mapping table
  console.log("skillId => bytes32  (verification table)");
  console.log(line());
  PILGRIM_SKILL_IDS.forEach((id) => {
    console.log(`${id} => ${PILGRIM_SKILL_HASHES[id]}`);
  });
  console.log("");
  console.log(`Total skills: ${initialSkills.length}`);
  console.log(line("="));
  console.log("");
}

main();
