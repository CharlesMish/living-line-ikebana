// @ts-nocheck
import assert from "node:assert/strict";
import {
  activeIdentity,
  distance,
  sampleBranch,
  segmentLengths,
  validatePlantGraph,
} from "../../src/core/index.ts";

export const assertClose = (actual, expected, tolerance = 1e-8, label = "value") => {
  assert.ok(Math.abs(actual - expected) <= tolerance, `${label}: ${actual} != ${expected}`);
};

export const assertVecClose = (actual, expected, tolerance = 1e-8, label = "vector") => {
  assert.ok(distance(actual, expected) <= tolerance, `${label}: ${JSON.stringify(actual)} != ${JSON.stringify(expected)}`);
};

export const snapshotRecords = (graph) => ({
  branches: new Map([...graph.branches].map(([id, branch]) => [id, JSON.stringify(branch)])),
  organs: new Map([...graph.organs].map(([id, organ]) => [id, JSON.stringify(organ)])),
});

export const assertRecordsUnchanged = (graph, snapshot, branchIds, organIds = []) => {
  for (const id of branchIds) assert.equal(JSON.stringify(graph.branches.get(id)), snapshot.branches.get(id), `branch ${id}`);
  for (const id of organIds) assert.equal(JSON.stringify(graph.organs.get(id)), snapshot.organs.get(id), `organ ${id}`);
};

export const assertRestLengthsPreserved = (before, after, branchIds = activeIdentity(before).branches) => {
  for (const id of branchIds) {
    const source = before.branches.get(id);
    const result = after.branches.get(id);
    assert.deepEqual(result.restLengths, source.restLengths, `${id} stored stock length changed`);
    segmentLengths(result.points).forEach((value, index) => {
      assertClose(value, result.restLengths[index], 1e-8, `${id} segment ${index}`);
    });
  }
};

export const assertAttachmentCoincidence = (graph) => {
  const issues = validatePlantGraph(graph);
  assert.deepEqual(issues, [], issues.map((item) => `${item.path}: ${item.message}`).join("\n"));
  for (const branch of graph.branches.values()) {
    if (!branch.active || branch.parentId === null) continue;
    const parent = graph.branches.get(branch.parentId);
    assertVecClose(branch.points[0], sampleBranch(parent, branch.parentDistance).position, 1e-8, branch.id);
  }
};

export const segmentDirections = (points) =>
  points.slice(0, -1).map((point, index) => {
    const next = points[index + 1];
    const dx = next.x - point.x;
    const dy = next.y - point.y;
    const dz = next.z - point.z;
    const magnitude = Math.hypot(dx, dy, dz);
    return { x: dx / magnitude, y: dy / magnitude, z: dz / magnitude };
  });

export const localTurns = (points) => {
  const directions = segmentDirections(points);
  return directions.slice(0, -1).map((first, index) => {
    const second = directions[index + 1];
    return Math.acos(Math.max(-1, Math.min(1, first.x * second.x + first.y * second.y + first.z * second.z)));
  });
};

