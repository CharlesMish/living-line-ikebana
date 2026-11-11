import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { createParasolLeaf, prepareMaterialInsertion, serializePlantGraph, deserializePlantGraph,
  validatePlantGraph, applyPrune, previewPrune, sampleBranch, bendBranch, aimBranch, add, organPosition,
  successfulSeatIdentity, getMaterialDefinitions, isSupportedGeneratorVersion,
} from "../../src/core/index.ts";
import { SceneCommittedStore, SceneGardenStore } from "../../src/app/scenePersistence.ts";
import { canonicalCameraPose } from "../../src/app/camera.ts";
import { DEFAULT_SCENE } from "../../src/app/scene.ts";
import { createDomainAdapters } from "../../src/app/domainAdapters.ts";
import { TransactionCoordinator } from "../../src/input/TransactionCoordinator.ts";
import { cutCue, materialName, shapeCue } from "../../src/app/craftCues.ts";
import type { PlantGraph } from "../../src/core/types.ts";

const BASE = { x: 0, y: 0.55, z: 0 };
const SEEDS = [8278, 9255, 10232];
const ORDINALS = [1, 2, 3, 17, 64];
const part = (graph: PlantGraph, name: string) => graph.branches.get(`${graph.id}:${name}`)!;
const activeOrgans = (graph: PlantGraph) => [...graph.organs.values()].filter(organ => organ.active);
const tipTangent = (points: readonly { x: number; y: number; z: number }[]) => {
  const a = points.at(-2)!, b = points.at(-1)!;
  const d = { x: b.x - a.x, y: b.y - a.y, z: b.z - a.z }, length = Math.hypot(d.x, d.y, d.z);
  return { x: d.x / length, y: d.y / length, z: d.z / length };
};

test("parasol-leaf is deterministic, additive, registered, and holds one open and one furled leaf", () => {
  for (const seed of SEEDS) {
    const graph = createParasolLeaf("plant-1", seed, BASE), bytes = serializePlantGraph(graph);
    assert.equal(serializePlantGraph(createParasolLeaf("plant-1", seed, BASE)), bytes);
    assert.equal(serializePlantGraph(deserializePlantGraph(bytes)), bytes);
    assert.deepEqual(validatePlantGraph(graph), []);
    assert.equal(graph.generatorVersion, "parasol-leaf-v1");
    assert.deepEqual([...graph.branches.keys()].sort(), ["plant-1:neck", "plant-1:shoot", "plant-1:stalk"]);
    assert.deepEqual([...graph.organs.keys()].sort(), ["plant-1:furl", "plant-1:leaf"]);
    const stalk = part(graph, "stalk"), neck = part(graph, "neck"), shoot = part(graph, "shoot");
    assert.equal(stalk.kind, "trunk"); assert.equal(neck.kind, "petiole"); assert.equal(shoot.kind, "lateral");
    // The open blade sits at the very tip of the neck, the neck at the very tip of the stalk.
    assert.equal(neck.parentDistance, stalk.activeLength);
    const leaf = graph.organs.get("plant-1:leaf")!, furl = graph.organs.get("plant-1:furl")!;
    assert.equal(leaf.kind, "leaf"); assert.equal(leaf.branchId, neck.id); assert.equal(leaf.distance, neck.activeLength);
    assert.equal(furl.kind, "bud"); assert.equal(furl.branchId, shoot.id); assert.equal(furl.distance, shoot.activeLength);
    // Existing organ kinds only: no schema, serializer or validator change.
    assert.equal(graph.schemaVersion, 1);
    assert.equal(materialName(stalk, graph), "Main stem");
    assert.equal(materialName(neck, graph), "Leaf stem");
    assert.equal(materialName(shoot, graph), "Young leaf stem");
    assert.equal(shapeCue(shoot, "bend", false, graph).title, "Bend young leaf stem");
  }
  const prepared = prepareMaterialInsertion("parasol-leaf", 1, BASE); assert.ok(prepared.ok);
  assert.deepEqual(JSON.parse(serializePlantGraph(prepared.graph)),
    JSON.parse(readFileSync("fixtures/plant-1-parasol-leaf-v1.json", "utf8")));
  assert.equal(getMaterialDefinitions().find(entry => entry.materialId === "parasol-leaf")?.generator.generatorVersion, "parasol-leaf-v1");
  assert.equal(isSupportedGeneratorVersion("parasol-leaf-v1"), true);
  const future = JSON.parse(serializePlantGraph(prepared.graph)); future.generatorVersion = "parasol-leaf-v2";
  assert.throws(() => deserializePlantGraph(JSON.stringify(future)), /Unsupported generatorVersion/);
});

test("the rest pose is a tilted plane held away from its root, with the young leaf clear beneath it", () => {
  for (const ordinal of ORDINALS) {
    const { id, seed } = successfulSeatIdentity(ordinal);
    const graph = createParasolLeaf(id, seed, BASE);
    const stalk = part(graph, "stalk"), neck = part(graph, "neck"), shoot = part(graph, "shoot");
    assert.ok(stalk.activeLength >= 1.7 && stalk.activeLength <= 2.7, `stalk length ${stalk.activeLength}`);
    // Bend-eligible stalks; the neck is a petiole and stays a rigid aim lever.
    assert.ok(stalk.points.length >= 4 && shoot.points.length >= 4);
    assert.equal(neck.stiffness, 0.18);
    // The blade's normal is the neck tangent: tilted enough to read as a disc
    // from a level front view, never flat and never on edge.
    const normal = tipTangent(neck.points);
    const tilt = Math.acos(normal.y) * 180 / Math.PI;
    assert.ok(tilt > 24 && tilt < 48, `ordinal ${ordinal} blade tilt ${tilt}`);
    // ...and it tilts toward the side the stalk leans to.
    const centre = neck.points.at(-1)!;
    const lean = { x: centre.x - BASE.x, z: centre.z - BASE.z };
    assert.ok(normal.x * lean.x + normal.z * lean.z > 0, "blade faces the lean");
    assert.ok(Math.hypot(lean.x, lean.z) > 0.3, "blade sits away from its root");
    // The young stalk leaves below the minimum trunk cut, so a main-stalk cut
    // can never take it.
    assert.ok(shoot.parentDistance < 0.62 - 0.3);
    // The furled leaf (0.62 tall at scale 1) stays beneath the blade's plane.
    const furl = graph.organs.get(`${id}:furl`)!, along = tipTangent(shoot.points), tip = shoot.points.at(-1)!;
    const top = add(tip, { x: along.x * 0.62 * furl.scale, y: along.y * 0.62 * furl.scale, z: along.z * 0.62 * furl.scale });
    const below = -((top.x - centre.x) * normal.x + (top.y - centre.y) * normal.y + (top.z - centre.z) * normal.z);
    assert.ok(below > 0.45, `ordinal ${ordinal} furled leaf clears the blade by ${below}`);
    assert.ok(top.y < centre.y - 0.25, "the young leaf is the lower of the two");
    // It also leaves the main stalk's line, so each stalk can be picked.
    const stalkAtTip = sampleBranch(stalk, Math.min(stalk.activeLength, shoot.parentDistance + shoot.activeLength)).position;
    assert.ok(Math.hypot(tip.x - stalkAtTip.x, tip.y - stalkAtTip.y, tip.z - stalkAtTip.z) > 0.28);
  }
});

test("three cuts give three silhouettes, and every cut is exact retained history", () => {
  for (const seed of SEEDS) {
    const graph = createParasolLeaf("plant-1", seed, BASE), before = serializePlantGraph(graph);
    const stalk = part(graph, "stalk"), neck = part(graph, "neck"), shoot = part(graph, "shoot");

    // 1. Cut the young stalk: the open leaf alone.
    const shootPlan = previewPrune(graph, shoot.id, shoot.activeLength * 0.5);
    assert.match(cutCue(graph, shootPlan, true).title, /Cut young leaf stem/);
    assert.match(cutCue(graph, shootPlan, true).detail, /1 furled leaf/);
    const openOnly = applyPrune(graph, shootPlan);
    assert.deepEqual(activeOrgans(openOnly).map(o => o.kind), ["leaf"]);
    assert.deepEqual(openOnly.branches.get(stalk.id), stalk); assert.deepEqual(openOnly.branches.get(neck.id), neck);

    // 2. Cut the main stalk at its lowest legal station: the furled leaf alone.
    const stalkPlan = previewPrune(graph, stalk.id, 0.62);
    assert.equal(stalkPlan.distance, 0.62);
    assert.match(cutCue(graph, stalkPlan, true).detail, /1 attached stem, 1 leaf/);
    const furledOnly = applyPrune(graph, stalkPlan);
    assert.deepEqual(activeOrgans(furledOnly).map(o => o.kind), ["bud"]);
    assert.equal(furledOnly.branches.get(shoot.id)!.active, true);
    assert.deepEqual(furledOnly.branches.get(shoot.id), shoot);
    assert.deepEqual(organPosition(furledOnly, "plant-1:furl"), organPosition(graph, "plant-1:furl"));
    assert.equal(furledOnly.branches.get(neck.id)!.active, false, "the neck is retained as inactive history");

    // 3. Cut the neck: a bare stalk beside the young leaf.
    const neckPlan = previewPrune(graph, neck.id, neck.activeLength * 0.5);
    assert.match(cutCue(graph, neckPlan, true).title, /Cut leaf stem/);
    assert.match(cutCue(graph, neckPlan, true).detail, /1 leaf/);
    const bare = applyPrune(graph, neckPlan);
    assert.deepEqual(activeOrgans(bare).map(o => o.kind), ["bud"]);
    assert.deepEqual(bare.branches.get(stalk.id), stalk);

    for (const edited of [openOnly, furledOnly, bare]) {
      assert.equal(edited.branches.size, 3); assert.equal(edited.organs.size, 2);
      assert.deepEqual(validatePlantGraph(edited), []);
      assert.equal(serializePlantGraph(deserializePlantGraph(serializePlantGraph(edited))), serializePlantGraph(edited));
    }
    assert.equal(serializePlantGraph(graph), before);
  }
});

test("aiming the neck tilts only the blade; bending a stalk keeps every rest length", () => {
  for (const seed of SEEDS) {
    const graph = createParasolLeaf("plant-1", seed, BASE), before = serializePlantGraph(graph);
    const stalk = part(graph, "stalk"), neck = part(graph, "neck"), shoot = part(graph, "shoot");
    const centre = organPosition(graph, "plant-1:leaf")!;
    const tilted = aimBranch(graph, neck.id, centre, add(centre, { x: 0.09, y: -0.03, z: 0.07 }));
    assert.notDeepEqual(tilted.branches.get(neck.id)!.points.at(-1), neck.points.at(-1));
    assert.deepEqual(tilted.branches.get(neck.id)!.points[0], neck.points[0], "the neck pivots at the stalk tip");
    assert.deepEqual(tilted.branches.get(stalk.id), stalk); assert.deepEqual(tilted.branches.get(shoot.id), shoot);
    assert.deepEqual(tilted.branches.get(neck.id)!.restLengths, neck.restLengths);

    for (const branch of [stalk, shoot]) {
      const station = branch.activeLength * 0.54;
      const bent = bendBranch(graph, { branchId: branch.id, stationDistance: station,
        target: add(sampleBranch(branch, station).position, { x: 0.4, y: 0.05, z: -0.25 }) });
      assert.notDeepEqual(bent.branches.get(branch.id)!.points, branch.points);
      for (const original of graph.branches.values()) assert.deepEqual(bent.branches.get(original.id)!.restLengths, original.restLengths);
      assert.deepEqual(validatePlantGraph(bent), []);
    }
    for (const edited of [tilted]) assert.deepEqual(validatePlantGraph(edited), []);
    assert.equal(serializePlantGraph(graph), before);
  }
});

test("cancelled insert, Aim, Bend and prune write nothing and never consume an ordinal", () => {
  let saves = 0;
  const coordinator = new TransactionCoordinator(createDomainAdapters(), {
    plants: new Map(), camera: canonicalCameraPose("front"), selectedPlantId: null, successfulPlantOrdinal: 0,
  }, { onAutosave: () => saves++ });
  const prep = prepareMaterialInsertion("parasol-leaf", 1, BASE); assert.ok(prep.ok);
  const reservation = { ordinal: prep.ordinal, plantId: prep.plantId, seed: prep.seed, graph: prep.graph };
  coordinator.beginInsert(1, reservation, {}, { base: BASE, valid: true }); coordinator.pointerCancel(1);
  assert.equal(saves, 0); assert.equal(coordinator.getDebugState().successfulPlantOrdinal, 0);
  coordinator.beginInsert(2, reservation, {}, { base: BASE, valid: true }); coordinator.release(2);
  const graph = coordinator.getDocumentSnapshot().plants.get("plant-1")!, before = serializePlantGraph(graph);
  const stalk = graph.branches.get(graph.rootBranchId)!, station = stalk.activeLength * 0.54;
  const target = add(sampleBranch(stalk, station).position, { x: 0.4, y: 0.02, z: 0.2 });
  assert.ok(coordinator.beginAim(3, { plantId: graph.id, branchId: stalk.id, grabbedMaterialDistance: station, context: {} }, { target }).ok);
  coordinator.pointerCancel(3);
  assert.ok(coordinator.beginBend(4, { plantId: graph.id, branchId: stalk.id, beadStationDistance: station, touchMaterialDistance: station, context: {} }, { target }).ok);
  coordinator.pointerCancel(4); coordinator.commandTool("prune");
  const spec = { plantId: graph.id, branchId: "plant-1:shoot", acquiredMaterialDistance: 0.2, context: {} };
  assert.ok(coordinator.beginPrune(5, spec, { distance: 0.2 }).ok); coordinator.pointerCancel(5);
  assert.equal(saves, 1); assert.equal(serializePlantGraph(coordinator.getDocumentSnapshot().plants.get(graph.id)!), before);
  coordinator.beginPrune(6, spec, { distance: 0.2 }); coordinator.release(6);
  assert.equal(saves, 2);
  assert.deepEqual(activeOrgans(coordinator.getDocumentSnapshot().plants.get(graph.id)!).map(o => o.kind), ["leaf"]);
  assert.equal(coordinator.getDebugState().successfulPlantOrdinal, 1);
});

test("a pruned parasol leaf survives working save, Garden backup, import and copy; an unknown version imports nothing", () => {
  const map = new Map<string, string>();
  const storage = { getItem: (k: string) => map.get(k) ?? null, setItem: (k: string, v: string) => { map.set(k, v); } };
  const g = createParasolLeaf("plant-1", 9255, BASE), shoot = part(g, "shoot");
  const plants = [JSON.parse(serializePlantGraph(applyPrune(g, previewPrune(g, shoot.id, shoot.activeLength * 0.5))))];
  const scene = DEFAULT_SCENE, camera = canonicalCameraPose("front");
  const working = new SceneCommittedStore("working", undefined, () => ({ scene, camera }), storage);
  working.load(); assert.ok(working.save(2, plants)); assert.deepEqual(working.load()?.plants, plants);
  const garden = new SceneGardenStore("garden", undefined, storage); garden.load();
  garden.keep({ id: "parasol", title: "Held over water", thumbnail: null, keptAt: "2026-11-10T00:00:00Z",
    arrangement: { successfulPlantOrdinal: 1, plants, camera, scene } });
  const imported = new SceneGardenStore("import", undefined, storage); imported.load();
  assert.equal(imported.importBackup(garden.exportRaw()), 1);
  const entry = imported.load()!.entries[0]!;
  assert.deepEqual(entry.arrangement.plants, plants);
  const copy = new SceneCommittedStore("copy", undefined, () => ({ scene: entry.arrangement.scene!, camera }), storage);
  copy.load(); assert.ok(copy.save(2, entry.arrangement.plants)); assert.deepEqual(copy.load()?.plants, plants);
  // A reader without this generator refuses the whole backup instead of
  // substituting another cutting: the same law an older build applies to v1.
  const unknown = garden.exportRaw().replaceAll("parasol-leaf-v1", "parasol-leaf-v9");
  const prior = imported.exportRaw(); assert.throws(() => imported.importBackup(unknown)); assert.equal(imported.exportRaw(), prior);
});
