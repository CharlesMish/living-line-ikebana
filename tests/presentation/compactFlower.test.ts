import assert from "node:assert/strict";
import test from "node:test";
import * as THREE from "three";
import { applyPrune, createCompactFlower, previewPrune } from "../../src/core/index.ts";
import { getMaterialAppearance } from "../../src/presentation/materialAppearance.ts";
import { studioFixture } from "./studioFixture.ts";

test("one compact cup stays within its acquisition envelope and acquires its own stalk from two views", () => {
  for (const seed of [8278, 9255, 10232]) {
    const graph = createCompactFlower("plant-1", seed, { x: 0, y: 0.55, z: 0 });
    const { studio, visual, camera, dispose } = studioFixture(graph);
    try {
      const bloom = graph.organs.get("plant-1:bloom")!;
      const organ = visual.organs.get(bloom.id);
      const tufts: THREE.Mesh[] = [];
      visual.group.traverse((node: THREE.Object3D) => {
        if (node instanceof THREE.Mesh && node.geometry.name === "living-line/compact-cup-corolla") tufts.push(node);
      });
      assert.equal(tufts.length, 1, "the head is one rounded cup, not five stacked organs");
      const tuft = tufts[0]!;
      const positions = tuft.geometry.getAttribute("position");
      const vertex = new THREE.Vector3();
      const radius = getMaterialAppearance(graph.generatorVersion).bloom.hitRadius;
      for (let i = 0; i < positions.count; i += 1) {
        vertex.fromBufferAttribute(positions, i);
        assert.ok(vertex.length() <= radius, "petal surface escaped the shared hit sphere");
      }
      for (const cameraPosition of [[0, 3.7, 15], [10, 8, 10]]) {
        camera.position.set(...cameraPosition as [number, number, number]);
        camera.lookAt(0, 2.55, 0);
        camera.updateMatrixWorld(true);
        let acquired = false;
        for (let i = 0; i < positions.count && !acquired; i += 5) {
          vertex.fromBufferAttribute(positions, i);
          tuft.localToWorld(vertex);
          vertex.project(camera);
          const candidates = studio.collectHitCandidates((vertex.x * 0.5 + 0.5) * 390, (-vertex.y * 0.5 + 0.5) * 844);
          const winner = candidates[0];
          acquired = winner?.organId === bloom.id && winner.branchId === bloom.branchId && winner.screenDistancePx === 0;
        }
        assert.ok(acquired, `seed ${seed}, camera ${cameraPosition}: head could not acquire its own pedicel`);
      }

      const pruned = applyPrune(graph, previewPrune(graph, bloom.branchId, bloom.distance));
      studio.upsertGraph(pruned);
      assert.equal(visual.organs.get(bloom.id), organ, "pruning retains the same derived record");
      assert.equal(organ.group.visible, false);
      assert.equal(visual.organs.get("plant-1:leaf-1").group.visible, true);
      studio.upsertGraph(graph);
      assert.equal(visual.organs.get(bloom.id), organ);
      assert.equal(organ.group.visible, true, "preview rollback restores that same head");
    } finally { dispose(); }
  }
});
