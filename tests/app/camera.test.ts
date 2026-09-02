import assert from "node:assert/strict";
import test from "node:test";

import { PerspectiveCamera, Vector3 } from "three";

import { canonicalCameraPose, orbitCameraPose } from "../../src/app/camera.ts";
import { STUDIO_VERTICAL_FOV } from "../../src/presentation/index.ts";

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

test("canonical viewing directions remain the mainline Front / 3/4 / Above poses", () => {
  assert.deepEqual(canonicalCameraPose("front"), {
    position: { x: 0, y: 3.7, z: 15 },
    target: { x: 0, y: 2.55, z: 0 },
    up: { x: 0, y: 1, z: 0 },
  });
  assert.deepEqual(canonicalCameraPose("three-quarter"), {
    position: { x: 9.72, y: 6.42, z: 11.1 },
    target: { x: 0, y: 2.4, z: 0 },
    up: { x: 0, y: 1, z: 0 },
  });
  assert.deepEqual(canonicalCameraPose("above"), {
    position: { x: 0.02, y: 15.4, z: 0.02 },
    target: { x: 0, y: 1.85, z: 0 },
    up: { x: 0, y: 0, z: -1 },
  });
});

test("portrait Front keeps both the pin field and stock crown below the top chrome band", () => {
  for (const [width, height] of [[390, 844], [430, 932]] as const) {
    const rootY = projectedClientY(new Vector3(0, 0.55, 0), width, height);
    const crownY = projectedClientY(new Vector3(0, 6.53, 0), width, height);
    assert.ok(rootY > height * 0.58 && rootY < height * 0.74, `${width}×${height} root projected to ${rootY}`);
    assert.ok(crownY > 100 && crownY < 200, `${width}×${height} crown projected to ${crownY}`);
  }
});
