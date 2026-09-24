import { createNoddingFlowerV2, NODDING_FLOWER_V2_VERSION } from "../../src/core/index.ts";
import assert from "node:assert/strict";
import test from "node:test";
import fixture from "../../fixtures/plant-1-nodding-flower-v1.json";
import floweringFixture from "../../fixtures/plant-1-one-branch-v1.json";
import leafyFixture from "../../fixtures/plant-2-leafy-shoot-v1.json";
import { canonicalCameraPose } from "../../src/app/camera.ts";
import { createDomainAdapters } from "../../src/app/domainAdapters.ts";
import { GardenStore, GARDEN_KEY, type GardenEntry } from "../../src/app/garden.ts";
import { createWorkbenchFixture } from "../../src/app/workbench.ts";
import {
  aimBranch, applyPrune, bendBranch, createFloweringBranch, createLeafyShoot,
  createNoddingFlower,
  deserializePlantGraph, createSingleFlower, deserializePlantGraph, getMaterialDefinition,
  legalBendStation, NODDING_FLOWER_VERSION, prepareMaterialInsertion, previewPrune,
  sampleBranch, sampleMaterialFrame, serializePlantGraph, toCanonicalPlantGraph,
  validatePlantGraph, add, clamp, dot, normalize, scale, subtract, vec3,
} from "../../src/core/index.ts";
import { NODDING_FLOWER_RESPONSE } from "../../src/core/materialResponse.ts";
import { TransactionCoordinator } from "../../src/input/index.ts";
import type { Branch, PlantGraph } from "../../src/core/types.ts";

const BASE = { x: 0, y: 0.55, z: 0 };
const SEEDS = [8278, 9255, 10232] as const;

const turningAngle = (branch: Branch): number => {
  let total = 0;
  let previous = normalize(subtract(branch.points[1], branch.points[0]));
  for (let index = 1; index < branch.points.length - 1; index += 1) {
    const next = normalize(subtract(branch.points[index + 1], branch.points[index]));
    total += Math.acos(clamp(dot(previous, next), -1, 1));
    previous = next;
  }
  return total;
};

const openFaceMouth = (graph: PlantGraph) => {
  const bloom = graph.organs.get("plant-1:bloom")!;
  const stalk = graph.branches.get(bloom.branchId)!;
  const frame = sampleMaterialFrame(stalk, bloom.distance);
  const cosine = Math.cos(bloom.spin);
  const sine = Math.sin(bloom.spin);
  return {
    mouth: {
      x: frame.normal.x * cosine + frame.binormal.x * sine,
      y: frame.normal.y * cosine + frame.binormal.y * sine,
      z: frame.normal.z * cosine + frame.binormal.z * sine,
    },
    tangent: frame.tangent,
    turn: turningAngle(stalk),
  };
};

test("nodding-flower catalog entry is additive and leaves the reference fixtures unchanged", () => {
  const material = getMaterialDefinition("nodding-flower");
  assert.ok(material);
  assert.equal(material.materialId, "nodding-flower");
  assert.equal(material.generator.generatorVersion, NODDING_FLOWER_V2_VERSION);
  assert.equal(material.generator.generate, createNoddingFlowerV2);

  const flowering = toCanonicalPlantGraph(createFloweringBranch("plant-1", 8278, BASE));
  assert.equal(flowering.generatorVersion, floweringFixture.generatorVersion);
  assert.deepEqual(flowering.organs, floweringFixture.organs);
  assert.equal(flowering.branches.length, floweringFixture.branches.length);

  const leafy = createLeafyShoot("plant-2", 9255, BASE);
  assert.deepEqual(JSON.parse(serializePlantGraph(leafy)), leafyFixture);

  const pair = createWorkbenchFixture("reference-pair", 8278, 6, { remember: false });
  assert.deepEqual(pair.plants.map((plant) => plant.generatorVersion).sort(), [
    "leafy-shoot-v1", "leafy-shoot-v1", "leafy-shoot-v1",
    "one-branch-v1", "one-branch-v1", "one-branch-v1",
  ]);
  const allFour = createWorkbenchFixture("all-four", 8278, 6, { remember: false });
  assert.equal(allFour.plants.some((plant) => plant.generatorVersion === NODDING_FLOWER_VERSION), false);
  const withNod = createWorkbenchFixture("references-plus-nodding-flower", 8278, 6, { remember: false });
  assert.deepEqual(withNod.plants.map((plant) => plant.generatorVersion), [
    "one-branch-v1", "leafy-shoot-v1", "nodding-flower-v1",
    "one-branch-v1", "leafy-shoot-v1", "nodding-flower-v1",
  ]);
  assert.deepEqual(withNod.plants[0], pair.plants[0]);
  assert.deepEqual(withNod.plants[1], pair.plants[1]);
});

test("nodding-flower-v1 is deterministic, valid, and fixture-identical at seed 8278", () => {
  for (const seed of SEEDS) {
    const first = createNoddingFlower("plant-1", seed, BASE);
    const second = createNoddingFlower("plant-1", seed, BASE);
    assert.equal(serializePlantGraph(first), serializePlantGraph(second));
    assert.deepEqual(validatePlantGraph(first), []);
    assert.equal(first.generatorVersion, NODDING_FLOWER_VERSION);
    assert.equal(first.branches.size, 3);
    assert.equal(first.organs.size, 2);
    const stem = first.branches.get(first.rootBranchId)!;
    assert.equal(stem.kind, "trunk");
    assert.equal(stem.stiffness, NODDING_FLOWER_RESPONSE.stem);
    assert.equal(stem.points.length, 13);
    assert.ok(stem.activeLength > 1.8, "the supporting stem stays long enough to grasp");
    const organs = [...first.organs.values()];
    assert.equal(organs.filter((organ) => organ.kind === "bloom").length, 1);
    assert.equal(organs.filter((organ) => organ.kind === "leaf").length, 1);
    const bloom = first.organs.get("plant-1:bloom")!;
    const neck = first.branches.get(bloom.branchId)!;
    assert.equal(neck.kind, "pedicel");
    assert.equal(neck.label, "flower neck");
    assert.equal(bloom.distance, neck.activeLength);
    assert.equal(legalBendStation(neck), null);
    assert.ok(legalBendStation(stem) !== null);
    const tip = sampleMaterialFrame(neck, bloom.distance);
    assert.ok(tip.tangent.y < -0.55, `neck tip should point downward, y=${tip.tangent.y}`);
    assert.ok(tip.position.y > 1.15, "the hanging bloom stays above the bowl");
    assert.ok(turningAngle(neck) > 0.9, `neck turning ${turningAngle(neck)} should be a legible curve`);
    const leaf = first.organs.get("plant-1:leaf")!;
    const petiole = first.branches.get(leaf.branchId)!;
    assert.ok(petiole.parentDistance < neck.parentDistance);
    assert.ok(petiole.parentDistance > stem.activeLength * 0.2);
  }

  const graphs = SEEDS.map((seed) => serializePlantGraph(createNoddingFlower("plant-1", seed, BASE)));
  assert.notEqual(graphs[0], graphs[1]);
  assert.notEqual(graphs[1], graphs[2]);

  const prepared = prepareMaterialInsertion("nodding-flower", 1, BASE);
  assert.ok(prepared.ok);
  if (!prepared.ok) return;
  assert.equal(prepared.seed, 8278);
  assert.deepEqual(JSON.parse(serializePlantGraph(createNoddingFlower("plant-1", 8278, BASE))), fixture);
  assert.equal(prepared.graph.generatorVersion, NODDING_FLOWER_V2_VERSION);
  assert.equal("materialId" in prepared.graph, false);
});

test("aim and bend preserve nodding stock; the neck curve is not a bend handle", () => {
  const graph = createNoddingFlower("plant-1", 8278, BASE);
  const before = serializePlantGraph(graph);
  const stem = graph.branches.get(graph.rootBranchId)!;
  const bloom = graph.organs.get("plant-1:bloom")!;
  const neck = graph.branches.get(bloom.branchId)!;
  const station = stem.activeLength * 0.54;
  const bent = bendBranch(graph, {
    branchId: stem.id,
    stationDistance: station,
    target: add(sampleBranch(stem, station).position, vec3(1.2, -0.2, 0.4)),
  });
  assert.deepEqual(validatePlantGraph(bent), []);
  for (const branch of graph.branches.values()) {
    assert.deepEqual(bent.branches.get(branch.id)!.restLengths, branch.restLengths);
  }
  assert.equal(bent.organs.get(bloom.id)!.spin, bloom.spin);
  assert.equal(bent.organs.get(bloom.id)!.scale, bloom.scale);
  assert.equal(serializePlantGraph(graph), before);
  assert.equal(legalBendStation(bent.branches.get(neck.id)!), null);

  const aimed = aimBranch(graph, neck.id, neck.points[neck.points.length - 1], vec3(1.4, 1.2, 0.2));
  assert.deepEqual(aimed.branches.get(neck.id)!.restLengths, neck.restLengths);
  assert.equal(aimed.organs.get(bloom.id)!.distance, bloom.distance);
  assert.equal(serializePlantGraph(deserializePlantGraph(serializePlantGraph(aimed))), serializePlantGraph(aimed));
});

test("pruning the neck removes the bell and keeps the leaf; a lower stem cut keeps history", () => {
  const graph = createNoddingFlower("plant-1", 8278, BASE);
  const bloom = graph.organs.get("plant-1:bloom")!;
  const neck = graph.branches.get(bloom.branchId)!;
  const neckPlan = previewPrune(graph, neck.id, neck.activeLength * 0.45);
  assert.deepEqual(neckPlan.removedOrganIds, [bloom.id]);
  const afterNeck = applyPrune(graph, neckPlan);
  assert.equal(afterNeck.organs.get(bloom.id)!.active, false);
  assert.equal(afterNeck.organs.get("plant-1:leaf")!.active, true);
  assert.equal(afterNeck.branches.size, 3);
  assert.equal(afterNeck.organs.size, 2);
  assert.deepEqual(validatePlantGraph(afterNeck), []);

  const stem = graph.branches.get(graph.rootBranchId)!;
  const stemPlan = previewPrune(graph, stem.id, neck.parentDistance - 0.05);
  assert.ok(stemPlan.removedBranchIds.includes(neck.id));
  assert.ok(stemPlan.removedOrganIds.includes(bloom.id));
  assert.equal(stemPlan.removedOrganIds.includes("plant-1:leaf"), false);
  const afterStem = applyPrune(graph, stemPlan);
  assert.equal(afterStem.branches.get(neck.id)!.active, false);
  assert.equal(afterStem.organs.get(bloom.id)!.active, false);
  assert.equal(afterStem.organs.get("plant-1:leaf")!.active, true);
  assert.equal(afterStem.branches.size, 3);
  assert.deepEqual(validatePlantGraph(afterStem), []);
});

test("aim and bend cannot point an open-face mouth along a downward single-flower stalk", () => {
  const graph = createSingleFlower("plant-1", 8278, BASE);
  const rest = openFaceMouth(graph);
  assert.ok(rest.turn < 0.45, "the single-flower pedicel is only slightly curved");
  assert.ok(Math.abs(dot(rest.mouth, rest.tangent)) < 1e-6);

  const samples = [rest];
  const pedicel = graph.branches.get("plant-1:pedicel")!;
  const anchor = pedicel.points[0];
  const grab = pedicel.points[pedicel.points.length - 1];
  for (let step = 0; step < 16; step += 1) {
    for (let band = 0; band < 6; band += 1) {
      const theta = (step / 16) * Math.PI * 2;
      const phi = ((band + 0.5) / 6) * Math.PI;
      const direction = vec3(
        Math.sin(phi) * Math.cos(theta),
        Math.cos(phi),
        Math.sin(phi) * Math.sin(theta),
      );
      samples.push(openFaceMouth(aimBranch(graph, pedicel.id, grab, add(anchor, scale(direction, 1.4)))));
    }
  }

  let posed = graph;
  const stemId = graph.rootBranchId;
  const stemAnchor = graph.branches.get(stemId)!.points[0];
  const stemTip = graph.branches.get(stemId)!.points.at(-1)!;
  posed = aimBranch(posed, stemId, stemTip, add(stemAnchor, vec3(0.2, 0.08, 5)));
  for (let pass = 0; pass < 4; pass += 1) {
    const stem = posed.branches.get(stemId)!;
    const fraction = pass % 2 === 0 ? 0.72 : 0.5;
    const station = stem.activeLength * fraction;
    const at = sampleBranch(stem, station).position;
    posed = bendBranch(posed, {
      branchId: stemId,
      stationDistance: station,
      target: add(at, vec3(0.2, -3.5, 1.4)),
    });
    samples.push(openFaceMouth(posed));
  }

  let downwardStalks = 0;
  for (const sample of samples) {
    assert.ok(Math.abs(dot(sample.mouth, sample.tangent)) < 1e-5, "open-face mouth stays perpendicular to its stalk");
    assert.ok(Math.abs(sample.turn - rest.turn) < 1e-6, "aim and bend do not author a new neck curve");
    if (sample.tangent.y < -0.45) {
      downwardStalks += 1;
      const alignment = dot(sample.mouth, normalize(sample.tangent));
      assert.ok(Math.abs(alignment) < 1e-5);
    }
  }
  assert.ok(downwardStalks > 0, "the search must include a downward stalk so the limit is actually exercised");
});

test("a kept nodding bowl survives an edited working copy", () => {
  const storage = {
    values: new Map<string, string>(),
    getItem(key: string) { return this.values.get(key) ?? null; },
    setItem(key: string, value: string) { this.values.set(key, value); },
  };
  const garden = new GardenStore(GARDEN_KEY, storage);
  garden.load();
  const arrangement = createWorkbenchFixture("nodding-flower", 8278, 1, { remember: false });
  const entry: GardenEntry = {
    id: "nodding-study",
    title: "Nodding flower study",
    keptAt: "2026-09-23T00:00:00.000Z",
    thumbnail: null,
    arrangement,
  };
  garden.keep(entry);
  const working = createWorkbenchFixture("nodding-flower", 8278, 1, { remember: false });
  const graph = deserializePlantGraph(working.plants[0]);
  const neck = graph.branches.get(`${graph.id}:neck`)!;
  const pruned = applyPrune(graph, previewPrune(graph, neck.id, neck.activeLength * 0.4));
  working.plants[0] = toCanonicalPlantGraph(pruned);
  const copy: GardenEntry = {
    id: "nodding-copy",
    title: "Nodding flower copy",
    keptAt: "2026-09-23T00:10:00.000Z",
    thumbnail: null,
    arrangement: working,
  };
  garden.keep(copy);
  const loaded = garden.load();
  const original = loaded.entries.find((item) => item.id === "nodding-study")!;
  const edited = loaded.entries.find((item) => item.id === "nodding-copy")!;
  assert.equal(original.arrangement.plants[0].organs.find((organ) => organ.id.endsWith(":bloom"))!.active, true);
  assert.equal(edited.arrangement.plants[0].organs.find((organ) => organ.id.endsWith(":bloom"))!.active, false);
  assert.equal(original.arrangement.plants[0].branches.length, edited.arrangement.plants[0].branches.length);
});

test("nodding insertion cancellation is covered beside the shared ordinal law", () => {
  const saves: unknown[] = [];
  const coordinator = new TransactionCoordinator(createDomainAdapters(), {
    plants: new Map(), camera: canonicalCameraPose("front"),
    selectedPlantId: null, successfulPlantOrdinal: 0,
  }, { onAutosave: (event) => saves.push(event) });
  const prepared = prepareMaterialInsertion("nodding-flower", 1, BASE);
  assert.ok(prepared.ok);
  if (!prepared.ok) return;
  coordinator.beginInsert("cancel-nod", {
    ordinal: 0, plantId: prepared.plantId, seed: prepared.seed, graph: prepared.graph,
  }, {}, { base: BASE, valid: true });
  coordinator.pointerCancel("cancel-nod");
  assert.equal(coordinator.getDebugState().successfulPlantOrdinal, 0);
  assert.equal(saves.length, 0);
});
