import assert from "node:assert/strict";
import test from "node:test";
import * as THREE from "three";

import { bendStationAtFraction, createLeafyShoot, sampleBranch } from "../../src/core/index.ts";
import { ThreeStudio } from "../../src/presentation/ThreeStudio.ts";

test("the single bead matches the supplied station and stays at 54% when omitted", () => {
  const graph = createLeafyShoot("plant-1", 8278, { x: 0, y: 0.55, z: 0 });
  const branch = graph.branches.get(graph.rootBranchId)!;
  const bendGroup = new THREE.Group();
  const studio = Object.create(ThreeStudio.prototype) as ThreeStudio & {
    fixedBendDistance: number | null;
    setShapeAffordances: ThreeStudio["setShapeAffordances"];
  };
  Object.assign(studio, {
    plants: new Map([[graph.id, {
      graph,
      branches: new Map([[branch.id, { selection: { visible: false } }]]),
    }]]),
    selection: { plantId: graph.id, branchId: branch.id },
    shapeAffordances: {
      visible: false,
      bendVariant: "bead",
      transactionActive: false,
      touchCueDistance: null,
      showSelection: true,
    },
    baseHandle: { group: new THREE.Group() },
    bendHandle: { group: bendGroup, hit: new THREE.Mesh() },
    touchCue: new THREE.Group(),
    camera: new THREE.PerspectiveCamera(),
    fixedBendDistance: null,
    requestRender() {},
  });

  studio.setShapeAffordances({
    visible: true,
    bendVariant: "bead",
    transactionActive: false,
    showSelection: true,
  });
  const middle = bendStationAtFraction(branch, 0.54)!;
  const middlePoint = sampleBranch(branch, middle).position;
  assert.equal(bendGroup.visible, true);
  assert.ok(Math.abs(bendGroup.position.x - middlePoint.x) < 1e-6);
  assert.ok(Math.abs(bendGroup.position.y - middlePoint.y) < 1e-6);
  assert.ok(Math.abs(bendGroup.position.z - middlePoint.z) < 1e-6);
  assert.equal(studio.fixedBendDistance, middle);

  const lower = bendStationAtFraction(branch, 0.32)!;
  studio.setShapeAffordances({
    visible: true,
    bendVariant: "bead",
    transactionActive: false,
    beadStationDistance: lower,
    showSelection: true,
  });
  const lowerPoint = sampleBranch(branch, lower).position;
  assert.equal(bendGroup.visible, true);
  assert.ok(Math.abs(bendGroup.position.y - lowerPoint.y) < 1e-6);
  assert.ok(Math.abs(lowerPoint.y - middlePoint.y) > 1e-3);
  assert.equal(studio.fixedBendDistance, lower);

  studio.setShapeAffordances({
    visible: true,
    bendVariant: "bead",
    transactionActive: true,
    beadStationDistance: lower,
    showSelection: true,
  });
  assert.equal(bendGroup.visible, false);

  studio.setShapeAffordances({
    visible: true,
    bendVariant: "touch",
    transactionActive: false,
    beadStationDistance: lower,
    showSelection: true,
  });
  assert.equal(bendGroup.visible, false);
  assert.equal(studio.fixedBendDistance, null);
});
