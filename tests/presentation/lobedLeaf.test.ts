import assert from "node:assert/strict";
import test from "node:test";
import * as THREE from "three";
import { add, bendBranch, createLobedLeaf, previewPrune, applyPrune, sampleBranch, serializePlantGraph } from "../../src/core/index.ts";
import { ThreeStudio, STUDIO_VERTICAL_FOV } from "../../src/presentation/ThreeStudio.ts";
import { botanicalSeed, createLeafGeometry, createLeafVeinGeometry } from "../../src/presentation/botanicalGeometry.ts";
import { createLobedLeafGeometry, createLobedLeafVeinGeometry, lobedLeafOutline } from "../../src/presentation/lobedLeafGeometry.ts";
import { disposeObject } from "../../src/presentation/geometry.ts";

const BASE = { x: 0, y: 0.55, z: 0 };

test("lobed lamina is one connected finite surface with four empty notches and fine stable veins", () => {
  for (const seed of [0, 8278, 9255, 10232, 0xffffffff]) {
    const blade = createLobedLeafGeometry(seed);
    const veins = createLobedLeafVeinGeometry(seed);
    const repeated = createLeafGeometry(seed, "lobed");
    const repeatedVeins = createLeafVeinGeometry(seed, "lobed");
    for (const [geometry, rebuild] of [[blade, repeated], [veins, repeatedVeins]]) {
      for (const key of ["position", "normal", "color", "uv"]) {
        assert.deepEqual(geometry.getAttribute(key).array, rebuild.getAttribute(key).array);
        assert.ok(Array.from(geometry.getAttribute(key).array).every(Number.isFinite));
      }
      const positions = geometry.getAttribute("position"), indices = geometry.index!;
      const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3();
      for (let index = 0; index < indices.count; index += 3) {
        a.fromBufferAttribute(positions, indices.getX(index));
        b.fromBufferAttribute(positions, indices.getX(index + 1));
        c.fromBufferAttribute(positions, indices.getX(index + 2));
        const face = b.sub(a).cross(c.sub(a));
        assert.ok(face.z > 1e-12, "nondegenerate +Z winding");
      }
    }
    const adjacency = new Map<number, Set<number>>();
    const indices = blade.index!;
    for (let i = 0; i < indices.count; i += 3) {
      const triangle = [indices.getX(i), indices.getX(i + 1), indices.getX(i + 2)];
      for (const a of triangle) for (const b of triangle) {
        if (!adjacency.has(a)) adjacency.set(a, new Set());
        adjacency.get(a)!.add(b);
      }
    }
    const visited = new Set<number>(), queue = [0];
    while (queue.length) {
      const index = queue.pop()!;
      if (visited.has(index)) continue;
      visited.add(index);
      queue.push(...adjacency.get(index)!);
    }
    assert.equal(visited.size, blade.getAttribute("position").count, "single connected lamina, not separate leaflets");
    const outline = lobedLeafOutline(seed);
    assert.deepEqual(outline[0], new THREE.Vector2(0, 0), "blade begins exactly at the petiole tip");
    const mesh = new THREE.Mesh(blade, new THREE.MeshBasicMaterial({ side: THREE.DoubleSide }));
    mesh.updateMatrixWorld(true);
    for (const direction of [-1, 1]) {
      const ray = (x: number, y: number) => new THREE.Raycaster(new THREE.Vector3(x, y, direction * 2), new THREE.Vector3(0, 0, -direction));
      assert.ok(ray(0.03, 0.63).intersectObject(mesh).length, "central lobe has a surface from both faces");
      for (const angle of [-80, -23, 23, 80]) {
        const theta = THREE.MathUtils.degToRad(angle);
        const radius = Math.abs(angle) === 23 ? 0.59 : 0.44;
        assert.equal(ray(Math.sin(theta) * radius, 0.16 + Math.cos(theta) * radius).intersectObject(mesh).length, 0, "notch has no triangles");
      }
    }
    assert.equal(blade.index!.count / 3, 462);
    assert.equal(veins.index!.count / 3, 208);
    mesh.material.dispose();
    for (const geometry of [blade, veins, repeated, repeatedVeins]) geometry.dispose();
  }
});

function fixture(graph: ReturnType<typeof createLobedLeaf>) {
  const scene = new THREE.Scene(), botanicalRoot = new THREE.Group(), pendingRoot = new THREE.Group();
  scene.add(botanicalRoot, pendingRoot);
  const camera = new THREE.PerspectiveCamera(STUDIO_VERTICAL_FOV, 390 / 844, 0.1, 80);
  const studio = Object.assign(Object.create(ThreeStudio.prototype), {
    scene, botanicalRoot, pendingRoot, camera, raycaster: new THREE.Raycaster(), plants: new Map(),
    canvas: { getBoundingClientRect: () => ({ left: 0, top: 0, width: 390, height: 844 }) },
    options: { debugHitTargets: false },
    baseHandle: { group: { visible: false } }, bendHandle: { group: { visible: false } },
    selection: null, cutPreview: null, updateAffordances() {}, updateCutCollar() {}, requestRender() {},
  });
  const plant = studio.createPlantVisual(graph, false);
  studio.plants.set(graph.id, plant);
  scene.updateMatrixWorld(true);
  return { studio, plant, scene, dispose: () => disposeObject(scene) };
}

test("production lobed-leaf picking grabs lamina from both faces but never bridges an empty notch", () => {
  for (const seed of [8278, 9255, 10232]) {
    const graph = createLobedLeaf("plant-1", seed, BASE);
    const { studio, plant, scene, dispose } = fixture(graph);
    for (const organ of graph.organs.values()) {
      const visual = plant.organs.get(organ.id)!;
      for (const side of [-1, 1]) {
        const focus = new THREE.Vector3(0, 0.5, 0).applyMatrix4(visual.group.matrixWorld);
        studio.camera.position.copy(new THREE.Vector3(0, 0.5, side * 5).applyMatrix4(visual.group.matrixWorld));
        studio.camera.up.set(0, 1, 0).transformDirection(visual.group.matrixWorld);
        studio.camera.lookAt(focus);
        studio.camera.updateMatrixWorld(true);
        const collect = (point: THREE.Vector3) => {
          const projected = point.applyMatrix4(visual.group.matrixWorld).project(studio.camera);
          return studio.collectHitCandidates((projected.x * 0.5 + 0.5) * 390, (-projected.y * 0.5 + 0.5) * 844);
        };
        const faceHit = collect(new THREE.Vector3(0.04, 0.64, 0)).find((c: any) => c.organId === organ.id);
        assert.ok(faceHit, `${seed} ${organ.id} side ${side}`);
        assert.equal(faceHit.screenDistancePx, 0);
        assert.equal(faceHit.branchId, organ.branchId);
        assert.equal(faceHit.materialDistance, organ.distance);
        assert.ok(faceHit.aimPoint, "grip is the real face, not the petiole attachment");
        for (const angle of [-23, 23]) {
          const theta = THREE.MathUtils.degToRad(angle);
          const hits = collect(new THREE.Vector3(Math.sin(theta) * 0.59, 0.16 + Math.cos(theta) * 0.59, 0));
          assert.ok(!hits.some((c: any) => c.organId === organ.id), "no spherical proxy fills the notch");
        }
      }
    }
    assert.ok(scene.children.length > 0);
    dispose();
  }
});

test("lobed surface identity survives bending, sibling pruning and independent production rebuilds", () => {
  const graph = createLobedLeaf("plant-1", 8278, BASE);
  const snapshot = serializePlantGraph(graph);
  const root = graph.branches.get(graph.rootBranchId)!;
  const stationDistance = root.activeLength * 0.54;
  const bent = bendBranch(graph, { branchId: root.id, stationDistance, target: add(sampleBranch(root, stationDistance).position, { x: 0.8, y: 0.1, z: 0.4 }) });
  const cut = applyPrune(bent, previewPrune(bent, "plant-1:petiole-1", 0.12)!);
  const studio = Object.assign(Object.create(ThreeStudio.prototype), { options: { debugHitTargets: false } });
  for (const organ of cut.organs.values()) {
    if (!organ.active) continue;
    const original = studio.createOrganVisual(graph, graph.organs.get(organ.id), false);
    const rebuilt = studio.createOrganVisual(cut, organ, true);
    for (let index = 0; index < original.group.children.length; index += 1) {
      for (const key of ["position", "normal", "color"]) {
        assert.deepEqual(original.group.children[index].geometry.getAttribute(key)?.array, rebuilt.group.children[index].geometry.getAttribute(key)?.array);
      }
    }
    assert.notEqual(original.hit.geometry, original.group.children[0].geometry, "hit geometry has independent disposal ownership");
    disposeObject(original.group); disposeObject(rebuilt.group);
  }
  assert.equal(serializePlantGraph(graph), snapshot);
  const a = createLobedLeafGeometry(botanicalSeed("plant-1:leaf-1", graph.seed));
  const b = createLobedLeafGeometry(botanicalSeed("plant-1:leaf-2", graph.seed));
  assert.notDeepEqual(a.getAttribute("position").array, b.getAttribute("position").array);
  a.dispose(); b.dispose();
});
