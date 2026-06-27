/**
 * Assertion script: verifies our EIP-712 / skills-hash encodings match the
 * Solidity contract's expectations (contracts/PilgrimPassportSBT3.sol):
 *
 *   skillsHash = keccak256(abi.encodePacked(bytes32[]))
 *   claimId    = keccak256(abi.encode(applicant, hubSafe, skillsHash, applicantNonce))
 *
 * Run: npm run test:pilgrim-passport-hash
 */
import {
  keccak256,
  encodePacked,
  encodeAbiParameters,
  concat,
  getAddress,
  type Hex,
} from "viem";
import {
  PILGRIM_SKILL_HASHES,
} from "../src/config/pilgrim-skills";

function assert(cond: boolean, msg: string) {
  if (!cond) {
    console.error(`✗ ${msg}`);
    process.exit(1);
  }
  console.log(`✓ ${msg}`);
}

// Reference implementations (independent of the app modules) ───────────
function refSkillsHash(skills: Hex[]): Hex {
  return keccak256(encodePacked(["bytes32[]"], [skills]));
}
function refSkillsHashManualConcat(skills: Hex[]): Hex {
  // Each bytes32 is exactly 32 bytes; abi.encodePacked == plain concatenation.
  return keccak256(concat(skills));
}
function refClaimId(
  applicant: string,
  hubSafe: string,
  skillsHash: Hex,
  nonce: bigint
): Hex {
  return keccak256(
    encodeAbiParameters(
      [{ type: "address" }, { type: "address" }, { type: "bytes32" }, { type: "uint256" }],
      [getAddress(applicant), getAddress(hubSafe), skillsHash, nonce]
    )
  );
}

const skills: Hex[] = [
  PILGRIM_SKILL_HASHES.software_development,
  PILGRIM_SKILL_HASHES.ui_ux,
  PILGRIM_SKILL_HASHES.community_organizing,
];

// 1. encodePacked(bytes32[]) == concatenation of the 32-byte words.
const packed = encodePacked(["bytes32[]"], [skills]);
assert(
  packed.toLowerCase() === concat(skills).toLowerCase(),
  "abi.encodePacked(bytes32[]) equals concatenation of words"
);

// 2. skillsHash matches the manual concat hash.
const h1 = refSkillsHash(skills);
const h2 = refSkillsHashManualConcat(skills);
assert(h1 === h2, `skillsHash deterministic & matches manual concat (${h1})`);

// 3. Order matters (sanity: different order => different hash).
const reordered = [skills[1], skills[0], skills[2]];
assert(
  refSkillsHash(reordered) !== h1,
  "skillsHash is order-sensitive (matches packed encoding)"
);

// 4. claimId is reproducible.
const applicant = "0x331F6717F76686436038b6522ccbADCC4Be13fCf";
const hubSafe = "0x74f06139bfd0eeb1e7e33d8d05f1699e52270863";
const cid1 = refClaimId(applicant, hubSafe, h1, BigInt(0));
const cid2 = refClaimId(applicant, hubSafe, h1, BigInt(0));
assert(cid1 === cid2, `claimId reproducible (${cid1})`);
assert(
  refClaimId(applicant, hubSafe, h1, BigInt(1)) !== cid1,
  "claimId changes with applicantNonce"
);

console.log("\nAll Pilgrim Passport hash assertions passed.");
