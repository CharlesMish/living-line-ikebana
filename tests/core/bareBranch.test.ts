import assert from "node:assert/strict";
import test from "node:test";
import fixture from "../../fixtures/plant-1-bare-branch-v1.json";
import floweringFixture from "../../fixtures/plant-1-one-branch-v1.json";
import {
  BARE_BRANCH_VERSION,
  aimBranch,
  applyPrune,
  bendBranch,
  createBareBranch,
  createFloweringBranch,
  deserializePlantGraph,
  fromCanonicalPlantGraph,
  getMaterialDefinition,
  legalBendStation,
  prepareMaterialInsertion,
  previewPrune,
  serializePlantGraph,
  toCanonicalPlantGraph,
  validatePlantGraph,
  add,
  sampleBranch,
  vec3,
} from "../../src/core/index.ts";
import { BARE_RESPONSE, FLOWERING_RESPONSE } from "../../src/core/materialResponse.ts";
import { getMaterialAppearance } from "../../src/presentation/materialAppearance.ts";
import { createWorkbenchFixture, WORKBENCH_SEEDS } from "../../src/app/workbench.ts";
import { GardenStore, GARDEN_KEY } from "../../src/app/garden.ts";

const BASE = { x: 0, y: 0.55, z: 0 };
const SEEDS = [8278, 9255, 10232] as const;

test("bare-branch catalog entry is additive and matches the golden fixture at seed 8278", () => {
  const material = getMaterialDefinition("bare-branch");
  assert.ok(material);
  assert.equal(material.materialId, "bare-branch");
  assert.equal(material.generator.generatorVersion, BARE_BRANCH_VERSION);
  assert.equal(material.generator.generate, createBareBranch);

  const prepared = prepareMaterialInsertion("bare-branch", 1, BASE);
  assert.ok(prepared.ok);
  const canonical = toCanonicalPlantGraph(prepared.graph);
  assert.deepEqual(canonical, fixture);
  assert.equal(canonical.generatorVersion, "bare-branch-v1");
  assert.equal(canonical.branches.length, 5);
  assert.equal(canonical.organs.length, 0);
  assert.equal("materialId" in prepared.graph, false);
  assert.doesNotMatch(serializePlantGraph(prepared.graph), /"materialId"/);
});

test("bare-branch-v1 is a different woody graph, not flowering with organs hidden", () => {
  const bare = createBareBranch("plant-1", 8278, vec3(0, 0.55, 0));
  const flowering = createFloweringBranch("plant-1", 8278, vec3(0, 0.55, 0));
  assert.equal(bare.organs.size, 0);
  assert.equal(flowering.organs.size, 10);
  assert.equal(bare.branches.size, 5);
  assert.equal(flowering.branches.size, 15);
  const bareTrunk = bare.branches.get("plant-1:trunk");
  const flowerTrunk = flowering.branches.get("plant-1:trunk");
  assert.ok(bareTrunk && flowerTrunk);
  assert.equal(bareTrunk.points.length, 17);
  assert.equal(flowerTrunk.points.length, 19);
  assert.equal(bareTrunk.stiffness, BARE_RESPONSE.trunk);
  assert.equal(flowerTrunk.stiffness, FLOWERING_RESPONSE.trunk);
  assert.notEqual(bareTrunk.radius, flowerTrunk.radius);
  const bareAttachments = [...bare.branches.values()]
    .filter((branch) => branch.parentId === bareTrunk.id)
    .map((branch) => branch.parentDistance)
    .sort((a, b) => a - b);
  const flowerAttachments = [...flowering.branches.values()]
    .filter((branch) => branch.parentId === flowerTrunk.id && (branch.kind === "lateral" || branch.kind === "twig"))
    .map((branch) => branch.parentDistance)
    .sort((a, b) => a - b);
  assert.equal(bareAttachments.length, 3);
  assert.ok(bareAttachments[0] > 1.45, "basal stem should remain clear enough to seat and slide");
  assert.notDeepEqual(bareAttachments, flowerAttachments);
  assert.notDeepEqual(JSON.parse(serializePlantGraph(bare)).branches, floweringFixture.branches);
});

test("bare-branch graphs are deterministic, valid and craftable at the review seeds", () => {
  for (const seed of SEEDS) {
    const first = createBareBranch("plant-1", seed, BASE);
    const second = createBareBranch("plant-1", seed, BASE);
    assert.equal(serializePlantGraph(first), serializePlantGraph(second));
    assert.deepEqual(validatePlantGraph(first), []);
    assert.equal(first.branches.size, 5);
    assert.equal(first.organs.size, 0);
    for (const branch of first.branches.values()) {
      assert.ok(legalBendStation(branch) !== null, `${branch.id} must be eligible for broad bend`);
      assert.ok(branch.points.length >= 6, `${branch.id} needs enough segmentation`);
    }
    const encoded = serializePlantGraph(first);
    assert.equal(serializePlantGraph(deserializePlantGraph(encoded)), encoded);

    const trunk = first.branches.get(first.rootBranchId)!;
    const station = trunk.activeLength * 0.54;
    const aimed = aimBranch(first, trunk.id, sampleBranch(trunk, trunk.activeLength * 0.8).position, add(sampleBranch(trunk, trunk.activeLength * 0.8).position, vec3(0.8, 0.2, -0.4)));
    assert.deepEqual(validatePlantGraph(aimed), []);
    for (const branch of first.branches.values()) {
      assert.deepEqual(aimed.branches.get(branch.id)!.restLengths, branch.restLengths);
    }
    const bent = bendBranch(first, {
      branchId: trunk.id,
      stationDistance: station,
      target: add(sampleBranch(trunk, station).position, vec3(1.6, 0.1, -0.7)),
    });
    assert.deepEqual(validatePlantGraph(bent), []);
    assert.notDeepEqual(bent.branches.get(trunk.id)!.points, trunk.points);
    for (const branch of first.branches.values()) {
      assert.deepEqual(bent.branches.get(branch.id)!.restLengths, branch.restLengths);
    }
    const answering = first.branches.get("plant-1:answering")!;
    const plan = previewPrune(bent, answering.id, 0.08);
    assert.ok(plan.removedBranchIds.includes("plant-1:spur"));
    const snapshot = serializePlantGraph(bent);
    previewPrune(bent, answering.id, 0.08);
    assert.equal(serializePlantGraph(bent), snapshot, "prune preview is non-mutating");
    const cut = applyPrune(bent, plan);
    assert.deepEqual(validatePlantGraph(cut), []);
    assert.equal(cut.branches.get("plant-1:spur")!.active, false);
    assert.equal(cut.branches.size, 5, "cut records survive as history");
    assert.equal(serializePlantGraph(first), serializePlantGraph(second), "generation snapshot remains immutable");
  }
});

test("seed variation changes authored line details without rerolling after an edit", () => {
  const graphs = SEEDS.map((seed) => createBareBranch("plant-1", seed, BASE));
  const encodings = graphs.map((graph) => serializePlantGraph(graph));
  assert.notEqual(encodings[0], encodings[1]);
  assert.notEqual(encodings[1], encodings[2]);
  const lengths = graphs.map((graph) => graph.branches.get(graph.rootBranchId)!.activeLength);
  assert.ok(new Set(lengths.map((value) => value.toFixed(5))).size > 1);

  const original = graphs[0];
  const trunk = original.branches.get(original.rootBranchId)!;
  const before = serializePlantGraph(original);
  const bent = bendBranch(original, {
    branchId: trunk.id,
    stationDistance: trunk.activeLength * 0.54,
    target: add(sampleBranch(trunk, trunk.activeLength * 0.54).position, vec3(1.2, 0, 0.4)),
  });
  assert.equal(serializePlantGraph(original), before);
  for (const id of original.branches.keys()) {
    if (id === trunk.id) continue;
    assert.deepEqual(
      bent.branches.get(id)!.restLengths,
      original.branches.get(id)!.restLengths,
    );
    assert.equal(bent.branches.get(id)!.parentDistance, original.branches.get(id)!.parentDistance);
  }
});

test("one useful cut of the answering fork reveals empty space and retains inactive identity", () => {
  const graph = createBareBranch("plant-1", 8278, BASE);
  const answering = graph.branches.get("plant-1:answering")!;
  const others = [...graph.branches.values()].filter((branch) => branch.id !== answering.id && branch.parentId !== answering.id);
  const plan = previewPrune(graph, answering.id, 0.08);
  const cut = applyPrune(graph, plan);
  assert.deepEqual(plan.removedBranchIds.sort(), ["plant-1:spur"]);
  assert.equal(cut.branches.get("plant-1:answering")!.active, true);
  assert.ok(cut.branches.get("plant-1:answering")!.activeLength < answering.activeLength);
  assert.equal(cut.branches.get("plant-1:spur")!.active, false);
  for (const branch of others) {
    if (branch.id === "plant-1:spur") continue;
    assert.deepEqual(cut.branches.get(branch.id)!.points, branch.points, `${branch.id} relocated`);
  }
  const appearance = getMaterialAppearance("bare-branch-v1");
  assert.equal(appearance.branchColors.trunk, 0x3c322c);
  assert.notEqual(appearance.branchColors.trunk, getMaterialAppearance("one-branch-v1").branchColors.trunk);
});

test("workbench fixtures and Garden copies isolate a later cut of the candidate", () => {
  for (const seed of WORKBENCH_SEEDS) {
    const snapshot = createWorkbenchFixture("bare-branch", seed, 1);
    assert.equal(snapshot.plants[0].generatorVersion, "bare-branch-v1");
    assert.equal(snapshot.plants[0].organs.length, 0);
    assert.deepEqual(snapshot, createWorkbenchFixture("bare-branch", seed, 1));
  }
  const mixed = createWorkbenchFixture("mixed", 8278, 6);
  const pair = createWorkbenchFixture("reference-pair", 8278, 6);
  assert.deepEqual(mixed, pair);
  assert.deepEqual(mixed.plants.map((plant) => plant.generatorVersion), [
    "one-branch-v1", "leafy-shoot-v1", "one-branch-v1",
    "leafy-shoot-v1", "one-branch-v1", "leafy-shoot-v1",
  ]);
  const catalogCycle = createWorkbenchFixture("all-registered-materials", 8278, 6);
  assert.deepEqual(catalogCycle.plants.map((plant) => plant.generatorVersion), [
    "one-branch-v1", "leafy-shoot-v1", "bare-branch-v1", "single-flower-v1",
    "one-branch-v1", "leafy-shoot-v1",
  ]);

  const values = new Map<string, string>();
  const garden = new GardenStore(GARDEN_KEY, {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => { values.set(key, value); },
  });
  garden.load();
  const original = createWorkbenchFixture("bare-branch", 8278, 1);
  garden.keep({
    id: "moment-bare",
    title: "One line",
    keptAt: "2026-09-21T12:00:00.000Z",
    thumbnail: null,
    arrangement: original,
  });
  const copy = structuredClone(original);
  const graph = fromCanonicalPlantGraph(copy.plants[0]);
  const answering = graph.branches.get("plant-1:answering")!;
  copy.plants[0] = toCanonicalPlantGraph(applyPrune(graph, previewPrune(graph, answering.id, 0.08)));
  const loaded = garden.load();
  assert.deepEqual(loaded.entries[0].arrangement.plants[0], original.plants[0]);
  assert.notEqual(
    JSON.stringify(copy.plants[0]),
    JSON.stringify(loaded.entries[0].arrangement.plants[0]),
  );
});
