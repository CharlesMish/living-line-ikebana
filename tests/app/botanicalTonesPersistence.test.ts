import assert from "node:assert/strict";
import test from "node:test";
import { createWorkbenchFixture } from "../../src/app/workbench.ts";
import { canonicalCameraPose } from "../../src/app/camera.ts";
import { DEFAULT_SCENE, validateScene, withBotanicalTones, withPhotoAdjustments, withPhotoLighting } from "../../src/app/scene.ts";
import { SceneCommittedStore, SceneGardenStore, parseSceneGarden, parseSceneStudio } from "../../src/app/scenePersistence.ts";
import { NEUTRAL_PHOTO_ADJUSTMENTS } from "../../src/presentation/photoAdjustments.ts";
import { IkebanaApp } from "../../src/app/IkebanaApp.ts";
import { BOTANICAL_FAMILIES } from "../../src/presentation/botanicalTones.ts";
const snapshot = JSON.parse(JSON.stringify(createWorkbenchFixture("flowering-branch", 8278, 1)));
const camera = canonicalCameraPose("three-quarter");
const timestamp = "2026-10-13T00:00:00Z";
function memory() {
  const items = new Map<string, string>(), writes: string[] = [];
  return { items, writes, getItem: (key: string) => items.get(key) ?? null,
    setItem(key: string, value: string) { writes.push(key); items.set(key, value); } };
}
test("old scene bytes remain v1 and unchanged on read; a color command explicitly upgrades to v2", () => {
  const storage = memory();
  const raw = JSON.stringify({ storageVersion: 2, savedAt: timestamp, nextSuccessfulOrdinal: 2,
    plants: snapshot.plants, camera, scene: DEFAULT_SCENE });
  storage.items.set("working", raw);
  const store = new SceneCommittedStore("working", undefined, () => ({ scene: DEFAULT_SCENE, camera }), storage);
  assert.deepEqual(store.load()?.scene, DEFAULT_SCENE); assert.equal(storage.getItem("working"), raw); assert.deepEqual(storage.writes, []);
  assert.deepEqual(withBotanicalTones(DEFAULT_SCENE), DEFAULT_SCENE);
  const toned = withBotanicalTones(DEFAULT_SCENE, { "nodding-flower": "violet" });
  assert.equal(toned.sceneVersion, 2);
  assert.deepEqual(toned.botanicalTones, { "nodding-flower": "violet" });
  assert.equal(store.save(2, snapshot.plants, { scene: toned, camera }), true);
  assert.deepEqual(parseSceneStudio(storage.getItem("working")!).scene, toned);
  const reset = withBotanicalTones(toned);
  assert.equal(reset.sceneVersion, 2); assert.equal("botanicalTones" in reset, false);
});

test("every tone survives working reload, Garden backup import and working-copy arrangement unchanged", () => {
  for (const family of BOTANICAL_FAMILIES) for (const tone of family.tones.slice(1)) {
    const scene = withBotanicalTones(DEFAULT_SCENE, { [family.id]: tone.id });
    const storage = memory();
    const working = new SceneCommittedStore("working", undefined, () => ({ scene, camera }), storage);
    working.load(); assert.equal(working.save(2, snapshot.plants), true);
    assert.deepEqual(working.load()?.scene, scene);
    const garden = new SceneGardenStore("garden", undefined, storage); garden.load();
    garden.keep({ id: `${family.id}-${tone.id}`, title: "Tone study", thumbnail: null, keptAt: timestamp,
      arrangement: { ...snapshot, camera, scene } });
    const other = new SceneGardenStore("imported", undefined, storage); other.load();
    assert.equal(other.importBackup(garden.exportRaw()), 1);
    const arrangement = parseSceneGarden(other.exportRaw()).entries[0].arrangement;
    assert.deepEqual(arrangement, { ...snapshot, camera, scene });
    const copy = new SceneCommittedStore("copy", undefined, () => ({ scene: arrangement.scene!, camera: arrangement.camera }), storage);
    copy.load(); assert.equal(copy.save(2, arrangement.plants), true);
    assert.deepEqual(copy.load()?.scene, scene); assert.deepEqual(copy.load()?.plants, snapshot.plants);
  }
});

test("invalid tone data and wrong or unknown scene envelopes preserve saved data and block writes", () => {
  for (const scene of [
    { ...DEFAULT_SCENE, botanicalTones: { "nodding-flower": "violet" } },
    { ...DEFAULT_SCENE, sceneVersion: 2, botanicalTones: { "nodding-flower": "future" } },
    { ...DEFAULT_SCENE, sceneVersion: 2, botanicalTones: { "future-flower": "violet" } },
    { ...DEFAULT_SCENE, sceneVersion: 3 },
    { ...DEFAULT_SCENE, sceneVersion: 2, futureAdjustment: true },
  ]) {
    assert.throws(() => validateScene(scene));
    const storage = memory();
    const raw = JSON.stringify({ storageVersion: 2, savedAt: timestamp, nextSuccessfulOrdinal: 2,
      plants: snapshot.plants, camera, scene });
    storage.items.set("working", raw);
    const store = new SceneCommittedStore("working", undefined, () => ({ scene: DEFAULT_SCENE, camera }), storage);
    assert.equal(store.load(), null); assert.equal(store.save(2, snapshot.plants), false);
    assert.equal(storage.getItem("working"), raw); assert.deepEqual(storage.writes, []);
  }
});


test("tone and photo recipes compose, reset independently and survive Garden and working reload together", () => {
  const tones = { "lobed-leaf": "russet", "nodding-flower": "violet" };
  const grade = { ...NEUTRAL_PHOTO_ADJUSTMENTS, exposure: .2, saturation: .1, vignette: .3 };
  const toneFirst = withPhotoAdjustments(withBotanicalTones(DEFAULT_SCENE, tones), grade);
  const gradeFirst = withBotanicalTones(withPhotoAdjustments(DEFAULT_SCENE, grade), tones);
  assert.deepEqual(toneFirst, gradeFirst);
  assert.equal(toneFirst.sceneVersion, 2);
  const storage = memory(), working = new SceneCommittedStore("working", undefined, () => ({ scene: toneFirst, camera }), storage);
  working.load(); assert.equal(working.save(2, snapshot.plants), true);
  assert.deepEqual(working.load()?.scene, toneFirst);
  const garden = new SceneGardenStore("garden", undefined, storage); garden.load();
  garden.keep({ id: "both", title: "Russet finish", thumbnail: null, keptAt: timestamp,
    arrangement: { ...snapshot, camera, scene: toneFirst } });
  assert.deepEqual(parseSceneGarden(garden.exportRaw()).entries[0].arrangement.scene, toneFirst);
  const noGrade = withPhotoAdjustments(toneFirst, { ...NEUTRAL_PHOTO_ADJUSTMENTS });
  assert.deepEqual(noGrade.botanicalTones, tones); assert.equal("photoAdjustments" in noGrade, false);
  const noTones = withBotanicalTones(toneFirst);
  assert.deepEqual(noTones.photoAdjustments, grade); assert.equal("botanicalTones" in noTones, false);
});

test("app scene transitions apply and clear both recipes without rebuilding botanical graphs", () => {
  const toned = withBotanicalTones(DEFAULT_SCENE, { "broad-blade": "olive" });
  const scene = withPhotoLighting(withPhotoAdjustments(toned, { ...NEUTRAL_PHOTO_ADJUSTMENTS, contrast: .2 }), "evening");
  const calls: Record<string, unknown> = {};
  const studio = { setPhotoAdjustments: (value: unknown) => { calls.grade = value; },
    setBotanicalTones: (value: unknown) => { calls.tones = value; },
    setPhotoLighting: (value: unknown) => { calls.lighting = value; }, setVesselAppearance() {}, setPhotoStage() {}, setStemFibers() {} };
  const app = Object.assign(Object.create(IkebanaApp.prototype), { scene: DEFAULT_SCENE, studio,
    config: {}, root: { dataset: {} }, setupVesselUI() {} });
  app.applyScene(scene);
  assert.equal(app.studio, studio); assert.equal(calls.lighting, "evening"); assert.deepEqual(calls.grade, scene.photoAdjustments); assert.deepEqual(calls.tones, scene.botanicalTones);
  app.applyScene(DEFAULT_SCENE);
  assert.equal(calls.grade, undefined); assert.equal(calls.tones, undefined); assert.equal(calls.lighting, undefined);
});


test("lighting resets independently of botanical tones and finish without changing an old scene on read", () => {
  assert.deepEqual(withPhotoLighting(DEFAULT_SCENE), DEFAULT_SCENE);
  const tones = { "lobed-leaf": "russet" };
  const grade = { ...NEUTRAL_PHOTO_ADJUSTMENTS, exposure: .3 };
  const styled = withPhotoAdjustments(withBotanicalTones(DEFAULT_SCENE, tones), grade);
  const lit = withPhotoLighting(styled, "window");
  assert.deepEqual(withPhotoLighting(withPhotoAdjustments(withBotanicalTones(DEFAULT_SCENE, tones), grade), "window"),
    withBotanicalTones(withPhotoAdjustments(withPhotoLighting(DEFAULT_SCENE, "window"), grade), tones));
  const reset = withPhotoLighting(lit, "studio");
  assert.deepEqual(reset, styled);
  assert.deepEqual(withBotanicalTones(lit).photoLighting, "window");
  assert.deepEqual(withPhotoAdjustments(lit, NEUTRAL_PHOTO_ADJUSTMENTS).photoLighting, "window");
});
