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

test("portrait Front keeps both the pin field and stock crown in the craft viewport", () => {
  const rootY = projectedClientY(new Vector3(0, 0.55, 0));
  const crownY = projectedClientY(new Vector3(0, 6.53, 0));
  assert.ok(rootY > 520 && rootY < 600, `root projected to ${rootY}`);
  assert.ok(crownY > 105 && crownY < 180, `crown projected to ${crownY}`);
});
