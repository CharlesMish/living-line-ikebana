import assert from "node:assert/strict";
import test from "node:test";
import fixture from "../../fixtures/plant-1-flower-volume-v1.json";
import floweringFixture from "../../fixtures/plant-1-one-branch-v1.json";
import leafyFixture from "../../fixtures/plant-2-leafy-shoot-v1.json";
import { canonicalCameraPose } from "../../src/app/camera.ts";
import { createDomainAdapters } from "../../src/app/domainAdapters.ts";
import { prepareMaterialInsertionForApp } from "../../src/app/materialInsertion.ts";
import { createWorkbenchFixture, describeFixture } from "../../src/app/workbench.ts";
import { IkebanaApp } from "../../src/app/IkebanaApp.ts";
import {
  FLOWER_VOLUME_GROUP_COUNT,
  FLOWER_VOLUME_VERSION,
  applyPrune,
  bendBranch,
  createFlowerVolume,
  createFloweringBranch,
  createLeafyShoot,
  deserializePlantGraph,
  distance,
  getMaterialDefinition,
  organPosition,
  prepareMaterialInsertion,
  previewPrune,
  sampleBranch,
  serializePlantGraph,
  toCanonicalPlantGraph,
  validatePlantGraph,
  vec3,
  add,
} from "../../src/core/index.ts";
import { FLOWER_VOLUME_RESPONSE } from "../../src/core/materialResponse.ts";
import { getMaterialAppearance } from "../../src/presentation/materialAppearance.ts";
import { TransactionCoordinator } from "../../src/input/index.ts";

const BASE = { x: 0, y: 0.55, z: 0 };
const SEEDS = [8278, 9255, 10232] as const;

function bloomGaps(graph: ReturnType<typeof createFlowerVolume>) {
  const positions = [...graph.organs.values()]
    .filter((organ) => organ.kind === "bloom")
    .map((organ) => organPosition(graph, organ.id)!);
  let min = Infinity;
  let max = 0;
  for (let i = 0; i < positions.length; i += 1) {
    for (let j = i + 1; j < positions.length; j += 1) {
      const gap = distance(positions[i]!, positions[j]!);
      min = Math.min(min, gap);
      max = Math.max(max, gap);
    }
  }
  return { min, max };
}

test("flower-volume catalog entry is additive and leaves both reference fixtures unchanged", () => {
  const material = getMaterialDefinition("flower-volume");
  assert.ok(material);
  assert.equal(material.materialId, "flower-volume");
  assert.equal(material.generator.generatorVersion, FLOWER_VOLUME_VERSION);
  assert.equal(material.generator.generate, createFlowerVolume);

  const flowering = toCanonicalPlantGraph(createFloweringBranch("plant-1", 8278, BASE));
  assert.equal(flowering.branches.length, floweringFixture.branches.length);
  assert.equal(flowering.organs.length, floweringFixture.organs.length);
  assert.deepEqual(flowering.organs, floweringFixture.organs);

  const leafy = createLeafyShoot("plant-2", 9255, BASE);
  assert.deepEqual(JSON.parse(serializePlantGraph(leafy)), leafyFixture);

  const pair = describeFixture(createWorkbenchFixture("reference-pair", 8278, 6, { remember: false }));
  assert.deepEqual(pair.plantsInIdentityOrder.map((plant) => plant.generatorVersion), [
    "one-branch-v1", "leafy-shoot-v1", "one-branch-v1", "leafy-shoot-v1", "one-branch-v1", "leafy-shoot-v1",
  ]);
  const allFour = describeFixture(createWorkbenchFixture("all-four", 8278, 6, { remember: false }));
  assert.deepEqual(allFour.plantsInIdentityOrder.map((plant) => plant.generatorVersion), [
    "one-branch-v1", "leafy-shoot-v1", "bare-branch-v1", "single-flower-v1", "one-branch-v1", "leafy-shoot-v1",
  ]);
});

test("flower-volume-v1 is a packed head of five groups, valid and fixture-identical at seed 8278", () => {
  for (const seed of SEEDS) {
    const first = createFlowerVolume("plant-1", seed, BASE);
    const second = createFlowerVolume("plant-1", seed, BASE);
    assert.equal(serializePlantGraph(first), serializePlantGraph(second));
    assert.deepEqual(validatePlantGraph(first), []);
    assert.equal(first.generatorVersion, FLOWER_VOLUME_VERSION);
    assert.equal(first.branches.size, 8);
    assert.equal(first.organs.size, 7);
    const stem = first.branches.get(first.rootBranchId)!;
    assert.equal(stem.kind, "trunk");
    assert.equal(stem.points.length, 15);
    assert.equal(stem.stiffness, FLOWER_VOLUME_RESPONSE.stem);
    const groups = [...first.branches.values()].filter((branch) => branch.label === "flower group");
    assert.equal(groups.length, FLOWER_VOLUME_GROUP_COUNT);
    const blooms = [...first.organs.values()].filter((organ) => organ.kind === "bloom");
    assert.equal(blooms.length, FLOWER_VOLUME_GROUP_COUNT);
    for (const group of groups) {
      assert.equal(group.kind, "pedicel");
      assert.equal(group.parentId, stem.id);
      assert.equal(group.stiffness, FLOWER_VOLUME_RESPONSE.group);
      assert.ok(group.parentDistance > stem.activeLength * 0.9, `${group.id} must sit in the crown`);
      const bloom = blooms.find((organ) => organ.branchId === group.id);
      assert.ok(bloom);
      assert.equal(bloom.distance, group.activeLength);
    }
    const leaves = [...first.organs.values()].filter((organ) => organ.kind === "leaf");
    assert.equal(leaves.length, 2);
    const lowestGroup = Math.min(...groups.map((group) => group.parentDistance));
    for (const leaf of leaves) {
      const stalk = first.branches.get(leaf.branchId)!;
      assert.ok(stalk.parentDistance < lowestGroup - 0.4, "leaves stay below the flower head");
    }
    const gaps = bloomGaps(first);
    assert.ok(gaps.min >= 0.26 && gaps.min <= 0.42, `neighbor gap ${gaps.min} should stay pickable inside one head`);
    assert.ok(gaps.max >= 0.48 && gaps.max <= 0.7, `head span ${gaps.max} should stay one volume`);
  }

  const prepared = prepareMaterialInsertion("flower-volume", 1, BASE);
  assert.equal(prepared.ok, true);
  if (!prepared.ok) return;
  assert.equal(prepared.seed, 8278);
  assert.deepEqual(JSON.parse(serializePlantGraph(prepared.graph)), fixture);
  assert.equal("materialId" in prepared.graph, false);
  const appearance = getMaterialAppearance(FLOWER_VOLUME_VERSION);
  assert.equal(appearance.bloom.form, "tufted");
  assert.notEqual(appearance.bloom.color, getMaterialAppearance("one-branch-v1").bloom.color);
  assert.notEqual(appearance.bloom.color, getMaterialAppearance("single-flower-v1").bloom.color);
  assert.notEqual(appearance.branchColors.trunk, getMaterialAppearance("single-flower-v1").branchColors.trunk);
});

test("seed variation changes the head without rerolling during a stem bend", () => {
  const graphs = SEEDS.map((seed) => serializePlantGraph(createFlowerVolume("plant-1", seed, BASE)));
  assert.notEqual(graphs[0], graphs[1]);
  assert.notEqual(graphs[1], graphs[2]);
  const graph = createFlowerVolume("plant-1", 8278, BASE);
  const before = serializePlantGraph(graph);
  const stem = graph.branches.get(graph.rootBranchId)!;
  const station = stem.activeLength * 0.54;
  const bent = bendBranch(graph, {
    branchId: stem.id,
    stationDistance: station,
    target: add(sampleBranch(stem, station).position, vec3(1.2, 0.2, -0.6)),
  });
  assert.deepEqual(validatePlantGraph(bent), []);
  for (const branch of graph.branches.values()) {
    assert.deepEqual(bent.branches.get(branch.id)!.restLengths, branch.restLengths);
  }
  for (const organ of graph.organs.values()) {
    assert.equal(bent.organs.get(organ.id)!.spin, organ.spin);
    assert.equal(bent.organs.get(organ.id)!.scale, organ.scale);
    assert.equal(bent.organs.get(organ.id)!.active, true);
  }
  assert.equal(serializePlantGraph(graph), before);
  assert.equal(serializePlantGraph(deserializePlantGraph(serializePlantGraph(bent))), serializePlantGraph(bent));
});

test("pruning one flower group opens only that group and keeps the rest of the specimen", () => {
  const graph = createFlowerVolume("plant-1", 8278, BASE);
  const bloom = graph.organs.get("plant-1:bloom-3")!;
  const group = graph.branches.get(bloom.branchId)!;
  const before = serializePlantGraph(graph);
  const plan = previewPrune(graph, group.id, bloom.distance);
  assert.equal(serializePlantGraph(graph), before, "preview must not mutate");
  assert.deepEqual(plan.removedBranchIds, []);
  assert.deepEqual(plan.removedOrganIds, [bloom.id]);

  const cut = applyPrune(graph, plan);
  assert.equal(serializePlantGraph(graph), before);
  assert.equal(cut.organs.get(bloom.id)!.active, false);
  assert.equal(cut.organs.get(bloom.id)!.spin, bloom.spin);
  assert.equal(cut.organs.get(bloom.id)!.scale, bloom.scale);
  assert.equal(cut.branches.get(group.id)!.active, true);
  assert.ok(cut.branches.get(group.id)!.activeLength < group.activeLength);
  assert.equal(cut.branches.size, graph.branches.size);
  assert.equal(cut.organs.size, graph.organs.size);
  for (const branch of graph.branches.values()) {
    if (branch.id === group.id) continue;
    assert.deepEqual(cut.branches.get(branch.id)!.points, branch.points, `${branch.id} moved`);
    assert.equal(cut.branches.get(branch.id)!.activeLength, branch.activeLength);
    assert.equal(cut.branches.get(branch.id)!.active, true);
  }
  for (const organ of graph.organs.values()) {
    if (organ.id === bloom.id) continue;
    assert.deepEqual(cut.organs.get(organ.id), organ);
    assert.equal(organPosition(cut, organ.id) !== null, true);
  }
  assert.deepEqual(validatePlantGraph(cut), []);

  const stem = graph.branches.get(graph.rootBranchId)!;
  const stemPlan = previewPrune(graph, stem.id, stem.activeLength * 0.7);
  assert.deepEqual(stemPlan.removedBranchIds, [
    "plant-1:group-1", "plant-1:group-2", "plant-1:group-3", "plant-1:group-4", "plant-1:group-5",
  ]);
  assert.deepEqual(stemPlan.removedOrganIds, [
    "plant-1:bloom-1", "plant-1:bloom-2", "plant-1:bloom-3", "plant-1:bloom-4", "plant-1:bloom-5",
  ]);
  const opened = applyPrune(graph, stemPlan);
  assert.equal(opened.organs.get("plant-1:leaf-1")!.active, true);
  assert.equal(opened.organs.get("plant-1:leaf-2")!.active, true);
  assert.equal(opened.branches.get("plant-1:petiole-1")!.active, true);
  for (const id of stemPlan.removedBranchIds) assert.equal(opened.branches.get(id)!.active, false);
  assert.deepEqual(validatePlantGraph(opened), []);
});

test("cancelled flower-volume insertion and prune write nothing; a committed prune reloads", () => {
  const saves: unknown[] = [];
  const coordinator = new TransactionCoordinator(createDomainAdapters(), {
    plants: new Map(),
    camera: canonicalCameraPose("front"),
    selectedPlantId: null,
    successfulPlantOrdinal: 0,
  }, { onAutosave: (event) => saves.push(event) });

  const prepared = prepareMaterialInsertionForApp("flower-volume", 0);
  assert.equal(prepared.ok, true);
  if (!prepared.ok) return;
  const reservation = {
    ordinal: prepared.ordinal,
    plantId: prepared.plantId,
    seed: prepared.seed,
    graph: prepared.graph,
  };
  coordinator.beginInsert("volume-cancel", reservation, {}, { base: BASE, valid: true });
  coordinator.pointerCancel("volume-cancel");
  assert.equal(coordinator.getDebugState().successfulPlantOrdinal, 0);
  assert.equal(coordinator.getDocumentSnapshot().plants.size, 0);
  assert.equal(saves.length, 0);

  coordinator.beginInsert("volume", reservation, {}, { base: BASE, valid: true });
  coordinator.release("volume");
  assert.equal(coordinator.getDebugState().successfulPlantOrdinal, 1);
  assert.equal(saves.length, 1);

  const seated = coordinator.getDocumentSnapshot().plants.get("plant-1")!;
  const bloom = seated.organs.get("plant-1:bloom-2")!;
  const intact = serializePlantGraph(seated);
  coordinator.commandTool("prune");
  const spec = {
    plantId: "plant-1",
    branchId: bloom.branchId,
    acquiredMaterialDistance: bloom.distance,
    context: {},
  };
  coordinator.beginPrune("cut-cancel", spec, { distance: bloom.distance });
  assert.equal(coordinator.getPresentationState().active?.kind, "prune");
  coordinator.pointerCancel("cut-cancel");
  assert.equal(coordinator.getPresentationState().active, null);
  assert.equal(saves.length, 1);
  assert.equal(serializePlantGraph(coordinator.getDocumentSnapshot().plants.get("plant-1")!), intact);
  assert.equal(coordinator.getDocumentSnapshot().plants.get("plant-1")!.organs.get(bloom.id)!.active, true);

  coordinator.beginPrune("cut", spec, { distance: bloom.distance });
  coordinator.release("cut");
  const edited = coordinator.getDocumentSnapshot().plants.get("plant-1")!;
  assert.equal(edited.organs.get(bloom.id)!.active, false);
  assert.equal(edited.organs.size, 7);
  assert.equal(edited.branches.size, 8);
  for (const organ of seated.organs.values()) {
    if (organ.id === bloom.id) continue;
    assert.equal(edited.organs.get(organ.id)!.active, true);
  }
  assert.equal(saves.length, 2);
  assert.deepEqual(validatePlantGraph(edited), []);

  const payload = JSON.parse(JSON.stringify({
    storageVersion: 1,
    nextSuccessfulOrdinal: 2,
    plants: [...coordinator.getDocumentSnapshot().plants.values()].map(toCanonicalPlantGraph),
  }));
  const app = Object.assign(Object.create(IkebanaApp.prototype), {
    config: { fresh: false },
    store: { load: () => payload },
  });
  const loaded = app.loadInitialDocument();
  assert.equal(loaded.successfulPlantOrdinal, 1);
  const reloaded = [...loaded.plants.values()][0]!;
  assert.equal(reloaded.generatorVersion, FLOWER_VOLUME_VERSION);
  assert.equal(reloaded.organs.get(bloom.id)!.active, false);
  assert.equal(reloaded.organs.get("plant-1:bloom-1")!.active, true);
  assert.equal(reloaded.organs.get("plant-1:leaf-1")!.active, true);
});
