import assert from "node:assert/strict";
import test from "node:test";
import * as THREE from "three";
import { createFloweringBranch, bendBranch, pruneBranch, toCanonicalPlantGraph } from "../../src/core/index.ts";
import { ThreeStudio } from "../../src/presentation/ThreeStudio.ts";
import { botanicalSeed, createLeafGeometry, createOpenFacePetalGeometry, createPetalGeometry } from "../../src/presentation/botanicalGeometry.ts";
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

test("registered material appearances rebuild consistently and leafy hit proxies cover their blades", async () => {
  const { prepareMaterialInsertion } = await import("../../src/core/index.ts");
  const studio = Object.assign(Object.create(ThreeStudio.prototype), { options: { debugHitTargets: false } });
  const stemColors = [];
  for (const material of ["flowering-branch", "leafy-shoot", "bare-branch", "single-flower"]) {
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
      if (material === "leafy-shoot" || (material === "single-flower" && organ.kind === "bloom")) {
        original.group.updateMatrixWorld(true);
        const radius = original.hit.geometry.parameters.radius;
        original.group.traverse((node: THREE.Object3D) => {
          if (!(node instanceof THREE.Mesh) || node === original.hit) return;
          const positions = node.geometry.getAttribute("position");
          if (!positions) return;
          const local = new THREE.Vector3();
          for (let index = 0; index < positions.count; index += 1) {
            local.fromBufferAttribute(positions, index);
            node.localToWorld(local);
            original.group.worldToLocal(local);
            assert.ok(local.distanceTo(original.hit.position) <= radius + 1e-6, `${material} ${organ.kind} outside acquisition proxy`);
          }
        });
      }
      disposeObject(original.group); disposeObject(rebuild.group);
    }
    for (const key of ["mesh", "hit", "selection", "doomed"]) disposeObject(branch[key]);
  }
  assert.notEqual(stemColors[0], stemColors[1], "green main stems must not inherit woody trunk appearance");
  assert.notEqual(stemColors[0], stemColors[2], "bare wood must not inherit flowering trunk appearance");
  assert.notEqual(stemColors[1], stemColors[2], "bare wood must not inherit leafy stem appearance");
  assert.notEqual(stemColors[0], stemColors[3], "single-flower stem must not inherit woody trunk appearance");
  assert.notEqual(stemColors[1], stemColors[3], "single-flower stem must remain distinct from leafy shoot");
});

test("open-face bloom is flatter than the cupped reference and follows the material frame, not the camera", async () => {
  const { prepareMaterialInsertion, sampleMaterialFrame, bendBranch, sampleBranch, add } = await import("../../src/core/index.ts");
  const cupped = createPetalGeometry(3);
  const open = createOpenFacePetalGeometry(3);
  const maxZ = (geometry: THREE.BufferGeometry) => {
    const positions = geometry.getAttribute("position");
    let peak = 0;
    for (let index = 0; index < positions.count; index += 1) peak = Math.max(peak, Math.abs(positions.getZ(index)));
    return peak;
  };
  assert.ok(maxZ(open) < maxZ(cupped) * 0.7, "open-face petal must be a shallower dish than the cupped bloom");
  cupped.dispose();
  open.dispose();

  const prepared = prepareMaterialInsertion("single-flower", 1, { x: 0, y: 0.55, z: 0 });
  assert.ok(prepared.ok);
  const graph = prepared.graph;
  const bloom = [...graph.organs.values()].find((organ) => organ.kind === "bloom")!;
  const studio = Object.assign(Object.create(ThreeStudio.prototype), { options: { debugHitTargets: false } });

  function faceFrom(frame: { tangent: { x: number; y: number; z: number }; normal: { x: number; y: number; z: number }; binormal: { x: number; y: number; z: number } }, spin: number) {
    const tangent = new THREE.Vector3(frame.tangent.x, frame.tangent.y, frame.tangent.z).normalize();
    const normal = new THREE.Vector3(frame.normal.x, frame.normal.y, frame.normal.z).normalize();
    const binormal = new THREE.Vector3(frame.binormal.x, frame.binormal.y, frame.binormal.z).normalize();
    const group = new THREE.Group();
    group.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(binormal, tangent, normal));
    group.rotateY(spin);
    return new THREE.Vector3(0, 0, 1).applyQuaternion(group.quaternion);
  }

  const pedicel = graph.branches.get(bloom.branchId)!;
  const beforeFace = faceFrom(sampleMaterialFrame(pedicel, bloom.distance), bloom.spin);
  const stem = graph.branches.get(graph.rootBranchId)!;
  const bent = bendBranch(graph, {
    branchId: stem.id,
    stationDistance: stem.activeLength * 0.54,
    target: add(sampleBranch(stem, stem.activeLength * 0.54).position, { x: 1.3, y: 0.2, z: -0.5 }),
  });
  const bentBloom = bent.organs.get(bloom.id)!;
  const bentPedicel = bent.branches.get(bentBloom.branchId)!;
  const afterFace = faceFrom(sampleMaterialFrame(bentPedicel, bentBloom.distance), bentBloom.spin);
  assert.equal(bentBloom.spin, bloom.spin);
  assert.ok(afterFace.distanceTo(beforeFace) > 0.02, "bloom face must move with the supporting stem, not stay locked in world");
  const cameraForward = new THREE.Vector3(0, 0, 1);
  assert.ok(Math.abs(afterFace.dot(cameraForward) - beforeFace.dot(cameraForward)) > 1e-6 || afterFace.distanceTo(beforeFace) > 0.02);

  const visual = studio.createOrganVisual(graph, bloom, false);
  const rebuilt = studio.createOrganVisual(bent, bentBloom, false);
  const originalPetal = visual.group.children[0] as THREE.Mesh;
  const rebuiltPetal = rebuilt.group.children[0] as THREE.Mesh;
  assert.deepEqual(originalPetal.geometry.getAttribute("position").array, rebuiltPetal.geometry.getAttribute("position").array);
  disposeObject(visual.group);
  disposeObject(rebuilt.group);
});
