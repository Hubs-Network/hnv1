/**
 * Assertion script for HubsNetworkPatronSBT shared logic:
 *
 *   skillsHash    = keccak256(abi.encodePacked(bytes32[]))            (10 skills)
 *   applicationId = keccak256(abi.encode(applicant, skillsHash, applicantNonce))
 *
 * Also verifies EIP-712 primary types/fields, skill-selection validation rules,
 * and that Patron JSON never persists skills.
 *
 * Run: npm run test:patron-sbt
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
  PILGRIM_SKILL_IDS,
} from "../src/config/pilgrim-skills";
import { isCanonicalSkillId } from "../src/lib/pilgrim-skills";
import {
  computeSkillsHash,
  computePatronApplicationId,
  buildPatronApplicationTypedData,
  buildPatronAppAuthorizationTypedData,
  buildApprovePatronTypedData,
  buildRejectPatronTypedData,
  buildRevokePatronTypedData,
} from "../src/lib/patron-sbt-message";
import { patronProfileSchema } from "../src/lib/schemas/patron";
import { PATRON_SKILL_MIN, PATRON_SKILL_MAX } from "../src/config/patron-sbt";

function assert(cond: boolean, msg: string) {
  if (!cond) {
    console.error(`✗ ${msg}`);
    process.exit(1);
  }
  console.log(`✓ ${msg}`);
}

// ── Reference (independent) Solidity encodings ───────────────────────
function refSkillsHash(skills: Hex[]): Hex {
  return keccak256(encodePacked(["bytes32[]"], [skills]));
}
function refApplicationId(applicant: string, skillsHash: Hex, nonce: bigint): Hex {
  return keccak256(
    encodeAbiParameters(
      [{ type: "address" }, { type: "bytes32" }, { type: "uint256" }],
      [getAddress(applicant), skillsHash, nonce]
    )
  );
}

// 10 canonical skills.
const ids10 = PILGRIM_SKILL_IDS.slice(0, 10);
const skills10 = ids10.map((id) => PILGRIM_SKILL_HASHES[id]) as Hex[];

// 1. encodePacked(bytes32[]) == concatenation of 32-byte words.
assert(
  encodePacked(["bytes32[]"], [skills10]).toLowerCase() ===
    concat(skills10).toLowerCase(),
  "abi.encodePacked(bytes32[]) equals concatenation of words"
);

// 2. computeSkillsHash matches the reference.
const sh = computeSkillsHash(skills10);
assert(sh === refSkillsHash(skills10), `skillsHash matches reference (${sh})`);
assert(
  sh === keccak256(concat(skills10)),
  "skillsHash equals keccak256 of concatenated words"
);

// 3. order sensitivity.
const reordered = [skills10[1], skills10[0], ...skills10.slice(2)];
assert(
  computeSkillsHash(reordered) !== sh,
  "skillsHash is order-sensitive"
);

// 4. applicationId (abi.encode) matches reference + is deterministic.
const applicant = "0x331F6717F76686436038b6522ccbADCC4Be13fCf";
const aid0 = computePatronApplicationId({
  applicant,
  skillsHash: sh,
  applicantNonce: BigInt(0),
});
assert(
  aid0 === refApplicationId(applicant, sh, BigInt(0)),
  `applicationId matches abi.encode reference (${aid0})`
);
assert(
  computePatronApplicationId({ applicant, skillsHash: sh, applicantNonce: BigInt(0) }) === aid0,
  "applicationId reproducible"
);
assert(
  computePatronApplicationId({ applicant, skillsHash: sh, applicantNonce: BigInt(1) }) !== aid0,
  "applicationId changes with applicantNonce"
);

// 5. EIP-712 primary types + field names.
const appTd = buildPatronApplicationTypedData({
  applicant,
  proposedSkills: skills10,
  applicantNonce: BigInt(0),
  signatureDeadline: BigInt(9999999999),
});
assert(appTd.primaryType === "PatronApplication", "PatronApplication primaryType");
assert(
  appTd.types.PatronApplication.map((f) => f.name).join(",") ===
    "applicant,proposedSkillsHash,applicantNonce,signatureDeadline",
  "PatronApplication fields"
);

const authTd = buildPatronAppAuthorizationTypedData({
  applicant,
  proposedSkills: skills10,
  applicantNonce: BigInt(0),
  signatureDeadline: BigInt(9999999999),
});
assert(authTd.primaryType === "AppAuthorization", "AppAuthorization primaryType");

const apprTd = buildApprovePatronTypedData({
  applicationId: aid0,
  applicant,
  skills: skills10,
  signer: applicant,
  signatureDeadline: BigInt(9999999999),
});
assert(
  apprTd.primaryType === "ApprovePatronApplication",
  "ApprovePatronApplication primaryType"
);
assert(
  apprTd.types.ApprovePatronApplication.map((f) => f.name).join(",") ===
    "applicationId,applicant,skillsHash,signer,signatureDeadline",
  "ApprovePatronApplication fields"
);

const rejTd = buildRejectPatronTypedData({
  applicationId: aid0,
  applicant,
  signer: applicant,
  signatureDeadline: BigInt(9999999999),
});
assert(
  rejTd.primaryType === "RejectPatronApplication",
  "RejectPatronApplication primaryType"
);

const revTd = buildRevokePatronTypedData({
  tokenId: BigInt(1),
  patronOwner: applicant,
  signer: applicant,
  nonce: BigInt(0),
  signatureDeadline: BigInt(9999999999),
});
assert(revTd.primaryType === "RevokePatron", "RevokePatron primaryType");
assert(
  revTd.types.RevokePatron.map((f) => f.name).join(",") ===
    "tokenId,patronOwner,signer,nonce,signatureDeadline",
  "RevokePatron fields"
);

// 6. Selection validation rules (pure): between 1 and 10 unique valid skills.
function validSelection(ids: string[]): boolean {
  return (
    ids.length >= PATRON_SKILL_MIN &&
    ids.length <= PATRON_SKILL_MAX &&
    new Set(ids).size === ids.length &&
    ids.every((id) => isCanonicalSkillId(id))
  );
}
assert(!validSelection([]), "0 skills rejected");
assert(validSelection(ids10.slice(0, 1)), "1 skill accepted");
assert(validSelection(ids10.slice(0, 9)), "9 skills accepted");
assert(validSelection([...ids10]), "10 unique valid skills accepted");
assert(!validSelection([...ids10, PILGRIM_SKILL_IDS[10]]), "11 skills rejected");
assert(
  !validSelection([ids10[0], ...ids10.slice(0, 9)]),
  "duplicate skill rejected"
);
assert(
  !validSelection([...ids10.slice(0, 9), "not_a_real_skill"]),
  "invalid canonical skill rejected"
);

// 7. Patron JSON never persists skills.
const jsonKeys = Object.keys(patronProfileSchema.shape);
assert(
  !jsonKeys.some((k) => /skill/i.test(k)),
  "Patron JSON schema has no skill fields"
);

console.log("\nAll Patron SBT assertions passed.");
