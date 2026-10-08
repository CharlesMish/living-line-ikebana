// @ts-nocheck
import assert from "node:assert/strict";
import test from "node:test";
import {
  applyPrune,
  createReed,
  createReedFineB2,
  previewPrune,
  serializePlantGraph,
  toCanonicalPlantGraph,
} from "../../src/core/index.ts";
import { contactRadius } from "../../src/core/stemContact.ts";

const BASE = { x: 0, y: 0.55, z: 0 };
const ordinals = [...Array(12).keys()];
const seedForOrdinal = (ordinal: number) => (7301 + ordinal * 977) >>> 0;

function normalizedCanonical(graph: ReturnType<typeof createReed>) {
  const canonical = structuredClone(toCanonicalPlantGraph(graph));
  canonical.generatorVersion = "normalized-reed";
  canonical.branches = canonical.branches.map((branch) => ({ ...branch, radius: 0 }));
  return canonical;
}

test("reed-fine-b2-v1 keeps reed-v1 construction with only generatorVersion and radius changed", () => {
  for (const ordinal of ordinals) {
    const seed = seedForOrdinal(ordinal);
    const id = `plant-${ordinal + 1}`;
    const reed = createReed(id, seed, BASE);
    const fine = createReedFineB2(id, seed, BASE);
    const reedBranch = reed.branches.get(reed.rootBranchId)!;
    const fineBranch = fine.branches.get(fine.rootBranchId)!;

    assert.equal(fine.generatorVersion, "reed-fine-b2-v1");
    assert.equal(reed.generatorVersion, "reed-v1");
    assert.equal(fineBranch.radius, 0.0192);
    assert.equal(reedBranch.radius, 0.024);
    assert.equal(fineBranch.activeLength, reedBranch.activeLength);
    assert.deepEqual(fineBranch.restLengths, reedBranch.restLengths);
    assert.deepEqual(fineBranch.points, reedBranch.points);
    assert.equal(fineBranch.stiffness, reedBranch.stiffness);
    assert.deepEqual(normalizedCanonical(fine), normalizedCanonical(reed));
  }
});

test("reed-fine-b2-v1 is deterministic and prune semantics match reed-v1", () => {
  for (const ordinal of ordinals) {
    const seed = seedForOrdinal(ordinal);
    const id = `plant-${ordinal + 1}`;
    const first = createReedFineB2(id, seed, BASE);
    const second = createReedFineB2(id, seed, BASE);
    assert.equal(serializePlantGraph(first), serializePlantGraph(second));

    const reed = createReed(id, seed, BASE);
    const branch = reed.branches.get(reed.rootBranchId)!;
    const cutDistance = branch.activeLength * 0.46;
    const reedPlan = previewPrune(reed, reed.rootBranchId, cutDistance);
    const finePlan = previewPrune(first, first.rootBranchId, cutDistance);
    assert.deepEqual(finePlan, reedPlan);
    const reedCut = applyPrune(reed, reedPlan);
    const fineCut = applyPrune(first, finePlan);
    assert.deepEqual(normalizedCanonical(fineCut), normalizedCanonical(reedCut));
  }
});

test("reed-fine-b2-v1 protection envelope follows the stored branch radius", () => {
  const reed = createReed("plant-1", seedForOrdinal(0), BASE).branches.get("plant-1:culm")!;
  const fine = createReedFineB2("plant-1", seedForOrdinal(0), BASE).branches.get("plant-1:culm")!;
  const reedEnvelope = contactRadius(reed, reed);
  const fineEnvelope = contactRadius(fine, fine);
  assert.ok(fineEnvelope < reedEnvelope);
  assert.equal(fineEnvelope, fine.radius * 2 - Math.max(1e-5, 0.1 * fine.radius));
});
