import assert from "node:assert/strict";
import test from "node:test";

import { PerspectiveCamera, Vector3 } from "three";

import { canonicalCameraPose, orbitCameraPose } from "../../src/app/camera.ts";
import { cameraViewOffsetForOccupiedTop, STUDIO_VERTICAL_FOV } from "../../src/presentation/index.ts";

function representativeOccupiedTopBottom(safeTopPx: number, remPx = 16): number {
  const paddingTop = safeTopPx + 0.45 * remPx;
  const segmentedHeight = (0.22 * 2 + 2.5) * remPx;
  const stackGap = 0.28 * remPx;
  const contextualMinHeight = 2.94 * remPx;
  return paddingTop + segmentedHeight + stackGap + contextualMinHeight;
}

function projectedClientY(
  point: Vector3,
  width: number,
  height: number,
  occupiedTopInsetPx = 0,
) {
  const pose = canonicalCameraPose("front");
  const camera = new PerspectiveCamera(STUDIO_VERTICAL_FOV, width / height, 0.1, 80);
  camera.position.set(pose.position.x, pose.position.y, pose.position.z);
  camera.up.set(pose.up.x, pose.up.y, pose.up.z);
  camera.lookAt(pose.target.x, pose.target.y, pose.target.z);
  const offset = cameraViewOffsetForOccupiedTop(width, height, occupiedTopInsetPx);
  if (offset) {
    camera.setViewOffset(
      offset.fullWidth,
      offset.fullHeight,
      offset.offsetX,
      offset.offsetY,
      offset.width,
      offset.height,
    );
  } else {
    camera.updateProjectionMatrix();
  }
  camera.updateMatrixWorld(true);
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

test("portrait Front keeps crown and upper material below the occupied top-chrome rectangle", () => {
  const crown = new Vector3(0, 6.53, 0);
  const upperMaterial = new Vector3(0, 5.2, 0);
  const root = new Vector3(0, 0.55, 0);
  const cases = [
    { width: 390, height: 844, safeTop: 47 },
    { width: 390, height: 844, safeTop: 59 },
    { width: 430, height: 932, safeTop: 47 },
    { width: 430, height: 932, safeTop: 59 },
  ] as const;

  for (const viewport of cases) {
    const occupiedBottom = representativeOccupiedTopBottom(viewport.safeTop);
    const rootY = projectedClientY(root, viewport.width, viewport.height, occupiedBottom);
    const crownY = projectedClientY(crown, viewport.width, viewport.height, occupiedBottom);
    const upperY = projectedClientY(upperMaterial, viewport.width, viewport.height, occupiedBottom);
    const label = `${viewport.width}×${viewport.height} safe-top ${viewport.safeTop}`;
    assert.ok(
      crownY > occupiedBottom,
      `${label}: crown at ${crownY} does not clear occupied chrome bottom ${occupiedBottom}`,
    );
    assert.ok(
      upperY > occupiedBottom,
      `${label}: upper material at ${upperY} does not clear occupied chrome bottom ${occupiedBottom}`,
    );
    assert.ok(
      rootY > occupiedBottom,
      `${label}: pin field at ${rootY} does not clear occupied chrome bottom ${occupiedBottom}`,
    );
    assert.ok(rootY > viewport.height * 0.58 && rootY < viewport.height * 0.82, `${label} root projected to ${rootY}`);
    assert.ok(crownY < occupiedBottom + viewport.height * 0.22, `${label} crown dropped too far (${crownY})`);
  }
});
