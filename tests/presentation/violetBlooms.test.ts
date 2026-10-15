import assert from "node:assert/strict";
import test from "node:test";
import * as THREE from "three";
import { createVioletSprig, createIndigoSpire, serializePlantGraph, previewPrune, applyPrune } from "../../src/core/index.ts";
import { createVioletFloretGeometry, createIndigoFloretGeometry } from "../../src/presentation/violetBloomGeometry.ts";
import { studioFixture } from "./studioFixture.ts";

test("new violet corollas have finite closed sheets and genuinely different profiles", () => {
  for (const make of [createVioletFloretGeometry, createIndigoFloretGeometry]) for (const seed of [8278, 9255, 10232]) {
    const g = make(seed), p = g.getAttribute("position"), n = g.getAttribute("normal");
    assert.ok(g.index && g.index.count > 0);
    assert.ok(Array.from(p.array).every(Number.isFinite));
    assert.ok(Array.from(n.array).every(Number.isFinite));
    const edges = new Map<string, number>();
    let signedVolume = 0;
    for (let i = 0; i < g.index.count; i += 3) {
      const v = [g.index.getX(i), g.index.getX(i + 1), g.index.getX(i + 2)];
      const a = new THREE.Vector3().fromBufferAttribute(p, v[0]!);
      const b = new THREE.Vector3().fromBufferAttribute(p, v[1]!);
      const c = new THREE.Vector3().fromBufferAttribute(p, v[2]!);
      signedVolume += a.dot(b.clone().cross(c)) / 6;
      assert.ok(b.sub(a).cross(c.sub(a)).lengthSq() > 1e-17, "no collapsed triangles");
      for (let e = 0; e < 3; e++) {
        const pair = [v[e]!, v[(e + 1) % 3]!].sort((x, y) => x - y).join(":");
        edges.set(pair, (edges.get(pair) ?? 0) + 1);
      }
    }
    assert.ok(signedVolume > 0, "closed surfaces have outward winding");
    assert.ok([...edges.values()].every(count => count === 2), "all surface boundaries stitched");
    if (make === createVioletFloretGeometry) {
      assert.ok(n.getZ(4 * 7 + 3) > .9, "front sheet normals face +Z");
      assert.ok(n.getZ(63 + 4 * 7 + 3) < -.9, "reverse sheet normals face −Z");
    }
    g.computeBoundingBox(); const box = g.boundingBox!;
    if (make === createVioletFloretGeometry) assert.ok(box.max.z - box.min.z < .1 && box.max.x - box.min.x > .5);
    else assert.ok(box.max.y - box.min.y > .38 && box.max.x - box.min.x < .4);
    g.dispose();
  }
});

test("violet surfaces survive prune preview, restore and tone changes without replacing graph or buffers", () => {
  for (const create of [createVioletSprig, createIndigoSpire]) {
    const graph = create("plant-1", 8278, { x: 0, y: .55, z: 0 }), before = serializePlantGraph(graph);
    const { studio, visual, dispose } = studioFixture(graph);
    try {
      const bloom = [...graph.organs.values()].find(o => o.kind === "bloom")!;
      const organ = visual.organs.get(bloom.id)!;
      const surfaces: THREE.BufferGeometry[] = [];
      organ.group.traverse((node: THREE.Object3D) => { if (node instanceof THREE.Mesh && /floret/.test(node.geometry.name)) surfaces.push(node.geometry); });
      assert.equal(surfaces.length, 1, "one merged corolla surface per flower");
      const savedPositions = [...surfaces[0]!.getAttribute("position").array];
      const plan = previewPrune(graph, bloom.branchId, bloom.distance * .5);
      studio.setCutPreview({ plantId: graph.id, plan });
      studio.setCutPreview(null);
      studio.upsertGraph(applyPrune(graph, plan));
      assert.equal(organ.group.visible, false);
      studio.upsertGraph(graph);
      assert.equal(organ.group.visible, true);
      studio.setBotanicalTones({ "violet-sprig": "lavender", "indigo-spire": "blue" });
      assert.deepEqual([...surfaces[0]!.getAttribute("position").array], savedPositions);
      assert.equal(visual.organs.get(bloom.id), organ);
      assert.equal(serializePlantGraph(graph), before);
    } finally { dispose(); }
  }
});
