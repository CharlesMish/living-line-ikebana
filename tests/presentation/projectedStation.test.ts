import assert from "node:assert/strict";
import test from "node:test";
import * as THREE from "three";
import {
  aimBranch, applyPrune, bendBranchAtFraction, createArchingTrailer,
  createNoddingFlowerV2, createReed, distance, previewPrune, sampleBranch,
  serializePlantGraph, translatePendingGraph,
} from "../../src/core/index.ts";
import type { PlantGraph } from "../../src/core/types.ts";
import { studioFixture } from "./studioFixture.ts";

/** C03's authored reed-forward pose, constructed with unchanged public craft operations. */
function lowReed() {
  let graph = createReed("plant-1", 8278, { x: 0, y: 0.55, z: 0 });
  const root = graph.branches.get(graph.rootBranchId)!;
  graph = aimBranch(graph, root.id, root.points.at(-1)!, { x: 1.45, y: 1.55, z: 2.35 });
  graph = bendBranchAtFraction(graph, root.id, { x: 1.2, y: 0.95, z: 2.05 }, 0.56);
  return translatePendingGraph(graph, { x: 0.06, y: 0.55, z: 0.62 });
}

function assertStationRoundTrips(graph: PlantGraph, width: number, height: number) {
  const { studio, dispose } = studioFixture(graph, width, height);
  const before = serializePlantGraph(graph);
  try {
    for (const branch of graph.branches.values()) {
      let offset = 0;
      for (const length of branch.restLengths) {
        for (const fraction of [0.2, 0.5, 0.8]) {
          const expectedDistance = offset + length * fraction;
          const expectedPoint = sampleBranch(branch, expectedDistance).position;
          const press = studio.projectPoint(expectedPoint);
          const acquired = studio.closestProjectedPointOnBranch(graph.id, branch.id, press.clientX, press.clientY);
          assert.ok(acquired);
          assert.ok(Math.abs(acquired.materialDistance - expectedDistance) < 1e-8,
            `${branch.id}: ${expectedDistance} was acquired as ${acquired.materialDistance}`);
          assert.ok(distance(acquired.worldPoint, expectedPoint) < 1e-8);
          const reprojected = studio.projectPoint(acquired.worldPoint);
          assert.ok(Math.hypot(reprojected.clientX - press.clientX, reprojected.clientY - press.clientY) < 1e-7);
        }
        offset += length;
      }
    }
    assert.equal(serializePlantGraph(graph), before, "projection cannot edit canonical material");
  } finally { dispose(); }
}

test("projected stations round-trip on a low reed, nodding neck and trailer at desktop and phone sizes", () => {
  for (const [width, height] of [[1280, 800], [390, 844]]) {
    for (const graph of [lowReed(),
      createNoddingFlowerV2("nodding", 8278, { x: 0, y: 0.55, z: 0 }),
      createArchingTrailer("trailer", 8278, { x: 0, y: 0.55, z: 0 })]) {
      assertStationRoundTrips(graph, width, height);
    }
  }
});

test("a low-reed prune uses the point under the press for both preview and committed cut", () => {
  const graph = lowReed();
  const branch = graph.branches.get(graph.rootBranchId)!;
  const expectedDistance = branch.activeLength - branch.restLengths.at(-1)! / 2;
  const expectedPoint = sampleBranch(branch, expectedDistance).position;
  const before = serializePlantGraph(graph);
  const { studio, visual, dispose } = studioFixture(graph, 1280, 800);
  try {
    const press = studio.projectPoint(expectedPoint);
    const candidate = studio.collectHitCandidates(press.clientX, press.clientY)[0];
    assert.equal(candidate.branchId, branch.id);
    const plan = previewPrune(graph, candidate.branchId, candidate.materialDistance);
    studio.setCutPreview({ plantId: graph.id, plan });
    const mesh = visual.branches.get(branch.id).mesh as THREE.Mesh<THREE.BufferGeometry>;
    const positions = mesh.geometry.getAttribute("position");
    // End cap has one centre followed by its ten separately shaded rim vertices.
    const cap = new THREE.Vector3().fromBufferAttribute(positions, positions.count - 11);
    assert.ok(cap.distanceTo(new THREE.Vector3(expectedPoint.x, expectedPoint.y, expectedPoint.z)) < 1e-6,
      "the displayed cut cap stays under the press");
    const edited = applyPrune(graph, plan);
    const cut = edited.branches.get(branch.id)!;
    assert.ok(Math.abs(cut.activeLength - expectedDistance) < 1e-8);
    assert.ok(distance(cut.points.at(-1)!, expectedPoint) < 1e-8,
      "commit uses the same physical station as preview");
    studio.setCutPreview(null);
    assert.equal(serializePlantGraph(graph), before, "preview cancellation leaves the acquisition graph exact");
  } finally { dispose(); }
});

test("the C03 low-reed misses are on its shadow, while visible material remains selectable", () => {
  const graph = lowReed();
  const { studio, dispose } = studioFixture(graph, 1280, 800);
  try {
    // F4 input-log seq 5–7. Screenshot 0004 shows a grey floor shadow here,
    // roughly 80–100px below the green reed. No hit halo should bridge this gap.
    for (const [x, y] of [[860, 652], [829, 638], [824, 636]]) {
      assert.deepEqual(studio.collectHitCandidates(x, y), []);
    }
    const branch = graph.branches.get(graph.rootBranchId)!;
    for (const fraction of [0.2, 0.4, 0.6, 0.8, 0.95]) {
      const point = sampleBranch(branch, branch.activeLength * fraction).position;
      const press = studio.projectPoint(point);
      assert.equal(studio.collectHitCandidates(press.clientX, press.clientY)[0]?.branchId, branch.id);
    }
  } finally { dispose(); }
});
