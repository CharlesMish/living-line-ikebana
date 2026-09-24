import assert from "node:assert/strict";
import test from "node:test";
import * as THREE from "three";

import {
  clonePlantGraph,
  createFloweringBranch,
  createReed,
  getMaterialDefinitions,
  previewPrune,
  serializePlantGraph,
} from "../../src/core/index.ts";
import { createVesselGeometry } from "../../src/presentation/vessel.ts";
import { innerWallRadiusAt, KENZAN_TOP_Y, WATER_Y, waterlineCrossings } from "../../src/presentation/waterline.ts";
import { studioFixture } from "./studioFixture.ts";

const BASE = { x: 0.3, y: 0.55, z: -0.2 };

test("water covers the kenzan top and meets the inner wall below the lip", () => {
  assert.equal(KENZAN_TOP_Y, BASE.y, "the insertion plane itself is unchanged");
  assert.ok(WATER_Y > KENZAN_TOP_Y, "seated stems leave the water, not an exposed pin frog");
  const geometry = createVesselGeometry();
  const material = new THREE.MeshStandardMaterial();
  const mesh = new THREE.Mesh(geometry, material);
  mesh.updateMatrixWorld(true);
  const ray = new THREE.Raycaster();
  ray.set(new THREE.Vector3(0, WATER_Y, 0), new THREE.Vector3(1, 0, 0));
  const wall = ray.intersectObject(mesh)[0];
  assert.ok(wall, "the water plane reaches an inward-facing wall");
  assert.ok(Math.abs(wall.point.x - innerWallRadiusAt(WATER_Y)) < 0.003, "water disc matches the wall");
  ray.set(new THREE.Vector3(2.46, 3, 0), new THREE.Vector3(0, -1, 0));
  const lip = ray.intersectObject(mesh)[0];
  assert.ok(lip && lip.point.y > WATER_Y + 0.03, "the lip still stands above the water");
  geometry.dispose(); material.dispose();
});

test("every catalog material seated fresh has exactly one emerging waterline on its root", () => {
  for (const material of getMaterialDefinitions()) {
    const graph = material.generator.generate("plant-1", 8278, BASE);
    const crossings = waterlineCrossings(graph);
    assert.equal(crossings.length, 1, `${material.materialId}: ${crossings.map((c) => c.branchId).join(",")}`);
    const [crossing] = crossings;
    assert.equal(crossing.branchId, graph.rootBranchId);
    assert.equal(crossing.emerging, true);
    assert.equal(crossing.point.y, WATER_Y);
    assert.ok(Math.hypot(crossing.point.x - BASE.x, crossing.point.z - BASE.z) < 0.1, material.materialId);
    assert.ok(Math.abs(Math.hypot(crossing.tangent.x, crossing.tangent.y, crossing.tangent.z) - 1) < 1e-9);
  }
});

test("a line that dips back into the water gets a second, submerging mark", () => {
  const graph = createReed("plant-1", 8278, BASE);
  const root = graph.branches.get(graph.rootBranchId)!;
  const dipped = clonePlantGraph(graph);
  const branch = dipped.branches.get(root.id)!;
  // Presentation-only probe: fold the distal points below the surface.
  const last = branch.points.length - 1;
  branch.points = branch.points.map((point, index) =>
    index >= last - 1 ? { x: point.x * 0.2, y: 0.5, z: point.z * 0.2 } : point);
  const crossings = waterlineCrossings(dipped);
  assert.deepEqual(crossings.map((crossing) => crossing.emerging), [true, false]);
});

test("crossings outside the basin, on inactive records, or exactly on a vertex are not doubled", () => {
  const graph = createReed("plant-1", 8278, BASE);
  const outside = clonePlantGraph(graph);
  for (const branch of outside.branches.values()) {
    branch.points = branch.points.map((point) => ({ ...point, x: point.x + 3 }));
  }
  assert.equal(waterlineCrossings(outside).length, 0);

  const inactive = clonePlantGraph(graph);
  inactive.branches.get(inactive.rootBranchId)!.active = false;
  assert.equal(waterlineCrossings(inactive).length, 0);

  const onVertex = clonePlantGraph(graph);
  const root = onVertex.branches.get(onVertex.rootBranchId)!;
  root.points = root.points.map((point, index) => (index === 1 ? { ...point, y: WATER_Y } : point));
  assert.equal(waterlineCrossings(onVertex).length, 1);
});

test("the studio derives one mark per crossing without touching the graph, and prune preview hides doomed marks", () => {
  const graph = createFloweringBranch("plant-1", 8278, BASE);
  const before = serializePlantGraph(graph);
  const { studio, scene, dispose } = studioFixture(graph);
  const group = scene.getObjectByName("waterline:plant:plant-1");
  assert.ok(group, "waterline group is rebuilt from the graph");
  assert.equal(group.children.length, 1);
  assert.equal(group.children[0].visible, true);
  assert.equal(serializePlantGraph(graph), before, "presentation never writes to the graph");

  // A trunk cut keeps the proximal trunk, whose waterline stays visible.
  studio.setCutPreview({ plantId: graph.id, plan: previewPrune(graph, graph.rootBranchId, 0.8) });
  assert.equal(group.children[0].visible, true);
  studio.setCutPreview(null);

  studio.removeGraph(graph.id);
  assert.equal(scene.getObjectByName("waterline:plant:plant-1"), undefined, "marks leave with their plant");
  dispose();
});

test("a prune preview hides the submerging mark on the doomed tip and restores it on cancel", () => {
  const reed = createReed("plant-1", 8278, BASE);
  const dipped = clonePlantGraph(reed);
  const root = dipped.branches.get(dipped.rootBranchId)!;
  const last = root.points.length - 1;
  root.points = root.points.map((point, index) =>
    index >= last - 1 ? { x: point.x * 0.2, y: 0.5, z: point.z * 0.2 } : point);
  const crossings = waterlineCrossings(dipped);
  assert.equal(crossings.length, 2);
  assert.ok(crossings[1].distance > crossings[0].distance);

  const { studio, scene, dispose } = studioFixture(dipped);
  const group = scene.getObjectByName("waterline:plant:plant-1")!;
  const cut = (crossings[0].distance + crossings[1].distance) / 2;
  studio.setCutPreview({ plantId: dipped.id, plan: previewPrune(dipped, root.id, Math.max(0.7, cut)) });
  assert.deepEqual(group.children.map((mark) => mark.visible), [true, false]);
  studio.setCutPreview(null);
  assert.deepEqual(group.children.map((mark) => mark.visible), [true, true]);
  dispose();
});
