import assert from "node:assert/strict";
import test from "node:test";
import * as THREE from "three";
import { createSingleFlower, applyPrune, previewPrune, serializePlantGraph } from "../../src/core/index.ts";
import { createOpenCupCorollaGeometry, createOpenCupCalyxGeometry } from "../../src/presentation/openCupGeometry.ts";
import { getMaterialAppearance } from "../../src/presentation/materialAppearance.ts";
import { resolveBotanicalAppearance } from "../../src/presentation/botanicalTones.ts";
import { studioFixture } from "./studioFixture.ts";

test("authored single-flower petals are closed, cupped, deterministic and bounded", () => {
  for (const seed of [0, 8278, 9255, 10232, 0xffffffff]) {
    const surface = createOpenCupCorollaGeometry(seed), repeat = createOpenCupCorollaGeometry(seed);
    try {
      for (const key of ["position", "normal", "color"]) {
        assert.deepEqual(surface.getAttribute(key).array, repeat.getAttribute(key).array);
        assert.ok(Array.from(surface.getAttribute(key).array).every(Number.isFinite));
      }
      const edges = new Map<string, number>();
      const index = surface.index!, position = surface.getAttribute("position");
      const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3();
      let minZ = Infinity, maxZ = -Infinity;
      for (let v = 0; v < position.count; v++) {
        a.fromBufferAttribute(position, v);
        assert.ok(a.length() < 0.65, "retains the original 0.7 hit envelope");
        minZ = Math.min(minZ, a.z); maxZ = Math.max(maxZ, a.z);
      }
      assert.ok(maxZ - minZ > 0.12, "the cup must have authored depth, not a flat radial card");
      assert.ok(maxZ < 0.22, "remains a quiet open cup, not a second tufted head");
      for (let i = 0; i < index.count; i += 3) {
        const ids = [index.getX(i), index.getX(i + 1), index.getX(i + 2)];
        a.fromBufferAttribute(position, ids[0]); b.fromBufferAttribute(position, ids[1]); c.fromBufferAttribute(position, ids[2]);
        assert.ok(b.sub(a).cross(c.sub(a)).lengthSq() > 1e-15, "no collapsed petal triangles");
        for (let e = 0; e < 3; e++) {
          const p = ids[e], q = ids[(e + 1) % 3], key = `${Math.min(p, q)}:${Math.max(p, q)}`;
          edges.set(key, (edges.get(key) ?? 0) + 1);
        }
      }
      assert.ok([...edges.values()].every(count => count === 2), "each thin petal is a closed two-sided shell");
    } finally { surface.dispose(); repeat.dispose(); }
  }
  const a = createOpenCupCorollaGeometry(8278), b = createOpenCupCorollaGeometry(9255);
  assert.notDeepEqual(a.getAttribute("position").array, b.getAttribute("position").array);
  a.dispose(); b.dispose();
  const calyx = createOpenCupCalyxGeometry(8278);
  assert.ok(calyx.boundingBox!.containsPoint(new THREE.Vector3(0, 0, 0)), "rear receptacle surrounds the graph attachment");
  assert.ok(calyx.boundingBox!.min.z < -0.07);
  calyx.dispose();
});

test("single flower stays distinct from Compact, updates tones and exposes front/rear head grips", () => {
  assert.equal(getMaterialAppearance("single-flower-v1").bloom.form, "open-cup");
  assert.equal(getMaterialAppearance("compact-flower-v1").bloom.form, "compact-cup");
  assert.equal(getMaterialAppearance("one-branch-v1").bloom.form, "cupped");
  for (const seed of [8278, 9255, 10232]) {
    const graph = createSingleFlower("plant-1", seed, { x: 0, y: 0.55, z: 0 });
    const before = serializePlantGraph(graph);
    const { studio, visual, camera, dispose } = studioFixture(graph);
    try {
      const bloom = graph.organs.get("plant-1:bloom")!, organ = visual.organs.get(bloom.id);
      const corolla = organ.group.children.find((node: THREE.Mesh) => node.geometry?.name === "living-line/open-cup-corolla") as THREE.Mesh<THREE.BufferGeometry, THREE.MeshStandardMaterial>;
      const mesh = corolla.geometry, material = corolla.material;
      const center = organ.group.getWorldPosition(new THREE.Vector3());
      for (const direction of [new THREE.Vector3(0, 0, 1), new THREE.Vector3(0.5, 0.15, -1), new THREE.Vector3(0.85, 0.1, 0.6)]) {
        direction.transformDirection(organ.group.matrixWorld);
        camera.position.copy(center).addScaledVector(direction, 12);
        camera.lookAt(center); camera.updateMatrixWorld(true);
        let acquired = false;
        for (let i = 0; i < mesh.getAttribute("position").count && !acquired; i += 7) {
          const vertex = new THREE.Vector3().fromBufferAttribute(mesh.getAttribute("position"), i);
          corolla.localToWorld(vertex); vertex.project(camera);
          const winner = studio.collectHitCandidates((vertex.x * 0.5 + 0.5) * 390, (-vertex.y * 0.5 + 0.5) * 844)[0];
          acquired = winner?.organId === bloom.id && winner.branchId === bloom.branchId && winner.screenDistancePx === 0 && !!winner.aimPoint;
        }
        assert.ok(acquired, `seed ${seed}: visible face/rear surface must route direct tilt to its own pedicel`);
      }
      for (const tone of ["rose", "lilac"] as const) {
        const appearance = resolveBotanicalAppearance(graph.generatorVersion, getMaterialAppearance(graph.generatorVersion), { "single-flower": tone });
        organ.applyTone(appearance);
        assert.equal(material.color.getHex(), appearance.bloom.color);
        assert.equal(corolla.geometry, mesh, "tone switches retain the same surface identity");
      }
      const cut = applyPrune(graph, previewPrune(graph, bloom.branchId, bloom.distance));
      studio.upsertGraph(cut); assert.equal(organ.group.visible, false);
      studio.upsertGraph(graph); assert.equal(organ.group.visible, true);
      assert.equal(serializePlantGraph(graph), before);
    } finally { dispose(); }
  }
});
