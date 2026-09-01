// @ts-nocheck
import assert from "node:assert/strict";
import test from "node:test";
import fixture from "../../fixtures/plant-1-one-branch-v1.json";
import {
  Mulberry32,
  createFloweringBranch,
  deserializePlantGraph,
  serializePlantGraph,
  successfulSeatIdentity,
  toCanonicalPlantGraph,
  validatePlantGraph,
  vec3,
} from "../../src/core/index.ts";
import { assertClose, assertVecClose } from "./helpers.ts";

test("Mulberry32 matches the v2.1 raw UInt32 oracle", () => {
  const random = new Mulberry32(8278);
  assert.deepEqual(
    [random.nextUInt32(), random.nextUInt32(), random.nextUInt32(), random.nextUInt32()],
    [1455703032, 1240698700, 1956662399, 3370247770],
  );
});

test("successful-seat identity reserves but does not invent a special first seed", () => {
  assert.deepEqual(successfulSeatIdentity(1), { id: "plant-1", seed: 8278 });
  assert.deepEqual(successfulSeatIdentity(2), { id: "plant-2", seed: 9255 });
});

test("one-branch-v1 generator semantically matches every golden fixture field", () => {
  const generated = toCanonicalPlantGraph(createFloweringBranch("plant-1", 8278, vec3(0, 0.55, 0)));
  assert.equal(generated.schemaVersion, fixture.schemaVersion);
  assert.equal(generated.generatorVersion, fixture.generatorVersion);
  assert.equal(generated.id, fixture.id);
  assert.equal(generated.seed, fixture.seed);
  assert.equal(generated.rootBranchId, fixture.rootBranchId);
  assert.equal(generated.branches.length, 15);
  assert.equal(generated.organs.length, 10);
  assert.equal(generated.branches.reduce((total, branch) => total + branch.points.length, 0), 94);

  for (let index = 0; index < fixture.branches.length; index += 1) {
    const expected = fixture.branches[index];
    const actual = generated.branches[index];
    for (const key of ["id", "label", "kind", "parentId", "active"]) assert.equal(actual[key], expected[key], `${actual.id}.${key}`);
    for (const key of ["parentDistance", "activeLength", "radius", "stiffness"]) {
      assertClose(actual[key], expected[key], 1e-8, `${actual.id}.${key}`);
    }
    assert.equal(actual.points.length, expected.points.length, actual.id);
    actual.points.forEach((point, pointIndex) => assertVecClose(point, expected.points[pointIndex], 1e-8, `${actual.id}.points.${pointIndex}`));
    assert.equal(actual.restLengths.length, expected.restLengths.length, actual.id);
    actual.restLengths.forEach((value, lengthIndex) => assertClose(value, expected.restLengths[lengthIndex], 1e-8, `${actual.id}.restLengths.${lengthIndex}`));
    assertVecClose(actual.referenceNormal, expected.referenceNormal, 1e-8, `${actual.id}.referenceNormal`);
  }
  assert.deepEqual(generated.organs, fixture.organs);
  assert.deepEqual(validatePlantGraph(createFloweringBranch("plant-1", 8278, vec3(0, 0.55, 0))), []);
});

test("canonical save/load sorts collections and preserves all domain state", () => {
  const graph = createFloweringBranch("plant-1", 8278, vec3(0, 0.55, 0));
  const encoded = serializePlantGraph(graph);
  const decoded = deserializePlantGraph(encoded);
  // JSON intentionally canonicalizes the numerically equivalent -0 to 0.
  assert.equal(serializePlantGraph(decoded), encoded);
  assert.deepEqual(validatePlantGraph(decoded), []);
  const canonical = JSON.parse(encoded);
  assert.deepEqual(canonical.branches.map(({ id }) => id), canonical.branches.map(({ id }) => id).sort());
  assert.deepEqual(canonical.organs.map(({ id }) => id), canonical.organs.map(({ id }) => id).sort());
});
