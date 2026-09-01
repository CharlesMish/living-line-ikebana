// @ts-nocheck
import assert from "node:assert/strict";
import test from "node:test";
import {
  activeIdentity,
  aimBranch,
  bendBranch,
  bendStationAtFraction,
  clonePlantGraph,
  createFloweringBranch,
  distance,
  legalBendStation,
  sampleBranch,
  translatePlantBaseWithResult,
  translatePendingGraph,
  vec3,
} from "../../src/core/index.ts";
import {
  assertAttachmentCoincidence,
  assertClose,
  assertRecordsUnchanged,
  assertRestLengthsPreserved,
  localTurns,
  segmentDirections,
  snapshotRecords,
} from "./helpers.ts";

test("aim rotates the acquired continuation and descendants without stretching stock", () => {
  const before = createFloweringBranch("plant-1", 8278, vec3(0, 0.55, 0));
  const branch = before.branches.get("plant-1:lateral-a");
  const grabbed = sampleBranch(branch, branch.activeLength * 0.78).position;
  const target = { x: grabbed.x + 0.42, y: grabbed.y + 0.18, z: grabbed.z + 0.31 };
  const after = aimBranch(before, branch.id, grabbed, target);
  assertRestLengthsPreserved(before, after);
  assertAttachmentCoincidence(after);
  assert.ok(distance(after.branches.get(branch.id).points.at(-1), branch.points.at(-1)) > 0.1);
  assert.deepEqual(activeIdentity(after), activeIdentity(before));
});

test("root aim enforces the anti-inversion floor", () => {
  const before = createFloweringBranch("plant-1", 8278, vec3(0, 0.55, 0));
  const trunk = before.branches.get(before.rootBranchId);
  const grabbed = sampleBranch(trunk, 4).position;
  const after = aimBranch(before, trunk.id, grabbed, { x: 2, y: -20, z: 1 });
  const direction = {
    x: after.branches.get(trunk.id).points[12].x - trunk.points[0].x,
    y: after.branches.get(trunk.id).points[12].y - trunk.points[0].y,
    z: after.branches.get(trunk.id).points[12].z - trunk.points[0].z,
  };
  assert.ok(direction.y > 0, "root continuation remains on the permitted side of the insertion floor");
  assertAttachmentCoincidence(after);
});

test("bend accepts a material-distance station and preserves broad coherent curvature", () => {
  const before = createFloweringBranch("plant-1", 8278, vec3(0, 0.55, 0));
  const branch = before.branches.get("plant-1:lateral-a");
  const stationDistance = bendStationAtFraction(branch);
  const station = sampleBranch(branch, stationDistance);
  const after = bendBranch(before, {
    branchId: branch.id,
    stationDistance,
    target: { x: station.position.x + 0.28, y: station.position.y + 0.11, z: station.position.z - 0.2 },
  });
  const bent = after.branches.get(branch.id);
  assertRestLengthsPreserved(before, after);
  assertAttachmentCoincidence(after);
  const oldDirections = segmentDirections(branch.points);
  const newDirections = segmentDirections(bent.points);
  assert.ok(newDirections.filter((direction, index) => {
    const old = oldDirections[index];
    return Math.acos(Math.max(-1, Math.min(1, direction.x * old.x + direction.y * old.y + direction.z * old.z))) > 0.01;
  }).length >= 4);
  const oldTurns = localTurns(branch.points);
  localTurns(bent.points).forEach((turn, index) => {
    assert.ok(turn < 0.38, `joint ${index} folded`);
    assert.ok(Math.abs(turn - oldTurns[index]) < 0.16, `joint ${index} changed abruptly`);
  });
});

test("extreme bend requests saturate instead of becoming a pretzel", () => {
  const before = createFloweringBranch("plant-1", 8278, vec3(0, 0.55, 0));
  const branch = before.branches.get(before.rootBranchId);
  const stationDistance = bendStationAtFraction(branch);
  const station = sampleBranch(branch, stationDistance);
  const after = bendBranch(before, {
    branchId: branch.id,
    stationDistance,
    target: { x: station.position.x + 300, y: station.position.y - 200, z: station.position.z + 120 },
  });
  const bent = after.branches.get(branch.id);
  assertRestLengthsPreserved(before, after);
  localTurns(bent.points).forEach((turn, index) => assert.ok(turn < 0.38, `joint ${index} folded`));
  assert.ok(distance(sampleBranch(bent, stationDistance).position, station.position) < 1.5);
  assertAttachmentCoincidence(after);
});

test("bend eligibility excludes stalks and is based on a legal rest-arc interval", () => {
  const graph = createFloweringBranch("plant-1", 8278, vec3(0, 0.55, 0));
  assert.equal(legalBendStation(graph.branches.get("plant-1:leaf-1"), 0.2), null);
  const trunk = graph.branches.get(graph.rootBranchId);
  const station = legalBendStation(trunk, trunk.activeLength * 0.54);
  assert.ok(station >= trunk.restLengths[0]);
  assert.ok(station <= trunk.activeLength - trunk.restLengths.at(-1));
});

test("default bend station follows rest arc rather than point count", () => {
  const graph = createFloweringBranch("plant-1", 8278, vec3(0, 0.55, 0));
  const source = graph.branches.get(graph.rootBranchId);
  const branch = {
    ...source,
    id: "nonuniform",
    points: [vec3(0, 0, 0), vec3(0.25, 0, 0), vec3(1.25, 0, 0), vec3(9.5, 0, 0), vec3(10, 0, 0)],
    restLengths: [0.25, 1, 8.25, 0.5],
    activeLength: 10,
    referenceNormal: vec3(0, 1, 0),
  };
  const station = bendStationAtFraction(branch);
  assertClose(station, 5.4, 1e-12);
  const sample = sampleBranch(branch, station);
  assertClose(sample.position.x, 5.4, 1e-12);
  assert.equal(sample.segmentIndex, 2, "54% of material is not the 54%-point-index joint");
});

test("base movement clamps once then translates every active point coherently", () => {
  const before = createFloweringBranch("plant-1", 8278, vec3(0, 0.55, 0));
  const records = snapshotRecords(before);
  const result = translatePlantBaseWithResult(before, { x: 9, y: 20, z: -4 }, 1.22);
  assert.equal(result.clamped, true);
  assertClose(Math.hypot(result.base.x, result.base.z), 1.22, 1e-12);
  assert.equal(result.base.y, 0.55);
  assertRestLengthsPreserved(before, result.graph);
  assertAttachmentCoincidence(result.graph);
  const inactive = clonePlantGraph(before);
  inactive.branches.get("plant-1:lateral-b").active = false;
  const inactiveRecords = snapshotRecords(inactive);
  const moved = translatePlantBaseWithResult(inactive, { x: 0.4, y: 0.55, z: 0.2 }).graph;
  assertRecordsUnchanged(moved, inactiveRecords, ["plant-1:lateral-b"]);
});

test("pending ghost translation follows raw placement without changing its identity", () => {
  const before = createFloweringBranch("plant-1", 8278, vec3(0, 0.55, 0));
  const after = translatePendingGraph(before, { x: 4.8, y: 0.55, z: -3.2 });
  assert.equal(after.id, before.id);
  assert.equal(after.seed, before.seed);
  assert.equal(after.branches.size, before.branches.size);
  assert.equal(after.organs.size, before.organs.size);
  assertClose(after.branches.get(after.rootBranchId).points[0].x, 4.8, 1e-12);
  assertClose(after.branches.get(after.rootBranchId).points[0].z, -3.2, 1e-12);
  assertRestLengthsPreserved(before, after);
  assertAttachmentCoincidence(after);
});

test("separate plant instances never share mutable geometry", () => {
  const first = createFloweringBranch("first", 8278, vec3(-0.3, 0.55, 0));
  const second = createFloweringBranch("second", 8278, vec3(0.3, 0.55, 0));
  const secondBefore = snapshotRecords(second);
  const branch = first.branches.get("first:lateral-a");
  const stationDistance = bendStationAtFraction(branch);
  const station = sampleBranch(branch, stationDistance);
  bendBranch(first, { branchId: branch.id, stationDistance, target: { x: station.position.x + 1, y: station.position.y, z: station.position.z } });
  assertRecordsUnchanged(second, secondBefore, [...second.branches.keys()], [...second.organs.keys()]);
});
