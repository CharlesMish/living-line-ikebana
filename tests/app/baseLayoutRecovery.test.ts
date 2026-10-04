import assert from "node:assert/strict";
import test from "node:test";
import { createDomainAdapters } from "../../src/app/domainAdapters.ts";
import { StemPrevention } from "../../src/app/stemPrevention.ts";
import { TransactionCoordinator } from "../../src/input/TransactionCoordinator.ts";
import { canonicalCameraPose } from "../../src/app/camera.ts";
import { DEFAULT_SCENE } from "../../src/app/scene.ts";
import { parseSceneStudio, SceneGardenStore } from "../../src/app/scenePersistence.ts";
import { VESSEL_PROFILES, inPlantingArea, constrainBaseToProfile, profileBaseRadius, type VesselProfile } from "../../src/study/vesselProfiles.ts";
import { createReed, createFloweringBranch, applyPrune, previewPrune, serializePlantGraph, toCanonicalPlantGraph, type PlantGraph, type Vec3 } from "../../src/core/index.ts";
import { assertRestLengthsPreserved, assertAttachmentCoincidence } from "../core/helpers.ts";

const point = (x: number, z = 0): Vec3 => ({ x, y: .55, z });
const profile = (id: string) => VESSEL_PROFILES.find(p => p.id === id)!;
const root = (graph: PlantGraph) => graph.branches.get(graph.rootBranchId)!.points[0];
function setup(plants: PlantGraph[], protectedOn: boolean) {
  let current = profile("vessel-pair"), c: any, writes = 0;
  const protection = new StemPrevention(() => protectedOn, () => c.getDocumentSnapshot().plants.values());
  c = new TransactionCoordinator(createDomainAdapters(protection, () => current), {
    plants: new Map(plants.map(g => [g.id, g])), selectedPlantId: plants[0].id,
    camera: canonicalCameraPose("above"), successfulPlantOrdinal: 2,
  }, { onAutosave: () => writes++ });
  return { c, protection, writes: () => writes, switchTo(p: VesselProfile) { current = p; } };
}
const active = (c: any): PlantGraph => c.getPresentationState().active.graph;
const stored = (c: any, id = "plant-1"): PlantGraph => c.getDocumentSnapshot().plants.get(id);

for (const destination of VESSEL_PROFILES) for (const protectedOn of [false, true]) {
  test(`${destination.id}, protection ${protectedOn}: remote base acquisition/no-motion release, recovery, cancel and Undo`, () => {
    for (const x of [-1.65, 1.65]) {
      const original = createReed("plant-1", 8278, point(x, .13));
      const other = createReed("plant-2", 9255, point(5, 5));
      const h = setup([original, other], protectedOn), { c } = h;
      h.switchTo(destination);
      const before = serializePlantGraph(original), spec = { plantId: original.id, context: {} };
      const start = root(original), area = destination.areas[x < 0 ? 0 : destination.areas.length - 1];
      const target = point(area.x, area.z);
      c.beginBase(1, spec, { base: start });
      assert.equal(serializePlantGraph(active(c)), before, "acquiring does not translate the old base");
      assert.equal(h.protection.feedback.reason, "clear");
      c.release(1);
      assert.equal(serializePlantGraph(stored(c)), before, "a click does not move or fit the graph");
      assert.equal(c.canUndo(), false, "no-motion release creates no botanical checkpoint");
      const writes = h.writes();
      c.beginBase(2, spec, { base: start }); c.updateBase(2, { base: target });
      assert.ok(inPlantingArea(root(active(c)), destination));
      c.pointerCancel(2);
      assert.equal(serializePlantGraph(stored(c)), before); assert.equal(h.writes(), writes);
      c.beginBase(3, spec, { base: start }); c.updateBase(3, { base: target });
      const preview = serializePlantGraph(active(c)); c.release(3);
      assert.equal(serializePlantGraph(stored(c)), preview);
      assert.ok(inPlantingArea(root(stored(c)), destination));
      assertRestLengthsPreserved(original, stored(c)); assertAttachmentCoincidence(stored(c));
      assert.equal(serializePlantGraph(stored(c, other.id)), serializePlantGraph(other));
      // A subsequent no-op must retain the preceding recovery checkpoint.
      c.beginBase(4, spec, { base: root(stored(c)) }); c.release(4); c.commandUndo();
      assert.equal(serializePlantGraph(stored(c)), before);
      assert.equal(c.getDebugState().successfulPlantOrdinal, 2);
    }
  });
}

test("an offset legacy ellipse is not clipped by an unrelated origin-centred guard", () => {
  const p = profile("pinbed-medium-oval"), start = point(1.65, .19);
  assert.deepEqual(constrainBaseToProfile(start, start, p), start);
  const adapter = createDomainAdapters(undefined, p), graph = createReed("plant-1", 8278, start);
  for (const request of [point(-5), point(-2, .5), point(0, 3)]) {
    const projected = constrainBaseToProfile(request, start, p);
    assert.ok(Math.hypot(projected.x, projected.z) <= profileBaseRadius(p, start) + 1e-12);
    const moved = adapter.moveBase(graph, { plantId: graph.id, context: {} }, { base: request });
    assert.ok(Math.hypot(root(moved).x - projected.x, root(moved).z - projected.z) < 1e-12);
  }
});

test("owner's flowering pair acquires unchanged; actual contacts remain protected", () => {
  const a = createFloweringBranch("plant-1", 8278, point(-.28));
  const b = createFloweringBranch("plant-2", 9255, point(1.65));
  const h = setup([b, a], true), { c } = h; h.switchTo(profile("petite"));
  const before = serializePlantGraph(b), spec = { plantId: b.id, context: {} };
  for (let attempt = 1; attempt <= 3; attempt++) {
    c.beginBase(attempt, spec, { base: root(b) });
    assert.equal(serializePlantGraph(active(c)), before);
    assert.equal(h.protection.feedback.reason, "clear", "no contact caused merely by acquisition");
    c.updateBase(attempt, { base: point(.28) });
    assert.equal(h.protection.feedback.reason, "contact");
    assert.ok(root(active(c)).x > .67);
    c.pointerCancel(attempt); assert.equal(h.writes(), 0);
  }
  const free = setup([b, a], false); free.switchTo(profile("petite"));
  free.c.beginBase(1, spec, { base: root(b) }); free.c.updateBase(1, { base: point(.28) }); free.c.release(1);
  assert.ok(inPlantingArea(root(stored(free.c, b.id)), profile("petite")));
});

test("recovered and still-outside graphs retain inactive history in studio and Garden round trips", () => {
  const full = createFloweringBranch("plant-1", 8278, point(-1.65));
  const branch = full.branches.get(full.rootBranchId)!;
  const pruned = applyPrune(full, previewPrune(full, branch.id, branch.activeLength * .65));
  const inactive = [...pruned.branches.values()].filter(b => !b.active);
  assert.ok(inactive.length > 0);
  for (const protectedOn of [false, true]) {
    const { c, switchTo } = setup([pruned], protectedOn); switchTo(profile("pinbed-small"));
    c.beginBase(1, { plantId: pruned.id, context: {} }, { base: root(pruned) });
    c.updateBase(1, { base: point(0) }); c.release(1);
    for (const record of inactive) assert.deepEqual(stored(c).branches.get(record.id), record);
    for (const graph of [pruned, stored(c)]) {
      const scene = { ...DEFAULT_SCENE, layoutId: "pinbed-small" }, camera = canonicalCameraPose("above");
      const plants = JSON.parse(JSON.stringify([toCanonicalPlantGraph(graph)]));
      const raw = JSON.stringify({ storageVersion: 2, savedAt: "2026-10-04T00:00:00Z", nextSuccessfulOrdinal: 3, plants, camera, scene });
      assert.deepEqual(parseSceneStudio(raw).plants, plants);
      const values = new Map<string, string>(), storage = { getItem: (k: string) => values.get(k) ?? null, setItem: (k: string, v: string) => { values.set(k, v); } };
      const garden = new SceneGardenStore("garden", undefined, storage); garden.load();
      garden.keep({ id: "moment", title: "Synthetic recovery", keptAt: "2026-10-04T00:00:00Z", thumbnail: null, arrangement: { plants, camera, scene, successfulPlantOrdinal: 2 } });
      const imported = new SceneGardenStore("imported", undefined, storage); imported.load(); imported.importBackup(garden.exportRaw());
      assert.deepEqual(imported.load().entries[0].arrangement.plants, plants);
    }
  }
});
