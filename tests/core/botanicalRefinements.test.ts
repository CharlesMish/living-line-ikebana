import assert from "node:assert/strict";
import test from "node:test";
import {
  add, aimBranch, bendBranch, bendStationAtFraction, deserializePlantGraph, distance,
  dot, getGeneratorDefinition, getMaterialDefinition, getMaterialDefinitions,
  normalize, prepareMaterialInsertion, pruneBranch, sampleBranch, serializePlantGraph,
  subtract, toCanonicalPlantGraph, validatePlantGraph,
} from "../../src/core/index.ts";
import { assertAttachmentCoincidence, assertRestLengthsPreserved } from "./helpers.ts";
import { createWorkbenchFixture } from "../../src/app/workbench.ts";
import { resolveBendStations } from "../../src/app/bendStations.ts";
import { canonicalCameraPose } from "../../src/app/camera.ts";
import { createDomainAdapters } from "../../src/app/domainAdapters.ts";
import { TransactionCoordinator } from "../../src/input/TransactionCoordinator.ts";

const base = { x: 0, y: 0.55, z: 0 };
const materials = ["fern-frond", "blossom-spray", "nodding-flower"];
const seeds = [0, 8278, 9255, 10232, 0xffffffff];
const make = (material: string, seed = 8278) => getMaterialDefinition(material)!.generator.generate("plant-1", seed, base);

test("revised catalog remains twelve; v1 graphs load unchanged and v2 is deterministic", () => {
  assert.equal(getMaterialDefinitions().length, 12);
  for (const material of materials) for (const seed of seeds) {
    const old = getGeneratorDefinition(`${material}-v1`)!.generate("plant-1", seed, base);
    const saved = serializePlantGraph(old);
    assert.equal(serializePlantGraph(deserializePlantGraph(saved)), saved);
    const graph = make(material, seed);
    assert.equal(graph.generatorVersion, `${material}-v2`);
    assert.deepEqual(validatePlantGraph(graph), []);
    assert.equal(serializePlantGraph(graph), serializePlantGraph(make(material, seed)));
    assert.notEqual(serializePlantGraph(graph), saved);
    assert.equal(serializePlantGraph(deserializePlantGraph(serializePlantGraph(graph))), serializePlantGraph(graph));
    const prepared = prepareMaterialInsertion(material, 3, base);
    assert.ok(prepared.ok);
    assert.equal(prepared.seed, 10232);
    assert.equal(prepared.graph.id, "plant-3");
  }
});

test("old comparison profiles pin original versions while singles and the new study use v2", () => {
  for (const profile of ["round4-candidates", "round4-palette", "round5-candidates", "round5-palette", "references-plus-fern-frond", "blossom-compare"]) {
    const fixture = createWorkbenchFixture(profile, 8278, 12, { remember: false });
    for (const plant of fixture.plants) {
      assert.ok(plant.generatorVersion.endsWith("-v1"), profile);
      const original = getGeneratorDefinition(plant.generatorVersion)!.generate(plant.id, plant.seed, plant.branches.find(b => b.id === plant.rootBranchId)!.points[0]);
      assert.deepEqual(toCanonicalPlantGraph(original), plant);
    }
  }
  const revised = createWorkbenchFixture("botanical-refinements", 8278, 6, { remember: false });
  assert.deepEqual(revised.plants.map(p => p.generatorVersion), [...materials, ...materials].map(m => `${m}-v2`));
  for (const material of materials) assert.equal(createWorkbenchFixture(material, 8278, 1, { remember: false }).plants[0].generatorVersion, `${material}-v2`);
});

test("all eligible v2 branches preserve stock and attachments under repeated Lower/Upper shaping and Aim", () => {
  for (const material of materials) for (const seed of seeds) {
    const initial = make(material, seed);
    const frozen = serializePlantGraph(initial);
    for (const branch of initial.branches.values()) {
      const stations = resolveBendStations(branch);
      if (!stations.length) continue;
      let edited = initial;
      for (const fraction of [0.32, 0.76, 0.54]) {
        const active = edited.branches.get(branch.id)!;
        const stationDistance = bendStationAtFraction(active, fraction)!;
        const p = sampleBranch(active, stationDistance).position;
        const before = edited;
        edited = bendBranch(before, { branchId: branch.id, stationDistance, target: add(p, { x: fraction === 0.76 ? -0.65 : 0.65, y: 0.1, z: 0.15 }) });
        assertRestLengthsPreserved(before, edited);
        assertAttachmentCoincidence(edited);
      }
      const active = edited.branches.get(branch.id)!;
      const aimed = aimBranch(edited, branch.id, active.points.at(-1)!, add(active.points.at(-1)!, { x: 0.2, y: 0.2, z: 0.2 }));
      assertRestLengthsPreserved(edited, aimed);
      assertAttachmentCoincidence(aimed);
    }
    assert.equal(serializePlantGraph(initial), frozen, "edits may not mutate the acquired source");
  }
});

test("fern narrows toward its tip; spray arms leave gently and curve instead of rigid elbows", () => {
  for (const seed of seeds) {
    const fern = make("fern-frond", seed);
    const blades = [...fern.organs.values()];
    assert.equal(blades.length, 10);
    assert.ok(blades.at(-1)!.scale < blades[2].scale * 0.4);
    const stalks = [...fern.branches.values()].filter(b => b.kind === "petiole");
    const gaps = stalks.slice(1).map((p, i) => p.parentDistance - stalks[i].parentDistance);
    assert.ok(Math.max(...gaps) > Math.min(...gaps) * 2);
    const spray = make("blossom-spray", seed);
    const stem = spray.branches.get(spray.rootBranchId)!;
    for (const arm of spray.branches.values()) if (arm.kind === "lateral") {
      const initial = normalize(subtract(arm.points[1], arm.points[0]));
      const tip = normalize(subtract(arm.points.at(-1)!, arm.points.at(-2)!));
      const tangent = sampleBranch(stem, arm.parentDistance).tangent;
      assert.ok(dot(initial, tangent) > Math.cos(Math.PI / 6), "junction under 30 degrees");
      assert.ok(dot(initial, tip) < 0.99, "arm actually changes direction");
    }
  }
});

test("nodding upper stem joins at the tip, bends meaningfully, and leaves the true pedicel rigid", () => {
  for (const seed of seeds) {
    const graph = make("nodding-flower", seed);
    const root = graph.branches.get(graph.rootBranchId)!;
    const neck = graph.branches.get("plant-1:neck")!;
    const stalk = graph.branches.get("plant-1:flower-stalk")!;
    assert.equal(neck.parentDistance, root.activeLength);
    assert.ok(distance(root.points.at(-1)!, neck.points[0]) < 1e-8);
    assert.ok(Math.abs(neck.points.at(-1)!.x - neck.points[0].x) > 0.3, "Front shows the arch");
    assert.equal(resolveBendStations(neck).length, 3);
    assert.equal(bendStationAtFraction(stalk), null);
    const stationDistance = bendStationAtFraction(neck)!;
    const bent = bendBranch(graph, { branchId: neck.id, stationDistance, target: add(sampleBranch(neck, stationDistance).position, { x: 0.6, y: 0.2, z: 0.2 }) });
    assert.ok(distance(bent.branches.get(neck.id)!.points.at(-1)!, neck.points.at(-1)!) > 0.02);
    assert.deepEqual(bent.branches.get(root.id), root, "upper-stem bend leaves lower stem untouched");
    assertRestLengthsPreserved(graph, bent);
    assertAttachmentCoincidence(bent);
  }
});

test("local v2 cuts retain history and leave sibling organs unchanged", () => {
  for (const [material, branchId] of [["fern-frond", "plant-1:pinna-3"], ["blossom-spray", "plant-1:group-1"], ["nodding-flower", "plant-1:neck"]]) {
    const graph = make(material);
    const branch = graph.branches.get(branchId)!;
    const cut = pruneBranch(graph, branchId, 0.05);
    assert.equal(cut.branches.size, graph.branches.size);
    assert.equal(cut.organs.size, graph.organs.size);
    assert.ok([...cut.organs.values()].some(o => !o.active));
    assert.ok([...cut.organs.values()].some(o => o.active));
    assert.deepEqual(cut.branches.get(graph.rootBranchId), graph.branches.get(graph.rootBranchId));
    for (const organ of cut.organs.values()) if (organ.active) assert.deepEqual(organ, graph.organs.get(organ.id));
    assert.equal(serializePlantGraph(deserializePlantGraph(serializePlantGraph(cut))), serializePlantGraph(cut));
    assertAttachmentCoincidence(cut);
  }
});

test("v2 neck station change cancels its preview; the next ordinary release saves once", () => {
  const graph = make("nodding-flower");
  const before = serializePlantGraph(graph);
  let saves = 0;
  const coordinator = new TransactionCoordinator(createDomainAdapters(), {
    plants: new Map([[graph.id, graph]]), camera: canonicalCameraPose("front"), selectedPlantId: graph.id, successfulPlantOrdinal: 1,
  }, { onAutosave: () => saves++ });
  const branch = graph.branches.get("plant-1:neck")!;
  for (const [owner, fraction] of [[1, 0.32], [2, 0.76]]) {
    const station = branch.activeLength * fraction;
    const target = add(sampleBranch(branch, station).position, { x: 0.65, y: 0.2, z: 0 });
    assert.ok(coordinator.beginBend(owner, { plantId: graph.id, branchId: branch.id, beadStationDistance: station, touchMaterialDistance: station, context: {} }, { target }).ok);
    assert.equal(serializePlantGraph(coordinator.getDocumentSnapshot().plants.get(graph.id)!), before);
    if (owner === 1) { coordinator.interrupt("experiment-command"); assert.equal(saves, 0); }
    else { coordinator.release(owner); assert.equal(saves, 1); }
  }
  assert.equal(coordinator.getDebugState().successfulPlantOrdinal, 1);
  assert.notEqual(serializePlantGraph(coordinator.getDocumentSnapshot().plants.get(graph.id)!), before);
});
