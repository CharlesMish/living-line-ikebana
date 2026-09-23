import assert from "node:assert/strict";
import test from "node:test";
import * as THREE from "three";
import { createBlossomSpray, createFlowerVolume, createFloweringBranch, previewPrune, applyPrune } from "../../src/core/index.ts";
import type { PlantGraph } from "../../src/core/types.ts";
import { tuftInstancePose } from "../../src/presentation/botanicalGeometry.ts";
import { getMaterialAppearance } from "../../src/presentation/materialAppearance.ts";
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
  let petalMeshes = 0;
  let shownPetalMeshes = 0;
  plant.group.traverse((node: THREE.Object3D) => {
    if (!(node instanceof THREE.Mesh) || node.userData?.targetKind) return;
    const positions = node.geometry.getAttribute("position");
    if (!positions) return;
    const indexed = node.geometry.index ? node.geometry.index.count / 3 : positions.count / 3;
    const instances = node instanceof THREE.InstancedMesh ? node.count : 1;
    const tuft = node instanceof THREE.InstancedMesh && node.geometry.name === "living-line/tufted-petal";
    if (tuft) petalMeshes += 1;
    if (!shown(node)) return;
    if (tuft) shownPetalMeshes += 1;
    visibleDraws += 1;
    triangles += indexed * instances;
  });
  dispose();
  return {
    branches: graph.branches.size,
    organs: graph.organs.size,
    visibleDraws,
    triangles: Math.round(triangles),
    petalMeshes,
    shownPetalMeshes,
  };
}

test("phone-front presses acquire each blossom on its own stalk, including instanced petals", () => {
  for (const seed of [8278, 9255, 10232]) {
    const graph = createBlossomSpray("plant-1", seed, BASE);
    const { studio, plant, dispose } = fixture(graph);
    try {
      for (const organ of graph.organs.values()) {
        const visual = plant.organs.get(organ.id);
        visual.group.updateMatrixWorld(true);
        let acquired = false;
        visual.group.traverse((node: THREE.Object3D) => {
          if (acquired || !(node instanceof THREE.Mesh) || node === visual.hit) return;
          const positions = node.geometry.getAttribute("position");
          if (!positions) return;
          const instances = node instanceof THREE.InstancedMesh ? node.count : 1;
          for (let instance = 0; instance < instances && !acquired; instance += 1) {
            const matrix = new THREE.Matrix4();
            if (node instanceof THREE.InstancedMesh) node.getMatrixAt(instance, matrix);
            for (let index = 0; index < positions.count && !acquired; index += 5) {
              const vertex = new THREE.Vector3().fromBufferAttribute(positions, index).applyMatrix4(matrix);
              node.localToWorld(vertex);
              const projected = vertex.clone().project(studio.camera);
              if (projected.z < -1 || projected.z > 1) continue;
              const x = (projected.x * 0.5 + 0.5) * PHONE.width;
              const y = (-projected.y * 0.5 + 0.5) * PHONE.height;
              const candidates = studio.collectHitCandidates(x, y);
              const winner = candidates[0];
              if (
                winner?.organId === organ.id
                && winner.branchId === organ.branchId
                && winner.screenDistancePx === 0
              ) acquired = true;
            }
          }
        });
        assert.equal(acquired, true, `seed ${seed} ${organ.id} petal is not acquirable at ${PHONE.width}×${PHONE.height}`);
        const tuft = [...visual.group.children].find((child: THREE.Object3D) =>
          child instanceof THREE.InstancedMesh && child.geometry.name === "living-line/tufted-petal");
        assert.ok(tuft instanceof THREE.InstancedMesh);
        assert.equal(tuft.count, 8);
      }
    } finally { dispose(); }
  }
});

test("tuft scatter is wider on separated blossoms and stays inside the shared hit sphere", () => {
  const blossom = getMaterialAppearance("blossom-spray-v1").bloom;
  const volume = getMaterialAppearance("flower-volume-v1").bloom;
  assert.equal(blossom.hitRadius, volume.hitRadius);
  assert.equal(blossom.hitRadius, 0.56);
  const deviation = (scatter: NonNullable<typeof blossom.tuftScatter>) => {
    let peak = 0;
    for (let index = 0; index < 8; index += 1) {
      const pose = tuftInstancePose(8278, index, 8, scatter);
      const even = (index / 8) * Math.PI * 2;
      peak = Math.max(peak, Math.abs(Math.atan2(Math.sin(pose.azimuth - even), Math.cos(pose.azimuth - even))));
      assert.ok(Math.abs(pose.scale - 1) <= scatter.scale + 1e-6);
      assert.ok(Math.abs(pose.tilt) <= scatter.tilt + 1e-6);
    }
    return peak;
  };
  const blossomDeviation = deviation(blossom.tuftScatter!);
  const volumeDeviation = deviation(volume.tuftScatter!);
  assert.ok(blossomDeviation > volumeDeviation);
  assert.ok(volumeDeviation > 0.01, "the packed head is not a perfect gear");
  assert.ok(blossomDeviation < 0.3, "scatter stays a tuft, not a loose ring");

  const graph = createBlossomSpray("plant-1", 8278, BASE);
  const volumeGraph = createFlowerVolume("plant-1", 8278, BASE);
  for (const sample of [graph, volumeGraph]) {
    const { plant, dispose } = fixture(sample);
    try {
      const appearance = getMaterialAppearance(sample.generatorVersion);
      for (const organ of sample.organs.values()) {
        if (organ.kind !== "bloom") continue;
        const visual = plant.organs.get(organ.id);
        const tuft = [...visual.group.children].find((child: THREE.Object3D) =>
          child instanceof THREE.InstancedMesh && child.geometry.name === "living-line/tufted-petal") as THREE.InstancedMesh;
        const positions = tuft.geometry.getAttribute("position");
        const matrix = new THREE.Matrix4();
        const vertex = new THREE.Vector3();
        for (let instance = 0; instance < tuft.count; instance += 1) {
          tuft.getMatrixAt(instance, matrix);
          for (let index = 0; index < positions.count; index += 1) {
            vertex.fromBufferAttribute(positions, index).applyMatrix4(matrix);
            assert.ok(
              vertex.length() <= appearance.bloom.hitRadius,
              `${organ.id} petal leaves the hit sphere`,
            );
          }
        }
      }
    } finally { dispose(); }
  }
});

test("removing a blossom group hides those organs and does not allocate a new petal mesh", () => {
  const graph = createBlossomSpray("plant-1", 8278, BASE);
  const { studio, plant, dispose } = fixture(graph);
  try {
    const before = census(graph);
    assert.equal(before.petalMeshes, 6);
    assert.equal(before.shownPetalMeshes, 6);
    assert.equal(before.organs, 6);
    const beforeIds = [...plant.organs.keys()].sort();
    const pruned = applyPrune(graph, previewPrune(graph, "plant-1:group-2", 0.12));
    plant.graph = pruned;
    studio.syncPlantVisual(plant);
    assert.deepEqual([...plant.organs.keys()].sort(), beforeIds);
    assert.equal(plant.organs.get("plant-1:bloom-2-1").group.visible, false);
    assert.equal(plant.organs.get("plant-1:bloom-2-2").group.visible, false);
    assert.equal(plant.organs.get("plant-1:bloom-1-1").group.visible, true);
    assert.equal(plant.organs.get("plant-1:bloom-3-1").group.visible, true);
    const after = census(pruned);
    assert.equal(after.organs, before.organs);
    assert.equal(after.branches, before.branches);
    assert.equal(after.petalMeshes, before.petalMeshes, "inactive flowers keep their meshes; a group is not a new draw");
    assert.equal(after.shownPetalMeshes, 4);
    assert.ok(after.visibleDraws < before.visibleDraws);
    const flowering = census(createFloweringBranch("plant-1", 8278, BASE));
    const volume = census(createFlowerVolume("plant-1", 8278, BASE));
    assert.equal(before.petalMeshes, before.organs, "each flower keeps one instanced petal mesh");
    assert.equal(volume.petalMeshes, 5);
    assert.equal(flowering.petalMeshes, 0, "the flowering branch still uses its separate cupped petals");
    assert.ok(before.visibleDraws < before.organs * 8, "a flower is not eight petal draw calls");
    assert.ok(after.triangles < before.triangles);
    assert.ok(volume.triangles > 0 && flowering.triangles > 0);
  } finally { dispose(); }
});
