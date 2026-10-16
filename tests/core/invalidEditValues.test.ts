import assert from 'node:assert/strict';
import test from 'node:test';
import {
  aimBranch, applyAimRotation, applyBendRotation, applyPrune, bendBranch, clonePlantGraph,
  createFloweringBranch, previewPrune, pruneBranch, sampleBranch, serializePlantGraph,
  translatePendingGraph, translatePlantBaseWithResult, validatePlantGraph,
} from '../../src/core/index.ts';
import { assertAttachmentCoincidence, assertRestLengthsPreserved } from './helpers.ts';

const plant = () => createFloweringBranch('plant-1', 8278, { x: 0, y: .55, z: 0 });

test('direct core operations safely no-op non-finite input and overflowing finite vectors', () => {
  const graph = plant();
  const branch = graph.branches.get(graph.rootBranchId)!;
  const point = sampleBranch(branch, 2).position;
  const original = serializePlantGraph(graph);
  for (const value of [NaN, Infinity, -Infinity, 1e308, -1e308]) {
    const target = { ...point, z: value };
    const request = { branchId: branch.id, stationDistance: 2, target };
    const results = [
      aimBranch(graph, branch.id, point, target),
      aimBranch(graph, branch.id, target, point),
      bendBranch(graph, request),
      applyBendRotation(graph, { ...request, target: point }, target),
      applyAimRotation(graph, branch.id, { x: value, y: 0, z: 0, w: 1 }),
      translatePlantBaseWithResult(graph, target).graph,
      translatePendingGraph(graph, target),
    ];
    for (const result of results) {
      assert.equal(serializePlantGraph(result), original);
      assert.deepEqual(validatePlantGraph(result), []);
    }
  }
  for (const value of [NaN, Infinity, -Infinity]) {
    assert.equal(serializePlantGraph(bendBranch(graph, { branchId: branch.id, stationDistance: value, target: point })), original);
    assert.equal(serializePlantGraph(translatePlantBaseWithResult(graph, point, value).graph), original);
    assert.equal(serializePlantGraph(pruneBranch(graph, branch.id, value)), original);
    const plan = previewPrune(graph, branch.id, value);
    assert.equal(serializePlantGraph(applyPrune(graph, plan)), original);
    assert.equal(serializePlantGraph(applyPrune(graph, { ...plan, distance: value })), original);
  }
});

test('finite prune extremes retain the established clamp law instead of being treated as malformed', () => {
  const graph = plant();
  const branch = graph.branches.get(graph.rootBranchId)!;
  for (const [distance, boundary] of [[-1e308, .62], [1e308, branch.activeLength - .025]]) {
    const result = pruneBranch(graph, branch.id, distance);
    assert.equal(serializePlantGraph(result), serializePlantGraph(pruneBranch(graph, branch.id, boundary)));
    assert.deepEqual(validatePlantGraph(result), []);
  }
});

test('direct non-unit rotations remain rigid, while zero rotations preserve the original graph', () => {
  const graph = plant();
  for (const rotation of [{ x: 0, y: 0, z: 0, w: 0 }, { x: 0, y: 0, z: 0, w: 2 }]) {
    assert.equal(serializePlantGraph(applyAimRotation(graph, graph.rootBranchId, rotation)), serializePlantGraph(graph));
  }
  const result = applyAimRotation(graph, graph.rootBranchId, { x: 0, y: 2, z: 0, w: 2 });
  assertRestLengthsPreserved(graph, result);
  assertAttachmentCoincidence(result);
  assert.deepEqual(validatePlantGraph(result), []);
});

test('deep accepted branch chains bend parent-first without changing stock or attachment positions', () => {
  const graph = clonePlantGraph(plant());
  const root = graph.branches.get(graph.rootBranchId)!;
  graph.branches = new Map([[root.id, root]]);
  graph.organs.clear();
  let parent = root;
  for (let index = 1; index < 120; index++) {
    const anchor = sampleBranch(parent, parent.activeLength).position;
    const child = { ...root, id: `chain-${index}`, kind: 'lateral' as const,
      parentId: parent.id, parentDistance: parent.activeLength,
      points: [anchor, { ...anchor, y: anchor.y + .125 }], restLengths: [.125],
      activeLength: .125, referenceNormal: { x: 1, y: 0, z: 0 } };
    graph.branches.set(child.id, child);
    parent = child;
  }
  assert.deepEqual(validatePlantGraph(graph), []);
  const target = sampleBranch(root, 2).position;
  const result = bendBranch(graph, { branchId: root.id, stationDistance: 2, target: { ...target, x: target.x + .3 } });
  assertRestLengthsPreserved(graph, result);
  assertAttachmentCoincidence(result);
  assert.deepEqual(validatePlantGraph(result), []);
  assert.notDeepEqual(result.branches.get('chain-119')!.points, graph.branches.get('chain-119')!.points);
});
