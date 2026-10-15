import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { createSilverSeed, prepareMaterialInsertion, serializePlantGraph, deserializePlantGraph,
  validatePlantGraph, applyPrune, previewPrune, sampleBranch, bendBranch, aimBranch, add, organPosition,
} from "../../src/core/index.ts";
import { createWorkbenchFixture } from "../../src/app/workbench.ts";
import { SceneCommittedStore, SceneGardenStore } from "../../src/app/scenePersistence.ts";
import { canonicalCameraPose } from "../../src/app/camera.ts";
import { DEFAULT_SCENE, withBotanicalTones } from "../../src/app/scene.ts";
import { createDomainAdapters } from "../../src/app/domainAdapters.ts";
import { TransactionCoordinator } from "../../src/input/TransactionCoordinator.ts";
import { cutCue, materialName } from "../../src/app/craftCues.ts";
import type { PlantGraph } from "../../src/core/types.ts";
const BASE = { x: 0, y: .55, z: 0 }, SEEDS = [8278, 9255, 10232];
const discs = (g: PlantGraph) => [...g.organs.values()].filter(o => o.active);

test("silver-seed is deterministic at three seeds, additive, registered, and semantically dried fruit", () => {
  for (const seed of SEEDS) {
    const graph = createSilverSeed("plant-1", seed, BASE), bytes = serializePlantGraph(graph);
    assert.equal(serializePlantGraph(createSilverSeed("plant-1", seed, BASE)), bytes);
    assert.equal(serializePlantGraph(deserializePlantGraph(bytes)), bytes);
    assert.deepEqual(validatePlantGraph(graph), []);
    assert.equal(graph.generatorVersion, "silver-seed-v1");
    assert.equal(graph.branches.size, 10); assert.equal(graph.organs.size, 6);
    for (const organ of discs(graph)) {
      assert.equal(organ.kind, "seedpod");
      const support = graph.branches.get(organ.branchId)!;
      assert.equal(support.kind, "pedicel"); assert.ok(support.activeLength >= .26);
      assert.equal(organ.distance, support.activeLength);
      assert.equal(materialName(support, graph), "Seed-disc stem");
    }
  }
  const prepared = prepareMaterialInsertion("silver-seed", 1, BASE); assert.ok(prepared.ok);
  assert.deepEqual(JSON.parse(serializePlantGraph(prepared.graph)), JSON.parse(readFileSync("fixtures/plant-1-silver-seed-v1.json", "utf8")));
  assert.deepEqual(createWorkbenchFixture("round5-candidates", 8278, 2, { remember: false }).plants.map(p => p.generatorVersion), ["berry-twig-v1", "fern-frond-v1"]);
  const invalid = JSON.parse(serializePlantGraph(prepared.graph)); invalid.organs[0].kind = "future-pod";
  assert.throws(() => deserializePlantGraph(JSON.stringify(invalid)), /kind is unsupported/);
  invalid.generatorVersion = "silver-seed-future";
  assert.throws(() => deserializePlantGraph(JSON.stringify(invalid)), /Unsupported generatorVersion/);
});

test("upper seed cuts retain lower discs, and one stalk can aim or prune independently", () => {
  for (const seed of SEEDS) {
    const graph = createSilverSeed("plant-1", seed, BASE), before = serializePlantGraph(graph);
    const stem = graph.branches.get(graph.rootBranchId)!;
    const plan = previewPrune(graph, stem.id, stem.activeLength * .69);
    const cut = applyPrune(graph, plan);
    assert.equal(discs(cut).length, 4);
    assert.match(cutCue(graph, plan, true).detail, /2 seed discs/);
    for (const o of discs(cut)) assert.deepEqual(organPosition(cut, o.id), organPosition(graph, o.id));
    const disc = discs(graph)[0]!, point = organPosition(graph, disc.id)!;
    const aimed = aimBranch(graph, disc.branchId, point, add(point, { x: .18, y: .02, z: .1 }));
    const individualPlan = previewPrune(graph, disc.branchId, disc.distance * .5);
    const single = applyPrune(graph, individualPlan);
    assert.match(cutCue(graph, individualPlan, true).detail, /1 seed disc/);
    assert.notDeepEqual(organPosition(aimed, disc.id), point);
    assert.equal(discs(single).length, 5);
    for (const branch of graph.branches.values()) if (branch.id !== disc.branchId) {
      assert.deepEqual(aimed.branches.get(branch.id), branch); assert.deepEqual(single.branches.get(branch.id), branch);
    }
    for (const edited of [cut, single, aimed]) {
      assert.equal(edited.branches.size, graph.branches.size); assert.equal(edited.organs.size, graph.organs.size);
      assert.deepEqual(validatePlantGraph(edited), []);
      assert.equal(serializePlantGraph(deserializePlantGraph(serializePlantGraph(edited))), serializePlantGraph(edited));
    }
    const station = stem.activeLength * .54;
    const bent = bendBranch(graph, { branchId: stem.id, stationDistance: station, target: add(sampleBranch(stem, station).position, { x: .5, y: .07, z: -.3 }) });
    assert.notDeepEqual(bent.branches.get(stem.id)!.points, stem.points);
    for (const branch of graph.branches.values()) assert.deepEqual(bent.branches.get(branch.id)!.restLengths, branch.restLengths);
    assert.deepEqual(validatePlantGraph(bent), []);
    assert.equal(serializePlantGraph(graph), before);
  }
});

test("silver stock cancels insert, Aim, Bend and prune without saves or ordinal consumption", () => {
  let saves = 0;
  const coordinator = new TransactionCoordinator(createDomainAdapters(), {
    plants: new Map(), camera: canonicalCameraPose("front"), selectedPlantId: null, successfulPlantOrdinal: 0,
  }, { onAutosave: () => saves++ });
  const prep = prepareMaterialInsertion("silver-seed", 1, BASE); assert.ok(prep.ok);
  const reservation = { ordinal: prep.ordinal, plantId: prep.plantId, seed: prep.seed, graph: prep.graph };
  coordinator.beginInsert(1, reservation, {}, { base: BASE, valid: true }); coordinator.pointerCancel(1);
  assert.equal(saves, 0); assert.equal(coordinator.getDebugState().successfulPlantOrdinal, 0);
  coordinator.beginInsert(2, reservation, {}, { base: BASE, valid: true }); coordinator.release(2);
  const graph = coordinator.getDocumentSnapshot().plants.get("plant-1")!, before = serializePlantGraph(graph);
  const stem = graph.branches.get(graph.rootBranchId)!, station = stem.activeLength * .54;
  const target = add(sampleBranch(stem, station).position, { x: .4, y: .02, z: .2 });
  assert.ok(coordinator.beginAim(3, { plantId: graph.id, branchId: stem.id, grabbedMaterialDistance: station, context: {} }, { target }).ok);
  coordinator.pointerCancel(3);
  assert.ok(coordinator.beginBend(4, { plantId: graph.id, branchId: stem.id, beadStationDistance: station, touchMaterialDistance: station, context: {} }, { target }).ok);
  coordinator.pointerCancel(4); coordinator.commandTool("prune");
  const disc = discs(graph)[0]!;
  const spec = { plantId: graph.id, branchId: disc.branchId, acquiredMaterialDistance: .12, context: {} };
  assert.ok(coordinator.beginPrune(5, spec, { distance: .12 }).ok); coordinator.pointerCancel(5);
  assert.equal(saves, 1); assert.equal(serializePlantGraph(coordinator.getDocumentSnapshot().plants.get(graph.id)!), before);
  coordinator.beginPrune(6, spec, { distance: .12 }); coordinator.release(6);
  assert.equal(saves, 2); assert.equal(discs(coordinator.getDocumentSnapshot().plants.get(graph.id)!).length, 5);
  assert.equal(coordinator.getDebugState().successfulPlantOrdinal, 1);
});

test("seed-pod records and tones survive actual working, Garden backup, import and copy paths", () => {
  const map = new Map<string, string>();
  const storage = { getItem: (k: string) => map.get(k) ?? null, setItem: (k: string, v: string) => { map.set(k, v); } };
  const g = createSilverSeed("plant-1", 9255, BASE), stem = g.branches.get(g.rootBranchId)!;
  const plants = [JSON.parse(serializePlantGraph(applyPrune(g, previewPrune(g, stem.id, stem.activeLength * .69))))];
  const scene = withBotanicalTones(DEFAULT_SCENE, { "silver-seed": "straw" }), camera = canonicalCameraPose("front");
  const working = new SceneCommittedStore("working", undefined, () => ({ scene, camera }), storage);
  working.load(); assert.ok(working.save(2, plants)); assert.deepEqual(working.load()?.plants, plants);
  const garden = new SceneGardenStore("garden", undefined, storage); garden.load();
  garden.keep({ id: "silver", title: "Dry silver", thumbnail: null, keptAt: "2026-10-14T00:00:00Z", arrangement: { successfulPlantOrdinal: 1, plants, camera, scene } });
  const imported = new SceneGardenStore("import", undefined, storage); imported.load();
  assert.equal(imported.importBackup(garden.exportRaw()), 1);
  const entry = imported.load()!.entries[0]!;
  assert.deepEqual(entry.arrangement.plants, plants); assert.deepEqual(entry.arrangement.scene, scene);
  const copy = new SceneCommittedStore("copy", undefined, () => ({ scene: entry.arrangement.scene!, camera }), storage);
  copy.load(); assert.ok(copy.save(2, entry.arrangement.plants)); assert.deepEqual(copy.load()?.plants, plants);
  assert.deepEqual(copy.load()?.scene, scene);
  const backup = garden.exportRaw().replace('"seedpod"', '"future-pod"');
  const prior = imported.exportRaw(); assert.throws(() => imported.importBackup(backup)); assert.equal(imported.exportRaw(), prior);
});
