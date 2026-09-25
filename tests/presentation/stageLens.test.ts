import assert from "node:assert/strict";
import test from "node:test";
import * as THREE from "three";

import { canonicalCameraPose, panCameraPose } from "../../src/app/camera.ts";
import { ThreeStudio, STUDIO_VERTICAL_FOV } from "../../src/presentation/ThreeStudio.ts";
import { computeStageLens, fogRangeForDistance } from "../../src/presentation/stageLens.ts";

const lensFor = (width: number, height: number, topInset: number) =>
  computeStageLens({ width, height, topInset, baseVerticalFov: STUDIO_VERTICAL_FOV, baseMaxRadius: 15.5 });

test("desktop and roomy stages keep the reference projection exactly", () => {
  for (const [width, height, inset] of [[1280, 800, 127], [1920, 1080, 127], [1280, 800, 0], [1440, 900, 127]]) {
    const lens = lensFor(width, height, inset);
    assert.equal(lens.shift, 0, `${width}x${height}`);
    assert.equal(lens.zoom, 1);
    assert.equal(lens.virtualHeight, height);
    assert.ok(Math.abs(lens.verticalFov - STUDIO_VERTICAL_FOV) < 1e-9);
    assert.equal(lens.maxRadius, 15.5);
  }
});

test("a portrait tablet keeps its preset but may zoom further out", () => {
  const lens = lensFor(768, 1024, 127);
  assert.equal(lens.shift, 0);
  assert.equal(lens.zoom, 1);
  assert.ok(Math.abs(lens.verticalFov - STUDIO_VERTICAL_FOV) < 1e-9);
  assert.ok(lens.maxRadius > 15.5 && lens.maxRadius < 20);
});

test("narrow and short stages centre below the rail and widen only as needed", () => {
  const portrait = lensFor(390, 844, 186);
  assert.ok(portrait.shift > 20 && portrait.shift < 30);
  assert.ok(portrait.zoom > 1.15 && portrait.zoom < 1.3, String(portrait.zoom));
  assert.ok(portrait.maxRadius > 20, "a tall phone can zoom out past the base limit");

  const small = lensFor(320, 640, 195);
  assert.ok(small.shift > 40);
  assert.ok(small.zoom >= 640 / small.stageHeight - 1e-12, "vertical extent of the stage matches the reference");

  const landscape = lensFor(844, 390, 127);
  assert.ok(landscape.shift > 25);
  assert.ok(Math.abs(landscape.zoom - 390 / landscape.stageHeight) < 1e-12);
  assert.equal(landscape.maxRadius, 15.5, "a wide stage keeps the base zoom-out limit");

  // The stage always shows at least the reference vertical extent, a horizontal
  // extent of at least 0.6 of it, and 0.9 of it at maximum zoom-out.
  for (const [width, height, inset] of [[390, 844, 186], [320, 640, 195], [844, 390, 127], [360, 780, 190]]) {
    const lens = lensFor(width, height, inset);
    const unitsPerPixel = lens.zoom * 2 * Math.tan(STUDIO_VERTICAL_FOV * Math.PI / 360) / height;
    const reference = 2 * Math.tan(STUDIO_VERTICAL_FOV * Math.PI / 360);
    assert.ok(lens.stageHeight * unitsPerPixel >= reference - 1e-12);
    assert.ok(width * unitsPerPixel >= 0.6 * reference - 1e-12);
    assert.ok(width * unitsPerPixel * lens.maxRadius / 15.5 >= 0.9 * reference - 1e-12);
  }
});

test("an absurd inset is capped and never inverts the stage", () => {
  const lens = lensFor(390, 844, 5000);
  assert.ok(lens.stageHeight > 0.4 * 844 - 1e-9);
  assert.ok(Number.isFinite(lens.verticalFov) && lens.verticalFov < 120);
});

test("fog follows the camera only beyond the base zoom limit", () => {
  assert.deepEqual(fogRangeForDistance(15.04, 15.5), { near: 13, far: 27 });
  assert.deepEqual(fogRangeForDistance(8, 15.5), { near: 13, far: 27 });
  const far = fogRangeForDistance(23.5, 15.5);
  assert.ok(Math.abs(far.near - 21) < 1e-12 && Math.abs(far.far - 35) < 1e-12);
});

/** Real studio projection, picking and pan helpers on a stubbed canvas; only GPU drawing is omitted. */
function lensStudio(width: number, height: number, inset: number) {
  const camera = new THREE.PerspectiveCamera(STUDIO_VERTICAL_FOV, width / height, 0.1, 80);
  const pose = canonicalCameraPose("front");
  camera.position.set(pose.position.x, pose.position.y, pose.position.z);
  camera.up.set(0, 1, 0);
  const cameraTarget = new THREE.Vector3(pose.target.x, pose.target.y, pose.target.z);
  camera.lookAt(cameraTarget);
  camera.updateMatrixWorld(true);
  const studio = Object.assign(Object.create(ThreeStudio.prototype), {
    camera, cameraTarget, scene: new THREE.Scene(), raycaster: new THREE.Raycaster(),
    canvas: { getBoundingClientRect: () => ({ left: 0, top: 0, width, height }), clientWidth: width, clientHeight: height },
    options: { stageLens: true }, baseVerticalFov: STUDIO_VERTICAL_FOV, stageTopInset: 0, lens: null,
    requestRender() {},
  }) as ThreeStudio;
  studio.setStageTopInset(inset);
  return { studio, camera, pose };
}

test("on a lensed stage the target sits at the stage centre and picking inverts projection", () => {
  const { studio } = lensStudio(390, 844, 186);
  const lens = studio.getStageLens();
  const target = studio.projectPoint(canonicalCameraPose("front").target);
  assert.ok(Math.abs(target.clientY - (844 / 2 + lens.shift)) < 1e-6, "optical centre moved down by the shift");
  assert.ok(Math.abs(target.clientX - 195) < 1e-6);
  for (const point of [{ x: 2.1, y: 6.4, z: 0.3 }, { x: -3.2, y: 0.6, z: 1.1 }, { x: 0, y: 8.5, z: -1 }]) {
    const projected = studio.projectPoint(point);
    const ray = studio.rayFromClient(projected.clientX, projected.clientY);
    const toPoint = new THREE.Vector3(point.x - ray.origin.x, point.y - ray.origin.y, point.z - ray.origin.z);
    const along = toPoint.dot(new THREE.Vector3(ray.direction.x, ray.direction.y, ray.direction.z));
    const miss = toPoint.addScaledVector(new THREE.Vector3(ray.direction.x, ray.direction.y, ray.direction.z), -along).length();
    assert.ok(miss < 1e-6, `pick ray passes through ${JSON.stringify(point)}`);
  }
});

test("pan speed from the lens projection moves target-depth material one pixel per pixel", () => {
  const { studio, camera, pose } = lensStudio(390, 844, 186);
  const projection = studio.getPanProjection();
  const before = studio.projectPoint(pose.target);
  const moved = panCameraPose(pose, 40, -30, projection.viewportHeight, projection.verticalFov);
  camera.position.set(moved.position.x, moved.position.y, moved.position.z);
  camera.lookAt(moved.target.x, moved.target.y, moved.target.z);
  camera.updateMatrixWorld(true);
  const after = studio.projectPoint(pose.target);
  assert.ok(Math.abs(after.clientX - before.clientX - 40) < 1e-6);
  assert.ok(Math.abs(after.clientY - before.clientY - -30) < 1e-6);
});

test("the stage lens is opt-in: comparison-style studios keep the plain shared field of view", () => {
  const camera = new THREE.PerspectiveCamera(STUDIO_VERTICAL_FOV, 1, 0.1, 80);
  const studio = Object.assign(Object.create(ThreeStudio.prototype), {
    camera, canvas: { getBoundingClientRect: () => ({ left: 0, top: 0, width: 390, height: 300 }) },
    options: { stageLens: false }, baseVerticalFov: STUDIO_VERTICAL_FOV, stageTopInset: 0, lens: null, requestRender() {},
  }) as ThreeStudio;
  studio.setStageTopInset(200);
  assert.equal(camera.view?.enabled ?? false, false);
  assert.equal(camera.fov, STUDIO_VERTICAL_FOV);
  assert.equal(studio.getCameraRadiusLimits().max, 15.5);
});
