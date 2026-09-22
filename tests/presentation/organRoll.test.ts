import assert from "node:assert/strict";
import test from "node:test";
import * as THREE from "three";

import { createSingleFlower, rollBloomSpin } from "../../src/core/index.ts";
import { ThreeStudio } from "../../src/presentation/ThreeStudio.ts";
import { disposeObject } from "../../src/presentation/geometry.ts";

test("production organ group turns with bloom spin and the stalk stays put", () => {
  const graph = createSingleFlower("plant-1", 8278, { x: 0, y: 0.55, z: 0 });
  const bloom = graph.organs.get("plant-1:bloom")!;
  const studio = Object.create(ThreeStudio.prototype) as ThreeStudio & {
    createPlantVisual(graph: typeof graph, pending: boolean): {
      graph: typeof graph;
      group: THREE.Group;
      organs: Map<string, { group: THREE.Group }>;
    };
    syncPlantVisual(visual: { graph: typeof graph; group: THREE.Group }): void;
  };
  Object.assign(studio, {
    options: { debugHitTargets: false },
    botanicalRoot: new THREE.Group(),
    pendingRoot: new THREE.Group(),
    plants: new Map(),
    selection: null,
    cutPreview: null,
    pendingValidity: null,
    shapeAffordances: {
      visible: false,
      bendVariant: "bead",
      transactionActive: false,
      touchCueDistance: null,
      showSelection: true,
    },
    baseHandle: { group: new THREE.Group() },
    bendHandle: { group: new THREE.Group() },
    touchCue: new THREE.Group(),
    cutCollar: { visible: false },
    camera: new THREE.PerspectiveCamera(),
    cameraTarget: new THREE.Vector3(),
    requestRender() {},
    updateAffordances() {},
    updateCutCollar() {},
  });

  const visual = studio.createPlantVisual(graph, false);
  visual.group.updateMatrixWorld(true);
  const group = visual.organs.get(bloom.id)!.group;
  const before = new THREE.Vector3().setFromMatrixColumn(group.matrixWorld, 2).normalize();
  const beforePosition = new THREE.Vector3().setFromMatrixPosition(group.matrixWorld);

  const rolled = rollBloomSpin(graph, bloom.id, 0.9);
  visual.graph = rolled;
  studio.syncPlantVisual(visual);
  visual.group.updateMatrixWorld(true);
  const after = new THREE.Vector3().setFromMatrixColumn(group.matrixWorld, 2).normalize();
  const afterPosition = new THREE.Vector3().setFromMatrixPosition(group.matrixWorld);
  const tangent = new THREE.Vector3().setFromMatrixColumn(group.matrixWorld, 1).normalize();

  assert.ok(before.distanceTo(after) > 0.2, "bloom spin must turn the production face normal");
  assert.ok(beforePosition.distanceTo(afterPosition) < 1e-6, "rolling spin must not move the organ origin");
  assert.ok(Math.abs(after.dot(tangent)) < 1e-5, "the face stays perpendicular to the supporting tangent");
  assert.deepEqual(
    rolled.branches.get(rolled.rootBranchId)!.points,
    graph.branches.get(graph.rootBranchId)!.points,
  );
  disposeObject(visual.group);
});
