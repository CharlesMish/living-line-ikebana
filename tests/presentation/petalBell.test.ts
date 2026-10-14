import assert from "node:assert/strict";
import test from "node:test";
import { createHash } from "node:crypto";
import * as THREE from "three";
import { applyPrune, createNoddingFlowerV2, previewPrune, serializePlantGraph } from "../../src/core/index.ts";
import { botanicalSeed, createBellGeometry } from "../../src/presentation/botanicalGeometry.ts";
import { getMaterialAppearance } from "../../src/presentation/materialAppearance.ts";
import { studioFixture } from "./studioFixture.ts";

test("legacy v1 bell keeps its published surface arrays byte-for-byte", () => {
  const bell = createBellGeometry(8278), hash = createHash("sha256");
  try {
    for (const name of ["position", "normal", "color"]) {
      const array = bell.getAttribute(name).array;
      hash.update(Buffer.from(array.buffer, array.byteOffset, array.byteLength));
    }
    const index = bell.index!.array;
    hash.update(Buffer.from(index.buffer, index.byteOffset, index.byteLength));
    assert.equal(hash.digest("hex"), "a59a1a3d2a1518796933b254902a8b049292773b44b438eb38b63b7a299d6831");
  } finally { bell.dispose(); }
});

test("petal bell remains one finite, thin shell within the unchanged nodding hit sphere", () => {
  const appearance = getMaterialAppearance("nodding-flower-v2").bloom;
  assert.equal(appearance.hitRadius, .66);
  assert.equal(appearance.hitCenterY, .32);
  for (const seed of [8278, 9255, 10232]) {
    const graph = createNoddingFlowerV2("plant-1", seed, { x: 0, y: .55, z: 0 });
    const identity = botanicalSeed("plant-1:bloom", seed);
    const palette = { petal: appearance.color, collar: appearance.collarColor! };
    const bell = createBellGeometry(identity, palette), rebuilt = createBellGeometry(identity, palette);
    const legacy = createBellGeometry(identity);
    try {
      assert.equal(bell.index!.count / 3, 2040);
      assert.equal(bell.index!.count / 3 - legacy.index!.count / 3, 152, "bounded cost: one shell, 8% more triangles");
      for (const name of ["position", "normal", "color"]) {
        assert.deepEqual(bell.getAttribute(name).array, rebuilt.getAttribute(name).array, "rebuild must retain organ identity");
        assert.ok([...bell.getAttribute(name).array].every(Number.isFinite));
      }
      const positions = bell.getAttribute("position"), normals = bell.getAttribute("normal");
      assert.ok(normals.getY(normals.count - 1) < -.99, "back cap points out along negative Y");
      let maxRadius = 0, minimumY = Infinity, maximumY = -Infinity;
      for (let i = 0; i < positions.count; i++) {
        const point = new THREE.Vector3().fromBufferAttribute(positions, i);
        assert.ok(point.distanceTo(new THREE.Vector3(0, appearance.hitCenterY, 0)) <= appearance.hitRadius);
        maxRadius = Math.max(maxRadius, Math.hypot(point.x, point.z));
        minimumY = Math.min(minimumY, point.y); maximumY = Math.max(maximumY, point.y);
        assert.ok(new THREE.Vector3().fromBufferAttribute(normals, i).length() > .99);
      }
      assert.ok(maxRadius > .29 && maxRadius < .32, "slender mouth replaces the heavy broad flare");
      assert.ok(minimumY < -.05 && maximumY > .61 && maximumY < .63, "attachment and axial flower reach stay recognizable");
      const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3();
      for (let i = 0; i < bell.index!.count; i += 3) {
        a.fromBufferAttribute(positions, bell.index!.getX(i));
        b.fromBufferAttribute(positions, bell.index!.getX(i + 1));
        c.fromBufferAttribute(positions, bell.index!.getX(i + 2));
        assert.ok(b.sub(a).cross(c.sub(a)).lengthSq() > 1e-15, "no collapsed triangles at a lobe or collar");
      }
      // The last shell row is its open mouth. Each opposite face is separated
      // by five-thousandths, with five clefts rather than the old thick rim.
      const mouth = Array.from({ length: 40 }, (_, column) => positions.getY(12 * 40 * 2 + column * 2));
      const peaks = mouth.filter((y, i) => y > mouth[(i + 39) % 40] && y > mouth[(i + 1) % 40]);
      assert.equal(peaks.length, 5);
      assert.ok(Math.max(...mouth) - Math.min(...mouth) > .08);
      for (let column = 0; column < 40; column++) {
        a.fromBufferAttribute(positions, 12 * 40 * 2 + column * 2);
        b.fromBufferAttribute(positions, 12 * 40 * 2 + column * 2 + 1);
        assert.ok(a.distanceTo(b) < .006, "the exposed lip reads as thin petal tissue");
      }
      assert.equal(graph.generatorVersion, "nodding-flower-v2");
    } finally { bell.dispose(); rebuilt.dispose(); legacy.dispose(); }
  }
});

test("nodding petal bell preview/cancel and cut/restore retain the exact surface, tone and graph", () => {
  const graph = createNoddingFlowerV2("plant-1", 8278, { x: 0, y: .55, z: 0 });
  const fixture = studioFixture(graph);
  try {
    const { studio, visual } = fixture;
    const canonical = serializePlantGraph(graph);
    const organ = visual.organs.get("plant-1:bloom");
    const shells = organ.group.children.filter((child: THREE.Object3D) => child instanceof THREE.Mesh && child.geometry.name === "living-line/bell");
    assert.equal(shells.length, 1);
    assert.equal(organ.bodyMaterials.length, 1, "no additional drawn material or mesh for petal detail");
    const shell = shells[0] as THREE.Mesh<THREE.BufferGeometry, THREE.MeshStandardMaterial>;
    const position = Array.from(shell.geometry.getAttribute("position").array);
    studio.setBotanicalTones({ "nodding-flower": "violet" });
    const colors = Array.from(shell.geometry.getAttribute("color").array);
    const plan = previewPrune(graph, "plant-1:flower-stalk", .02);
    assert.ok(plan.removedOrganIds.includes("plant-1:bloom"));
    studio.setCutPreview({ plantId: graph.id, plan });
    assert.equal(shell.material.transparent, true);
    assert.ok(shell.material.opacity < .2);
    studio.setCutPreview(null);
    assert.equal(shell.material.transparent, false);
    assert.equal(shell.material.opacity, 1);
    studio.upsertGraph(applyPrune(graph, plan));
    assert.equal(organ.group.visible, false);
    studio.upsertGraph(graph);
    assert.equal(organ.group.visible, true);
    assert.equal(visual.organs.get("plant-1:bloom").group.children[0], shell);
    assert.deepEqual(Array.from(shell.geometry.getAttribute("position").array), position);
    assert.deepEqual(Array.from(shell.geometry.getAttribute("color").array), colors);
    assert.equal(serializePlantGraph(graph), canonical);
  } finally { fixture.dispose(); }
});
