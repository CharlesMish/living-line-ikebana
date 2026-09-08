import assert from "node:assert/strict";
import test from "node:test";
import * as THREE from "three";
import { createVesselGeometry } from "../../src/presentation/vessel.ts";

test("the vessel has an open basin, an inward-facing wall at the waterline and a raised lip", () => {
  const geometry = createVesselGeometry();
  const material = new THREE.MeshStandardMaterial();
  const mesh = new THREE.Mesh(geometry, material);
  mesh.updateMatrixWorld(true);
  const ray = new THREE.Raycaster();
  ray.set(new THREE.Vector3(0, 3, 1.8), new THREE.Vector3(0, -1, 0));
  const basin = ray.intersectObject(mesh)[0];
  assert.ok(basin);
  assert.ok(Math.abs(basin.point.y - 0.19) < 1e-6, "open basin exposes its floor rather than a cylinder cap");
  ray.set(new THREE.Vector3(0, 0.46, 0), new THREE.Vector3(1, 0, 0));
  const innerWall = ray.intersectObject(mesh)[0];
  assert.ok(innerWall, "inner wall must face into the basin");
  assert.ok(Math.abs(innerWall.point.x - 2.345) < 0.003, "water reaches the inner wall");
  ray.set(new THREE.Vector3(2.46, 3, 0), new THREE.Vector3(0, -1, 0));
  const lip = ray.intersectObject(mesh)[0];
  assert.ok(lip && lip.point.y > 0.6, "lip sits visibly above water at 0.46");
  assert.ok(geometry.boundingBox!.min.y >= 0);
  geometry.dispose(); material.dispose();
});
