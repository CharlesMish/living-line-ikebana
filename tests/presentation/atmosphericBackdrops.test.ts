import assert from "node:assert/strict";
import test from "node:test";
import * as THREE from "three";
import { ATMOSPHERIC_BACKDROPS, atmosphericBackdropPixel, createAtmosphericBackdrop, fitAtmosphericBackdrop } from "../../src/presentation/atmosphericBackdrops.ts";
import { ThreeStudio } from "../../src/presentation/ThreeStudio.ts";
import { PHOTO_COLORS } from "../../src/presentation/photoStage.ts";

// GPU drawing is deliberately omitted. These tests cover actual authored bytes,
// background bindings and resource ownership, not rendered/browser appearance.
test("atmospheric maps are deterministic, bounded and individually owned", () => {
  const maps = ATMOSPHERIC_BACKDROPS.map(kind => {
    const first = createAtmosphericBackdrop(kind), second = createAtmosphericBackdrop(kind);
    assert.equal(first.image.width, 256); assert.equal(first.image.height, 256);
    assert.equal(first.image.data.byteLength, 256 * 256 * 4);
    assert.equal(first.colorSpace, THREE.SRGBColorSpace);
    assert.notEqual(first, second); assert.notEqual(first.image.data, second.image.data);
    assert.deepEqual(first.image.data, second.image.data);
    const values = first.image.data;
    for (let index = 0; index < values.length; index += 4) {
      assert.equal(values[index + 3], 255);
      for (let channel = 0; channel < 3; channel++) assert.ok(values[index + channel]! >= 110 && values[index + channel]! <= 235);
    }
    const topPixel = atmosphericBackdropPixel(kind, 0, 0);
    assert.deepEqual([...values.slice((255 * 256) * 4, (255 * 256) * 4 + 3)], topPixel.map(Math.round), "sky is above the foreground in UV space");
    first.dispose(); second.dispose(); return values;
  });
  assert.notDeepEqual(maps[0], maps[1]);
});

test("backdrop cover crop preserves shape for landscape, portrait and export aspects", () => {
  const texture = createAtmosphericBackdrop("hills");
  for (const aspect of [4 / 3, 3 / 4, 1, 390 / 844, 844 / 390]) {
    fitAtmosphericBackdrop(texture, aspect);
    assert.ok(Math.abs(texture.repeat.x / texture.repeat.y - aspect) < 1e-12);
    assert.ok(texture.repeat.x > 0 && texture.repeat.x <= 1);
    assert.ok(texture.repeat.y > 0 && texture.repeat.y <= 1);
    assert.equal(texture.offset.x + texture.repeat.x / 2, .5);
    assert.equal(texture.offset.y + texture.repeat.y / 2, .5);
    const before = texture.matrix.clone(); fitAtmosphericBackdrop(texture, aspect);
    assert.deepEqual(texture.matrix, before);
  }
  const before = texture.matrix.clone(); fitAtmosphericBackdrop(texture, NaN);
  assert.deepEqual(texture.matrix, before); texture.dispose();
});

function fixture() {
  const scene = new THREE.Scene();
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(10, 10), new THREE.MeshStandardMaterial());
  floor.name = "studio-floor"; scene.add(floor);
  const studio = Object.assign(Object.create(ThreeStudio.prototype), {
    scene, photoPerch: null, disposed: false, renderFrame: null, resizeObserver: null,
    renderer: { setClearColor() {}, dispose() {} }, plants: new Map(), pendingPlant: null,
    requestRender() {}, getVesselPresentation: () => ({ vessels: [{ contactY: .04, footprintXZ: { minX: -2.64, maxX: 2.64, minZ: -2.64, maxZ: 2.64 } }] }),
  });
  return { studio, scene, floor };
}

test("production stage owns one background map and disposes it on replacement, transparency and close", () => {
  const { studio, scene, floor } = fixture();
  studio.setPhotoStage("hills", "stone");
  const hills = scene.background as THREE.Texture;
  assert.ok(hills instanceof THREE.DataTexture);
  let hillsDisposed = 0; hills.addEventListener("dispose", () => hillsDisposed++);
  studio.setPhotoStage("hills", "bench");
  assert.equal(scene.background, hills, "perch changes reuse the existing backdrop");
  assert.equal(hillsDisposed, 0);
  studio.setPhotoStage("garden", "ground");
  assert.equal(hillsDisposed, 1);
  const garden = scene.background as THREE.Texture;
  let gardenDisposed = 0; garden.addEventListener("dispose", () => gardenDisposed++);
  assert.ok(scene.fog instanceof THREE.Fog);
  assert.equal(scene.fog.color.getHex(), PHOTO_COLORS.garden.wall);
  assert.equal(floor.material.color.getHex(), PHOTO_COLORS.garden.floor);
  studio.setPhotoStage("transparent", "bench");
  assert.equal(gardenDisposed, 1); assert.equal(scene.background, null);
  assert.equal(scene.fog, null); assert.equal(floor.visible, false);
  assert.equal(studio.photoPerch.children.length, 0);
  studio.setPhotoStage("hills", "ground");
  const reopened = scene.background as THREE.Texture;
  let reopenedDisposed = 0; reopened.addEventListener("dispose", () => reopenedDisposed++);
  studio.dispose(); studio.dispose();
  assert.equal(reopenedDisposed, 1); assert.equal(hillsDisposed, 1); assert.equal(gardenDisposed, 1);
});

test("changing one studio does not mutate another's saved scenic background", () => {
  const left = fixture(), right = fixture();
  left.studio.setPhotoStage("hills", "ground"); right.studio.setPhotoStage("hills", "ground");
  const first = left.scene.background as THREE.Texture, second = right.scene.background as THREE.Texture;
  assert.notEqual(first, second);
  const before = second.matrix.clone(); fitAtmosphericBackdrop(first, .5);
  assert.deepEqual(second.matrix, before);
  left.studio.setPhotoStage("paper", "ground");
  assert.ok(left.scene.background instanceof THREE.Color);
  assert.equal(left.scene.background.getHex(), PHOTO_COLORS.paper.wall);
  assert.equal(right.scene.background, second);
  left.studio.dispose(); right.studio.dispose();
});


test("production render fits the actual camera aspect before drawing its owned map", () => {
  const { studio, scene } = fixture();
  const camera = new THREE.PerspectiveCamera(40, 4 / 3, .1, 80);
  camera.position.set(0, 4, 15);
  const seen: { aspect: number; repeat: [number, number] }[] = [];
  Object.assign(studio, {
    camera, cameraTarget: new THREE.Vector3(0, 2.5, 0),
    bendHandle: { group: { visible: false } }, touchCue: { visible: false },
    canvas: { getBoundingClientRect: () => ({ height: 800 }) },
  });
  studio.renderer.render = () => {
    const texture = scene.background as THREE.Texture;
    seen.push({ aspect: camera.aspect, repeat: [texture.repeat.x, texture.repeat.y] });
  };
  studio.setPhotoStage("hills", "ground"); studio.renderNow();
  camera.aspect = 3 / 4; studio.renderNow();
  camera.aspect = 1; studio.renderNow();
  assert.deepEqual(seen, [
    { aspect: 4 / 3, repeat: [1, 3 / 4] },
    { aspect: 3 / 4, repeat: [3 / 4, 1] },
    { aspect: 1, repeat: [1, 1] },
  ]);
  studio.dispose();
});
