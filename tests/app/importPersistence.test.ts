import assert from "node:assert/strict";
import test from "node:test";
import { createWorkbenchFixture } from "../../src/app/workbench.ts";
import { canonicalCameraPose } from "../../src/app/camera.ts";
import { DEFAULT_SCENE, withPhotoAdjustments, withPhotoLighting } from "../../src/app/scene.ts";
import { SceneCommittedStore, SceneGardenStore, parseSceneGarden, parseSceneStudio } from "../../src/app/scenePersistence.ts";
import { fromCanonicalPlantGraph, previewPrune, applyPrune, toCanonicalPlantGraph } from "../../src/core/index.ts";

const camera = canonicalCameraPose("three-quarter");
const snapshot = createWorkbenchFixture("round5-palette", 8278, 12);
const plants = JSON.parse(JSON.stringify([...snapshot.plants].reverse().map((plant, index) => {
  const graph = fromCanonicalPlantGraph(plant);
  return index % 2 ? toCanonicalPlantGraph(applyPrune(graph, previewPrune(graph, graph.rootBranchId, graph.branches.get(graph.rootBranchId)!.activeLength * .6))) : plant;
}))) as typeof snapshot.plants;
const scene = withPhotoLighting(withPhotoAdjustments({ ...DEFAULT_SCENE, backdropId: "hills", perchId: "stone" }, {
  version: 1, exposure: .2, contrast: -.1, warmth: .3, saturation: .4, vignette: .2,
}), "evening");
const arrangement = { plants, camera, scene, successfulPlantOrdinal: 12 };
const keptAt = "2026-10-15T00:00:00.000Z";
const entry = { id: "kept-1", title: "Existing craft", keptAt, thumbnail: null, arrangement };
const studio = { storageVersion: 2, savedAt: keptAt, nextSuccessfulOrdinal: 13, plants, camera, scene };
function memory() {
  const values = new Map<string, string>(); const writes: string[] = [];
  return { values, writes, getItem: (key: string) => values.get(key) ?? null,
    setItem(key: string, value: string) { values.set(key, value); writes.push(key); } };
}
function extras() {
  return plants.map(plant => ({ ...plant, unexpected: { poison: true },
    branches: plant.branches.map(branch => ({ ...branch, unexpected: true,
      points: branch.points.map(point => ({ ...point, w: 1 })), referenceNormal: { ...branch.referenceNormal, w: 1 } })),
    organs: plant.organs.map(organ => ({ ...organ, unexpected: "persisted before" })),
  }));
}

test("working and Garden v1/v2 persistence stores validated fields without changing plant order, numerical state, or photo recipes", () => {
  for (const version of [1, 2]) {
    const source = { ...studio, storageVersion: version, plants: extras() };
    const parsed = parseSceneStudio(JSON.stringify(source));
    assert.deepEqual(parsed.plants, plants);
    assert.deepEqual(parsed.scene, version === 1 ? DEFAULT_SCENE : scene);
    assert.deepEqual(parsed.camera, version === 1 ? canonicalCameraPose("front") : camera);
    const garden = parseSceneGarden(JSON.stringify({ gardenVersion: version,
      entries: [{ ...entry, arrangement: { ...arrangement, plants: extras() } }] }));
    assert.deepEqual(garden.entries[0].arrangement.plants, plants);
    assert.deepEqual(garden.entries[0].arrangement.scene, version === 1 ? DEFAULT_SCENE : scene);
    const storage = memory(); storage.values.set("bowl", JSON.stringify(source));
    const store = new SceneCommittedStore("bowl", undefined, () => ({ camera, scene }), storage);
    assert.deepEqual(store.load()?.plants, plants);
    assert.deepEqual(storage.writes, [], "Reading does not rewrite the old bytes");
    assert.equal(store.save(13, extras()), true);
    assert.deepEqual(JSON.parse(storage.values.get("bowl")!).plants, plants);
    assert.equal(storage.values.get("bowl")!.includes("unexpected"), false);
    const keeper = new SceneGardenStore("garden", undefined, storage); keeper.load();
    keeper.keep({ ...entry, arrangement: { ...arrangement, plants: extras() } });
    assert.deepEqual(JSON.parse(keeper.exportRaw()).entries[0].arrangement.plants, plants);
    assert.equal(keeper.exportRaw().includes("unexpected"), false);
    const importer = new SceneGardenStore("imported", undefined, storage); importer.load();
    importer.importBackup(JSON.stringify({ gardenVersion: version,
      entries: [{ ...entry, arrangement: { ...arrangement, plants: extras() } }] }));
    assert.deepEqual(JSON.parse(importer.exportRaw()).entries[0].arrangement.plants, plants);
  }
});

test("invalid seed import and load never overwrite existing art or consume its working ordinal", () => {
  const storage = memory();
  storage.values.set("bowl", JSON.stringify(studio));
  const keeper = new SceneGardenStore("garden", undefined, storage); keeper.load(); keeper.keep(entry);
  const invalidPlants = structuredClone(plants); invalidPlants[0].seed = -1;
  const badBackup = JSON.stringify({ gardenVersion: 2, entries: [{ ...entry, id: "invalid-new", arrangement: { ...arrangement, plants: invalidPlants } }] });
  const before = [...storage.values]; const beforeWrites = storage.writes.length;
  assert.throws(() => keeper.importBackup(badBackup), /seed/);
  assert.deepEqual([...storage.values], before); assert.equal(storage.writes.length, beforeWrites);
  const invalidBytes = JSON.stringify({ ...studio, plants: invalidPlants });
  storage.values.set("bad-bowl", invalidBytes);
  const store = new SceneCommittedStore("bad-bowl", undefined, () => ({ scene, camera }), storage);
  assert.equal(store.load(), null); assert.equal(store.error, true);
  assert.equal(store.save(13, plants), false);
  assert.equal(storage.values.get("bad-bowl"), invalidBytes);
  assert.equal(storage.values.get("bowl"), JSON.stringify(studio));
});
