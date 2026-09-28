import assert from "node:assert/strict";
import test from "node:test";
import * as THREE from "three";
import { createReed, createSingleFlower, sampleBranch, toCanonicalPlantGraph } from "../../src/core/index.ts";
import type { PlantGraph } from "../../src/core/types.ts";
import { STUDIO_VERTICAL_FOV } from "../../src/presentation/ThreeStudio.ts";
import { studioFixture } from "./studioFixture.ts";

/** Production geometry, projection, cues and picking. Only GPU/DOM drawing is omitted. */
function acquisitionStudio(graph: PlantGraph, width = 320, height = 640) {
  const fixture = studioFixture(graph, width, height);
  const { studio, scene } = fixture;
  Object.assign(studio, {
    options: { debugHitTargets: false, stageLens: true },
    baseVerticalFov: STUDIO_VERTICAL_FOV, stageTopInset: 0, lens: null,
    cameraTarget: new THREE.Vector3(0, 2.55, 0),
    shapeAffordances: { visible: true, bendVariant: "bead", transactionActive: false },
  });
  delete studio.updateAffordances;
  studio.baseHandle = studio.buildBaseHandle();
  studio.bendHandle = studio.buildBendHandle();
  studio.touchCue = studio.buildTouchCue();
  scene.add(studio.baseHandle.group, studio.bendHandle.group, studio.touchCue, studio.pendingRoot);
  studio.setStageTopInset(186);
  studio.setSelection({ plantId: graph.id, branchId: graph.rootBranchId });
  // Max portrait zoom is precisely where world-only proxies become small.
  studio.applyInspectDolly(studio.captureCameraOrbit(), 2);
  return fixture;
}

function reed() { return createReed("plant-1", 8278, { x: 0, y: 0.55, z: 0 }); }

function projectedNormal(studio: any, branch: any, fraction: number) {
  const position = sampleBranch(branch, branch.activeLength * fraction).position;
  const next = sampleBranch(branch, branch.activeLength * (fraction + 0.01)).position;
  const p = studio.projectPoint(position);
  const q = studio.projectPoint(next);
  const dx = q.clientX - p.clientX, dy = q.clientY - p.clientY;
  const length = Math.hypot(dx, dy);
  return { x: p.clientX, y: p.clientY, nx: -dy / length, ny: dx / length };
}

test("pending insertion marks the exact pin field even while the source-rail ghost is hidden", () => {
  const graph = reed();
  const before = JSON.stringify(toCanonicalPlantGraph(graph));
  const { studio, dispose } = acquisitionStudio(graph);
  try {
    studio.kenzanGlow = studio.buildStudio().kenzanGlow;
    studio.setPendingGraph(graph, { visible: false, valid: false });
    assert.equal(studio.pendingPlant.group.visible, false);
    assert.equal(studio.kenzanGlow.visible, true, "destination is shown at acquisition over the rail");
    assert.equal(studio.kenzanGlow.material.color.getHex(), 0xc47a4c,
      "a source-rail acquisition shows a neutral destination, not an error");
    assert.equal(studio.kenzanGlow.geometry.parameters.radius, 1.22);
    assert.equal(studio.kenzanGlow.position.y, 0.55, "outline projects from the true insertion plane");
    assert.equal(studio.kenzanGlow.material.depthTest, false, "water cannot obscure the guide");
    assert.ok(studio.kenzanGlow.children.length > 0, "pale under-outline gives value contrast");
    for (const view of ["front", "three-quarter", "above"]) {
      studio.setCanonicalView(view, false);
      for (const sign of [-1, 1]) {
        const inside = studio.projectPoint({ x: sign * 1.22 * 0.99, y: 0.55, z: 0 });
        const outside = studio.projectPoint({ x: sign * 1.22 * 1.01, y: 0.55, z: 0 });
        assert.equal(studio.intersectKenzanPlane(inside.clientX, inside.clientY)?.valid, true);
        assert.equal(studio.intersectKenzanPlane(outside.clientX, outside.clientY)?.valid, false,
          "outline does not enlarge or snap the allowed field");
      }
    }
    studio.setPendingGraph(null);
    assert.equal(studio.kenzanGlow.visible, false);
    assert.equal(JSON.stringify(toCanonicalPlantGraph(graph)), before);
  } finally { dispose(); }
});

test("selected handles acquire within a bounded CSS envelope at portrait zoom-out", () => {
  for (const [width, height] of [[320, 640], [390, 844]]) {
    const graph = reed();
    const { studio, dispose } = acquisitionStudio(graph, width, height);
    try {
      for (const kind of ["base", "bend"] as const) {
        const handle = kind === "base" ? studio.baseHandle : studio.bendHandle;
        const p = studio.projectPoint(handle.group.position);
        const x = p.clientX + 15, y = p.clientY;
        studio.setRaycaster(x, y);
        assert.equal(studio.raycaster.intersectObject(handle.hit, false).length, 0,
          "the probe misses the old world proxy");
        const winner = studio.collectHitCandidates(x, y)[0];
        assert.equal(winner?.kind, kind, `${width}: ${kind}`);
        assert.equal(winner?.plantId, graph.id);
        assert.ok(!studio.collectHitCandidates(p.clientX + 17, p.clientY)
          .some((candidate: any) => candidate.kind === kind), "no unbounded nearest-handle snapping");
      }
      const bead = studio.bendHandle.group.getObjectByName("bend-bead");
      const centre = studio.bendHandle.group.position;
      const p = studio.projectPoint(centre);
      const right = new THREE.Vector3().setFromMatrixColumn(studio.camera.matrixWorld, 0);
      const edge = studio.projectPoint(centre.clone().addScaledVector(right, 0.105 * bead.scale.x));
      assert.ok(Math.hypot(edge.clientX - p.clientX, edge.clientY - p.clientY) >= 6 - 1e-6,
        "the visible bead keeps a recognisable 12px diameter");
      assert.equal(studio.bendHandle.hit.scale.x, 1, "visual enlargement does not enlarge the old proxy");
      studio.setShapeAffordances({ visible: false, bendVariant: "bead", transactionActive: false });
      assert.ok(studio.collectHitCandidates(p.clientX + 15, p.clientY)
        .every((candidate: any) => candidate.kind !== "bend" && candidate.kind !== "base"));
    } finally { dispose(); }
  }
});

test("thin stem near misses acquire at eight CSS pixels without nearest-object snapping", () => {
  const graph = reed();
  const before = JSON.stringify(toCanonicalPlantGraph(graph));
  const { studio, visual, dispose } = acquisitionStudio(graph);
  try {
    studio.setShapeAffordances({ visible: false, bendVariant: "bead", transactionActive: false });
    const branch = graph.branches.get(graph.rootBranchId)!;
    const p = projectedNormal(studio, branch, 0.78);
    const x = p.x + 7.9 * p.nx, y = p.y + 7.9 * p.ny;
    studio.setRaycaster(x, y);
    assert.equal(studio.raycaster.intersectObject(visual.branches.get(branch.id).hit, false).length, 0);
    const candidates = studio.collectHitCandidates(x, y);
    assert.equal(candidates[0]?.branchId, branch.id);
    assert.ok(candidates[0].screenDistancePx > 7.5);
    assert.equal(studio.collectHitCandidates(p.x + 9 * p.nx, p.y + 9 * p.ny).length, 0);
    const intersect = studio.raycaster.intersectObjects.bind(studio.raycaster);
    studio.raycaster.intersectObjects = (...args: any[]) => intersect(...args).reverse();
    assert.deepEqual(studio.collectHitCandidates(x, y), candidates);
    assert.equal(JSON.stringify(toCanonicalPlantGraph(graph)), before);
  } finally { dispose(); }
});

test("new proximity handles never steal a visible flower surface", () => {
  const graph = createSingleFlower("plant-1", 8278, { x: 0, y: 0.55, z: 0 });
  const { studio, visual, dispose } = acquisitionStudio(graph);
  try {
    // Find an actual visible petal through production raycasting, then put the
    // selected handle fifteen screen pixels away, outside its old world proxy.
    const bloom = [...graph.organs.values()].find((organ) => organ.kind === "bloom")!;
    const center = studio.projectPoint(visual.organs.get(bloom.id).group.position);
    let press: { x: number; y: number } | null = null;
    studio.bendHandle.group.visible = false;
    for (let y = center.clientY - 20; y <= center.clientY + 20 && !press; y += 1) {
      for (let x = center.clientX - 20; x <= center.clientX + 20 && !press; x += 1) {
        if (studio.collectHitCandidates(x, y).some((candidate: any) =>
          candidate.organId === bloom.id && candidate.screenDistancePx === 0)) press = { x, y };
      }
    }
    assert.ok(press, "an actual visible petal exists");
    const original = studio.collectHitCandidates(press.x, press.y)[0];
    const nearbyPoint = studio.intersectClientPlane(press.x + 15, press.y,
      studio.cameraFacingPlaneThrough(original.worldPoint));
    assert.ok(nearbyPoint);
    studio.bendHandle.group.position.set(nearbyPoint.x, nearbyPoint.y, nearbyPoint.z);
    studio.bendHandle.group.visible = true;
    studio.setRaycaster(press.x, press.y);
    assert.equal(studio.raycaster.intersectObject(studio.bendHandle.hit, false).length, 0);
    assert.equal(studio.collectHitCandidates(press.x, press.y)[0].stableId, original.stableId);
    assert.ok(!studio.collectHitCandidates(press.x, press.y).some((candidate: any) => candidate.kind === "bend"));
  } finally { dispose(); }
});

test("overlapping fallback stems use stable IDs, independent of plant enumeration", () => {
  const graph = reed();
  const { studio, dispose } = acquisitionStudio(graph);
  try {
    const other = createReed("another", 8278, { x: 0, y: 0.55, z: 0 });
    studio.upsertGraph(other);
    studio.setSelection(null);
    const branch = graph.branches.get(graph.rootBranchId)!;
    const p = projectedNormal(studio, branch, 0.78);
    const x = p.x + 7.9 * p.nx, y = p.y + 7.9 * p.ny;
    const before = studio.collectHitCandidates(x, y);
    assert.equal(before.length, 2);
    assert.equal(before[0].plantId, "another");
    studio.plants = new Map([...studio.plants.entries()].reverse());
    assert.deepEqual(studio.collectHitCandidates(x, y), before);
    assert.ok(before.every((candidate: any) => candidate.kind === "branch" && candidate.priorityTier === 2));
  } finally { dispose(); }
});
