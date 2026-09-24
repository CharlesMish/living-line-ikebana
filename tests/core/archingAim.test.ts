import assert from "node:assert/strict";
import test from "node:test";
import { add, aimBranch, createArchingTrailer, createFloweringBranch, distance, normalize, sampleBranch, serializePlantGraph, subtract } from "../../src/core/index.ts";
import { assertAttachmentCoincidence, assertRestLengthsPreserved } from "./helpers.ts";

test("a trailer tip can descend while the seated exit remains upright", () => {
  for (const seed of [8278, 9255, 10232]) {
    const graph = createArchingTrailer("plant-1", seed, { x: 0, y: 0.55, z: 0 });
    const before = serializePlantGraph(graph);
    const root = graph.branches.get(graph.rootBranchId)!;
    const grip = root.points.at(-1)!;
    const low = aimBranch(graph, root.id, grip, add(grip, { x: 0, y: -0.5, z: 0 }));
    const lower = aimBranch(graph, root.id, grip, add(grip, { x: 0, y: -0.8, z: 0 }));
    const shaped = lower.branches.get(root.id)!;
    assert.ok(shaped.points.at(-1)!.y < root.points[0].y - 0.4, "the arch's end is not clamped at the insertion height");
    assert.ok(distance(low.branches.get(root.id)!.points.at(-1)!, shaped.points.at(-1)!) > 0.2, "continued downward dragging does not stick at the old floor");
    assert.ok(shaped.points[1].y > shaped.points[0].y, "the seated exit stays up");
    assert.equal(serializePlantGraph(aimBranch(lower, root.id, shaped.points.at(-1)!, shaped.points.at(-1)!)), serializePlantGraph(lower), "reacquiring a lowered arch has no jump");
    assertRestLengthsPreserved(graph, lower);
    assertAttachmentCoincidence(lower);
    assert.equal(serializePlantGraph(graph), before);
  }
});

test("extreme root aims keep the seated exit above its floor and do not stretch or detach", () => {
  for (const create of [createArchingTrailer, createFloweringBranch]) {
    const graph = create("plant-1", 8278, { x: 0, y: 0.55, z: 0 });
    const branch = graph.branches.get(graph.rootBranchId)!;
    for (const fraction of [0.1, 0.54, 1]) {
      const grip = sampleBranch(branch, branch.activeLength * fraction).position;
      for (const target of [{ x: 2, y: -20, z: 1 }, { x: -12, y: -20, z: -3 }, { x: 0, y: 30, z: 1 }]) {
        const result = aimBranch(graph, branch.id, grip, target);
        const points = result.branches.get(branch.id)!.points;
        const exit = normalize(subtract(points[1], points[0]));
        assert.ok(exit.y >= 0.08 / branch.activeLength - 1e-9);
        assertRestLengthsPreserved(graph, result);
        assertAttachmentCoincidence(result);
      }
    }
  }
});
