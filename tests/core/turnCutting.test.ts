import assert from "node:assert/strict";
import test from "node:test";
import { turnCutting } from "../../src/core/turnCutting.ts";
import { getMaterialDefinitions, serializePlantGraph, createFloweringBranch, previewPrune, applyPrune } from "../../src/core/index.ts";
import { rotateVector, quaternionFromAxisAngle } from "../../src/core/math.ts";
import { assertRestLengthsPreserved, assertAttachmentCoincidence, assertVecClose } from "./helpers.ts";

test("a whole-cutting turn carries every material and frame while preserving anchor, height, stock, organs and identity", () => {
  const angle = Math.PI / 12;
  for (const material of getMaterialDefinitions()) {
    const before = material.generator.generate("plant-1", 8278, { x: .41, y: .55, z: -.23 });
    const frozen = serializePlantGraph(before), after = turnCutting(before, angle);
    assert.equal(serializePlantGraph(before), frozen, "immutable input");
    assert.equal(after.generatorVersion, before.generatorVersion);
    assert.deepEqual([...after.organs], [...before.organs]);
    assert.deepEqual(after.branches.get(after.rootBranchId)!.points[0], before.branches.get(before.rootBranchId)!.points[0]);
    assertRestLengthsPreserved(before, after); assertAttachmentCoincidence(after);
    const rotation = quaternionFromAxisAngle({ x: 0, y: 1, z: 0 }, angle);
    for (const [id, branch] of before.branches) {
      const changed = after.branches.get(id)!;
      assert.equal(changed.parentId, branch.parentId); assert.equal(changed.parentDistance, branch.parentDistance);
      assert.equal(changed.activeLength, branch.activeLength);
      branch.points.forEach((point, i) => assert.ok(Math.abs(changed.points[i].y - point.y) < 1e-12));
      assertVecClose(changed.referenceNormal, rotateVector(branch.referenceNormal, rotation));
    }
    const reversed = turnCutting(after, -angle);
    for (const [id, branch] of before.branches) branch.points.forEach((p, i) => assertVecClose(reversed.branches.get(id)!.points[i], p));
  }
});

test("turning keeps inactive cut history byte-identical and invalid/no-motion commands exact", () => {
  const full = createFloweringBranch("plant-1", 8278, { x: .3, y: .55, z: .2 });
  const before = applyPrune(full, previewPrune(full, full.rootBranchId, 2));
  const inactive = [...before.branches.values()].filter(b => !b.active);
  assert.ok(inactive.length);
  const after = turnCutting(before, Math.PI);
  for (const branch of inactive) assert.deepEqual(after.branches.get(branch.id), branch);
  assert.deepEqual([...after.organs], [...before.organs]);
  assertRestLengthsPreserved(before, after); assertAttachmentCoincidence(after);
  for (const angle of [0, NaN, Infinity]) assert.equal(serializePlantGraph(turnCutting(before, angle)), serializePlantGraph(before));
});
