import assert from "node:assert/strict";
import test from "node:test";
import floweringFixture from "../../fixtures/plant-1-one-branch-v1.json";
import leafyFixture from "../../fixtures/plant-2-leafy-shoot-v1.json";
import fixture from "../../fixtures/plant-1-arching-trailer-v1.json";
import { GARDEN_KEY, GardenStore } from "../../src/app/garden.ts";
import { createWorkbenchFixture } from "../../src/app/workbench.ts";
import {
  aimBranch, applyPrune, bendBranch, createArchingTrailer, createFloweringBranch,
  createLeafyShoot, deserializePlantGraph, fromCanonicalPlantGraph, getMaterialDefinition,
  legalBendStation, organPosition, prepareMaterialInsertion, previewPrune, sampleBranch,
  serializePlantGraph, toCanonicalPlantGraph, validatePlantGraph, add, vec3,
} from "../../src/core/index.ts";
import { ARCHING_TRAILER_RESPONSE } from "../../src/core/materialResponse.ts";
import { ARCHING_TRAILER_VERSION } from "../../src/core/archingTrailer.ts";

const BASE = { x: 0, y: 0.55, z: 0 };
const SEEDS = [8278, 9255, 10232] as const;
const WATER_Y = 0.46;
const WATER_RADIUS = 2.345;
const RIM_RADIUS = 2.48;
const RIM_Y = 0.635;
const RIM_TUBE = 0.035;
const STEM_RADIUS = 0.031;
const OPEN_WATER_INNER = 1.34;

const round3 = (value: number): number => Math.round(value * 1000) / 1000;

const innerAirRadius = (y: number): number => {
  const segments: Array<[number, number]> = [[2.46, 0.65], [2.38, 0.61], [2.3, 0.27], [2.19, 0.19]];
  if (y >= 0.65) return 99;
  if (y <= 0.19) return 0;
  for (let index = 0; index < segments.length - 1; index += 1) {
    const [r0, y0] = segments[index];
    const [r1, y1] = segments[index + 1];
    const high = Math.max(y0, y1);
    const low = Math.min(y0, y1);
    if (y <= high && y >= low && y0 !== y1) return r0 + (r1 - r0) * ((y0 - y) / (y0 - y1));
  }
  return 99;
};

const polylineSamples = (points: readonly { x: number; y: number; z: number }[]) => {
  const samples: Array<{ x: number; y: number; z: number }> = [];
  for (let index = 0; index < points.length - 1; index += 1) {
    for (let step = 0; step <= 8; step += 1) {
      const t = step / 8;
      const start = points[index];
      const end = points[index + 1];
      samples.push({
        x: start.x + (end.x - start.x) * t,
        y: start.y + (end.y - start.y) * t,
        z: start.z + (end.z - start.z) * t,
      });
    }
  }
  return samples;
};

test("arching-trailer catalog entry is additive and leaves the reference fixtures unchanged", () => {
  const material = getMaterialDefinition("arching-trailer");
  assert.ok(material);
  assert.equal(material.materialId, "arching-trailer");
  assert.equal(material.generator.generatorVersion, ARCHING_TRAILER_VERSION);
  assert.equal(material.generator.generate, createArchingTrailer);

  const flowering = toCanonicalPlantGraph(createFloweringBranch("plant-1", 8278, BASE));
  assert.equal(flowering.generatorVersion, floweringFixture.generatorVersion);
  assert.equal(flowering.branches.length, floweringFixture.branches.length);
  assert.equal(flowering.organs.length, floweringFixture.organs.length);
  assert.deepEqual(flowering.organs, floweringFixture.organs);

  const leafy = createLeafyShoot("plant-2", 9255, BASE);
  assert.deepEqual(JSON.parse(serializePlantGraph(leafy)), leafyFixture);

  const pair = createWorkbenchFixture("reference-pair", 8278, 6, { remember: false });
  assert.deepEqual(pair.plants.map((plant) => plant.generatorVersion), [
    "one-branch-v1", "leafy-shoot-v1", "one-branch-v1",
    "leafy-shoot-v1", "one-branch-v1", "leafy-shoot-v1",
  ]);
  const allFour = createWorkbenchFixture("all-four", 8278, 6, { remember: false });
  assert.deepEqual(allFour.plants.map((plant) => plant.generatorVersion), [
    "one-branch-v1", "leafy-shoot-v1", "bare-branch-v1", "single-flower-v1",
    "one-branch-v1", "leafy-shoot-v1",
  ]);
  assert.equal(allFour.plants.some((plant) => plant.generatorVersion === ARCHING_TRAILER_VERSION), false);
});

test("arching-trailer-v1 is deterministic, valid, and fixture-identical at seed 8278", () => {
  for (const ordinal of [1, 2, 3, 17, 64]) {
    const prepared = prepareMaterialInsertion("arching-trailer", ordinal, BASE);
    assert.equal(prepared.ok, true);
    if (!prepared.ok) return;
    const graph = prepared.graph;
    assert.equal(graph.generatorVersion, ARCHING_TRAILER_VERSION);
    assert.equal(graph.branches.size, 4);
    assert.equal(graph.organs.size, 3);
    assert.deepEqual(validatePlantGraph(graph), []);
    assert.equal("materialId" in graph, false);
    const repeated = prepareMaterialInsertion("arching-trailer", ordinal, BASE);
    assert.equal(repeated.ok, true);
    if (!repeated.ok) return;
    assert.equal(serializePlantGraph(repeated.graph), serializePlantGraph(graph));
    assert.equal(serializePlantGraph(deserializePlantGraph(serializePlantGraph(graph))), serializePlantGraph(graph));
    const trail = graph.branches.get(graph.rootBranchId)!;
    assert.equal(trail.kind, "trunk");
    assert.equal(trail.points.length, 19);
    assert.equal(trail.stiffness, ARCHING_TRAILER_RESPONSE.cane);
    assert.equal(trail.radius, 0.031);
    for (const branch of graph.branches.values()) {
      if (branch.kind === "petiole") assert.equal(branch.stiffness, ARCHING_TRAILER_RESPONSE.stalk);
    }
    assert.equal([...graph.organs.values()].every((organ) => organ.kind === "leaf"), true);
  }

  const prepared = prepareMaterialInsertion("arching-trailer", 1, BASE);
  assert.equal(prepared.ok, true);
  if (!prepared.ok) return;
  assert.equal(prepared.seed, 8278);
  assert.deepEqual(JSON.parse(serializePlantGraph(prepared.graph)), fixture);
});

test("the rest pose is one arch from a seated base toward the rim, and seeds vary that arch", () => {
  const graphs = SEEDS.map((seed) => createArchingTrailer("plant-1", seed, BASE));
  const serialized = graphs.map((graph) => serializePlantGraph(graph));
  assert.notEqual(serialized[0], serialized[1]);
  assert.notEqual(serialized[1], serialized[2]);

  for (const graph of graphs) {
    const trail = graph.branches.get(graph.rootBranchId)!;
    const first = trail.points[1];
    const root = trail.points[0];
    const rise = first.y - root.y;
    const step = Math.hypot(first.x - root.x, rise, first.z - root.z);
    assert.ok(rise / step > 0.95, "basal tangent stays seated and upright");
    const tip = trail.points[trail.points.length - 1];
    const tipRadius = Math.hypot(tip.x - root.x, tip.z - root.z);
    assert.ok(tipRadius > 2.15 && tipRadius < 2.5, "the trail reaches toward the bowl edge");
    const crest = Math.max(...trail.points.map((point) => point.y));
    assert.ok(crest > tip.y + 0.55, "the cane crests and then descends");
    assert.ok(tip.y > WATER_Y, "the centered tip stays above the water plane");
    assert.equal(legalBendStation(trail, trail.activeLength * 0.54) !== null, true);
    for (const branch of graph.branches.values()) {
      if (branch.kind === "petiole") assert.equal(legalBendStation(branch), null);
    }
  }
});

test("a centered seat clears water and rim; seating with the arch carries the tip outside", () => {
  const graph = createArchingTrailer("plant-1", 8278, BASE);
  const trail = graph.branches.get(graph.rootBranchId)!;
  const samples = polylineSamples(trail.points);
  let minOpen = Infinity;
  let crest = -Infinity;
  let rimGap = Infinity;
  let ceramic = 0;
  let pierced = 0;
  for (const point of samples) {
    crest = Math.max(crest, point.y);
    const radius = Math.hypot(point.x, point.z);
    if (radius > OPEN_WATER_INNER && radius < WATER_RADIUS) {
      minOpen = Math.min(minOpen, point.y);
      if (point.y - STEM_RADIUS < WATER_Y) pierced += 1;
    }
    rimGap = Math.min(rimGap, Math.hypot(radius - RIM_RADIUS, point.y - RIM_Y) - RIM_TUBE - STEM_RADIUS);
    if (point.y < 0.65 && point.y > 0.19 && radius + STEM_RADIUS > innerAirRadius(point.y)) ceramic += 1;
  }
  const tip = trail.points[trail.points.length - 1];
  assert.deepEqual({
    length: round3(trail.activeLength),
    crestY: round3(crest),
    tipY: round3(tip.y),
    tipRadius: round3(Math.hypot(tip.x, tip.z)),
    minOpenWaterY: round3(minOpen),
    waterClearance: round3(minOpen - WATER_Y - STEM_RADIUS),
    rimClearance: round3(rimGap),
    pierced,
    ceramic,
  }, {
    length: 3.016,
    crestY: 1.368,
    tipY: 0.659,
    tipRadius: 2.327,
    minOpenWaterY: 0.659,
    waterClearance: 0.168,
    rimClearance: 0.089,
    pierced: 0,
    ceramic: 0,
  });
  for (const organ of graph.organs.values()) {
    const position = organPosition(graph, organ.id);
    assert.ok(position);
    assert.ok(position.y > 1, `${organ.id} attachment stays above the water on the rest pose`);
  }

  const radial = Math.hypot(tip.x, tip.z);
  const shifted = createArchingTrailer("plant-1", 8278, {
    x: (tip.x / radial) * 1.22,
    y: BASE.y,
    z: (tip.z / radial) * 1.22,
  });
  const shiftedTip = shifted.branches.get(shifted.rootBranchId)!.points.at(-1)!;
  const shiftedRadius = Math.hypot(shiftedTip.x, shiftedTip.z);
  assert.ok(shiftedRadius > 3.4, "the same stock seated at the pin-field edge overshoots the bowl");
  assert.ok(Math.hypot(shifted.branches.get(shifted.rootBranchId)!.points[0].x, shifted.branches.get(shifted.rootBranchId)!.points[0].z) <= 1.22 + 1e-8);
});

test("aim and the single bend station preserve stock; a downward bend can enter the water", () => {
  const graph = createArchingTrailer("plant-1", 8278, BASE);
  const before = serializePlantGraph(graph);
  const trail = graph.branches.get(graph.rootBranchId)!;
  const station = legalBendStation(trail, trail.activeLength * 0.54);
  assert.ok(station);
  const anchor = sampleBranch(trail, station);
  const bent = bendBranch(graph, {
    branchId: trail.id,
    stationDistance: station,
    target: add(anchor.position, vec3(0, -1.2, 0)),
  });
  assert.deepEqual(validatePlantGraph(bent), []);
  assert.notDeepEqual(bent.branches.get(trail.id)!.points, trail.points);
  for (const branch of graph.branches.values()) {
    assert.deepEqual(bent.branches.get(branch.id)!.restLengths, branch.restLengths);
    assert.equal(bent.branches.get(branch.id)!.stiffness, branch.stiffness);
  }
  const bentTip = bent.branches.get(trail.id)!.points.at(-1)!;
  assert.ok(bentTip.y < 0.19, "a saturated downward bend drives the tip through the basin");
  assert.equal(serializePlantGraph(graph), before);

  const grabbed = sampleBranch(trail, trail.activeLength * 0.7);
  const aimed = aimBranch(graph, trail.id, grabbed.position, add(grabbed.position, vec3(0.4, 0.2, -0.3)));
  assert.deepEqual(validatePlantGraph(aimed), []);
  for (const branch of graph.branches.values()) {
    assert.deepEqual(aimed.branches.get(branch.id)!.restLengths, branch.restLengths);
  }
  assert.equal(serializePlantGraph(deserializePlantGraph(serializePlantGraph(bent))), serializePlantGraph(bent));
});

test("pruning the descending limb removes the outer leaf and keeps the records", () => {
  const graph = createArchingTrailer("plant-1", 8278, BASE);
  const trail = graph.branches.get(graph.rootBranchId)!;
  const plan = previewPrune(graph, trail.id, trail.activeLength * 0.7);
  assert.deepEqual(plan.removedBranchIds, ["plant-1:petiole-3"]);
  assert.deepEqual(plan.removedOrganIds, ["plant-1:leaf-3"]);
  const cut = applyPrune(graph, plan);
  assert.equal(cut.branches.size, 4);
  assert.equal(cut.organs.size, 3);
  assert.equal(cut.organs.get("plant-1:leaf-3")!.active, false);
  assert.equal(cut.branches.get("plant-1:petiole-3")!.active, false);
  assert.equal(cut.organs.get("plant-1:leaf-1")!.active, true);
  assert.equal(cut.organs.get("plant-1:leaf-2")!.active, true);
  assert.ok(cut.branches.get(trail.id)!.activeLength < trail.activeLength);
  assert.deepEqual(cut.branches.get("plant-1:petiole-1")!.points, graph.branches.get("plant-1:petiole-1")!.points);
  assert.deepEqual(validatePlantGraph(cut), []);
  assert.equal(serializePlantGraph(graph), serializePlantGraph(createArchingTrailer("plant-1", 8278, BASE)));
});

test("a Garden original survives an edited copy of the trailer", () => {
  const values = new Map<string, string>();
  const garden = new GardenStore(GARDEN_KEY, {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => { values.set(key, value); },
  });
  garden.load();
  const original = createWorkbenchFixture("arching-trailer", 8278, 1);
  garden.keep({
    id: "moment-trailer",
    title: "Across the water",
    keptAt: "2026-09-22T12:00:00.000Z",
    thumbnail: null,
    arrangement: original,
  });
  const copy = structuredClone(original);
  const graph = fromCanonicalPlantGraph(copy.plants[0]);
  const trail = graph.branches.get(graph.rootBranchId)!;
  copy.plants[0] = toCanonicalPlantGraph(applyPrune(graph, previewPrune(graph, trail.id, trail.activeLength * 0.7)));
  const loaded = garden.load();
  assert.deepEqual(loaded.entries[0].arrangement.plants[0], original.plants[0]);
  assert.notEqual(JSON.stringify(copy.plants[0]), JSON.stringify(loaded.entries[0].arrangement.plants[0]));
});
