import assert from "node:assert/strict";
import test from "node:test";
import { createWorkbenchFixture } from "../../src/app/workbench.ts";
import { add, aimBranch, applyPrune, bendBranch, deserializePlantGraph, distance, dot, fromCanonicalPlantGraph,
  organPosition, previewPrune, sampleBranch, serializePlantGraph } from "../../src/core/index.ts";
import { assertAttachmentCoincidence, assertRestLengthsPreserved } from "./helpers.ts";

test("bowed Starry has a continuous flowering apex, and leaves the ordinary fixture on v1", () => {
  for (const seed of [8278, 9255, 10232]) {
    const load = (id: string) => createWorkbenchFixture(id, seed, 1, { remember: false }).plants[0]!;
    assert.equal(load("starry-pincushion").generatorVersion, "starry-pincushion-v1");
    const graph = fromCanonicalPlantGraph(load("starry-bowed-axis"));
    assert.equal(graph.generatorVersion, "starry-pincushion-v2");
    assert.equal(serializePlantGraph(fromCanonicalPlantGraph(load("starry-bowed-axis"))), serializePlantGraph(graph));
    const stem = graph.branches.get(graph.rootBranchId)!;
    const tip = sampleBranch(stem, stem.activeLength);
    const upper = graph.branches.get(graph.id + ":arm-3")!;
    assert.equal(upper.parentDistance, stem.activeLength);
    assert.ok(distance(tip.position, upper.points[0]) < 1e-8);
    assert.ok(dot(tip.tangent, sampleBranch(upper, 0).tangent) > .99);
    assert.ok(dot(sampleBranch(stem, 0).tangent, tip.tangent) < .83, "the stock has a visible bow");
    for (const edit of [
      bendBranch(graph, { branchId: stem.id, stationDistance: stem.activeLength / 2, target: add(tip.position, { x: .7, y: -.5, z: .2 }) }),
      aimBranch(graph, upper.id, upper.points.at(-1)!, add(upper.points.at(-1)!, { x: -.3, y: 0, z: .24 })),
    ]) {
      assertRestLengthsPreserved(graph, edit); assertAttachmentCoincidence(edit);
    }
    const cut = applyPrune(graph, previewPrune(graph, stem.id, .75 * stem.activeLength));
    const heads = [...cut.organs.values()].filter(o => o.kind === "bloom" && o.active);
    assert.equal(heads.length, 2);
    for (const head of heads) assert.deepEqual(organPosition(cut, head.id), organPosition(graph, head.id));
    assertAttachmentCoincidence(cut);
    const bytes = serializePlantGraph(cut);
    assert.equal(serializePlantGraph(deserializePlantGraph(bytes)), bytes);
  }
});
