import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { createStarryPincushion, prepareMaterialInsertion, serializePlantGraph, deserializePlantGraph,
  validatePlantGraph, applyPrune, previewPrune, sampleBranch, bendBranch, aimBranch, add, organPosition,
} from "../../src/core/index.ts";
import { SceneCommittedStore, SceneGardenStore } from "../../src/app/scenePersistence.ts";
import { canonicalCameraPose } from "../../src/app/camera.ts";
import { DEFAULT_SCENE, withBotanicalTones } from "../../src/app/scene.ts";
import { createDomainAdapters } from "../../src/app/domainAdapters.ts";
import { prepareMaterialInsertionForApp } from "../../src/app/materialInsertion.ts";
import { TransactionCoordinator } from "../../src/input/TransactionCoordinator.ts";
import { assertAttachmentCoincidence, assertRestLengthsPreserved } from "./helpers.ts";
const BASE = { x: 0, y: .55, z: 0 };
const SEEDS = [8278, 9255, 10232];

test("starry stock is deterministic, separately versioned and reloadable across three seat seeds", () => {
  const unique = new Set<string>();
  for (const seed of SEEDS) {
    const graph = createStarryPincushion("plant-1", seed, BASE), bytes = serializePlantGraph(graph);
    unique.add(bytes);
    assert.equal(serializePlantGraph(createStarryPincushion("plant-1", seed, BASE)), bytes);
    assert.equal(serializePlantGraph(deserializePlantGraph(bytes)), bytes);
    assert.deepEqual(validatePlantGraph(graph), []);
    assert.equal(graph.schemaVersion, 1);
    assert.equal(graph.generatorVersion, "starry-pincushion-v1");
    assert.equal(graph.branches.size, 9);
    assert.equal([...graph.organs.values()].filter(o => o.kind === "bloom").length, 3);
    assertAttachmentCoincidence(graph);
  }
  assert.equal(unique.size, 3);
  const prepared = prepareMaterialInsertion("starry-pincushion", 1, BASE);
  assert.ok(prepared.ok);
  assert.deepEqual(JSON.parse(serializePlantGraph(prepared.graph)), JSON.parse(readFileSync("fixtures/plant-1-starry-pincushion-v1.json", "utf8")));
});

test("upper starry cuts retain two unchanged lower heads; a head-stalk cut affects only its own bloom", () => {
  for (const seed of SEEDS) {
    const graph = createStarryPincushion("plant-1", seed, BASE), before = serializePlantGraph(graph);
    const stem = graph.branches.get(graph.rootBranchId)!;
    const cut = applyPrune(graph, previewPrune(graph, stem.id, stem.activeLength * .7));
    const survivors = [...cut.organs.values()].filter(o => o.kind === "bloom" && o.active);
    assert.equal(survivors.length, 2);
    assert.equal(cut.branches.size, graph.branches.size);
    assert.equal(cut.organs.size, graph.organs.size);
    for (const organ of survivors) {
      assert.deepEqual(cut.organs.get(organ.id), graph.organs.get(organ.id));
      assert.deepEqual(organPosition(cut, organ.id), organPosition(graph, organ.id));
    }
    const head = graph.organs.get("plant-1:head-1")!;
    const headCut = applyPrune(graph, previewPrune(graph, head.branchId, head.distance * .5));
    assert.equal(headCut.organs.get(head.id)!.active, false);
    for (const organ of graph.organs.values()) if (organ.id !== head.id) assert.deepEqual(headCut.organs.get(organ.id), organ);
    assertAttachmentCoincidence(cut); assertAttachmentCoincidence(headCut);
    assert.deepEqual(validatePlantGraph(cut), []);
    assert.equal(serializePlantGraph(deserializePlantGraph(serializePlantGraph(cut))), serializePlantGraph(cut));
    assert.equal(serializePlantGraph(graph), before);
  }
});

test("starry root, arms and heads Aim coherently; bend keeps stock lengths and all organ identities", () => {
  for (const seed of SEEDS) {
    const graph = createStarryPincushion("plant-1", seed, BASE), before = serializePlantGraph(graph);
    for (const id of [graph.rootBranchId, "plant-1:arm-2", "plant-1:head-stalk-1"]) {
      const branch = graph.branches.get(id)!, grip = sampleBranch(branch, branch.activeLength).position;
      const aimed = aimBranch(graph, id, grip, add(grip, { x: .2, y: .1, z: -.2 }));
      assert.notDeepEqual(aimed.branches.get(id)!.points, branch.points);
      assertRestLengthsPreserved(graph, aimed); assertAttachmentCoincidence(aimed);
      assert.deepEqual(validatePlantGraph(aimed), []);
    }
    const stem = graph.branches.get(graph.rootBranchId)!, station = stem.activeLength * .5;
    const bent = bendBranch(graph, { branchId: stem.id, stationDistance: station,
      target: add(sampleBranch(stem, station).position, { x: .5, y: 0, z: -.3 }) });
    assert.notDeepEqual(bent.branches.get(stem.id)!.points, stem.points);
    assertRestLengthsPreserved(graph, bent); assertAttachmentCoincidence(bent);
    for (const organ of graph.organs.values()) assert.deepEqual(bent.organs.get(organ.id), organ);
    assert.equal(serializePlantGraph(graph), before);
  }
});

test("cancelled starry insertion, Aim, Bend and prune preserve document and successful-seat ordinal", () => {
  let saves = 0;
  const coordinator = new TransactionCoordinator(createDomainAdapters(), {
    plants: new Map(), camera: canonicalCameraPose("front"), selectedPlantId: null, successfulPlantOrdinal: 0,
  }, { onAutosave: () => saves++ });
  const prepared = prepareMaterialInsertionForApp("starry-pincushion", 0); assert.ok(prepared.ok);
  const reservation = { ordinal: prepared.ordinal, plantId: prepared.plantId, seed: prepared.seed, graph: prepared.graph };
  coordinator.beginInsert(1, reservation, {}, { base: BASE, valid: true }); coordinator.pointerCancel(1);
  assert.equal(saves, 0); assert.equal(coordinator.getDebugState().successfulPlantOrdinal, 0);
  coordinator.beginInsert(2, reservation, {}, { base: BASE, valid: true }); coordinator.release(2);
  const graph = coordinator.getDocumentSnapshot().plants.get("plant-1")!, before = serializePlantGraph(graph);
  const branch = graph.branches.get(graph.rootBranchId)!, station = branch.activeLength * .54;
  const target = add(sampleBranch(branch, station).position, { x: .6, y: .1, z: .5 });
  assert.ok(coordinator.beginAim(3, { plantId: graph.id, branchId: branch.id, grabbedMaterialDistance: station, context: {} }, { target }).ok);
  coordinator.pointerCancel(3);
  assert.ok(coordinator.beginBend(4, { plantId: graph.id, branchId: branch.id, beadStationDistance: station, touchMaterialDistance: station, context: {} }, { target }).ok);
  coordinator.pointerCancel(4); coordinator.commandTool("prune");
  assert.ok(coordinator.beginPrune(5, { plantId: graph.id, branchId: "plant-1:head-stalk-1", acquiredMaterialDistance: .08, context: {} }, { distance: .08 }).ok);
  coordinator.pointerCancel(5); coordinator.release(5);
  assert.equal(saves, 1); assert.equal(coordinator.getDebugState().successfulPlantOrdinal, 1);
  assert.equal(serializePlantGraph(coordinator.getDocumentSnapshot().plants.get(graph.id)!), before);
});

test("starry material and plum tone survive working save, Garden backup/import and working copy", () => {
  const items = new Map<string, string>();
  const storage = { getItem: (k: string) => items.get(k) ?? null, setItem: (k: string, v: string) => { items.set(k, v); } };
  const plants = [JSON.parse(serializePlantGraph(createStarryPincushion("plant-1", 8278, BASE)))];
  const scene = withBotanicalTones(DEFAULT_SCENE, { "starry-pincushion": "plum" }), camera = canonicalCameraPose("front");
  const working = new SceneCommittedStore("working", undefined, () => ({ scene, camera }), storage);
  working.load(); assert.equal(working.save(2, plants), true); assert.deepEqual(working.load()?.plants, plants);
  const garden = new SceneGardenStore("garden", undefined, storage); garden.load();
  garden.keep({ id: "starry", title: "Starry study", thumbnail: null, keptAt: "2026-10-14T00:00:00Z",
    arrangement: { successfulPlantOrdinal: 1, plants, camera, scene } });
  const imported = new SceneGardenStore("import", undefined, storage); imported.load();
  assert.equal(imported.importBackup(garden.exportRaw()), 1);
  const entry = imported.load()!.entries[0]!; assert.deepEqual(entry.arrangement.plants, plants);
  const copy = new SceneCommittedStore("copy", undefined, () => ({ scene: entry.arrangement.scene!, camera }), storage);
  copy.load(); assert.ok(copy.save(2, entry.arrangement.plants)); assert.deepEqual(copy.load()?.scene, scene);
});
