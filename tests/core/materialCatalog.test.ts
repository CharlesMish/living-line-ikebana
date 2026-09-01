// @ts-nocheck
import assert from "node:assert/strict";
import test from "node:test";

import fixture from "../../fixtures/plant-1-one-branch-v1.json";
import schema from "../../fixtures/plant-graph.schema.json";
import {
  GENERATOR_VERSION,
  clonePlantGraph,
  createFloweringBranch,
  deserializePlantGraph,
  getMaterialDefinition,
  isSupportedGeneratorVersion,
  prepareMaterialInsertion,
  serializePlantGraph,
  toCanonicalPlantGraph,
  validatePlantGraph,
} from "../../src/core/index.ts";
import { assertClose, assertVecClose } from "./helpers.ts";

const BASE = { x: 0, y: 0.55, z: 0 };

test("flowering-branch catalog entry delegates the exact one-branch-v1 fixture generator", () => {
  const material = getMaterialDefinition("flowering-branch");
  assert.ok(material);
  assert.equal(material.materialId, "flowering-branch");
  assert.equal(material.generator.generatorVersion, GENERATOR_VERSION);
  assert.equal(material.generator.generate, createFloweringBranch);

  const prepared = prepareMaterialInsertion("flowering-branch", 1, BASE);
  assert.equal(prepared.ok, true);
  if (!prepared.ok) return;

  const direct = createFloweringBranch("plant-1", 8278, BASE);
  assert.deepEqual(toCanonicalPlantGraph(prepared.graph), toCanonicalPlantGraph(direct));
  const canonical = toCanonicalPlantGraph(prepared.graph);
  assert.equal(canonical.schemaVersion, fixture.schemaVersion);
  assert.equal(canonical.generatorVersion, fixture.generatorVersion);
  assert.equal(canonical.id, fixture.id);
  assert.equal(canonical.seed, fixture.seed);
  assert.equal(canonical.rootBranchId, fixture.rootBranchId);
  for (let index = 0; index < fixture.branches.length; index += 1) {
    const expected = fixture.branches[index];
    const actual = canonical.branches[index];
    for (const key of ["id", "label", "kind", "parentId", "active"]) {
      assert.equal(actual[key], expected[key], `${actual.id}.${key}`);
    }
    for (const key of ["parentDistance", "activeLength", "radius", "stiffness"]) {
      assertClose(actual[key], expected[key], 1e-8, `${actual.id}.${key}`);
    }
    actual.points.forEach((point, pointIndex) => {
      assertVecClose(point, expected.points[pointIndex], 1e-8, `${actual.id}.points.${pointIndex}`);
    });
    actual.restLengths.forEach((value, lengthIndex) => {
      assertClose(value, expected.restLengths[lengthIndex], 1e-8, `${actual.id}.restLengths.${lengthIndex}`);
    });
    assertVecClose(actual.referenceNormal, expected.referenceNormal, 1e-8, `${actual.id}.referenceNormal`);
  }
  assert.deepEqual(canonical.organs, fixture.organs);
  assert.deepEqual(validatePlantGraph(prepared.graph), []);
  assert.equal(prepared.graph.generatorVersion, GENERATOR_VERSION);

  assert.equal("materialId" in prepared.graph, false);
  assert.equal("materialId" in canonical, false);
  assert.doesNotMatch(serializePlantGraph(prepared.graph), /"materialId"/);
});

test("generator support comes from the registry while schemaVersion remains 1", () => {
  assert.equal(isSupportedGeneratorVersion(GENERATOR_VERSION), true);
  assert.equal(isSupportedGeneratorVersion("unknown-generator-v99"), false);
  assert.equal(schema.properties.schemaVersion.const, 1);
  assert.deepEqual(schema.properties.generatorVersion, { type: "string", minLength: 1 });

  const prepared = prepareMaterialInsertion("flowering-branch", 1, BASE);
  assert.equal(prepared.ok, true);
  if (!prepared.ok) return;

  const decoded = deserializePlantGraph(serializePlantGraph(prepared.graph));
  assert.equal(decoded.generatorVersion, GENERATOR_VERSION);

  const unknownCanonical = JSON.parse(JSON.stringify(toCanonicalPlantGraph(prepared.graph)));
  unknownCanonical.generatorVersion = "unknown-generator-v99";
  assert.throws(
    () => deserializePlantGraph(unknownCanonical),
    /Unsupported generatorVersion unknown-generator-v99/,
  );

  const unknownGraph = clonePlantGraph(prepared.graph);
  unknownGraph.generatorVersion = "unknown-generator-v99";
  assert.deepEqual(validatePlantGraph(unknownGraph), [
    { path: "generatorVersion", message: "must be a supported generator version" },
  ]);
  assert.throws(
    () => serializePlantGraph(unknownGraph),
    /Unsupported generatorVersion unknown-generator-v99/,
  );
});

test("material preparation requires an exact catalog ID without fallback", () => {
  assert.deepEqual(
    prepareMaterialInsertion("missing-material", 1, BASE),
    { ok: false, reason: "unknown-material", materialId: "missing-material" },
  );
  assert.equal(getMaterialDefinition("flowering-branch "), null);
  assert.deepEqual(
    prepareMaterialInsertion("flowering-branch ", 1, BASE),
    { ok: false, reason: "unknown-material", materialId: "flowering-branch " },
  );
});
