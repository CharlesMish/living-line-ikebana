import assert from "node:assert/strict";
import test from "node:test";
import { createWorkbenchFixture } from "../../src/app/workbench.ts";
import { canonicalCameraPose } from "../../src/app/camera.ts";
import { DEFAULT_SCENE, validateScene } from "../../src/app/scene.ts";
import { SceneCommittedStore, SceneGardenStore, parseSceneStudio, parseSceneGarden, sceneStorageKeys } from "../../src/app/scenePersistence.ts";
import { parseGarden } from "../../src/app/garden.ts";
import { applyPrune, fromCanonicalPlantGraph, previewPrune, toCanonicalPlantGraph } from "../../src/core/index.ts";
const snapshot = createWorkbenchFixture("bare-branch", 8278, 1);
const graph = fromCanonicalPlantGraph(snapshot.plants[0]);
const branch = graph.branches.get("plant-1:answering")!;
const pruned = toCanonicalPlantGraph(applyPrune(graph, previewPrune(graph, branch.id, .08)));
const plants = [pruned];
const scene = { ...DEFAULT_SCENE, layoutId: "vessel-pair", colorId: "celadon", finishId: "stoneware", backdropId: "sage" as const, perchId: "stone" as const, photoFormat: "portrait" as const, stemFibers: true };
const camera = canonicalCameraPose("three-quarter");
const legacyStudio = JSON.stringify({ storageVersion: 1, savedAt: "2026-09-01T12:00:00Z", nextSuccessfulOrdinal: 2, plants });
const entry = { id: "synthetic-pruned", title: "History", keptAt: "2026-09-01T12:00:00Z", thumbnail: null, arrangement: { ...snapshot, plants } };
const legacyGarden = JSON.stringify({ gardenVersion: 1, entries: [entry] });
function memory() {
 const items = new Map<string, string>([["old-studio", legacyStudio], ["old-garden", legacyGarden], ["personal-sentinel", "do-not-touch"]]);
 const writes: string[] = [];
 return { items, writes, getItem(key: string) { return items.get(key) ?? null; }, setItem(key: string, value: string) { writes.push(key); items.set(key, value); } };
}
test("legacy studio reads without write and defaults scene without losing pruned history", () => {
 const storage = memory(), store = new SceneCommittedStore("new-studio", "old-studio", () => ({ scene, camera }), storage);
 assert.deepEqual(store.load()?.plants, plants); assert.deepEqual(store.loaded?.scene, DEFAULT_SCENE);
 assert.equal(store.loaded?.plants[0].branches.length, pruned.branches.length);
 assert.deepEqual(storage.writes, []); assert.equal(storage.items.get("old-studio"), legacyStudio);
 assert.equal(store.save(2, plants), true);
 const restored = new SceneCommittedStore("new-studio", "old-studio", () => ({ scene: DEFAULT_SCENE, camera }), storage).load()!;
 assert.deepEqual(restored.plants, plants); assert.deepEqual(restored.scene, scene); assert.deepEqual(restored.camera, camera);
 assert.equal(storage.items.get("old-studio"), legacyStudio); assert.equal(storage.items.get("personal-sentinel"), "do-not-touch");
});
test("Garden v1 reads unchanged and v2 export/import preserves layout, appearance, stage, camera and inactive records", () => {
 const storage = memory(), store = new SceneGardenStore("new-garden", "old-garden", storage);
 assert.deepEqual(store.load().entries[0].arrangement.scene, DEFAULT_SCENE); assert.deepEqual(storage.writes, []);
 assert.equal(store.exportRaw(), legacyGarden);
 store.keep({ ...entry, id: "new-moment", arrangement: { ...entry.arrangement, camera, scene } });
 const backup = store.exportRaw(), parsed = parseSceneGarden(backup);
 assert.equal(parsed.gardenVersion, 2); assert.deepEqual(parsed.entries[0].arrangement, { ...entry.arrangement, camera, scene });
 assert.deepEqual(parsed.entries[1].arrangement.plants, plants); assert.equal(storage.items.get("old-garden"), legacyGarden);
 assert.throws(() => parseGarden(backup), /version/); // Old reader fails closed; no silent scene loss.
 const target = new SceneGardenStore("destination", undefined, storage); target.load(); assert.equal(target.importBackup(backup), 2);
 assert.deepEqual(parseSceneGarden(target.exportRaw()), parsed);
});
test("invalid and future studio versions preserve both keys and block subsequent saves", () => {
 for (const payload of [{ storageVersion: 3 }, { ...JSON.parse(legacyStudio), nextSuccessfulOrdinal: "2" }, { ...JSON.parse(legacyStudio), plants: [{}] }]) {
  const storage = memory(); const invalid = JSON.stringify(payload); storage.items.set("new-studio", invalid);
  const store = new SceneCommittedStore("new-studio", "old-studio", () => ({ scene, camera }), storage);
  assert.equal(store.load(), null); assert.equal(store.error, true); assert.equal(store.save(2, plants), false);
  assert.equal(storage.items.get("new-studio"), invalid); assert.equal(storage.items.get("old-studio"), legacyStudio);
 }
});
test("Garden rejects unknown layout/scene versions, malformed entries and future versions atomically", () => {
 for (const payload of [{ gardenVersion: 99 }, { gardenVersion: 2, entries: [{ ...entry, arrangement: { ...entry.arrangement, scene: { ...scene, layoutId: "future" } } }] }, { gardenVersion: 2, entries: [{ ...entry, arrangement: { ...entry.arrangement, scene: { ...scene, sceneVersion: 2 } } }] }]) {
  const storage = memory(), store = new SceneGardenStore("new-garden", "old-garden", storage); store.load();
  assert.throws(() => store.importBackup(JSON.stringify(payload))); assert.deepEqual(storage.writes, []);
  storage.items.set("new-garden", JSON.stringify(payload)); assert.throws(() => store.load());
  assert.throws(() => store.keep({ ...entry, arrangement: { ...entry.arrangement, scene } }));
  assert.equal(storage.items.get("old-garden"), legacyGarden);
 }
});
test("failed quota writes preserve disk and cached documents, then retry succeeds", () => {
 const storage = memory(); let fail = true;
 const adapter = { getItem: (k: string) => storage.getItem(k), setItem: (k: string, v: string) => { if (fail) throw new Error("synthetic quota"); storage.setItem(k, v); } };
 const studio = new SceneCommittedStore("new-studio", "old-studio", () => ({ scene, camera }), adapter); studio.load();
 assert.equal(studio.save(2, plants), false); assert.equal(storage.getItem("new-studio"), null);
 const garden = new SceneGardenStore("new-garden", "old-garden", adapter); garden.load();
 assert.throws(() => garden.keep({ ...entry, id: "new-moment", arrangement: { ...entry.arrangement, scene } }), /Previous entries/);
 assert.equal(garden.exportRaw(), legacyGarden); fail = false; assert.equal(studio.save(2, plants), true);
 garden.keep({ ...entry, id: "new-moment", arrangement: { ...entry.arrangement, scene } }); assert.equal(parseSceneGarden(garden.exportRaw()).entries.length, 2);
});
test("old and new tab changes both block stale writes, and conflicting imports write nothing", () => {
 for (const key of ["old-garden", "new-garden"]) {
  const storage = memory(), garden = new SceneGardenStore("new-garden", "old-garden", storage); garden.load();
  storage.items.set(key, JSON.stringify({ gardenVersion: 1, entries: [] }));
  assert.throws(() => garden.keep({ ...entry, id: "new-moment", arrangement: { ...entry.arrangement, scene } }), /another tab/);
  assert.deepEqual(storage.writes, []);
 }
 const storage = memory(), garden = new SceneGardenStore("new-garden", "old-garden", storage); garden.load();
 assert.throws(() => garden.importBackup(JSON.stringify({ gardenVersion: 1, entries: [{ ...entry, title: "Conflict" }] })), /differs/);
 assert.deepEqual(storage.writes, []);
});
test("routing keeps preview, workbench, vessel study and ordinary legacy keys separated", () => {
 const ordinary = sceneStorageKeys(new URL("https://example.test"), false);
 assert.equal(ordinary.legacyStudio, "ikebana-web-alpha:studio-v1"); assert.equal(ordinary.studio, "ikebana-web-alpha:studio-v2");
 const preview = sceneStorageKeys(new URL("https://example.test?combinedPreview=1"), false, "vessel-pair");
 assert.equal(preview.legacyStudio, undefined); assert.ok(preview.studio.startsWith("ikebana-integration-preview:"));
 assert.notEqual(sceneStorageKeys(new URL("https://example.test"), true).studio, ordinary.studio);
 assert.ok(sceneStorageKeys(new URL("https://example.test"), false, "long-bed").studio.includes("long-bed"));
});
test("strict scene validation rejects fallback substitutions and invalid canonical identity", () => {
 for (const patch of [{ colorId: "future" }, { finishId: "future" }, { backdropId: "future" }, { perchId: "future" }, { photoFormat: "future" }, { stemFibers: 1 }]) assert.throws(() => validateScene({ ...scene, ...patch }));
 assert.throws(() => parseSceneStudio(JSON.stringify({ ...JSON.parse(legacyStudio), nextSuccessfulOrdinal: 1 })), /identity/);
});
test("legacy working saves retain the previous count/size allowance instead of inheriting Garden limits", () => {
 const fixture = createWorkbenchFixture("reed", 8278, 1);
 const many = Array.from({length:65}, (_, index) => {
   const plant = structuredClone(fixture.plants[0]); const previous = plant.id, id = `plant-${index+1}`;
   // Canonical record identities are plant-prefixed, so clone with a consistent namespace.
   return JSON.parse(JSON.stringify(plant).replaceAll(previous, id));
 });
 const raw = JSON.stringify({storageVersion:1,savedAt:'2026-09-01T12:00:00Z',nextSuccessfulOrdinal:66,plants:many});
 assert.equal(parseSceneStudio(raw).plants.length,65);
 assert.deepEqual(parseSceneStudio(raw).plants,many);
 const storage = memory();storage.items.set('old-studio',raw);
 const store = new SceneCommittedStore('new-studio','old-studio',()=>({scene,camera}),storage);assert.equal(store.load()?.plants.length,65);
 assert.equal(store.save(66,many),true);assert.equal(parseSceneStudio(storage.getItem('new-studio')!).plants.length,65);
});
