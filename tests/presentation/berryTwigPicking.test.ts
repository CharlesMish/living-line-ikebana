import assert from "node:assert/strict";
import test from "node:test";
import * as THREE from "three";
import { applyPrune, createBerryTwig, createBlossomSpray, createFloweringBranch, previewPrune } from "../../src/core/index.ts";
import type { PlantGraph } from "../../src/core/types.ts";
import { ThreeStudio, STUDIO_VERTICAL_FOV } from "../../src/presentation/ThreeStudio.ts";
import { disposeObject } from "../../src/presentation/geometry.ts";

const BASE = { x: 0, y: 0.55, z: 0 };
const PHONE = { width: 390, height: 844 };

function fixture(graph: PlantGraph) {
  const scene = new THREE.Scene();
  const botanicalRoot = new THREE.Group();
  const pendingRoot = new THREE.Group();
  scene.add(botanicalRoot, pendingRoot);
  const camera = new THREE.PerspectiveCamera(STUDIO_VERTICAL_FOV, PHONE.width / PHONE.height, 0.1, 80);
  camera.position.set(0, 3.7, 15);
  camera.lookAt(0, 2.55, 0);
  camera.updateProjectionMatrix();
  camera.updateMatrixWorld(true);
  const studio = Object.assign(Object.create(ThreeStudio.prototype), {
    scene, botanicalRoot, pendingRoot, camera,
    raycaster: new THREE.Raycaster(),
    plants: new Map(),
    canvas: { getBoundingClientRect: () => ({ left: 0, top: 0, width: PHONE.width, height: PHONE.height }) },
    options: { debugHitTargets: false },
    baseHandle: { group: { visible: false } },
    bendHandle: { group: { visible: false } },
    selection: null,
    cutPreview: null,
    updateAffordances() {},
    updateCutCollar() {},
    requestRender() {},
  });
  const plant = studio.createPlantVisual(graph, false);
  studio.plants.set(graph.id, plant);
  scene.updateMatrixWorld(true);
  return { studio, plant, dispose: () => disposeObject(scene) };
}

function shown(node: THREE.Object3D): boolean {
  let current: THREE.Object3D | null = node;
  while (current) {
    if (!current.visible) return false;
    current = current.parent;
  }
  return true;
}

function census(graph: PlantGraph) {
  const { plant, dispose } = fixture(graph);
  let visibleDraws = 0;
  let triangles = 0;
  let berryMeshes = 0;
  let shownBerryMeshes = 0;
  plant.group.traverse((node: THREE.Object3D) => {
    if (!(node instanceof THREE.Mesh) || node.userData?.targetKind) return;
    const positions = node.geometry.getAttribute("position");
    if (!positions) return;
    const indexed = node.geometry.index ? node.geometry.index.count / 3 : positions.count / 3;
    const instances = node instanceof THREE.InstancedMesh ? node.count : 1;
    const berry = node.geometry.name === "living-line/berry";
    if (berry) berryMeshes += 1;
    if (!shown(node)) return;
    if (berry) shownBerryMeshes += 1;
    visibleDraws += 1;
    triangles += indexed * instances;
  });
  dispose();
  return {
    branches: graph.branches.size,
    organs: graph.organs.size,
    visibleDraws,
    triangles: Math.round(triangles),
    berryMeshes,
    shownBerryMeshes,
  };
}

test("phone-sized hits land on the berry organ and its own stem", () => {
  for (const seed of [8278, 9255, 10232]) {
    const graph = createBerryTwig("plant-1", seed, BASE);
    const { studio, plant, dispose } = fixture(graph);
    for (const organ of graph.organs.values()) {
      assert.equal(organ.kind, "berry");
      const visual = plant.organs.get(organ.id)!;
      visual.group.updateWorldMatrix(true, true);
      const fruit = [...visual.group.children].find((child) => child instanceof THREE.Mesh && child.geometry.name === "living-line/berry") as THREE.Mesh;
      assert.ok(fruit);
      const projected = fruit.getWorldPosition(new THREE.Vector3()).project(studio.camera);
      const x = (projected.x * 0.5 + 0.5) * PHONE.width;
      const y = (-projected.y * 0.5 + 0.5) * PHONE.height;
      const hit = studio.collectHitCandidates(x, y)[0];
      assert.equal(hit?.organId, organ.id, `${organ.id} seed ${seed}`);
      assert.equal(hit?.branchId, organ.branchId, `${organ.id} seed ${seed}`);
      assert.equal(hit?.screenDistancePx, 0, `${organ.id} seed ${seed} surface`);
    }
    dispose();
  }
});

test("a removed cluster hides its berries without adding a mesh", () => {
  const graph = createBerryTwig("plant-1", 8278, BASE);
  const intact = census(graph);
  const opened = [...graph.branches.values()].some((branch) => branch.id === "plant-1:cluster-2")
    ? "plant-1:cluster-2"
    : "plant-1:cluster-1";
  const plan = previewPrune(graph, opened, 0.12);
  const pruned = applyPrune(graph, plan);
  const openedCount = plan.removedOrganIds.length;
  const after = census(pruned);
  assert.equal(intact.berryMeshes, intact.organs);
  assert.equal(after.berryMeshes, intact.berryMeshes);
  assert.equal(after.shownBerryMeshes, intact.shownBerryMeshes - openedCount);
  assert.ok(after.visibleDraws < intact.visibleDraws);
  assert.ok(after.triangles < intact.triangles);
  assert.equal(pruned.branches.size, graph.branches.size);
  assert.equal(pruned.organs.size, graph.organs.size);
  const spray = census(createBlossomSpray("plant-1", 8278, BASE));
  const flowering = census(createFloweringBranch("plant-1", 8278, BASE));
  assert.equal(spray.berryMeshes, 0);
  assert.equal(flowering.berryMeshes, 0);
  assert.ok(intact.triangles < spray.triangles, `berry triangles ${intact.triangles} should stay under a six-tuft spray ${spray.triangles}`);
  assert.deepEqual(
    { intactDraws: intact.visibleDraws, intactTriangles: intact.triangles, prunedDraws: after.visibleDraws, prunedTriangles: after.triangles },
    { intactDraws: 22, intactTriangles: 2200, prunedDraws: 16, prunedTriangles: 1620 },
  );
  let stressDraws = 0;
  let stressTriangles = 0;
  for (let index = 0; index < 12; index += 1) {
    const seed = (8278 + 977 * index) >>> 0;
    const sample = census(createBerryTwig(`plant-${index + 1}`, seed, BASE));
    stressDraws += sample.visibleDraws;
    stressTriangles += sample.triangles;
  }
  assert.equal(stressDraws, 273);
  assert.equal(stressTriangles, 27060);
});
