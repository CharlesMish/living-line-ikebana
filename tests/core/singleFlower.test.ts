import assert from "node:assert/strict";
import test from "node:test";
import fixture from "../../fixtures/plant-1-single-flower-v1.json";
import floweringFixture from "../../fixtures/plant-1-one-branch-v1.json";
import leafyFixture from "../../fixtures/plant-2-leafy-shoot-v1.json";
import {
  prepareMaterialInsertion, serializePlantGraph, deserializePlantGraph,
  toCanonicalPlantGraph, validatePlantGraph, bendBranch, previewPrune, applyPrune,
  sampleBranch, sampleMaterialFrame, add, vec3, createFloweringBranch, createLeafyShoot,
  getMaterialDefinition, createSingleFlower, SINGLE_FLOWER_VERSION,
} from "../../src/core/index.ts";
import { SINGLE_FLOWER_RESPONSE } from "../../src/core/materialResponse.ts";

const BASE = { x: 0, y: 0.55, z: 0 };
const SEEDS = [8278, 9255, 10232] as const;

test("single-flower catalog entry is additive and leaves both reference fixtures unchanged", () => {
  const material = getMaterialDefinition("single-flower");
  assert.ok(material);
  assert.equal(material.materialId, "single-flower");
  assert.equal(material.generator.generatorVersion, SINGLE_FLOWER_VERSION);
  assert.equal(material.generator.generate, createSingleFlower);

  const flowering = toCanonicalPlantGraph(createFloweringBranch("plant-1", 8278, BASE));
  assert.equal(flowering.generatorVersion, floweringFixture.generatorVersion);
  assert.equal(flowering.branches.length, floweringFixture.branches.length);
  assert.equal(flowering.organs.length, floweringFixture.organs.length);
  assert.equal(
    flowering.branches.reduce((total, branch) => total + branch.points.length, 0),
    floweringFixture.branches.reduce((total, branch) => total + branch.points.length, 0),
  );
  assert.deepEqual(flowering.organs, floweringFixture.organs);

  const leafy = createLeafyShoot("plant-2", 9255, BASE);
  assert.deepEqual(JSON.parse(serializePlantGraph(leafy)), leafyFixture);
});

test("single-flower-v1 is deterministic, valid and fixture-identical at seed 8278", () => {
  for (const seed of SEEDS) {
    const first = createSingleFlower("plant-1", seed, BASE);
    const second = createSingleFlower("plant-1", seed, BASE);
    assert.equal(serializePlantGraph(first), serializePlantGraph(second));
    assert.deepEqual(validatePlantGraph(first), []);
    assert.equal(first.generatorVersion, SINGLE_FLOWER_VERSION);
    assert.equal(first.branches.size, 4);
    assert.equal(first.organs.size, 3);
    const stem = first.branches.get(first.rootBranchId)!;
    assert.equal(stem.kind, "trunk");
    assert.equal(stem.stiffness, SINGLE_FLOWER_RESPONSE.stem);
    assert.equal(stem.points.length, 15);
    assert.ok(stem.radius < 0.05, "supporting stem stays slender");
    const organs = [...first.organs.values()];
    assert.equal(organs.filter((organ) => organ.kind === "bloom").length, 1);
    assert.equal(organs.filter((organ) => organ.kind === "leaf").length, 2);
    const bloom = first.organs.get("plant-1:bloom")!;
    const pedicel = first.branches.get(bloom.branchId)!;
    assert.equal(pedicel.kind, "pedicel");
    assert.equal(bloom.distance, pedicel.activeLength);
  }

  const prepared = prepareMaterialInsertion("single-flower", 1, BASE);
  assert.ok(prepared.ok);
  assert.equal(prepared.seed, 8278);
  assert.deepEqual(JSON.parse(serializePlantGraph(prepared.graph)), fixture);
  assert.equal("materialId" in prepared.graph, false);
});

test("seed variation changes authored detail without rerolling during edits", () => {
  const graphs = SEEDS.map((seed) => serializePlantGraph(createSingleFlower("plant-1", seed, BASE)));
  assert.notEqual(graphs[0], graphs[1]);
  assert.notEqual(graphs[1], graphs[2]);
  const graph = createSingleFlower("plant-1", 8278, BASE);
  const before = serializePlantGraph(graph);
  const stem = graph.branches.get(graph.rootBranchId)!;
  const station = stem.activeLength * 0.54;
  const bent = bendBranch(graph, {
    branchId: stem.id,
    stationDistance: station,
    target: add(sampleBranch(stem, station).position, vec3(1.4, 0.15, -0.7)),
  });
  assert.deepEqual(validatePlantGraph(bent), []);
  assert.notDeepEqual(bent.branches.get(stem.id)!.points, stem.points);
  for (const branch of graph.branches.values()) {
    assert.deepEqual(bent.branches.get(branch.id)!.restLengths, branch.restLengths);
  }
  assert.equal(serializePlantGraph(graph), before);
  assert.equal(serializePlantGraph(deserializePlantGraph(serializePlantGraph(bent))), serializePlantGraph(bent));
});

test("cutting the pedicel removes the bloom; a stem cut below it removes the stalk as history", () => {
  const graph = createSingleFlower("plant-1", 8278, BASE);
  const bloom = graph.organs.get("plant-1:bloom")!;
  const pedicel = graph.branches.get(bloom.branchId)!;
  const leafIds = ["plant-1:leaf-1", "plant-1:leaf-2"];
  const pedicelPlan = previewPrune(graph, pedicel.id, pedicel.activeLength * 0.4);
  assert.deepEqual(pedicelPlan.removedOrganIds, [bloom.id]);
  const afterPedicel = applyPrune(graph, pedicelPlan);
  assert.equal(afterPedicel.organs.get(bloom.id)!.active, false);
  assert.equal(afterPedicel.organs.size, 3);
  for (const id of leafIds) assert.equal(afterPedicel.organs.get(id)!.active, true);
  assert.deepEqual(validatePlantGraph(afterPedicel), []);

  const stem = graph.branches.get(graph.rootBranchId)!;
  const stemPlan = previewPrune(graph, stem.id, bloom.distance > 0 ? pedicel.parentDistance - 0.08 : stem.activeLength * 0.8);
  assert.ok(stemPlan.removedBranchIds.includes(pedicel.id));
  assert.ok(stemPlan.removedOrganIds.includes(bloom.id));
  const afterStem = applyPrune(graph, stemPlan);
  assert.equal(afterStem.branches.get(pedicel.id)!.active, false);
  assert.equal(afterStem.organs.get(bloom.id)!.active, false);
  assert.equal(afterStem.branches.size, 4);
  assert.equal(afterStem.organs.size, 3);
  assert.deepEqual(validatePlantGraph(afterStem), []);
});

test("bloom facing is a persistent organ spin on the supporting material frame", () => {
  const graph = createSingleFlower("plant-1", 8278, BASE);
  const bloom = graph.organs.get("plant-1:bloom")!;
  const pedicel = graph.branches.get(bloom.branchId)!;
  const frame = sampleMaterialFrame(pedicel, bloom.distance);
  assert.ok(Number.isFinite(bloom.spin));
  assert.ok(Math.abs(frame.normal.x ** 2 + frame.normal.y ** 2 + frame.normal.z ** 2 - 1) < 1e-8);
  const stem = graph.branches.get(graph.rootBranchId)!;
  const bent = bendBranch(graph, {
    branchId: stem.id,
    stationDistance: stem.activeLength * 0.54,
    target: add(sampleBranch(stem, stem.activeLength * 0.54).position, vec3(1.2, 0.2, 0.4)),
  });
  assert.equal(bent.organs.get(bloom.id)!.spin, bloom.spin);
  assert.equal(bent.organs.get(bloom.id)!.scale, bloom.scale);
});
