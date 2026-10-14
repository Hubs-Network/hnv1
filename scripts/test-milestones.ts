/**
 * Assertion script for the off-chain Residency Milestone plan logic (pure
 * functions only — no network / no chain). Validates the derived milestone/plan
 * state machine and the Zod input schemas.
 *
 * Run: npm run test:milestones
 */
import {
  deriveMilestoneDoneStatus,
  isMilestoneValidated,
  allMilestonesValidated,
  recomputePlanStatusAfterDone,
  updateMilestonesInputSchema,
  doneInputSchema,
  milestonePlanSchema,
  MAX_MILESTONES,
} from "../src/lib/schemas/residency-milestones";

function assert(cond: boolean, msg: string) {
  if (!cond) {
    console.error(`✗ ${msg}`);
    process.exit(1);
  }
  console.log(`✓ ${msg}`);
}

// 1. Per-milestone done status derivation.
assert(
  deriveMilestoneDoneStatus({ pilgrimDone: false, hubDone: false }) === "open",
  "no sides done → open"
);
assert(
  deriveMilestoneDoneStatus({ pilgrimDone: true, hubDone: false }) === "pilgrim_done",
  "pilgrim only → pilgrim_done"
);
assert(
  deriveMilestoneDoneStatus({ pilgrimDone: false, hubDone: true }) === "hub_done",
  "hub only → hub_done"
);
assert(
  deriveMilestoneDoneStatus({ pilgrimDone: true, hubDone: true }) === "validated",
  "both sides → validated"
);

// 2. Validation helpers.
assert(
  isMilestoneValidated({ pilgrimDone: true, hubDone: true }),
  "isMilestoneValidated true when both done"
);
assert(
  !allMilestonesValidated([]),
  "empty plan is NOT all-validated"
);
assert(
  allMilestonesValidated([
    { pilgrimDone: true, hubDone: true },
    { pilgrimDone: true, hubDone: true },
  ]),
  "all validated when every milestone is validated"
);
assert(
  !allMilestonesValidated([
    { pilgrimDone: true, hubDone: true },
    { pilgrimDone: true, hubDone: false },
  ]),
  "not all validated when one side missing"
);

// 3. Plan status recompute after a done toggle.
assert(
  recomputePlanStatusAfterDone("confirmed", [
    { pilgrimDone: true, hubDone: true },
  ]) === "all_validated",
  "confirmed → all_validated when everything validated"
);
assert(
  recomputePlanStatusAfterDone("all_validated", [
    { pilgrimDone: true, hubDone: false },
  ]) === "confirmed",
  "all_validated → confirmed when a side is unticked"
);
assert(
  recomputePlanStatusAfterDone("draft", [
    { pilgrimDone: true, hubDone: true },
  ]) === "draft",
  "pre-confirm statuses are left unchanged"
);
assert(
  recomputePlanStatusAfterDone("awarded", [
    { pilgrimDone: true, hubDone: true },
  ]) === "awarded",
  "awarded is terminal / unchanged"
);

// 4. Input schemas.
assert(
  updateMilestonesInputSchema.safeParse({
    milestones: [{ title: "Build the thing" }],
  }).success,
  "update input accepts a titled milestone"
);
assert(
  !updateMilestonesInputSchema.safeParse({
    milestones: [{ title: "" }],
  }).success,
  "update input rejects an empty title"
);
assert(
  !updateMilestonesInputSchema.safeParse({
    milestones: Array.from({ length: MAX_MILESTONES + 1 }, () => ({ title: "x" })),
  }).success,
  `update input rejects more than ${MAX_MILESTONES} milestones`
);
assert(
  doneInputSchema.safeParse({ milestoneId: "a", actor: "pilgrim", done: true }).success,
  "done input accepts a valid payload"
);
assert(
  !doneInputSchema.safeParse({ milestoneId: "a", actor: "nobody", done: true }).success,
  "done input rejects an unknown actor"
);

// 5. Full plan schema round-trips a realistic object.
assert(
  milestonePlanSchema.safeParse({
    residencyId: 1,
    hubSafe: "0x1111111111111111111111111111111111111111",
    pilgrimPassportTokenId: 7,
    pilgrimAddress: "0x2222222222222222222222222222222222222222",
    status: "confirmed",
    milestones: [
      {
        id: "m1",
        title: "Ship milestone",
        order: 0,
        pilgrimDone: true,
        hubDone: false,
      },
    ],
    createdAt: new Date().toISOString(),
    createdBy: "0x2222222222222222222222222222222222222222",
    updatedAt: new Date().toISOString(),
    updatedBy: "0x2222222222222222222222222222222222222222",
    revision: 2,
  }).success,
  "milestonePlanSchema accepts a realistic plan"
);

console.log("\nAll milestone assertions passed.");
