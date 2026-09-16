/**
 * Assertion script for HubsNetworkResidencies shared logic:
 *
 *   skillsHash / skillIdsHash = keccak256(abi.encodePacked(bytes32[]))
 *   pilgrimIdsHash            = keccak256(abi.encodePacked(uint256[]))
 *
 * Also verifies the EIP-712 primary types + field ordering for every residency
 * message (and the Passport AttestSkills used by the award flow).
 *
 * Run: npm run test:residencies
 */
import {
  keccak256,
  encodePacked,
  concat,
  pad,
  toHex,
  type Hex,
} from "viem";
import { PILGRIM_SKILL_HASHES, PILGRIM_SKILL_IDS } from "../src/config/pilgrim-skills";
import {
  hashBytes32Array,
  hashUint256Array,
  buildCreateResidencyTypedData,
  buildApplyToResidencyTypedData,
  buildSelectPilgrimsTypedData,
  buildAwardPilgrimTypedData,
  buildCancelResidencyTypedData,
  buildAttestSkillsTypedData,
} from "../src/lib/residencies-message";

function assert(cond: boolean, msg: string) {
  if (!cond) {
    console.error(`✗ ${msg}`);
    process.exit(1);
  }
  console.log(`✓ ${msg}`);
}

const skills = PILGRIM_SKILL_IDS.slice(0, 3).map(
  (id) => PILGRIM_SKILL_HASHES[id]
) as Hex[];

// 1. hashBytes32Array == keccak256 of concatenated 32-byte words.
assert(
  hashBytes32Array(skills).toLowerCase() === keccak256(concat(skills)).toLowerCase(),
  "hashBytes32Array matches keccak256(abi.encodePacked(bytes32[]))"
);
assert(
  hashBytes32Array(skills).toLowerCase() ===
    keccak256(encodePacked(["bytes32[]"], [skills])).toLowerCase(),
  "hashBytes32Array matches encodePacked reference"
);

// 2. hashUint256Array == keccak256 of concatenated 32-byte big-endian words.
const ids = [BigInt(1), BigInt(42), BigInt(1000)];
const packed = concat(ids.map((n) => pad(toHex(n), { size: 32 }))) as Hex;
assert(
  hashUint256Array(ids).toLowerCase() === keccak256(packed).toLowerCase(),
  "hashUint256Array matches keccak256(abi.encodePacked(uint256[]))"
);
assert(
  hashUint256Array(ids).toLowerCase() ===
    keccak256(encodePacked(["uint256[]"], [ids])).toLowerCase(),
  "hashUint256Array matches encodePacked reference"
);

// 3. Order sensitivity.
assert(
  hashUint256Array([BigInt(1), BigInt(2)]) !== hashUint256Array([BigInt(2), BigInt(1)]),
  "hashUint256Array is order-sensitive"
);

const addr = "0x1111111111111111111111111111111111111111";
const dl = BigInt(9999999999);

// 4. CreateResidency type + fields.
const createTd = buildCreateResidencyTypedData({
  hubSafe: addr,
  signer: addr,
  metadataHash: pad("0x01", { size: 32 }),
  skills,
  applicationDeadline: BigInt(1000),
  startDate: BigInt(0),
  endDate: BigInt(0),
  isCalendarBound: false,
  nonce: BigInt(0),
  signatureDeadline: dl,
});
assert(createTd.primaryType === "CreateResidency", "CreateResidency primaryType");
assert(
  createTd.types.CreateResidency.map((f) => f.name).join(",") ===
    "hubSafe,signer,metadataHash,skillsHash,applicationDeadline,startDate,endDate,isCalendarBound,nonce,signatureDeadline",
  "CreateResidency fields"
);

// 5. ApplyToResidency type + fields.
const applyTd = buildApplyToResidencyTypedData({
  residencyId: BigInt(1),
  pilgrim: addr,
  pilgrimPassportTokenId: BigInt(1),
  matchingSkill: skills[0],
  nonce: BigInt(0),
  signatureDeadline: dl,
});
assert(applyTd.primaryType === "ApplyToResidency", "ApplyToResidency primaryType");
assert(
  applyTd.types.ApplyToResidency.map((f) => f.name).join(",") ===
    "residencyId,pilgrim,pilgrimPassportTokenId,matchingSkill,nonce,signatureDeadline",
  "ApplyToResidency fields"
);

// 6. SelectPilgrims type + fields + pilgrimIdsHash.
const selectTd = buildSelectPilgrimsTypedData({
  residencyId: BigInt(1),
  signer: addr,
  pilgrimPassportTokenIds: ids,
  nonce: BigInt(0),
  signatureDeadline: dl,
});
assert(selectTd.primaryType === "SelectPilgrims", "SelectPilgrims primaryType");
assert(
  selectTd.types.SelectPilgrims.map((f) => f.name).join(",") ===
    "residencyId,signer,pilgrimIdsHash,nonce,signatureDeadline",
  "SelectPilgrims fields"
);
assert(
  selectTd.pilgrimIdsHash === hashUint256Array(ids),
  "SelectPilgrims pilgrimIdsHash matches hashUint256Array"
);

// 7. AwardPilgrim type + fields.
const awardTd = buildAwardPilgrimTypedData({
  residencyId: BigInt(1),
  pilgrimPassportTokenId: BigInt(1),
  signer: addr,
  skillIds: skills,
  nonce: BigInt(0),
  signatureDeadline: dl,
});
assert(awardTd.primaryType === "AwardPilgrim", "AwardPilgrim primaryType");
assert(
  awardTd.types.AwardPilgrim.map((f) => f.name).join(",") ===
    "residencyId,pilgrimPassportTokenId,signer,skillIdsHash,nonce,signatureDeadline",
  "AwardPilgrim fields"
);

// 8. CancelResidency type + fields.
const cancelTd = buildCancelResidencyTypedData({
  residencyId: BigInt(1),
  signer: addr,
  nonce: BigInt(0),
  signatureDeadline: dl,
});
assert(cancelTd.primaryType === "CancelResidency", "CancelResidency primaryType");
assert(
  cancelTd.types.CancelResidency.map((f) => f.name).join(",") ===
    "residencyId,signer,nonce,signatureDeadline",
  "CancelResidency fields"
);

// 9. AttestSkills (Passport domain) type + fields.
const attestTd = buildAttestSkillsTypedData({
  tokenId: BigInt(1),
  hubSafe: addr,
  signer: addr,
  skillIds: skills,
  signatureDeadline: dl,
});
assert(attestTd.primaryType === "AttestSkills", "AttestSkills primaryType");
assert(
  attestTd.types.AttestSkills.map((f) => f.name).join(",") ===
    "tokenId,hubSafe,signer,skillIdsHash,signatureDeadline",
  "AttestSkills fields"
);
assert(
  attestTd.domain.name === "PilgrimPassportSBT",
  "AttestSkills uses the PilgrimPassport domain"
);
assert(
  createTd.domain.name === "HubsNetworkResidencies",
  "Residency messages use the Residencies domain"
);

console.log("\nAll Residencies assertions passed.");
