import assert from "node:assert/strict";
import test from "node:test";
import { readExperimentConfig } from "../../src/app/config.ts";
import { prepareMaterialInsertionForApp } from "../../src/app/materialInsertion.ts";
import {
  bendBranch,
  distance,
  legalBendStation,
  pruneBranch,
  translatePendingGraph,
  getMaterialDefinitions,
  naturalPoseProfile,
  prepareMaterialInsertion,
  sampleBranch,
  segmentLengths,
  settleNaturalPose,
  toCanonicalPlantGraph,
  validatePlantGraph,
} from "../../src/core/index.ts";
import type { PlantGraph } from "../../src/core/types.ts";

const BASE = { x: 0, y: 0.55, z: 0 };
const ORDINALS = [1, 2, 3];

function stock(materialId: string, ordinal: number): PlantGraph {
  const prepared = prepareMaterialInsertion(materialId, ordinal, BASE);
  assert.ok(prepared.ok, materialId);
  return prepared.graph;
}

const canonical = (graph: PlantGraph) => JSON.stringify(toCanonicalPlantGraph(graph));

test("a natural pose keeps every material's topology, stock lengths and attachments", () => {
  for (const { materialId } of getMaterialDefinitions()) {
    for (const ordinal of ORDINALS) {
      const before = stock(materialId, ordinal);
      const snapshot = canonical(before);
      const after = settleNaturalPose(before);
      const label = `${materialId}#${ordinal}`;

      assert.equal(canonical(before), snapshot, `${label}: the stock graph is not mutated`);
      assert.deepEqual(validatePlantGraph(after), [], `${label}: settled graph is valid`);
      assert.equal(after.generatorVersion, before.generatorVersion, label);
      assert.equal(after.seed, before.seed, label);
      assert.equal(after.rootBranchId, before.rootBranchId, label);
      assert.deepEqual([...after.branches.keys()], [...before.branches.keys()], `${label}: branch identities and order`);
      assert.deepEqual([...after.organs.keys()], [...before.organs.keys()], `${label}: organ identities and order`);

      for (const [id, branch] of after.branches) {
        const original = before.branches.get(id)!;
        assert.equal(branch.kind, original.kind, `${label} ${id}`);
        assert.equal(branch.parentId, original.parentId, `${label} ${id}`);
        assert.equal(branch.parentDistance, original.parentDistance, `${label} ${id}`);
        assert.equal(branch.activeLength, original.activeLength, `${label} ${id}`);
        assert.equal(branch.radius, original.radius, `${label} ${id}`);
        assert.equal(branch.stiffness, original.stiffness, `${label} ${id}`);
        assert.equal(branch.active, original.active, `${label} ${id}`);
        assert.deepEqual(branch.restLengths, original.restLengths, `${label} ${id}: rest lengths`);
        assert.equal(branch.points.length, original.points.length, `${label} ${id}`);
        const lengths = segmentLengths(branch.points);
        for (let index = 0; index < lengths.length; index += 1) {
          assert.ok(Math.abs(lengths[index] - branch.restLengths[index]) < 1e-8, `${label} ${id}: segment ${index} keeps its stock length`);
        }
        if (branch.parentId) {
          const seat = sampleBranch(after.branches.get(branch.parentId)!, branch.parentDistance).position;
          assert.ok(distance(seat, branch.points[0]) < 1e-7, `${label} ${id}: still attached at its parent station`);
        }
      }
      const root = after.branches.get(after.rootBranchId)!;
      assert.ok(distance(root.points[0], before.branches.get(before.rootBranchId)!.points[0]) < 1e-9, `${label}: the cut end stays where it was seated`);

      for (const [id, organ] of after.organs) {
        const original = before.organs.get(id)!;
        assert.equal(organ.kind, original.kind, `${label} ${id}`);
        assert.equal(organ.branchId, original.branchId, `${label} ${id}`);
        assert.equal(organ.distance, original.distance, `${label} ${id}`);
        assert.equal(organ.active, original.active, `${label} ${id}`);
        assert.ok(Math.abs(organ.scale / original.scale - 1) <= 0.07 + 1e-9, `${label} ${id}: size varies by a few percent only`);
        assert.ok(Math.abs(organ.spin - original.spin) <= 0.5 + 1e-9, `${label} ${id}: roll is slight`);
      }
    }
  }
});

test("a natural pose is repeatable, individual, and a modest departure from the design", () => {
  for (const { materialId } of getMaterialDefinitions()) {
    const before = stock(materialId, 1);
    const once = settleNaturalPose(before), again = settleNaturalPose(before);
    assert.equal(canonical(once), canonical(again), `${materialId}: same cutting, same pose`);
    assert.notEqual(canonical(once), canonical(before), `${materialId}: the pose is not the stock design`);
    assert.notEqual(
      JSON.stringify(poseOffsets(stock(materialId, 2), settleNaturalPose(stock(materialId, 2)))),
      JSON.stringify(poseOffsets(before, once)),
      `${materialId}: another cutting settles differently`,
    );

    const root = before.branches.get(before.rootBranchId)!;
    const height = root.restLengths.reduce((sum, value) => sum + value, 0);
    let farthest = 0;
    for (const [id, branch] of once.branches) {
      const original = before.branches.get(id)!;
      for (let index = 0; index < branch.points.length; index += 1) farthest = Math.max(farthest, distance(branch.points[index], original.points[index]));
    }
    assert.ok(farthest > 0.002, `${materialId}: the sway is visible (${farthest})`);
    assert.ok(farthest < Math.max(0.3 * height, 0.12), `${materialId}: the sway keeps the design's gesture (${farthest} of ${height})`);
  }
});

function poseOffsets(before: PlantGraph, after: PlantGraph): number[] {
  const offsets: number[] = [];
  for (const [id, branch] of after.branches) {
    const original = before.branches.get(id)!;
    const tip = branch.points.length - 1;
    offsets.push(
      Math.round((branch.points[tip].x - original.points[tip].x) * 1e6),
      Math.round((branch.points[tip].y - original.points[tip].y) * 1e6),
      Math.round((branch.points[tip].z - original.points[tip].z) * 1e6),
    );
  }
  return offsets;
}

test("zero strength, the stock switch and the generators themselves give the stock design", () => {
  const before = stock("blossom-spray", 1);
  assert.equal(canonical(settleNaturalPose(before, 0)), canonical(before));
  assert.equal(canonical(settleNaturalPose(before, Number.NaN)), canonical(before));

  const natural = prepareMaterialInsertionForApp("blossom-spray", 0);
  const explicit = prepareMaterialInsertionForApp("blossom-spray", 0, "natural");
  const plain = prepareMaterialInsertionForApp("blossom-spray", 0, "stock");
  assert.ok(natural.ok && explicit.ok && plain.ok);
  assert.equal(canonical(plain.graph), canonical(before), "?pose=stock seats the cutting exactly as generated");
  assert.equal(canonical(natural.graph), canonical(settleNaturalPose(before)), "tray cuttings settle by default");
  assert.equal(canonical(explicit.graph), canonical(natural.graph));
  assert.equal(canonical(stock("blossom-spray", 1)), canonical(before), "core insertion is untouched");

  assert.equal(readExperimentConfig(new URL("https://example.test/?pose=stock")).cuttingPose, "stock");
  assert.equal(readExperimentConfig(new URL("https://example.test/?pose=natural")).cuttingPose, "natural");
  assert.equal(readExperimentConfig(new URL("https://example.test/?pose=wild")).cuttingPose, undefined);
  assert.equal(readExperimentConfig(new URL("https://example.test/")).cuttingPose, undefined);
});

test("authored gestures temper the pose of their own stalks", () => {
  assert.equal(naturalPoseProfile("one-branch-v1").stalk, 1);
  assert.ok(naturalPoseProfile("nodding-flower-v2").stalk < 1, "a nod is authored, so it is disturbed less");
  assert.ok(naturalPoseProfile("lantern-spray-v1").curve < 1, "hanging lanterns keep their plumb stalks");
  assert.equal(naturalPoseProfile("unknown-generator").sway, 1);
});

test("a settled cutting is ordinary material: it seats elsewhere, bends and prunes under the same laws", () => {
  for (const { materialId } of getMaterialDefinitions()) {
    const settled = settleNaturalPose(stock(materialId, 1));
    const moved = translatePendingGraph(settled, { x: 0.2, y: 0.55, z: -0.1 });
    assert.deepEqual(validatePlantGraph(moved), [], `${materialId}: seated elsewhere`);

    const root = moved.branches.get(moved.rootBranchId)!;
    const station = legalBendStation(root);
    if (station !== null) {
      const at = sampleBranch(root, station).position;
      const bent = bendBranch(moved, { branchId: root.id, stationDistance: station, target: { x: at.x + 0.3, y: at.y, z: at.z + 0.1 } });
      assert.deepEqual(validatePlantGraph(bent), [], `${materialId}: bent`);
      const lengths = segmentLengths(bent.branches.get(root.id)!.points);
      for (let index = 0; index < lengths.length; index += 1) assert.ok(Math.abs(lengths[index] - root.restLengths[index]) < 1e-8, `${materialId}: bend keeps stock length`);
    }
    const cut = pruneBranch(moved, root.id, root.activeLength * 0.6);
    assert.deepEqual(validatePlantGraph(cut), [], `${materialId}: pruned`);
    assert.equal(cut.branches.size, moved.branches.size, `${materialId}: pruned records are kept`);
  }
});
