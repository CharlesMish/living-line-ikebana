import assert from "node:assert/strict";
import test from "node:test";
import {
  add,
  aimBranch,
  createFlowerVolume,
  distance,
  normalize,
  pruneBranch,
  sampleBranch,
  serializePlantGraph,
  subtract,
  vec3,
} from "../../src/core/index.ts";
import {
  assertAttachmentCoincidence,
  assertRecordsUnchanged,
  assertRestLengthsPreserved,
  assertVecClose,
  snapshotRecords,
} from "./helpers.ts";

const flowerVolume = () => createFlowerVolume("plant-1", 8278, vec3(0, 0.55, 0));

test("short flower stalk grabs aim without a material-size dead zone", () => {
  const graph = flowerVolume();
  const before = serializePlantGraph(graph);
  const records = snapshotRecords(graph);
  const crown = graph.branches.get("plant-1:group-1")!;

  for (const station of [0.06, 0.12]) {
    const grabbed = sampleBranch(crown, station).position;
    const target = add(grabbed, vec3(0.15, 0, 0));
    const result = aimBranch(graph, crown.id, grabbed, target);
    const shaped = result.branches.get(crown.id)!;

    assert.ok(distance(shaped.points.at(-1)!, crown.points.at(-1)!) > 0.05,
      "a valid short-stalk acquisition must respond to the drag");
    assertVecClose(
      normalize(subtract(sampleBranch(shaped, station).position, crown.points[0])),
      normalize(subtract(target, crown.points[0])),
    );
    assertRestLengthsPreserved(graph, result);
    assertAttachmentCoincidence(result);
    assertRecordsUnchanged(result, records,
      [...graph.branches.keys()].filter(id => id !== crown.id),
      [...graph.organs.keys()]);
  }
  assert.equal(serializePlantGraph(graph), before, "the acquisition snapshot stays immutable");
});

test("aim stays continuous through the former near-root target dead zone", () => {
  const graph = flowerVolume();
  const crown = graph.branches.get("plant-1:group-1")!;
  const grabbed = sampleBranch(crown, crown.activeLength).position;
  const anchor = crown.points[0];
  const radius = distance(grabbed, anchor);
  let previousTip = null;

  // A plane sweep passing 0.03 units from the root never has an undefined
  // direction. Previously its central span reset to the acquisition graph.
  for (let step = -32; step <= 32; step += 1) {
    const target = add(anchor, vec3(step * 0.005, 0, 0.03));
    const result = aimBranch(graph, crown.id, grabbed, target);
    const tip = result.branches.get(crown.id)!.points.at(-1)!;
    assertVecClose(normalize(subtract(tip, anchor)), normalize(subtract(target, anchor)));
    assert.ok(Math.abs(distance(tip, anchor) - radius) < 1e-8);
    if (previousTip) assert.ok(distance(tip, previousTip) < radius * 0.18,
      "successive nearby targets must not snap back to the acquired pose");
    assertRestLengthsPreserved(graph, result);
    assertAttachmentCoincidence(result);
    previousTip = tip;
  }
});

test("undefined aim directions and an unchanged target remain no-ops", () => {
  const graph = flowerVolume();
  const crown = graph.branches.get("plant-1:group-1")!;
  const grabbed = sampleBranch(crown, crown.activeLength).position;
  const anchor = crown.points[0];
  const before = serializePlantGraph(graph);
  for (const [start, target] of [
    [anchor, add(anchor, vec3(0.1, 0.1, 0))],
    [grabbed, anchor],
    [add(anchor, vec3(0.0000001, 0, 0)), grabbed],
    [grabbed, add(anchor, vec3(0, 0.0000001, 0))],
    [grabbed, grabbed],
  ]) {
    assert.equal(serializePlantGraph(aimBranch(graph, crown.id, start, target)), before);
  }
});

test("aiming a short pruned stalk preserves stock and inactive flower history", () => {
  const graph = pruneBranch(flowerVolume(), "plant-1:group-1", 0.12);
  const crown = graph.branches.get("plant-1:group-1")!;
  const records = snapshotRecords(graph);
  const before = serializePlantGraph(graph);
  assert.equal(graph.organs.get("plant-1:bloom-1")!.active, false);
  const grabbed = sampleBranch(crown, 0.06).position;
  const result = aimBranch(graph, crown.id, grabbed, add(grabbed, vec3(0.08, 0, 0.03)));

  assert.ok(distance(result.branches.get(crown.id)!.points.at(-1)!, crown.points.at(-1)!) > 0.03);
  assertRestLengthsPreserved(graph, result);
  assertAttachmentCoincidence(result);
  assertRecordsUnchanged(result, records,
    [...graph.branches.keys()].filter(id => id !== crown.id),
    [...graph.organs.keys()]);
  assert.equal(serializePlantGraph(graph), before);
});
