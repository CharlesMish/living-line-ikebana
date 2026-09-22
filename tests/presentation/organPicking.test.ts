import assert from "node:assert/strict";
import test from "node:test";
import * as THREE from "three";
import { createReed, createSingleFlower, prepareMaterialInsertion, sampleBranch, toCanonicalPlantGraph, translatePendingGraph } from "../../src/core/index.ts";
import type { PlantGraph } from "../../src/core/types.ts";
import { ThreeStudio, STUDIO_VERTICAL_FOV } from "../../src/presentation/ThreeStudio.ts";
import { disposeObject } from "../../src/presentation/geometry.ts";

// Exercise production meshes, transforms, proxies and arbitration without a GPU.
// The harness supplies the canvas bounds and suppresses only drawing/chrome.
function fixture(graph: PlantGraph) {
  const scene = new THREE.Scene();
  const botanicalRoot = new THREE.Group();
  const pendingRoot = new THREE.Group();
  scene.add(botanicalRoot, pendingRoot);
  const camera = new THREE.PerspectiveCamera(STUDIO_VERTICAL_FOV, 390 / 844, 0.1, 80);
  camera.position.set(0, 3.7, 15);
  camera.lookAt(0, 2.55, 0);
  camera.updateMatrixWorld(true);
  const studio = Object.assign(Object.create(ThreeStudio.prototype), {
    scene, botanicalRoot, pendingRoot, camera,
    raycaster: new THREE.Raycaster(),
    plants: new Map(),
    canvas: { getBoundingClientRect: () => ({ left: 0, top: 0, width: 390, height: 844 }) },
    options: { debugHitTargets: false },
    baseHandle: { group: { visible: false } },
    bendHandle: { group: { visible: false } },
    selection: null,
    cutPreview: null,
    updateAffordances() {},
    updateCutCollar() {},
    requestRender() {},
  });
  function add(graph: PlantGraph) {
    const plant = studio.createPlantVisual(graph, false);
    studio.plants.set(graph.id, plant);
    scene.updateMatrixWorld(true);
    return plant;
  }
  const plant = add(graph);
  return { studio, plant, add, dispose: () => disposeObject(scene) };
}

function prepared(material: string) {
  const result = prepareMaterialInsertion(material, 1, { x: 0, y: 0.55, z: 0 });
  assert.ok(result.ok);
  return result.graph;
}

test("a visible small leaf wins over the stem behind it without moving its acquired graph station", () => {
  const graph = prepared("single-flower");
  const before = JSON.stringify(toCanonicalPlantGraph(graph));
  const { studio, plant, dispose } = fixture(graph);
  try {
    // Before surface arbitration this exact visible blade press chose the trunk:
    // 1.45 CSS px to the trunk versus 2.75 px to the leaf's attachment.
    const x = 200.17873020669663;
    const y = 462.9665032020409;
    const candidates = studio.collectHitCandidates(x, y);
    const winner = candidates[0];
    assert.equal(winner.organId, "plant-1:leaf-1");
    assert.equal(winner.branchId, "plant-1:petiole-1");
    assert.equal(winner.screenDistancePx, 0);
    assert.ok(candidates.some((candidate: any) => candidate.branchId === graph.rootBranchId));
    const organ = graph.organs.get(winner.organId)!;
    const branch = graph.branches.get(organ.branchId)!;
    assert.equal(winner.materialDistance, organ.distance);
    assert.deepEqual(winner.worldPoint, sampleBranch(branch, organ.distance).position);
    studio.setRaycaster(x, y);
    const blade = plant.organs.get(organ.id).group.children[0];
    const realHit = studio.raycaster.intersectObject(blade, false)[0];
    assert.ok(realHit, "the regression coordinate is on the actual visible blade");
    assert.ok(Math.abs(winner.rayDepth - realHit.distance) < 1e-6);
    assert.equal(JSON.stringify(toCanonicalPlantGraph(graph)), before);
  } finally { dispose(); }
});

test("an exposed flower-volume tuft selects its own group independent of intersection order", () => {
  const graph = prepared("flower-volume");
  const { studio, dispose } = fixture(graph);
  try {
    // Visible group 5 petal; ranking only graph attachments previously chose
    // group 1, despite group 5 being the frontmost rendered material here.
    const candidates = studio.collectHitCandidates(224, 224);
    const winner = candidates[0];
    assert.equal(winner.organId, "plant-1:bloom-5");
    assert.equal(winner.branchId, "plant-1:group-5");
    assert.equal(winner.screenDistancePx, 0);
    assert.ok(candidates.some((candidate: any) => candidate.organId === "plant-1:bloom-1"));
    const intersect = studio.raycaster.intersectObjects.bind(studio.raycaster);
    studio.raycaster.intersectObjects = (...args: any[]) => intersect(...args).reverse();
    assert.deepEqual(studio.collectHitCandidates(224, 224), candidates);
  } finally { dispose(); }
});

test("visible organ hits retain selected-plant priority and the enlarged near-miss envelope", () => {
  const graph = prepared("single-flower");
  const { studio, add, dispose } = fixture(graph);
  try {
    // A soft acquisition near the blade must remain possible: detailed triangle
    // picking refines rank only, rather than replacing the forgiving proxy.
    let halo = null;
    for (let y = 448; y <= 475 && !halo; y += 1) {
      for (let x = 189; x <= 222 && !halo; x += 1) {
        halo = studio.collectHitCandidates(x, y).find((candidate: any) =>
          candidate.organId === "plant-1:leaf-1" && candidate.screenDistancePx > 0) ?? null;
      }
    }
    assert.ok(halo, "the leaf still admits a press beside its exact visible surface");
    assert.equal(halo.branchId, "plant-1:petiole-1");

    const selected = createSingleFlower("selected", 8278, { x: 0, y: 0.55, z: -0.1 });
    add(selected);
    studio.selection = { plantId: selected.id, branchId: selected.rootBranchId };
    const candidates = studio.collectHitCandidates(200.17873020669663, 462.9665032020409);
    assert.ok(candidates.some((candidate: any) => candidate.organId === "plant-1:leaf-1" && candidate.screenDistancePx === 0));
    assert.equal(candidates[0].plantId, selected.id);
    assert.equal(candidates[0].priorityTier, 1);
  } finally { dispose(); }
});

test("a real foreground stem wins over a leaf behind it even off the stem centerline", () => {
  const graph = prepared("single-flower");
  const { studio, add, dispose } = fixture(graph);
  try {
    const x = 200.17873020669663;
    const y = 462.9665032020409;
    studio.setRaycaster(x, y);
    const foregroundPoint = studio.raycaster.ray.at(14, new THREE.Vector3());
    const reed = createReed("foreground", 9255, { x: 0, y: 0.55, z: 0 });
    const culm = reed.branches.get(reed.rootBranchId)!;
    // Keep the seated root height while putting a generated reed across the
    // known leaf press. Offset 0.005 units so the visible stem covers the press,
    // but its centerline is a positive CSS distance away.
    let low = 0;
    let high = culm.activeLength;
    for (let index = 0; index < 40; index += 1) {
      const middle = (low + high) / 2;
      if (sampleBranch(culm, middle).position.y < foregroundPoint.y) low = middle;
      else high = middle;
    }
    const point = sampleBranch(culm, (low + high) / 2).position;
    const foreground = translatePendingGraph(reed, {
      x: foregroundPoint.x - point.x + 0.005,
      y: 0.55,
      z: foregroundPoint.z - point.z,
    });
    const visual = add(foreground);
    const centerline = studio.closestProjectedPointOnBranch(foreground.id, foreground.rootBranchId, x, y);
    assert.ok(centerline.screenDistancePx > 0.1);
    studio.setRaycaster(x, y);
    const actualStem = studio.raycaster.intersectObject(visual.branches.get(foreground.rootBranchId).mesh, false)[0];
    assert.ok(actualStem, "this press genuinely touches the visible foreground tube");
    const candidates = studio.collectHitCandidates(x, y);
    const rearLeaf = candidates.find((candidate: any) => candidate.organId === "plant-1:leaf-1");
    assert.equal(rearLeaf.screenDistancePx, 0);
    assert.equal(candidates[0].branchId, foreground.rootBranchId);
    assert.equal(candidates[0].screenDistancePx, 0);
    assert.ok(candidates[0].rayDepth < rearLeaf.rayDepth);
    assert.ok(Math.abs(candidates[0].rayDepth - actualStem.distance) < 1e-6);
    assert.equal(candidates[0].materialDistance, centerline.materialDistance);
    assert.deepEqual(candidates[0].worldPoint, centerline.worldPoint);
  } finally { dispose(); }
});
