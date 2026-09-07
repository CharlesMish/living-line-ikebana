import assert from "node:assert/strict";
import test from "node:test";
import fixture from "../../fixtures/plant-2-leafy-shoot-v1.json";
import {
  prepareMaterialInsertion, serializePlantGraph, deserializePlantGraph,
  toCanonicalPlantGraph, validatePlantGraph, bendBranch, previewPrune, applyPrune,
  sampleBranch, add, vec3,
} from "../../src/core/index.ts";

const BASE = { x: 0, y: 0.55, z: 0 };

test("leafy shoot is deterministic, additive and valid at fixed seeds before and after craft", () => {
  for (const ordinal of [1, 2, 3, 17, 64]) {
    const prepared = prepareMaterialInsertion("leafy-shoot", ordinal, BASE);
    assert.ok(prepared.ok);
    const graph = prepared.graph;
    const before = serializePlantGraph(graph);
    if (ordinal === 2) assert.deepEqual(JSON.parse(before), fixture);
    assert.equal(graph.generatorVersion, "leafy-shoot-v1");
    assert.equal(graph.branches.size, 8);
    assert.equal(graph.organs.size, 7);
    assert.deepEqual(validatePlantGraph(graph), []);
    const repeated = prepareMaterialInsertion("leafy-shoot", ordinal, BASE);
    assert.ok(repeated.ok);
    assert.equal(serializePlantGraph(repeated.graph), before);
    assert.equal(serializePlantGraph(deserializePlantGraph(before)), before);
    const root = graph.branches.get(graph.rootBranchId)!;
    const station = root.activeLength * 0.54;
    const target = add(sampleBranch(root, station).position, vec3(1.7, 0.1, -0.8));
    const bent = bendBranch(graph, { branchId: root.id, stationDistance: station, target });
    assert.deepEqual(validatePlantGraph(bent), []);
    assert.notDeepEqual(bent.branches.get(root.id)!.points, root.points);
    for (const branch of graph.branches.values()) {
      assert.deepEqual(bent.branches.get(branch.id)!.restLengths, branch.restLengths);
    }
    const plan = previewPrune(bent, root.id, root.activeLength * 0.6);
    assert.ok(plan);
    const cut = applyPrune(bent, plan);
    assert.deepEqual(validatePlantGraph(cut), []);
    assert.deepEqual([...cut.organs.values()].filter(o => !o.active).map(o => o.id).sort(), [...plan.removedOrganIds].sort());
    assert.equal(cut.organs.size, 7, "cut records survive as history");
    assert.equal(serializePlantGraph(deserializePlantGraph(serializePlantGraph(cut))), serializePlantGraph(cut));
    assert.equal(serializePlantGraph(graph), before, "generation snapshot remains immutable");
  }
});

test("leaf pruning removes one blade without relocating its neighbours", () => {
  const prepared = prepareMaterialInsertion("leafy-shoot", 2, BASE);
  assert.ok(prepared.ok);
  const graph = prepared.graph;
  const leaf = graph.organs.get("plant-2:leaf-3")!;
  const stalk = graph.branches.get(leaf.branchId)!;
  const plan = previewPrune(graph, stalk.id, stalk.activeLength * 0.5);
  assert.ok(plan);
  const cut = applyPrune(graph, plan);
  assert.deepEqual(plan.removedOrganIds, [leaf.id]);
  for (const branch of graph.branches.values()) {
    if (branch.id !== stalk.id) assert.deepEqual(cut.branches.get(branch.id), branch);
  }
  assert.deepEqual(validatePlantGraph(cut), []);
});
