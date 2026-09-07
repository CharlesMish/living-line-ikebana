import assert from "node:assert/strict";
import test from "node:test";
import * as THREE from "three";
import { createFloweringBranch, bendBranch, pruneBranch, toCanonicalPlantGraph } from "../../src/core/index.ts";
import { ThreeStudio } from "../../src/presentation/ThreeStudio.ts";
import { botanicalSeed, createLeafGeometry, createPetalGeometry } from "../../src/presentation/botanicalGeometry.ts";
import { disposeObject, splitBranchAtMaterialDistance, updateTubeGeometry } from "../../src/presentation/geometry.ts";

test("rendered stems have outward faces, closed ends, and stable proximal stock after a cut", () => {
  const graph = createFloweringBranch("plant-1", 8278, { x: 0, y: 0.55, z: 0 });
  const before = JSON.stringify(toCanonicalPlantGraph(graph));
  for (const branch of graph.branches.values()) {
    const geometry = new THREE.BufferGeometry();
    updateTubeGeometry(geometry, branch.points, branch.radius, branch.referenceNormal, 10, true);
    const positions = geometry.getAttribute("position");
    const normals = geometry.getAttribute("normal");
    const index = geometry.index!;
    const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3();
    for (let i = 0; i < index.count; i += 3) {
      const ia = index.getX(i), ib = index.getX(i + 1), ic = index.getX(i + 2);
      a.fromBufferAttribute(positions, ia);
      b.fromBufferAttribute(positions, ib);
      c.fromBufferAttribute(positions, ic);
      const face = b.sub(a).cross(c.sub(a));
      assert.ok(face.lengthSq() > 1e-20, `${branch.id}: degenerate face`);
      const normal = new THREE.Vector3().fromBufferAttribute(normals, ia)
        .add(new THREE.Vector3().fromBufferAttribute(normals, ib))
        .add(new THREE.Vector3().fromBufferAttribute(normals, ic));
      assert.ok(face.dot(normal) > 0, `${branch.id}: inward face`);
    }
    const split = splitBranchAtMaterialDistance(branch, branch.activeLength * 0.73);
    const shortened = new THREE.BufferGeometry();
    updateTubeGeometry(shortened, split.proximal, branch.radius, branch.referenceNormal, 10, true);
    // The first ring is untouched for a cut beyond the first segment; compare
    // physical radius, not the final ring normal (which legitimately changes).
    const origin = new THREE.Vector3(branch.points[0].x, branch.points[0].y, branch.points[0].z);
    for (let v = 0; v < 10; v += 1) {
      const radius = new THREE.Vector3().fromBufferAttribute(shortened.getAttribute("position"), v).distanceTo(origin);
      assert.ok(Math.abs(radius - branch.radius) < 1e-6);
    }
    geometry.dispose(); shortened.dispose();
  }
  assert.equal(JSON.stringify(toCanonicalPlantGraph(graph)), before);
});

test("organ surface detail survives bending, other cuts, and independent visual rebuilds", () => {
  const graph = createFloweringBranch("plant-1", 8278, { x: 0, y: 0.55, z: 0 });
  const snapshot = JSON.stringify(toCanonicalPlantGraph(graph));
  const bent = bendBranch(graph, { branchId: graph.rootBranchId, stationDistance: 3, target: { x: 0.6, y: 3, z: 0.1 } });
  const cut = pruneBranch(bent, bent.rootBranchId, 4.8);
  const studio = Object.assign(Object.create(ThreeStudio.prototype), { options: { debugHitTargets: false } });
  function surface(graph: ReturnType<typeof createFloweringBranch>, id: string) {
    const visual = studio.createOrganVisual(graph, graph.organs.get(id), false);
    const arrays: number[][] = [];
    visual.group.traverse((node: THREE.Object3D) => {
      if (!(node instanceof THREE.Mesh)) return;
      for (const key of ["position", "normal", "color"]) {
        const attribute = node.geometry.getAttribute(key);
        if (attribute) arrays.push(Array.from(attribute.array));
      }
    });
    disposeObject(visual.group);
    return arrays;
  }
  for (const organ of cut.organs.values()) {
    if (!organ.active) continue;
    assert.deepEqual(surface(graph, organ.id), surface(bent, organ.id));
    assert.deepEqual(surface(graph, organ.id), surface(cut, organ.id));
  }
  assert.equal(JSON.stringify(toCanonicalPlantGraph(graph)), snapshot);
  const one = createLeafGeometry(botanicalSeed("one", 8278));
  const two = createLeafGeometry(botanicalSeed("two", 8278));
  assert.notDeepEqual(one.getAttribute("position").array, two.getAttribute("position").array);
  const petal = createPetalGeometry(3);
  assert.ok(Array.from(petal.getAttribute("normal").array).every(Number.isFinite));
  one.dispose(); two.dispose(); petal.dispose();
});

test("disposing botanical groups releases instanced flower detail", () => {
  const group = new THREE.Group();
  const detail = new THREE.InstancedMesh(new THREE.SphereGeometry(0.02), new THREE.MeshStandardMaterial(), 2);
  let instanceDisposed = false;
  let geometryDisposed = false;
  detail.addEventListener("dispose", () => { instanceDisposed = true; });
  detail.geometry.addEventListener("dispose", () => { geometryDisposed = true; });
  group.add(detail);
  disposeObject(group);
  assert.ok(instanceDisposed && geometryDisposed);
});

test("both material appearances rebuild consistently and leafy hit proxies cover their blades", async () => {
  const { prepareMaterialInsertion } = await import("../../src/core/index.ts");
  const studio = Object.assign(Object.create(ThreeStudio.prototype), { options: { debugHitTargets: false } });
  const stemColors = [];
  for (const material of ["flowering-branch", "leafy-shoot"]) {
    const prepared = prepareMaterialInsertion(material, 2, { x: 0, y: 0.55, z: 0 });
    assert.ok(prepared.ok);
    const graph = prepared.graph;
    const root = graph.branches.get(graph.rootBranchId)!;
    const branch = studio.createBranchVisual(graph, root, false);
    stemColors.push(branch.mesh.material.color.getHex());
    assert.equal(branch.doomed.material.color.getHex(), branch.mesh.material.color.getHex());
    const bent = bendBranch(graph, { branchId: root.id, stationDistance: root.activeLength * 0.54, target: { x: 1, y: 3, z: 0 } });
    for (const organ of graph.organs.values()) {
      const original = studio.createOrganVisual(graph, organ, false);
      const rebuild = studio.createOrganVisual(bent, bent.organs.get(organ.id), true);
      for (let index = 0; index < original.group.children.length; index += 1) {
        const a = original.group.children[index] as THREE.Mesh;
        const b = rebuild.group.children[index] as THREE.Mesh;
        for (const key of ["position", "normal", "color"]) {
          assert.deepEqual(a.geometry.getAttribute(key)?.array, b.geometry.getAttribute(key)?.array);
        }
      }
      if (material === "leafy-shoot") {
        const blade = (original.group.children[0] as THREE.Mesh).geometry.getAttribute("position");
        const radius = original.hit.geometry.parameters.radius;
        for (let index = 0; index < blade.count; index += 1) {
          const point = new THREE.Vector3().fromBufferAttribute(blade, index);
          assert.ok(point.distanceTo(original.hit.position) <= radius, "blade outside acquisition proxy");
        }
      }
      disposeObject(original.group); disposeObject(rebuild.group);
    }
    for (const key of ["mesh", "hit", "selection", "doomed"]) disposeObject(branch[key]);
  }
  assert.notEqual(stemColors[0], stemColors[1], "green main stems must not inherit woody trunk appearance");
});
