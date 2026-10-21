import assert from "node:assert/strict";
import test from "node:test";
import fixture from "../../fixtures/plant-1-arching-trailer-v2.json";
import v1Fixture from "../../fixtures/plant-1-arching-trailer-v1.json";
import { createWorkbenchFixture } from "../../src/app/workbench.ts";
import {
  ARCHING_TRAILER_V2_VERSION, add, applyPrune, bendBranch, createArchingTrailer, createArchingTrailerV2,
  deserializePlantGraph, getGeneratorDefinition, getMaterialDefinition, legalBendStation, organPosition,
  prepareMaterialInsertion, previewPrune, sampleBranch, serializePlantGraph, validatePlantGraph, vec3,
} from "../../src/core/index.ts";
import { ARCHING_TRAILER_V2_RESPONSE } from "../../src/core/materialResponse.ts";
import { getMaterialAppearance } from "../../src/presentation/materialAppearance.ts";

const BASE = { x: 0, y: 0.55, z: 0 };
const SEEDS = [8278, 9255, 10232, 11209, 12186] as const;
const RIM_RADIUS = 2.48;
const RIM_Y = 0.635;
const RIM_TUBE = 0.035;
const OUTER_WALL_RADIUS = 2.66;

const samples = (points: readonly { x: number; y: number; z: number }[]) => {
  const out: Array<{ x: number; y: number; z: number }> = [];
  for (let index = 0; index < points.length - 1; index += 1) {
    for (let step = 0; step <= 8; step += 1) {
      const t = step / 8;
      const a = points[index];
      const b = points[index + 1];
      out.push({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t, z: a.z + (b.z - a.z) * t });
    }
  }
  return out;
};

test("new arching-trailer stock is v2; v1 stays registered and byte-identical", () => {
  const material = getMaterialDefinition("arching-trailer");
  assert.ok(material);
  assert.equal(material.generator.generatorVersion, ARCHING_TRAILER_V2_VERSION);
  assert.equal(material.generator.generate, createArchingTrailerV2);
  assert.ok(getGeneratorDefinition("arching-trailer-v1"));
  assert.deepEqual(JSON.parse(serializePlantGraph(createArchingTrailer("plant-1", 8278, BASE))), v1Fixture);
  assert.notEqual(getMaterialAppearance("arching-trailer-v2"), getMaterialAppearance("arching-trailer-v1"));
  assert.equal(getMaterialAppearance("arching-trailer-v2").leaf.form, "lanceolate");
});

test("frozen workbench profiles keep building the v1 trailer", () => {
  const palette = createWorkbenchFixture("round3-palette", 8278, 12, { remember: false });
  const versions = palette.plants.map((plant) => plant.generatorVersion);
  assert.ok(versions.includes("arching-trailer-v1"));
  assert.equal(versions.includes(ARCHING_TRAILER_V2_VERSION), false);
});

test("arching-trailer-v2 is deterministic, valid, round-trips and matches its fixture", () => {
  for (const ordinal of [1, 2, 3, 17, 64]) {
    const prepared = prepareMaterialInsertion("arching-trailer", ordinal, BASE);
    assert.equal(prepared.ok, true);
    if (!prepared.ok) return;
    const graph = prepared.graph;
    assert.equal(graph.generatorVersion, ARCHING_TRAILER_V2_VERSION);
    assert.equal(graph.branches.size, 15, "cane, two side shoots and twelve leaf stalks");
    assert.equal(graph.organs.size, 12);
    assert.deepEqual(validatePlantGraph(graph), []);
    const again = prepareMaterialInsertion("arching-trailer", ordinal, BASE);
    assert.ok(again.ok);
    assert.equal(serializePlantGraph(again.graph), serializePlantGraph(graph));
    assert.equal(serializePlantGraph(deserializePlantGraph(serializePlantGraph(graph))), serializePlantGraph(graph));
    const trail = graph.branches.get(graph.rootBranchId)!;
    assert.equal(trail.stiffness, ARCHING_TRAILER_V2_RESPONSE.cane);
    for (const branch of graph.branches.values()) {
      if (branch.kind === "petiole") assert.equal(branch.stiffness, ARCHING_TRAILER_V2_RESPONSE.stalk);
      if (branch.kind === "lateral") assert.equal(branch.stiffness, ARCHING_TRAILER_V2_RESPONSE.shoot);
    }
  }
  const first = prepareMaterialInsertion("arching-trailer", 1, BASE);
  assert.ok(first.ok);
  assert.equal(first.seed, 8278);
  assert.deepEqual(JSON.parse(serializePlantGraph(first.graph)), fixture);
});

test("a centered v2 cane is longer than v1, crests higher, clears the rim and drapes outside", () => {
  for (const seed of SEEDS) {
    const graph = createArchingTrailerV2("plant-1", seed, BASE);
    const v1 = createArchingTrailer("plant-1", seed, BASE);
    const trail = graph.branches.get(graph.rootBranchId)!;
    const oldTrail = v1.branches.get(v1.rootBranchId)!;
    assert.ok(trail.activeLength > oldTrail.activeLength * 1.5, "at least half again as long");

    const root = trail.points[0];
    const first = trail.points[1];
    const step = Math.hypot(first.x - root.x, first.y - root.y, first.z - root.z);
    assert.ok((first.y - root.y) / step > 0.95, "basal tangent stays seated and upright");

    let crest = -Infinity;
    let rimGap = Infinity;
    for (const point of samples(trail.points)) {
      crest = Math.max(crest, point.y);
      const radius = Math.hypot(point.x, point.z);
      rimGap = Math.min(rimGap, Math.hypot(radius - RIM_RADIUS, point.y - RIM_Y) - RIM_TUBE - trail.radius);
      if (radius > RIM_RADIUS - 0.1 && radius < OUTER_WALL_RADIUS) assert.ok(point.y > 0.75, "passes over the rim");
    }
    assert.ok(crest > 1.9, "crests well above the water");
    assert.ok(rimGap > 0.2, "clears the rim with room to spare");
    const tip = trail.points.at(-1)!;
    assert.ok(Math.hypot(tip.x, tip.z) > OUTER_WALL_RADIUS, "the tip hangs beyond the bowl");
    assert.ok(tip.y > 0.2 && tip.y < RIM_Y, "the tip drapes below the rim but stays off the ground");

    assert.notEqual(legalBendStation(trail, trail.activeLength * 0.54), null);
    for (const branch of graph.branches.values()) {
      if (branch.kind === "petiole") assert.equal(legalBendStation(branch), null);
    }
    const sizes = [1, 2, 3, 4, 5, 6, 7, 8].map((index) => graph.organs.get(`plant-1:leaf-${index}`)!.scale);
    assert.ok(sizes[0] > sizes[7], "cane leaves diminish toward the tip");
    for (const organ of graph.organs.values()) assert.ok(organPosition(graph, organ.id));
  }
});

test("cutting one side shoot removes only its two leaves and keeps the records", () => {
  const graph = createArchingTrailerV2("plant-1", 8278, BASE);
  const shoot = graph.branches.get("plant-1:shoot-1")!;
  const plan = previewPrune(graph, shoot.id, 0.01);
  assert.deepEqual([...plan.removedOrganIds].sort(), ["plant-1:leaf-s1-a", "plant-1:leaf-s1-b"]);
  const cut = applyPrune(graph, plan);
  assert.equal(cut.branches.size, graph.branches.size);
  assert.equal(cut.organs.size, graph.organs.size);
  assert.equal(cut.organs.get("plant-1:leaf-s1-a")!.active, false);
  assert.equal(cut.organs.get("plant-1:leaf-s2-a")!.active, true);
  assert.equal(cut.organs.get("plant-1:leaf-1")!.active, true);
  assert.deepEqual(validatePlantGraph(cut), []);
  assert.equal(serializePlantGraph(graph), serializePlantGraph(createArchingTrailerV2("plant-1", 8278, BASE)));
});

test("shortening the cane takes the outer leaves and the second shoot, never the first", () => {
  const graph = createArchingTrailerV2("plant-1", 8278, BASE);
  const trail = graph.branches.get(graph.rootBranchId)!;
  const shoot2 = graph.branches.get("plant-1:shoot-2")!;
  const plan = previewPrune(graph, trail.id, shoot2.parentDistance - 0.05);
  assert.ok(plan.removedBranchIds.includes("plant-1:shoot-2"));
  assert.equal(plan.removedBranchIds.includes("plant-1:shoot-1"), false);
  assert.ok(plan.removedOrganIds.includes("plant-1:leaf-8"));
  assert.equal(plan.removedOrganIds.includes("plant-1:leaf-1"), false);
  assert.deepEqual(validatePlantGraph(applyPrune(graph, plan)), []);
});

test("bend at the station and aim preserve stock length and leave the input unchanged", () => {
  const graph = createArchingTrailerV2("plant-1", 9255, BASE);
  const before = serializePlantGraph(graph);
  const trail = graph.branches.get(graph.rootBranchId)!;
  const station = legalBendStation(trail, trail.activeLength * 0.54)!;
  const anchor = sampleBranch(trail, station);
  const bent = bendBranch(graph, { branchId: trail.id, stationDistance: station, target: add(anchor.position, vec3(0.3, 0.6, 0)) });
  assert.deepEqual(validatePlantGraph(bent), []);
  for (const branch of graph.branches.values()) {
    assert.deepEqual(bent.branches.get(branch.id)!.restLengths, branch.restLengths);
  }
  assert.equal(serializePlantGraph(graph), before);
});
