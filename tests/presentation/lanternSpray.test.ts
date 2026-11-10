import assert from "node:assert/strict";
import test from "node:test";
import * as THREE from "three";
import { createLanternSpray } from "../../src/core/index.ts";
import { createLanternBellGeometry } from "../../src/presentation/lanternGeometry.ts";
import { studioFixture } from "./studioFixture.ts";

const SEEDS = [8278, 9255, 10232];

test("lantern bell geometry is a finite, closed, five-ribbed manifold with outward normals", () => {
  for (const seed of SEEDS) {
    const geometry = createLanternBellGeometry(seed);
    const repeat = createLanternBellGeometry(seed);
    try {
      const pos = geometry.getAttribute("position");
      const norm = geometry.getAttribute("normal");
      const col = geometry.getAttribute("color");
      const idx = geometry.index!;

      assert.equal(geometry.name, "living-line/lantern-bell");
      assert.deepEqual(pos.array, repeat.getAttribute("position").array);
      assert.deepEqual(col.array, repeat.getAttribute("color").array);
      assert.ok(Array.from(pos.array).every(Number.isFinite));
      assert.ok(Array.from(norm.array).every(Number.isFinite));
      assert.ok(Array.from(col.array).every((v) => Number.isFinite(v) && v >= 0.65 && v <= 1));

      const edges = new Map<string, number>();
      let volume = 0;
      for (let i = 0; i < idx.count; i += 3) {
        const v0 = idx.getX(i);
        const v1 = idx.getX(i + 1);
        const v2 = idx.getX(i + 2);
        const a = new THREE.Vector3().fromBufferAttribute(pos, v0);
        const b = new THREE.Vector3().fromBufferAttribute(pos, v1);
        const c = new THREE.Vector3().fromBufferAttribute(pos, v2);
        volume += a.dot(b.clone().cross(c)) / 6;
        assert.ok(b.sub(a).cross(c.sub(a)).lengthSq() > 1e-16);
        const verts = [v0, v1, v2];
        for (let e = 0; e < 3; e += 1) {
          const key = [verts[e]!, verts[(e + 1) % 3]!].sort((x, y) => x - y).join(":");
          edges.set(key, (edges.get(key) ?? 0) + 1);
        }
      }
      assert.ok(volume > 0.002, `expected positive closed volume, got ${volume}`);
      assert.ok([...edges.values()].every((count) => count === 2), "every edge belongs to exactly 2 triangles");
      assert.equal(geometry.boundingBox!.min.y, 0);
      assert.ok(geometry.boundingBox!.max.y > 0.38);
      assert.ok(geometry.boundingBox!.max.x - geometry.boundingBox!.min.x > 0.34);
    } finally {
      geometry.dispose();
      repeat.dispose();
    }
  }
});

test("ThreeStudio renders lantern-spray bells and recolors them cleanly across botanical tones", () => {
  const graph = createLanternSpray("plant-1", 8278, { x: 0, y: 0.55, z: 0 });
  const { studio, visual, dispose } = studioFixture(graph);
  try {
    const blooms = [...graph.organs.values()].filter((o) => o.kind === "bloom");
    assert.equal(blooms.length, 5);
    for (const organ of blooms) {
      const organVisual = visual.organs.get(organ.id)!;
      const bellMesh = organVisual.group.children.find(
        (child: THREE.Object3D) => child instanceof THREE.Mesh && child.geometry.name === "living-line/lantern-bell",
      ) as THREE.Mesh | undefined;
      assert.ok(bellMesh, `expected lantern-bell mesh for ${organ.id}`);
      assert.equal((bellMesh.material as THREE.MeshStandardMaterial).color.getHex(), 0xe68a2e);
    }

    studio.setBotanicalTones({ "lantern-spray": "persimmon" });
    for (const organ of blooms) {
      const organVisual = visual.organs.get(organ.id)!;
      assert.equal(organVisual.bodyMaterials[0]!.color.getHex(), 0xd4573b);
    }

    studio.setBotanicalTones({ "lantern-spray": "celadon" });
    for (const organ of blooms) {
      const organVisual = visual.organs.get(organ.id)!;
      assert.equal(organVisual.bodyMaterials[0]!.color.getHex(), 0xc5d9b2);
    }

    studio.setBotanicalTones();
    for (const organ of blooms) {
      const organVisual = visual.organs.get(organ.id)!;
      assert.equal(organVisual.bodyMaterials[0]!.color.getHex(), 0xe68a2e);
    }
  } finally {
    dispose();
  }
});
