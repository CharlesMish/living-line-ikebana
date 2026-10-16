import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import {
  aimBranch, applyPrune, assertValidPlantGraph, bendBranch, descendantIds,
  fromCanonicalPlantGraph, getGeneratorDefinition, getMaterialDefinitions,
  previewPrune, serializePlantGraph, toCanonicalPlantGraph, validatePlantGraph,
  type Branch, type PlantGraph,
} from "../../src/core/index.ts";
import { ARRANGEMENT_IMPORT_LIMITS, PLANT_IMPORT_LIMITS, countPlantImportRecords } from "../../src/core/graphLimits.ts";
import { canonicalCameraPose } from "../../src/app/camera.ts";
import { validateArrangement } from "../../src/app/garden.ts";

/** All branches have real unit stock. The chain attaches at each parent's tip;
 * the shallow variant attaches independent siblings at the root base. */
function graphWithBranches(count: number, chain = true, id = "plant-1"): PlantGraph {
  const branches = new Map<string, Branch>();
  for (let index = 0; index < count; index++) {
    const key = `${id}:b${String(index).padStart(5, "0")}`;
    const y = chain ? index : 0;
    branches.set(key, {
      id: key, label: "test", kind: index ? "lateral" : "trunk",
      parentId: index ? `${id}:b${String(chain ? index - 1 : 0).padStart(5, "0")}` : null,
      parentDistance: index && chain ? 1 : 0,
      points: [{ x: 0, y, z: 0 }, { x: 0, y: y + 1, z: 0 }], restLengths: [1],
      activeLength: 1, radius: .01, stiffness: .2, referenceNormal: { x: 1, y: 0, z: 0 }, active: true,
    });
  }
  return { schemaVersion: 1, generatorVersion: "one-branch-v1", id, seed: 8278,
    rootBranchId: `${id}:b00000`, branches, organs: new Map() };
}
const arrangement = (plants: unknown[], ordinal = plants.length) => ({ plants, successfulPlantOrdinal: ordinal, camera: canonicalCameraPose("front") });

test("seed parsing and serialization reject coercion while retaining exact UInt32 endpoints", () => {
  const graph = graphWithBranches(1);
  for (const seed of [-1, 2 ** 32, .5, NaN, Infinity, "8278", null]) {
    const raw = { ...toCanonicalPlantGraph(graph), seed };
    assert.throws(() => fromCanonicalPlantGraph(raw), /seed/);
    assert.throws(() => serializePlantGraph({ ...graph, seed: seed as number }), /seed/);
  }
  for (const seed of [0, 1, 8278, 0xffffffff]) {
    const raw = { ...toCanonicalPlantGraph(graph), seed };
    assert.deepEqual(toCanonicalPlantGraph(fromCanonicalPlantGraph(raw)), raw);
  }
});

test("descendant traversal handles deep stock without recursion and keeps old depth-first sibling order", () => {
  const graph = graphWithBranches(12_000);
  const descendants = descendantIds(graph, graph.rootBranchId);
  assert.equal(descendants.size, 11_999);
  assert.equal([...descendants].at(-1), "plant-1:b11999");
  const shallow = graphWithBranches(5, false);
  shallow.branches.get("plant-1:b00003")!.parentId = "plant-1:b00001";
  shallow.branches.get("plant-1:b00004")!.active = false;
  const result = new Set(["preexisting"]);
  assert.equal(descendantIds(shallow, shallow.rootBranchId, result), result);
  assert.deepEqual([...result], ["preexisting", "plant-1:b00001", "plant-1:b00003", "plant-1:b00002"]);
  // A malformed direct caller must not loop forever; import validation rejects this cycle.
  shallow.branches.get("plant-1:b00001")!.parentId = "plant-1:b00003";
  assert.deepEqual([...descendantIds(shallow, "plant-1:b00001")], ["plant-1:b00003"]);
});

test("imports reject deep ancestry, including inactive history, while the supported boundary remains editable", () => {
  const boundary = graphWithBranches(PLANT_IMPORT_LIMITS.depth);
  assertValidPlantGraph(boundary);
  assert.equal(validateArrangement(arrangement([toCanonicalPlantGraph(boundary)])).plants.length, 1);
  const plan = previewPrune(boundary, boundary.rootBranchId, .5);
  assert.equal(plan.removedBranchIds.length, PLANT_IMPORT_LIMITS.depth - 1);
  assertValidPlantGraph(applyPrune(boundary, plan));
  const deep = graphWithBranches(PLANT_IMPORT_LIMITS.depth + 1);
  assert.throws(() => validateArrangement(arrangement([toCanonicalPlantGraph(deep)])), /ancestry depth/);
  for (const branch of deep.branches.values()) if (branch.id !== deep.rootBranchId) branch.active = false;
  assert.throws(() => validateArrangement(arrangement([toCanonicalPlantGraph(deep)])), /ancestry depth/);
});

test("plant and arrangement count preflights reject oversized records before graph decoding", () => {
  const tooMany = toCanonicalPlantGraph(graphWithBranches(4400));
  assert.throws(() => fromCanonicalPlantGraph(tooMany), /too many botanical records/);
  const mismatched = toCanonicalPlantGraph(graphWithBranches(2));
  mismatched.branches[0].restLengths = Array(PLANT_IMPORT_LIMITS.points).fill(1);
  assert.throws(() => fromCanonicalPlantGraph(mismatched), /exactly one more point/);
  const excessiveOrgans = toCanonicalPlantGraph(graphWithBranches(1));
  excessiveOrgans.organs = Array(PLANT_IMPORT_LIMITS.organs + 1).fill(null);
  assert.throws(() => fromCanonicalPlantGraph(excessiveOrgans), /too many botanical records/);
  const excessivePoints = toCanonicalPlantGraph(graphWithBranches(1));
  excessivePoints.branches[0].points = Array(PLANT_IMPORT_LIMITS.points + 1).fill({ x: 0, y: 0, z: 0 });
  excessivePoints.branches[0].restLengths = Array(PLANT_IMPORT_LIMITS.points).fill(1);
  assert.throws(() => fromCanonicalPlantGraph(excessivePoints), /too many material points/);
  const plants = Array.from({ length: ARRANGEMENT_IMPORT_LIMITS.branches / PLANT_IMPORT_LIMITS.branches + 1 }, (_, index) =>
    toCanonicalPlantGraph(graphWithBranches(PLANT_IMPORT_LIMITS.branches, false, `plant-${index + 1}`)));
  // Invalid seed would be the first decoder error if aggregate preflight ran too late.
  plants[0].seed = -1;
  assert.throws(() => validateArrangement(arrangement(plants)), /Arrangement has too many/);
});

test("aggregate budgets cannot be bypassed by splitting point-heavy or organ-heavy stock across plants", () => {
  const pointHeavy = Array.from({ length: 5 }, (_, index) => {
    const plant = toCanonicalPlantGraph(graphWithBranches(4, false, `plant-${index + 1}`));
    for (const branch of plant.branches) {
      branch.points = Array.from({ length: 2000 }, (_, y) => ({ x: 0, y, z: 0 }));
      branch.restLengths = Array(1999).fill(1); branch.activeLength = 1999;
    }
    return plant;
  });
  assert.equal(validateArrangement(arrangement(pointHeavy.slice(0, 4))).plants.length, 4);
  assert.throws(() => validateArrangement(arrangement(pointHeavy)), /Arrangement has too many/);
  const organHeavy = Array.from({ length: 9 }, (_, index) => {
    const plant = toCanonicalPlantGraph(graphWithBranches(1, false, `plant-${index + 1}`));
    plant.organs = Array.from({ length: PLANT_IMPORT_LIMITS.organs }, (_, ordinal) => ({
      id: `${plant.id}:organ-${ordinal}`, kind: "leaf" as const, branchId: plant.rootBranchId,
      distance: .5, spin: 0, scale: 1, active: true,
    }));
    return plant;
  });
  assert.equal(validateArrangement(arrangement(organHeavy.slice(0, 8))).plants.length, 8);
  assert.throws(() => validateArrangement(arrangement(organHeavy)), /Arrangement has too many/);
});

test("finite but overflowing geometry is refused rather than clamped into different stock", () => {
  const fixture = toCanonicalPlantGraph(getMaterialDefinitions()[0].generator.generate("plant-1", 8278, { x: 0, y: .55, z: 0 }));
  const bad = [
    (plant: typeof fixture) => { plant.branches[0].radius = 1e300; },
    (plant: typeof fixture) => { plant.branches[0].points[0].x = 1e300; },
    (plant: typeof fixture) => { plant.branches[0].restLengths[0] = 1e300; },
    (plant: typeof fixture) => { plant.branches[0].parentDistance = -1e300; },
    (plant: typeof fixture) => { plant.organs[0].scale = 1e300; },
  ];
  for (const mutate of bad) {
    const plant = structuredClone(fixture); mutate(plant);
    assert.throws(() => validateArrangement(arrangement([plant])), /supported geometry range/);
  }
  const direct = fromCanonicalPlantGraph(fixture);
  direct.branches.get(direct.rootBranchId)!.radius = 1e300;
  assert.ok(validatePlantGraph(direct).some(issue => issue.path.endsWith("radius")));
});

test("validation catches non-finite fields and disconnected or cyclic inactive topology", () => {
  for (const field of ["activeLength", "referenceNormal"] as const) {
    for (const value of [NaN, Infinity, -Infinity]) {
      const graph = graphWithBranches(1);
      if (field === "activeLength") graph.branches.get(graph.rootBranchId)!.activeLength = value;
      else graph.branches.get(graph.rootBranchId)!.referenceNormal.x = value;
      assert.ok(validatePlantGraph(graph).some(issue => issue.path.endsWith(field) && issue.message === "must be finite"));
    }
  }
  const graph = graphWithBranches(4);
  graph.branches.get("plant-1:b00001")!.parentId = "plant-1:b00003";
  for (const branch of graph.branches.values()) if (branch.id !== graph.rootBranchId) branch.active = false;
  assert.equal(validatePlantGraph(graph).filter(issue => /parent cycle/.test(issue.message)).length, 3);
  graph.branches.get("plant-1:b00001")!.parentId = null;
  assert.equal(validatePlantGraph(graph).filter(issue => /canonical root/.test(issue.message)).length, 3);
});

const versions = [...new Set([
  ...getMaterialDefinitions().map(material => material.generator.generatorVersion),
  "fern-frond-v1", "blossom-spray-v1", "nodding-flower-v1",
])];
test("all shipped generator versions preserve exact values and edit results through sanitized, reordered saves", () => {
  for (const version of versions) for (const seed of [0, 8278, 9255, 0xffffffff]) {
    const graph = getGeneratorDefinition(version)!.generate("plant-1", seed, { x: 0, y: .55, z: 0 });
    const canonical = toCanonicalPlantGraph(graph);
    const counts = countPlantImportRecords(canonical);
    assert.ok(counts.branches < PLANT_IMPORT_LIMITS.branches / 4, version);
    assert.ok(counts.organs < PLANT_IMPORT_LIMITS.organs / 4, version);
    assert.ok(counts.points < PLANT_IMPORT_LIMITS.points / 4, version);
    const raw = { ...canonical, branches: [...canonical.branches].reverse(), organs: [...canonical.organs].reverse() };
    const restored = fromCanonicalPlantGraph(validateArrangement(arrangement([raw])).plants[0]);
    assert.equal(serializePlantGraph(restored), serializePlantGraph(graph), `${version}/${seed}: raw values`);
    const root = graph.branches.get(graph.rootBranchId)!;
    const operations = [
      (source: PlantGraph) => aimBranch(source, root.id, root.points.at(-1)!, { x: 1.2, y: 2.7, z: -.4 }),
      (source: PlantGraph) => bendBranch(source, { branchId: root.id, stationDistance: root.activeLength * .54, target: { x: .3, y: 2.3, z: -.2 } }),
      (source: PlantGraph) => applyPrune(source, previewPrune(source, root.id, root.activeLength * .6)),
    ];
    for (const operation of operations) {
      const before = operation(graph), after = operation(restored);
      assertValidPlantGraph(after);
      assert.equal(serializePlantGraph(after), serializePlantGraph(before), `${version}/${seed}: edit after reload`);
      assert.equal(serializePlantGraph(fromCanonicalPlantGraph(toCanonicalPlantGraph(after))), serializePlantGraph(after), `${version}/${seed}: inactive history`);
    }
  }
  const fixture = JSON.parse(readFileSync(new URL("../../fixtures/plant-1-one-branch-v1.json", import.meta.url), "utf8"));
  assert.deepEqual(toCanonicalPlantGraph(fromCanonicalPlantGraph(fixture)), fixture);
});
