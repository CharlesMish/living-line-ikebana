import assert from "node:assert/strict";
import test from "node:test";
import volumeFixture from "../../fixtures/plant-1-flower-volume-v1.json";
import compactFixture from "../../fixtures/plant-1-compact-flower-v1.json";
import { canonicalCameraPose } from "../../src/app/camera.ts";
import { createDomainAdapters } from "../../src/app/domainAdapters.ts";
import { prepareMaterialInsertionForApp } from "../../src/app/materialInsertion.ts";
import { createWorkbenchFixture, describeFixture } from "../../src/app/workbench.ts";
import {
  COMPACT_FLOWER_VERSION, add, aimBranch, applyPrune, bendBranch, createCompactFlower,
  createFlowerVolume, deserializePlantGraph, getMaterialDefinition, organPosition,
  prepareMaterialInsertion, previewPrune, sampleBranch, serializePlantGraph, validatePlantGraph,
} from "../../src/core/index.ts";
import { TransactionCoordinator } from "../../src/input/index.ts";
import { getMaterialAppearance } from "../../src/presentation/materialAppearance.ts";

const BASE = { x: 0, y: 0.55, z: 0 };
const SEEDS = [8278, 9255, 10232];

test("compact flower is additive; original packed volume and named profiles keep their graphs", () => {
  const material = getMaterialDefinition("compact-flower")!;
  assert.equal(material.generator.generate, createCompactFlower);
  assert.equal(material.generator.generatorVersion, COMPACT_FLOWER_VERSION);
  assert.deepEqual(JSON.parse(serializePlantGraph(createFlowerVolume("plant-1", 8278, BASE))), volumeFixture);
  const frozen = describeFixture(createWorkbenchFixture("round3-three", 8278, 6, { remember: false }));
  assert.deepEqual(frozen.plantsInIdentityOrder.map((plant) => plant.generatorVersion), [
    "reed-v1", "flower-volume-v1", "arching-trailer-v1", "reed-v1", "flower-volume-v1", "arching-trailer-v1",
  ]);
  const prepared = prepareMaterialInsertion("compact-flower", 1, BASE);
  assert.equal(prepared.ok, true);
  if (prepared.ok) assert.deepEqual(JSON.parse(serializePlantGraph(prepared.graph)), compactFixture);
});

test("compact flower keeps exactly one terminal head on a separate stalk, deterministically", () => {
  const strings: string[] = [];
  for (const seed of SEEDS) {
    const graph = createCompactFlower("plant-1", seed, BASE);
    const serialized = serializePlantGraph(graph);
    strings.push(serialized);
    assert.equal(serialized, serializePlantGraph(createCompactFlower("plant-1", seed, BASE)));
    assert.deepEqual(validatePlantGraph(graph), []);
    assert.equal(serializePlantGraph(deserializePlantGraph(serialized)), serialized);
    assert.equal(graph.branches.size, 4);
    assert.equal(graph.organs.size, 3);
    const stem = graph.branches.get(graph.rootBranchId)!;
    assert.ok(stem.activeLength >= 3.25 && stem.activeLength <= 3.42);
    const blooms = [...graph.organs.values()].filter((organ) => organ.kind === "bloom");
    assert.equal(blooms.length, 1);
    const bloom = blooms[0]!;
    const stalk = graph.branches.get(bloom.branchId)!;
    assert.equal(stalk.kind, "pedicel");
    assert.equal(stalk.parentId, stem.id);
    assert.equal(stalk.parentDistance, stem.activeLength, "no stem tip protrudes beyond its terminal attachment");
    assert.equal(bloom.distance, stalk.activeLength);
    assert.ok(stalk.activeLength >= 0.4 && stalk.activeLength <= 0.435);
    assert.ok(bloom.scale < 1.03);
    const leaves = [...graph.organs.values()].filter((organ) => organ.kind === "leaf");
    assert.equal(leaves.length, 2);
    assert.ok(leaves.every((leaf) => graph.branches.get(leaf.branchId)!.parentDistance < stem.activeLength * 0.55));
  }
  assert.equal(new Set(strings).size, 3, "different seeds produce different persistent specimens");
  const appearance = getMaterialAppearance(COMPACT_FLOWER_VERSION);
  assert.equal(appearance.bloom.form, "tufted");
  assert.equal(appearance.bloom.hitRadius, getMaterialAppearance("flower-volume-v1").bloom.hitRadius);
});

test("aiming the compact head changes its stalk without turning the stem or leaves", () => {
  for (const seed of SEEDS) {
    const graph = createCompactFlower("plant-1", seed, BASE);
    const before = serializePlantGraph(graph);
    const bloom = graph.organs.get("plant-1:bloom")!;
    const pedicel = graph.branches.get(bloom.branchId)!;
    const grip = organPosition(graph, bloom.id)!;
    const aimed = aimBranch(graph, pedicel.id, grip, add(grip, { x: 0.4, y: -0.16, z: 0.3 }));
    assert.notDeepEqual(organPosition(aimed, bloom.id), grip);
    for (const branch of graph.branches.values()) {
      assert.deepEqual(aimed.branches.get(branch.id)!.restLengths, branch.restLengths);
      if (branch.id !== pedicel.id) assert.deepEqual(aimed.branches.get(branch.id), branch);
    }
    for (const leaf of [...graph.organs.values()].filter((organ) => organ.kind === "leaf")) {
      assert.deepEqual(organPosition(aimed, leaf.id), organPosition(graph, leaf.id));
    }
    assert.equal(serializePlantGraph(graph), before);
    assert.deepEqual(validatePlantGraph(aimed), []);
  }
});

test("bending the compact stem preserves stock, seeded details and reloadable attachments", () => {
  const graph = createCompactFlower("plant-1", 8278, BASE);
  const before = serializePlantGraph(graph);
  const stem = graph.branches.get(graph.rootBranchId)!;
  const station = stem.activeLength * 0.54;
  const bent = bendBranch(graph, {
    branchId: stem.id, stationDistance: station,
    target: add(sampleBranch(stem, station).position, { x: 0.8, y: 0.1, z: -0.4 }),
  });
  assert.notDeepEqual(bent.branches.get(stem.id)!.points, stem.points);
  for (const branch of graph.branches.values()) {
    assert.deepEqual(bent.branches.get(branch.id)!.restLengths, branch.restLengths);
  }
  for (const organ of graph.organs.values()) assert.deepEqual(bent.organs.get(organ.id), organ);
  assert.deepEqual(validatePlantGraph(bent), []);
  assert.equal(serializePlantGraph(deserializePlantGraph(serializePlantGraph(bent))), serializePlantGraph(bent));
  assert.equal(serializePlantGraph(graph), before);
});

test("a compact head cut removes one bloom and retains leaves and inactive history", () => {
  const graph = createCompactFlower("plant-1", 8278, BASE);
  const before = serializePlantGraph(graph);
  const bloom = graph.organs.get("plant-1:bloom")!;
  const plan = previewPrune(graph, bloom.branchId, bloom.distance);
  assert.equal(serializePlantGraph(graph), before);
  assert.deepEqual(plan.removedOrganIds, [bloom.id]);
  assert.deepEqual(plan.removedBranchIds, []);
  const cut = applyPrune(graph, plan);
  assert.equal(cut.organs.get(bloom.id)!.active, false);
  assert.equal(cut.branches.size, graph.branches.size);
  assert.equal(cut.organs.size, graph.organs.size);
  for (const branch of graph.branches.values()) {
    if (branch.id !== bloom.branchId) assert.deepEqual(cut.branches.get(branch.id), branch);
  }
  for (const organ of graph.organs.values()) {
    if (organ.id !== bloom.id) assert.deepEqual(cut.organs.get(organ.id), organ);
  }
  assert.deepEqual(validatePlantGraph(cut), []);
  assert.equal(serializePlantGraph(deserializePlantGraph(serializePlantGraph(cut))), serializePlantGraph(cut));
});

test("compact insertion and cut cancellation neither save nor consume the reserved identity", () => {
  const saves: unknown[] = [];
  const coordinator = new TransactionCoordinator(createDomainAdapters(), {
    plants: new Map(), camera: canonicalCameraPose("front"), selectedPlantId: null, successfulPlantOrdinal: 0,
  }, { onAutosave: (event) => saves.push(event) });
  const prepared = prepareMaterialInsertionForApp("compact-flower", 0);
  assert.equal(prepared.ok, true);
  if (!prepared.ok) return;
  const reservation = { ordinal: prepared.ordinal, plantId: prepared.plantId, seed: prepared.seed, graph: prepared.graph };
  coordinator.beginInsert("cancel-seat", reservation, {}, { base: BASE, valid: true });
  coordinator.pointerCancel("cancel-seat");
  assert.equal(coordinator.getDebugState().successfulPlantOrdinal, 0);
  assert.equal(coordinator.getDocumentSnapshot().plants.size, 0);
  assert.equal(saves.length, 0);
  coordinator.beginInsert("seat", reservation, {}, { base: BASE, valid: true });
  coordinator.release("seat");
  const seated = coordinator.getDocumentSnapshot().plants.get("plant-1")!;
  const before = serializePlantGraph(seated);
  const bloom = seated.organs.get("plant-1:bloom")!;
  coordinator.commandTool("prune");
  const spec = { plantId: seated.id, branchId: bloom.branchId, acquiredMaterialDistance: bloom.distance, context: {} };
  coordinator.beginPrune("cancel-cut", spec, { distance: bloom.distance });
  coordinator.pointerCancel("cancel-cut");
  assert.equal(serializePlantGraph(coordinator.getDocumentSnapshot().plants.get(seated.id)!), before);
  assert.equal(saves.length, 1);
  coordinator.beginPrune("cut", spec, { distance: bloom.distance });
  coordinator.release("cut");
  const cut = coordinator.getDocumentSnapshot().plants.get(seated.id)!;
  assert.equal(cut.organs.get(bloom.id)!.active, false);
  assert.equal(saves.length, 2);
  assert.equal(coordinator.getDebugState().successfulPlantOrdinal, 1);
});
