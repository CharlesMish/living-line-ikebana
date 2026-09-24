import assert from "node:assert/strict";
import test from "node:test";
import * as THREE from "three";
import { add, aimBranch, applyPrune, bendBranch, createFloweringBranch, previewPrune, sampleBranch, translatePlantBase } from "../../src/core/index.ts";
import type { PlantGraph } from "../../src/core/types.ts";
import { studioFixture } from "./studioFixture.ts";

// Regression investigation for a floating bud reported on a real device.
// These checks cover production geometry/state, not a GPU or device reproduction.
function assertLiveSupports(graph: PlantGraph, visual: any) {
  visual.group.updateMatrixWorld(true);
  for (const branch of graph.branches.values()) {
    if (!branch.active) continue;
    const mesh: THREE.Mesh<THREE.BufferGeometry, THREE.MeshStandardMaterial> = visual.branches.get(branch.id).mesh;
    assert.ok(mesh.visible, branch.id);
    assert.equal(mesh.material.opacity, 1, branch.id);
    assert.equal(mesh.material.transparent, false, branch.id);
    assert.equal(mesh.material.depthWrite, true, branch.id);
    const positions = mesh.geometry.getAttribute("position");
    const indices = mesh.geometry.getIndex()!;
    assert.ok(indices.count > 0);
    for (let i = 0; i < indices.count; i++) assert.ok(indices.getX(i) < positions.count);
    for (let row = 0; row < branch.points.length; row++) {
      const center = new THREE.Vector3();
      for (let radial = 0; radial < 10; radial++) {
        const vertex = new THREE.Vector3().fromBufferAttribute(positions, row * 10 + radial);
        assert.ok(vertex.toArray().every(Number.isFinite));
        center.add(vertex);
        assert.ok(mesh.geometry.boundingBox!.containsPoint(vertex));
        assert.ok(mesh.geometry.boundingSphere!.distanceToPoint(vertex) < 1e-6);
      }
      center.multiplyScalar(0.1);
      const point = branch.points[row];
      assert.ok(center.distanceTo(new THREE.Vector3(point.x, point.y, point.z)) < 1e-6, `${branch.id}: tube follows graph`);
    }
  }
  for (const organ of graph.organs.values()) {
    if (!organ.active) continue;
    const support = graph.branches.get(organ.branchId)!;
    assert.ok(support.active);
    const position = sampleBranch(support, organ.distance).position;
    const group = visual.organs.get(organ.id).group;
    assert.ok(group.visible);
    assert.ok(group.position.distanceTo(new THREE.Vector3(position.x, position.y, position.z)) < 1e-8);
  }
}

test("bud supports remain complete after prune cancellation, retained-node cuts, aim, bend and moving the base", () => {
  for (const seed of [8278, 9255, 10232]) {
    let graph = createFloweringBranch("plant-1", seed, { x: 0, y: 0.55, z: 0 });
    const { studio, visual, dispose } = studioFixture(graph);
    try {
      const bud = [...graph.organs.values()].find(organ => organ.kind === "bud")!;
      const stalk = graph.branches.get(bud.branchId)!;
      const parent = graph.branches.get(stalk.parentId!)!;
      for (const cutAt of [stalk.parentDistance - 0.1, stalk.parentDistance, parent.activeLength - 0.03]) {
        studio.setCutPreview({ plantId: graph.id, plan: previewPrune(graph, parent.id, cutAt) });
        studio.setCutPreview(null);
        assertLiveSupports(graph, visual);
      }
      const keptPlan = previewPrune(graph, parent.id, stalk.parentDistance);
      studio.setCutPreview({ plantId: graph.id, plan: keptPlan });
      graph = applyPrune(graph, keptPlan);
      studio.upsertGraph(graph);
      studio.setCutPreview(null);
      assert.ok(graph.organs.get(bud.id)!.active);
      assertLiveSupports(graph, visual);
      const tip = sampleBranch(graph.branches.get(stalk.id)!, stalk.activeLength).position;
      graph = aimBranch(graph, stalk.id, tip, add(tip, { x: 0.3, y: -0.25, z: 0.4 }));
      studio.upsertGraph(graph);
      assertLiveSupports(graph, visual);
      const root = graph.branches.get(graph.rootBranchId)!;
      const station = root.activeLength * 0.54;
      graph = bendBranch(graph, { branchId: root.id, stationDistance: station,
        target: add(sampleBranch(root, station).position, { x: -0.7, y: 0, z: 0.2 }) });
      studio.upsertGraph(graph);
      assertLiveSupports(graph, visual);
      graph = translatePlantBase(graph, { x: 0.6, y: 0.55, z: -0.3 });
      studio.upsertGraph(graph);
      assertLiveSupports(graph, visual);
    } finally { dispose(); }
  }
});
