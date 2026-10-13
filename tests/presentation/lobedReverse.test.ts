import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import test from "node:test";
import * as THREE from "three";
import { createLobedLeaf, previewPrune, toCanonicalPlantGraph } from "../../src/core/index.ts";
import { createLobedLeafGeometry, createLobedLeafReverseVeinGeometry, createLobedLeafVeinGeometry } from "../../src/presentation/lobedLeafGeometry.ts";
import { installLobedLeafReverse, lobedLeafReverseColor, lobedLeafReverseVeinColor } from "../../src/presentation/lobedLeafSurface.ts";
import { getMaterialAppearance } from "../../src/presentation/materialAppearance.ts";
import { resolveBotanicalAppearance } from "../../src/presentation/botanicalTones.ts";
import { studioFixture } from "./studioFixture.ts";

// Captured directly from c707845, before the reverse treatment. All front
// positions, normals, vertex colors, UVs and triangle indices are protected.
const FRONT_HASHES = new Map([
  [0, "842a23394169be383bebc0611a124523542c1079bb448051847b1032434c7a14"],
  [8278, "9678eb33915cf4f9a4a3f37b9ae78b88ccc816af3a6a71cb4a3c395bfc6cd95a"],
  [9255, "38e3fd12dbe1fcc7c5c5b7c06a878b1562ddcc458a7024dd9e512c69d38d6ac3"],
  [10232, "9bf91ac3e84c991b22f007c3fe448deede4119821e884f1652c0e3243ef69f19"],
  [0xffffffff, "74fdbe0b83aa414d58244ca5c0cb50a531028623b42a3a39fa1a0fcabe7cab55"],
]);

test("lobed front remains exact while reverse veins sit below the real lamina without crossing notches", () => {
  for (const [seed, expected] of FRONT_HASHES) {
    const lamina = createLobedLeafGeometry(seed), frontVeins = createLobedLeafVeinGeometry(seed);
    const hash = createHash("sha256");
    for (const geometry of [lamina, frontVeins]) {
      for (const name of ["position", "normal", "color", "uv"]) hash.update(Buffer.from(geometry.getAttribute(name).array.buffer));
      hash.update(Buffer.from(geometry.index!.array.buffer));
    }
    assert.equal(hash.digest("hex"), expected, `front identity at seed ${seed}`);
    const reverse = createLobedLeafReverseVeinGeometry(seed, lamina);
    const material = new THREE.MeshBasicMaterial({ side: THREE.FrontSide });
    const mesh = new THREE.Mesh(lamina, material); mesh.updateMatrixWorld(true);
    const position = reverse.getAttribute("position"), normal = reverse.getAttribute("normal"), indices = reverse.index!;
    assert.equal(indices.count / 3, 208);
    assert.ok(Array.from(normal.array).every(Number.isFinite));
    const below = (p: THREE.Vector3) => {
      const hit = new THREE.Raycaster(new THREE.Vector3(p.x, p.y, 1), new THREE.Vector3(0, 0, -1)).intersectObject(mesh)[0];
      assert.ok(hit, `vein stays inside the connected leaf at ${seed} ${p.x},${p.y}`);
      assert.ok(hit.point.z - p.z > 0.0001, `reverse ribbon is outside, not buried in the triangle: ${hit.point.z - p.z}`);
      assert.ok(hit.point.z - p.z < 0.007, "no conspicuously floating reverse ribbon");
    };
    for (let i = 0; i < indices.count; i += 3) {
      const triangle = [0, 1, 2].map(j => new THREE.Vector3().fromBufferAttribute(position, indices.getX(i + j)));
      triangle.forEach(below);
      below(triangle[0].clone().add(triangle[1]).add(triangle[2]).divideScalar(3));
      for (let edge = 0; edge < 3; edge++) below(triangle[edge].clone().lerp(triangle[(edge + 1) % 3], 0.5));
      assert.ok(triangle[1].sub(triangle[0]).cross(triangle[2].sub(triangle[0])).z > 1e-12);
    }
    reverse.dispose(); frontVeins.dispose(); lamina.dispose(); material.dispose();
  }
});

function compileMaterial(material: THREE.MeshStandardMaterial) {
  const shader = { uniforms: {}, vertexShader: THREE.ShaderLib.standard.vertexShader, fragmentShader: THREE.ShaderLib.standard.fragmentShader };
  material.onBeforeCompile(shader as any, {} as THREE.WebGLRenderer);
  return shader as typeof shader & { uniforms: { lobedReverseColor: { value: THREE.Color } } };
}

test("reverse shader retains standard alpha/front shading and updates its live tone uniform", () => {
  const material = new THREE.MeshStandardMaterial({ color: 0x568348, vertexColors: true, side: THREE.DoubleSide });
  const update = installLobedLeafReverse(material, 0x568348);
  const shader = compileMaterial(material), identity = shader.uniforms.lobedReverseColor.value;
  assert.equal(material.color.getHex(), 0x568348, "front diffuse uniform unchanged");
  assert.ok(shader.fragmentShader.includes("#include <color_fragment>\n        if (!gl_FrontFacing)"));
  assert.ok(shader.fragmentShader.includes("#include <roughnessmap_fragment>\n        if (!gl_FrontFacing)"));
  for (const chunk of ["alphamap_fragment", "alphatest_fragment", "opaque_fragment", "tonemapping_fragment", "colorspace_fragment"]) {
    assert.ok(shader.fragmentShader.includes(`#include <${chunk}>`), `${chunk} retained`);
  }
  for (const color of [0x568348, 0xc09539, 0xa85239]) {
    update(color);
    assert.equal(shader.uniforms.lobedReverseColor.value, identity, "compiled program keeps the same uniform reference");
    assert.deepEqual(identity, lobedLeafReverseColor(color));
    const front = new THREE.Color(color);
    const luminance = (c: THREE.Color) => c.r * .2126 + c.g * .7152 + c.b * .0722;
    assert.ok(luminance(identity) > luminance(front), "curated reverse tones are paler");
  }
  material.dispose();
});

test("production reverse has its own veins and culling, exact surface acquisition, tone reset and single-owner disposal", () => {
  const graph = createLobedLeaf("plant-1", 8278, { x: 0, y: .55, z: 0 });
  const original = toCanonicalPlantGraph(graph), fixture = studioFixture(graph);
  const organs = [...fixture.visual.organs.values()] as any[];
  const disposals: number[] = [];
  const geometries = new Set<THREE.BufferGeometry>(), materials = new Set<THREE.Material>();
  fixture.visual.group.traverse((object: THREE.Object3D) => {
    if (!(object instanceof THREE.Mesh || object instanceof THREE.Line)) return;
    geometries.add(object.geometry);
    for (const material of Array.isArray(object.material) ? object.material : [object.material]) materials.add(material);
  });
  for (const resource of [...geometries, ...materials]) {
    const slot = disposals.push(0) - 1;
    resource.addEventListener("dispose", () => { disposals[slot]++; });
  }
  for (const organ of organs) {
    const [leaf, front, reverse] = organ.group.children as THREE.Mesh<THREE.BufferGeometry, THREE.MeshStandardMaterial>[];
    assert.equal(front.material.side, THREE.FrontSide); assert.equal(reverse.material.side, THREE.BackSide);
    assert.equal(reverse.geometry.name, "living-line/lobed-leaf-reverse-veins");
    assert.equal(leaf.material.side, THREE.DoubleSide);
    assert.equal(organ.bodyMaterials.length, 3);
    assert.notEqual(reverse.geometry, organ.hit.geometry);
    assert.notEqual(leaf.geometry, reverse.geometry);
    const pos = reverse.geometry.getAttribute("position");
    const target = new THREE.Vector3();
    for (let corner = 0; corner < 3; corner++) target.add(new THREE.Vector3().fromBufferAttribute(pos, reverse.geometry.index!.getX(39 + corner)));
    target.divideScalar(3).applyMatrix4(organ.group.matrixWorld);
    const direction = new THREE.Vector3(0, 0, 1).transformDirection(organ.group.matrixWorld);
    const ray = new THREE.Raycaster(target.clone().addScaledVector(direction, -1), direction);
    const visibleHit = ray.intersectObjects([leaf, front, reverse], false)[0];
    assert.ok(visibleHit?.object === reverse, `reverse detail is the frontmost surface from behind, got ${visibleHit?.object.geometry.name}`);
    assert.ok(ray.intersectObject(organ.hit).length, "same fine surface remains in the owned acquisition geometry");
  }
  const shaders = organs.map(organ => compileMaterial(organ.bodyMaterials[0]));
  for (const tone of ["ochre", "russet", "natural"]) {
    fixture.studio.setBotanicalTones({ "lobed-leaf": tone });
    const appearance = resolveBotanicalAppearance(graph.generatorVersion, getMaterialAppearance(graph.generatorVersion), { "lobed-leaf": tone });
    organs.forEach((organ, index) => {
      assert.deepEqual(shaders[index].uniforms.lobedReverseColor.value, lobedLeafReverseColor(appearance.leaf.color));
      assert.equal(organ.bodyMaterials[2].color.getHex(), lobedLeafReverseVeinColor(appearance.leaf.color, appearance.leaf.veinColor));
    });
  }
  const first = [...graph.organs.values()][0];
  const plan = previewPrune(graph, first.branchId, first.distance * .5)!;
  fixture.studio.setCutPreview({ plantId: graph.id, plan });
  const doomed = fixture.visual.organs.get(first.id);
  assert.ok(doomed.bodyMaterials.every((material: THREE.MeshStandardMaterial) => material.opacity === .14 && material.transparent));
  fixture.studio.setBotanicalTones({ "lobed-leaf": "russet" });
  assert.ok(doomed.bodyMaterials.every((material: THREE.MeshStandardMaterial) => material.opacity === .14));
  fixture.studio.setCutPreview(null);
  assert.ok(doomed.bodyMaterials.every((material: THREE.MeshStandardMaterial) => material.opacity === 1 && !material.transparent));
  const pending = fixture.studio.createPlantVisual(graph, true);
  assert.ok([...pending.organs.values()].every((organ: any) => organ.bodyMaterials.every((material: THREE.MeshStandardMaterial) => material.opacity === .45 && material.transparent && !material.depthWrite)));
  // This fixture's pending root is detached; own its explicit teardown too.
  fixture.scene.add(fixture.studio.pendingRoot);
  assert.deepEqual(toCanonicalPlantGraph(graph), original);
  fixture.dispose();
  assert.ok(disposals.length > 30);
  assert.ok(disposals.every(count => count === 1), "each geometry/material disposed exactly once");
});
