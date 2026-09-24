import assert from "node:assert/strict";
import test from "node:test";
import * as THREE from "three";
import { add, bendBranch, createNoddingFlower, createNoddingFlowerV2, sampleBranch } from "../../src/core/index.ts";
import { ThreeStudio } from "../../src/presentation/ThreeStudio.ts";
import { disposeObject } from "../../src/presentation/geometry.ts";

test("production bell follows the bent v2 neck and uses a green attachment without changing v1", () => {
  const studio = Object.assign(Object.create(ThreeStudio.prototype), {
    options: { debugHitTargets: false }, botanicalRoot: new THREE.Group(),
    updateAffordances() {}, updateCutCollar() {}, requestRender() {},
  });
  for (const seed of [8278, 9255, 10232]) {
    const graph = createNoddingFlowerV2("plant-1", seed, { x: 0, y: 0.55, z: 0 });
    const neck = graph.branches.get("plant-1:neck")!;
    const distance = neck.activeLength * 0.76;
    const edited = bendBranch(graph, { branchId: neck.id, stationDistance: distance,
      target: add(sampleBranch(neck, distance).position, { x: 0.5, y: 0.2, z: 0.1 }) });
    const old = createNoddingFlower("plant-1", seed, { x: 0, y: 0.55, z: 0 });
    for (const specimen of [old, graph, edited]) {
      const visual = studio.createPlantVisual(specimen, false);
      visual.group.updateMatrixWorld(true);
      const organ = specimen.organs.get("plant-1:bloom")!;
      const stalk = specimen.branches.get(organ.branchId)!;
      const frame = sampleBranch(stalk, organ.distance);
      const group: THREE.Group = visual.organs.get(organ.id).group;
      assert.ok(group.position.distanceTo(new THREE.Vector3(frame.position.x, frame.position.y, frame.position.z)) < 1e-8);
      const mouth = new THREE.Vector3(0, 1, 0).applyQuaternion(group.quaternion);
      assert.ok(mouth.dot(new THREE.Vector3(frame.tangent.x, frame.tangent.y, frame.tangent.z)) > 1 - 1e-8);
      const shell = group.children.find(child => child instanceof THREE.Mesh && child.geometry.name === "living-line/bell") as THREE.Mesh<THREE.BufferGeometry, THREE.MeshStandardMaterial>;
      assert.ok(shell);
      const color = shell.geometry.getAttribute("color");
      if (specimen.generatorVersion === "nodding-flower-v2") {
        assert.equal(shell.material.color.getHex(), 0xffffff);
        assert.ok(color.getY(0) > color.getX(0) && color.getY(0) > color.getZ(0), "attachment is green");
        const lastRing = color.count - 3;
        assert.ok(color.getZ(lastRing) > color.getX(lastRing), "mouth retains blue corolla color");
      } else {
        assert.equal(shell.material.color.getHex(), 0x7d94b8);
        assert.ok(color.getZ(0) > color.getY(0), "v1 sleeve is preserved");
      }
      disposeObject(visual.group);
    }
  }
});
