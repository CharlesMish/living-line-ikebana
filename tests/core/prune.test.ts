// @ts-nocheck
import assert from "node:assert/strict";
import test from "node:test";
import {
  ATTACHMENT_TOLERANCE,
  activeIdentity,
  aimBranch,
  applyPrune,
  createFloweringBranch,
  previewPrune,
  sampleBranch,
  toCanonicalPlantGraph,
  vec3,
} from "../../src/core/index.ts";
import {
  assertAttachmentCoincidence,
  assertRecordsUnchanged,
  assertVecClose,
  snapshotRecords,
} from "./helpers.ts";

test("prune preview is non-mutating and commit preserves proximal identity", () => {
  const before = createFloweringBranch("plant-1", 8278, vec3(0, 0.55, 0));
  const canonicalBefore = toCanonicalPlantGraph(before);
  const trunk = before.branches.get(before.rootBranchId);
  const proximalPoints = trunk.points.map((point) => ({ ...point }));
  const plan = previewPrune(before, trunk.id, 3.15);
  assert.deepEqual(toCanonicalPlantGraph(before), canonicalBefore, "preview mutated the graph");
  assert.ok(plan.removedBranchIds.includes("plant-1:lateral-b"));
  assert.ok(plan.removedOrganIds.length > 0);

  const after = applyPrune(before, plan);
  assert.ok(activeIdentity(after).branches.length < activeIdentity(before).branches.length);
  const cut = after.branches.get(trunk.id);
  cut.points.slice(0, -1).forEach((point, index) => assertVecClose(point, proximalPoints[index], 1e-12, `proximal ${index}`));
  for (const id of plan.removedBranchIds) {
    assert.equal(after.branches.has(id), true);
    assert.equal(after.branches.get(id).active, false);
  }
  assertAttachmentCoincidence(after);
});

test("cutting through a pedicel removes its physical bloom and nothing unrelated", () => {
  const before = createFloweringBranch("plant-1", 8278, vec3(0, 0.55, 0));
  const bloom = [...before.organs.values()].find((organ) => organ.kind === "bloom");
  const stalk = before.branches.get(bloom.branchId);
  const unrelatedIds = [...before.organs.keys()].filter((id) => id !== bloom.id);
  const records = snapshotRecords(before);
  const plan = previewPrune(before, stalk.id, stalk.activeLength * 0.35);
  assert.deepEqual(plan.removedOrganIds, [bloom.id]);
  const after = applyPrune(before, plan);
  assert.equal(after.organs.get(bloom.id).active, false);
  assertRecordsUnchanged(after, records, [], unrelatedIds);
  assertAttachmentCoincidence(after);
});

test("shared 1e-8 distal tolerance keeps boundary child and organ consistently", () => {
  const graph = createFloweringBranch("plant-1", 8278, vec3(0, 0.55, 0));
  const trunk = graph.branches.get(graph.rootBranchId);
  const boundary = 2.15;
  const organ = graph.organs.get("plant-1:organ-leaf-1");
  organ.branchId = trunk.id;
  organ.distance = boundary + ATTACHMENT_TOLERANCE * 0.5;
  const plan = previewPrune(graph, trunk.id, boundary);
  assert.equal(plan.removedBranchIds.includes("plant-1:lateral-a"), false);
  assert.equal(plan.removedOrganIds.includes(organ.id), false);
  const distal = previewPrune(graph, trunk.id, boundary - ATTACHMENT_TOLERANCE * 2);
  assert.equal(distal.removedBranchIds.includes("plant-1:lateral-a"), true);
  assert.equal(distal.removedOrganIds.includes(organ.id), true);
});

test("inactive cut-time identity stays frozen during later aim", () => {
  const initial = createFloweringBranch("plant-1", 8278, vec3(0, 0.55, 0));
  const plan = previewPrune(initial, initial.rootBranchId, 3.15);
  const cut = applyPrune(initial, plan);
  const frozen = snapshotRecords(cut);
  const trunk = cut.branches.get(cut.rootBranchId);
  const grabbed = sampleBranch(trunk, 2.5).position;
  const aimed = aimBranch(cut, trunk.id, grabbed, { x: grabbed.x + 0.5, y: grabbed.y + 0.2, z: grabbed.z });
  assertRecordsUnchanged(aimed, frozen, plan.removedBranchIds, plan.removedOrganIds);
  assertAttachmentCoincidence(aimed);
});

