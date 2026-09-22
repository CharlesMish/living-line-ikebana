import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import floweringFixture from "../../fixtures/plant-1-one-branch-v1.json";
import leafyFixture from "../../fixtures/plant-2-leafy-shoot-v1.json";
import fixture from "../../fixtures/plant-1-reed-v1.json";
import studyBackup from "../../artifacts/reed-lines-garden.json";
import { canonicalCameraPose } from "../../src/app/camera.ts";
import { parseGarden } from "../../src/app/garden.ts";
import { createWorkbenchFixture } from "../../src/app/workbench.ts";
import {
  REED_VERSION,
  aimBranch,
  applyPrune,
  bendBranch,
  createBareBranch,
  createFloweringBranch,
  createLeafyShoot,
  createReed,
  createSingleFlower,
  deserializePlantGraph,
  getMaterialDefinition,
  legalBendStation,
  prepareMaterialInsertion,
  previewPrune,
  sampleBranch,
  serializePlantGraph,
  successfulSeatIdentity,
  toCanonicalPlantGraph,
  translatePlantBase,
  validatePlantGraph,
  add,
  vec3,
} from "../../src/core/index.ts";
import { FLOWERING_RESPONSE, LEAFY_RESPONSE, REED_RESPONSE, SINGLE_FLOWER_RESPONSE } from "../../src/core/materialResponse.ts";
import { getMaterialAppearance } from "../../src/presentation/materialAppearance.ts";
import { buildReedStudyGraph, buildReedStudyGraphs, REED_STUDY_PLACEMENTS, reedStudyGardenDocument } from "./reedStudy.ts";

const BASE = { x: 0, y: 0.55, z: 0 };
const SEEDS = [8278, 9255, 10232] as const;

test("reed catalog entry is additive and matches the golden fixture at seed 8278", () => {
  const material = getMaterialDefinition("reed");
  assert.ok(material);
  assert.equal(material.materialId, "reed");
  assert.equal(material.generator.generatorVersion, REED_VERSION);
  assert.equal(material.generator.generate, createReed);

  const prepared = prepareMaterialInsertion("reed", 1, BASE);
  assert.equal(prepared.ok, true);
  if (!prepared.ok) return;
  assert.deepEqual(toCanonicalPlantGraph(prepared.graph), fixture);
  assert.equal(prepared.graph.generatorVersion, "reed-v1");
  assert.equal(prepared.graph.branches.size, 1);
  assert.equal(prepared.graph.organs.size, 0);
  assert.equal("materialId" in prepared.graph, false);
  assert.doesNotMatch(serializePlantGraph(prepared.graph), /"materialId"/);

  const flowering = toCanonicalPlantGraph(createFloweringBranch("plant-1", 8278, BASE));
  assert.equal(flowering.branches.length, floweringFixture.branches.length);
  assert.equal(flowering.organs.length, floweringFixture.organs.length);
  assert.deepEqual(flowering.organs, floweringFixture.organs);
  assert.deepEqual(JSON.parse(serializePlantGraph(createLeafyShoot("plant-2", 9255, BASE))), leafyFixture);
});

test("reed-v1 is one culm, thinner and less woody than the line references", () => {
  const reed = createReed("plant-1", 8278, BASE);
  const bare = createBareBranch("plant-1", 8278, BASE);
  const flower = createSingleFlower("plant-1", 8278, BASE);
  const leafy = createLeafyShoot("plant-1", 8278, BASE);
  const culm = reed.branches.get("plant-1:culm")!;
  assert.equal(culm.kind, "trunk");
  assert.equal(culm.points.length, 17);
  assert.equal(culm.stiffness, REED_RESPONSE.culm);
  assert.ok(culm.radius < flower.branches.get("plant-1:stem")!.radius);
  assert.ok(culm.radius < leafy.branches.get(leafy.rootBranchId)!.radius);
  assert.ok(culm.radius < bare.branches.get(bare.rootBranchId)!.radius);
  assert.ok(culm.stiffness < FLOWERING_RESPONSE.trunk);
  assert.ok(culm.stiffness > LEAFY_RESPONSE.stem);
  assert.ok(culm.stiffness < 0.72);
  assert.equal(SINGLE_FLOWER_RESPONSE.stem < REED_RESPONSE.culm, true);
  assert.equal(reed.branches.size, 1);
  assert.equal(bare.branches.size, 5);
  assert.equal(reed.organs.size, 0);
  const appearance = getMaterialAppearance("reed-v1");
  assert.equal(appearance.branchColors.trunk, 0x4e6240);
  assert.notEqual(appearance.branchColors.trunk, getMaterialAppearance("one-branch-v1").branchColors.trunk);
  assert.notEqual(appearance.branchColors.trunk, getMaterialAppearance("leafy-shoot-v1").branchColors.trunk);
  assert.notEqual(appearance.branchColors.trunk, getMaterialAppearance("bare-branch-v1").branchColors.trunk);
  assert.notEqual(appearance.branchColors.trunk, getMaterialAppearance("single-flower-v1").branchColors.trunk);
});

test("review seeds are deterministic, valid, and differ in height and lean", () => {
  const lengths: number[] = [];
  const azimuths: number[] = [];
  for (const seed of SEEDS) {
    const first = createReed("plant-1", seed, BASE);
    const second = createReed("plant-1", seed, BASE);
    assert.equal(serializePlantGraph(first), serializePlantGraph(second));
    assert.deepEqual(validatePlantGraph(first), []);
    assert.equal(first.branches.size, 1);
    assert.equal(first.organs.size, 0);
    const culm = first.branches.get(first.rootBranchId)!;
    assert.ok(legalBendStation(culm) !== null);
    assert.equal(culm.points.length, culm.restLengths.length + 1);
    const root = culm.points[0]!;
    const tip = culm.points[culm.points.length - 1]!;
    assert.ok(tip.y - root.y > culm.activeLength * 0.9, "a reed stays a rising line");
    lengths.push(culm.activeLength);
    azimuths.push(Math.atan2(tip.z - root.z, tip.x - root.x));
    const encoded = serializePlantGraph(first);
    assert.equal(serializePlantGraph(deserializePlantGraph(encoded)), encoded);
  }
  const span = Math.max(...lengths) - Math.min(...lengths);
  assert.ok(span > 0.9, `review seeds should not share one height, span ${span}`);
  const angleSpan = Math.max(...azimuths) - Math.min(...azimuths);
  assert.ok(angleSpan > 0.4, `review seeds should not share one lean, span ${angleSpan}`);
});

test("aim and bend keep reed stock; prune shortens and retains the culm record", () => {
  for (const seed of SEEDS) {
    const graph = createReed("plant-1", seed, BASE);
    const culm = graph.branches.get(graph.rootBranchId)!;
    const stock = culm.restLengths;
    const grabbed = sampleBranch(culm, culm.activeLength * 0.8);
    const aimed = aimBranch(
      graph,
      culm.id,
      grabbed.position,
      add(grabbed.position, vec3(0.7, 0.15, -0.45)),
    );
    assert.deepEqual(validatePlantGraph(aimed), []);
    assert.deepEqual(aimed.branches.get(culm.id)!.restLengths, stock);
    assert.equal(aimed.branches.get(culm.id)!.activeLength, culm.activeLength);
    const station = culm.activeLength * 0.54;
    const bent = bendBranch(graph, {
      branchId: culm.id,
      stationDistance: station,
      target: add(sampleBranch(culm, station).position, vec3(1.1, 0.05, -0.4)),
    });
    assert.deepEqual(validatePlantGraph(bent), []);
    assert.notDeepEqual(bent.branches.get(culm.id)!.points, culm.points);
    assert.deepEqual(bent.branches.get(culm.id)!.restLengths, stock);
    assert.equal(serializePlantGraph(graph), serializePlantGraph(createReed("plant-1", seed, BASE)));
    const plan = previewPrune(bent, culm.id, culm.activeLength * 0.46);
    const snapshot = serializePlantGraph(bent);
    previewPrune(bent, culm.id, culm.activeLength * 0.46);
    assert.equal(serializePlantGraph(bent), snapshot);
    assert.deepEqual(plan.removedBranchIds, []);
    assert.deepEqual(plan.removedOrganIds, []);
    const cut = applyPrune(bent, plan);
    assert.deepEqual(validatePlantGraph(cut), []);
    const shortened = cut.branches.get(culm.id)!;
    assert.equal(shortened.active, true);
    assert.ok(shortened.activeLength < culm.activeLength);
    assert.equal(cut.branches.size, 1);
    assert.equal(cut.organs.size, 0);
    assert.deepEqual(shortened.restLengths.slice(0, -1), stock.slice(0, shortened.restLengths.length - 1));
  }
});

test("a five-reed bowl differs in height, lean, and spacing without a length control", () => {
  const graphs = buildReedStudyGraphs();
  assert.equal(graphs.length, 5);
  const heights: number[] = [];
  const azimuths: number[] = [];
  const bases: Array<{ x: number; z: number }> = [];
  for (const [index, graph] of graphs.entries()) {
    const placement = REED_STUDY_PLACEMENTS[index]!;
    const identity = successfulSeatIdentity(placement.ordinal);
    assert.equal(graph.id, identity.id);
    assert.equal(graph.seed, identity.seed);
    assert.equal(graph.generatorVersion, "reed-v1");
    assert.deepEqual(validatePlantGraph(graph), []);
    const culm = graph.branches.get(graph.rootBranchId)!;
    const stock = createReed(identity.id, identity.seed, BASE).branches.get(`${identity.id}:culm`)!;
    const root = culm.points[0]!;
    const tip = culm.points[culm.points.length - 1]!;
    heights.push(culm.activeLength);
    azimuths.push(Math.atan2(tip.z - root.z, tip.x - root.x));
    bases.push({ x: root.x, z: root.z });
    assert.ok(Math.hypot(root.x, root.z) <= 1.22 + 1e-8);
    if (placement.pruneTo === null) {
      assert.equal(culm.activeLength, stock.activeLength);
      assert.deepEqual(culm.restLengths, stock.restLengths);
    } else {
      assert.ok(culm.activeLength < stock.activeLength - 0.4);
      assert.ok(Math.abs(culm.activeLength - placement.pruneTo) < 1e-8);
    }
  }
  assert.ok(Math.max(...heights) - Math.min(...heights) > 2.5);
  const sortedAngles = [...azimuths].sort((a, b) => a - b);
  let widestGap = sortedAngles[0]! + Math.PI * 2 - sortedAngles[sortedAngles.length - 1]!;
  for (let index = 1; index < sortedAngles.length; index += 1) {
    widestGap = Math.max(widestGap, sortedAngles[index]! - sortedAngles[index - 1]!);
  }
  assert.ok(Math.PI * 2 - widestGap > 2.2, "leans should cover more than one direction");
  const gaps: number[] = [];
  for (let i = 0; i < bases.length; i += 1) {
    for (let j = i + 1; j < bases.length; j += 1) {
      gaps.push(Math.hypot(bases[i]!.x - bases[j]!.x, bases[i]!.z - bases[j]!.z));
    }
  }
  assert.ok(Math.min(...gaps) > 0.45);
  assert.ok(Math.max(...gaps) - Math.min(...gaps) > 0.55, "spacing should not be one repeated interval");
  const bent = graphs[3]!;
  const unbent = buildReedStudyGraph({ ...REED_STUDY_PLACEMENTS[3]!, bendOffset: null });
  assert.notDeepEqual(
    bent.branches.get(bent.rootBranchId)!.points,
    unbent.branches.get(unbent.rootBranchId)!.points,
  );
  assert.deepEqual(
    bent.branches.get(bent.rootBranchId)!.restLengths,
    unbent.branches.get(unbent.rootBranchId)!.restLengths,
  );

  const loaded = parseGarden(JSON.stringify(studyBackup));
  const built = reedStudyGardenDocument();
  assert.deepEqual(loaded, built);
  assert.equal(loaded.entries[0]?.title, "Reed lines and the spaces between");
  assert.deepEqual(loaded.entries[0]?.arrangement.camera, canonicalCameraPose("front"));
  const moved = translatePlantBase(graphs[0]!, { x: 0.4, y: 0.55, z: 0.2 });
  assert.notDeepEqual(
    moved.branches.get(moved.rootBranchId)!.points[0],
    graphs[0]!.branches.get(graphs[0]!.rootBranchId)!.points[0],
  );
  assert.deepEqual(parseGarden(JSON.stringify(studyBackup)), built);
});

test("registering reed leaves reference-pair and all-four graphs unchanged", () => {
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
  const single = createWorkbenchFixture("reed", 8278, 1, { remember: false });
  assert.deepEqual(single.plants[0], fixture);
  const repeated = createWorkbenchFixture("reed", 8278, 6, { remember: false });
  assert.equal(repeated.plants.every((plant) => plant.generatorVersion === "reed-v1"), true);
  assert.equal(new Set(repeated.plants.map((plant) => plant.seed)).size, 6);
});

test("golden reed fixture file is the serialized plant-1 graph", () => {
  const raw = readFileSync(new URL("../../fixtures/plant-1-reed-v1.json", import.meta.url), "utf8");
  assert.equal(raw, serializePlantGraph(createReed("plant-1", 8278, BASE), 2) + "\n");
});
