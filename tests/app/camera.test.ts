import assert from "node:assert/strict";
import test from "node:test";

import { PerspectiveCamera, Vector3 } from "three";

import { canonicalCameraPose, dollyCameraPose, orbitCameraPose, panCameraPose } from "../../src/app/camera.ts";
import { STUDIO_VERTICAL_FOV, ThreeStudio } from "../../src/presentation/index.ts";

function projectedClientY(point: Vector3, width = 390, height = 844) {
  const pose = canonicalCameraPose("front");
  const camera = new PerspectiveCamera(STUDIO_VERTICAL_FOV, width / height, 0.1, 80);
  camera.position.set(pose.position.x, pose.position.y, pose.position.z);
  camera.up.set(pose.up.x, pose.up.y, pose.up.z);
  camera.lookAt(pose.target.x, pose.target.y, pose.target.z);
  camera.updateMatrixWorld(true);
  camera.updateProjectionMatrix();
  const projected = point.clone().project(camera);
  return (1 - projected.y) * height * 0.5;
}

test("Front orbit begins continuously instead of snapping to a hidden clamp", () => {
  const pose = canonicalCameraPose("front");
  const yawOnly = orbitCameraPose(pose, 48, 0);
  assert.ok(Math.abs(yawOnly.position.y - pose.position.y) < 1e-10);
});

test("Above orbit begins continuously instead of snapping away from plan view", () => {
  const pose = canonicalCameraPose("above");
  const yawOnly = orbitCameraPose(pose, 48, 0);
  assert.ok(Math.abs(yawOnly.position.y - pose.position.y) < 1e-6);
});

test("portrait Front keeps both the pin field and stock crown in the craft viewport", () => {
  const rootY = projectedClientY(new Vector3(0, 0.55, 0));
  const crownY = projectedClientY(new Vector3(0, 6.53, 0));
  assert.ok(rootY > 520 && rootY < 600, `root projected to ${rootY}`);
  assert.ok(crownY > 105 && crownY < 180, `crown projected to ${crownY}`);
});

function cameraFor(pose: ReturnType<typeof canonicalCameraPose>) {
  const camera = new PerspectiveCamera();
  camera.position.set(pose.position.x, pose.position.y, pose.position.z);
  camera.up.set(pose.up.x, pose.up.y, pose.up.z);
  camera.lookAt(pose.target.x, pose.target.y, pose.target.z);
  return camera;
}

test("canonical views retain rendered orientation when an orbit is acquired", () => {
  for (const view of ["front", "three-quarter", "above"] as const) {
    const pose = canonicalCameraPose(view);
    const before = cameraFor(pose);
    const after = cameraFor(orbitCameraPose(pose, 0, 0));
    assert.ok(before.quaternion.angleTo(after.quaternion) < 1e-6, `${view} rolls`);
    assert.ok(before.position.distanceTo(after.position) < 1e-8, `${view} moves`);
  }
  const above = canonicalCameraPose("above");
  for (const [dx, dy] of [[0.01, 0], [-0.01, 0], [0, 0.01], [0, -0.01]]) {
    assert.ok(cameraFor(above).quaternion.angleTo(cameraFor(orbitCameraPose(above, dx, dy)).quaternion) < 1e-4);
  }
});

test("renewing small Above orbits stays continuous at polar clamps and azimuth wraps", () => {
  let pose = canonicalCameraPose("above");
  for (let step = 0; step < 650; step += 1) {
    const next = orbitCameraPose(pose, 2, step < 325 ? 2 : -2);
    assert.ok(cameraFor(pose).quaternion.angleTo(cameraFor(next).quaternion) < 0.02);
    assert.ok(cameraFor(next).quaternion.angleTo(cameraFor(orbitCameraPose(next, 0, 0)).quaternion) < 1e-6);
    const offset = new Vector3(next.position.x - next.target.x, next.position.y - next.target.y, next.position.z - next.target.z);
    assert.ok(offset.length() >= 5.7 - 1e-8 && offset.length() <= 15.5 + 1e-8);
    const phi = Math.acos(offset.y / offset.length());
    assert.ok(phi >= 0.002 - 1e-8 && phi <= 1.52 + 1e-8);
    pose = next;
  }
});

test("presentation adapter agrees with the Above pose and does not reintroduce roll", () => {
  // Exercise the real adapter methods without constructing a GPU renderer.
  const adapter = Object.assign(Object.create(ThreeStudio.prototype), {
    camera: new PerspectiveCamera(), cameraTarget: new Vector3(), options: {},
    updateAffordances() {}, requestRender() {},
  });
  adapter.setCanonicalView("above");
  const before = adapter.camera.quaternion.clone();
  assert.ok(before.angleTo(cameraFor(canonicalCameraPose("above")).quaternion) < 1e-6);
  const snapshot = adapter.captureCameraOrbit();
  adapter.applyInspectOrbit(snapshot, 0, 0);
  assert.ok(before.angleTo(adapter.camera.quaternion) < 1e-6);
  adapter.camera.up.set(1, 0, 0);
  adapter.applyInspectDolly(snapshot, 1);
  assert.ok(before.angleTo(adapter.camera.quaternion) < 1e-6);
});

test("Move follows CSS pixels in all views, short windows and zoom levels without rotation or scaling", () => {
  for (const view of ["front", "three-quarter", "above"] as const) {
    for (const [width, height] of [[390, 844], [844, 390], [320, 480]]) {
      for (const zoom of [1, 0.5]) {
        const acquired = dollyCameraPose(canonicalCameraPose(view), zoom);
        const frozen = JSON.stringify(acquired);
        const shifted = panCameraPose(acquired, 73, -61, height, STUDIO_VERTICAL_FOV);
        const before = cameraFor(acquired);
        const after = cameraFor(shifted);
        for (const camera of [before, after]) {
          camera.fov = STUDIO_VERTICAL_FOV;
          camera.aspect = width / height;
          camera.updateProjectionMatrix();
          camera.updateMatrixWorld(true);
        }
        const target = new Vector3(acquired.target.x, acquired.target.y, acquired.target.z);
        const a = target.clone().project(before);
        const b = target.clone().project(after);
        assert.ok(Math.abs((b.x - a.x) * width / 2 - 73) < 1e-8);
        assert.ok(Math.abs(-(b.y - a.y) * height / 2 + 61) < 1e-8);
        assert.ok(before.quaternion.angleTo(after.quaternion) < 1e-6);
        const offset = (pose: typeof acquired) => new Vector3(pose.position.x - pose.target.x, pose.position.y - pose.target.y, pose.position.z - pose.target.z);
        assert.ok(offset(acquired).distanceTo(offset(shifted)) < 1e-10);
        assert.equal(JSON.stringify(acquired), frozen);
        assert.deepEqual(panCameraPose(acquired, 0, 0, height, STUDIO_VERTICAL_FOV), acquired);
      }
    }
  }
});

test("Move ignores unavailable viewport dimensions and non-finite pointer deltas", () => {
  const acquired = canonicalCameraPose("above");
  for (const [dx, height, fov] of [[100, 0, 44], [NaN, 390, 44], [Infinity, 390, 44], [100, 390, 180]]) {
    assert.deepEqual(panCameraPose(acquired, dx, 20, height, fov), acquired);
  }
});
