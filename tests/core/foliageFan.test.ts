import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import floweringFixture from "../../fixtures/plant-1-one-branch-v1.json";
import leafyFixture from "../../fixtures/plant-2-leafy-shoot-v1.json";
import fixture from "../../fixtures/plant-1-foliage-fan-v1.json";
import studyBackup from "../../artifacts/foliage-fan-garden.json";
import { canonicalCameraPose } from "../../src/app/camera.ts";
import { GARDEN_KEY, GardenStore, parseGarden } from "../../src/app/garden.ts";
import { createWorkbenchFixture } from "../../src/app/workbench.ts";
import {
  FOLIAGE_FAN_VERSION,
  aimBranch,
  applyPrune,
  bendBranch,
  createFloweringBranch,
  createFoliageFan,
  createLeafyShoot,
  deserializePlantGraph,
  getMaterialDefinition,
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
  type PlantGraph,
} from "../../src/core/index.ts";
import { FOLIAGE_FAN_RESPONSE, LEAFY_RESPONSE } from "../../src/core/materialResponse.ts";
import { getMaterialAppearance } from "../../src/presentation/materialAppearance.ts";
import {
  FOLIAGE_FAN_OPENING_CUT,
  FOLIAGE_FAN_STUDY_PLACEMENTS,
  buildFoliageFanStudyGraph,
  buildFoliageFanStudyGraphs,
  foliageFanStudyGardenDocument,
} from "./foliageFanStudy.ts";

const BASE = { x: 0, y: 0.55, z: 0 };
const SEEDS = [8278, 9255, 10232] as const;

function bounds(graph: PlantGraph) {
  let minX = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const branch of graph.branches.values()) {
    if (!branch.active) continue;
    for (const point of branch.points) {
      minX = Math.min(minX, point.x);
      maxX = Math.max(maxX, point.x);
      maxY = Math.max(maxY, point.y);
    }
  }
  return { width: maxX - minX, maxY };
}

test("foliage-fan catalog entry is additive and matches the golden fixture at seed 8278", () => {
  const material = getMaterialDefinition("foliage-fan");
  assert.ok(material);
  assert.equal(material.materialId, "foliage-fan");
  assert.equal(material.generator.generatorVersion, FOLIAGE_FAN_VERSION);
  assert.equal(material.generator.generate, createFoliageFan);

  const prepared = prepareMaterialInsertion("foliage-fan", 1, BASE);
  assert.equal(prepared.ok, true);
  if (!prepared.ok) return;
  assert.deepEqual(JSON.parse(serializePlantGraph(prepared.graph)), fixture);
  assert.equal(prepared.graph.generatorVersion, "foliage-fan-v1");
  assert.equal(prepared.graph.branches.size, 12);
  assert.equal(prepared.graph.organs.size, 8);
  assert.equal("materialId" in prepared.graph, false);
  assert.doesNotMatch(serializePlantGraph(prepared.graph), /"materialId"/);
  assert.equal(prepared.graph.branches.get("plant-1:stem")!.stiffness, FOLIAGE_FAN_RESPONSE.stem);

  const flowering = toCanonicalPlantGraph(createFloweringBranch("plant-1", 8278, BASE));
  assert.equal(flowering.branches.length, floweringFixture.branches.length);
  assert.equal(flowering.organs.length, floweringFixture.organs.length);
  assert.deepEqual(flowering.organs, floweringFixture.organs);
  assert.deepEqual(JSON.parse(serializePlantGraph(createLeafyShoot("plant-2", 9255, BASE))), leafyFixture);
});

test("foliage-fan-v1 is a shorter spray of three arms and eight small leaves, not another leafy shoot", () => {
  for (const seed of SEEDS) {
    const fan = createFoliageFan("plant-1", seed, BASE);
    const leafy = createLeafyShoot("plant-1", seed, BASE);
    assert.deepEqual(validatePlantGraph(fan), []);
    assert.equal(serializePlantGraph(fan), serializePlantGraph(createFoliageFan("plant-1", seed, BASE)));
    const stem = fan.branches.get("plant-1:stem")!;
    const leafyStem = leafy.branches.get(leafy.rootBranchId)!;
    assert.equal(stem.kind, "trunk");
    assert.equal(stem.points.length, 13);
    assert.equal(stem.stiffness, FOLIAGE_FAN_RESPONSE.stem);
    assert.ok(stem.activeLength < leafyStem.activeLength - 1.5);
    assert.ok(stem.activeLength > 2.4);
    const laterals = [...fan.branches.values()].filter((branch) => branch.kind === "lateral");
    assert.deepEqual(laterals.map((branch) => branch.id), [
      "plant-1:arm-opening", "plant-1:arm-answering", "plant-1:arm-crown",
    ]);
    assert.equal([...leafy.branches.values()].some((branch) => branch.kind === "lateral"), false);
    const opening = fan.branches.get("plant-1:arm-opening")!;
    assert.ok(opening.parentDistance > 1.05, "the stem keeps a basal span below the first arm");
    assert.ok(opening.parentDistance < stem.activeLength * 0.55);
    for (const arm of laterals) {
      assert.equal(arm.stiffness, FOLIAGE_FAN_RESPONSE.arm);
      assert.equal(arm.points.length, 7);
      const stalks = [...fan.branches.values()].filter((branch) => branch.parentId === arm.id);
      assert.ok(stalks.length >= 2);
      for (const stalk of stalks) {
        assert.equal(stalk.kind, "petiole");
        assert.equal(stalk.stiffness, FOLIAGE_FAN_RESPONSE.stalk);
        assert.ok(stalk.parentDistance > 0.35);
      }
    }
    const leaves = [...fan.organs.values()];
    assert.equal(leaves.length, 8);
    assert.equal(leaves.every((organ) => organ.kind === "leaf" && organ.active), true);
    assert.ok(leaves.every((organ) => organ.scale >= 0.6 && organ.scale <= 0.8));
    const leafyScales = [...leafy.organs.values()].map((organ) => organ.scale);
    assert.ok(Math.max(...leaves.map((organ) => organ.scale)) < Math.max(...leafyScales) - 0.15);
    const fanBox = bounds(fan);
    const leafyBox = bounds(leafy);
    assert.ok(fanBox.width > leafyBox.width + 0.9, `fan spread ${fanBox.width} should exceed the leafy shoot ${leafyBox.width}`);
    assert.ok(leafyBox.maxY > fanBox.maxY + 1.3, "the spray sits lower than the leafy shoot");
    assert.equal(serializePlantGraph(deserializePlantGraph(serializePlantGraph(fan))), serializePlantGraph(fan));
  }
  const appearance = getMaterialAppearance("foliage-fan-v1");
  assert.equal(appearance.leaf.form, "elliptic");
  assert.equal(appearance.branchColors.trunk, 0x7c9a34);
  assert.notEqual(appearance.branchColors.trunk, getMaterialAppearance("leafy-shoot-v1").branchColors.trunk);
  assert.notEqual(appearance.leaf.color, getMaterialAppearance("leafy-shoot-v1").leaf.color);
  assert.equal(getMaterialAppearance("leafy-shoot-v1").leaf.form, "lanceolate");
  assert.equal(LEAFY_RESPONSE.stem < FOLIAGE_FAN_RESPONSE.stem, true);
  assert.equal(FOLIAGE_FAN_RESPONSE.arm < FOLIAGE_FAN_RESPONSE.stem, true);
});

test("aim and bend keep fan stock; cutting the opening arm opens a gap and keeps the other arms", () => {
  for (const seed of SEEDS) {
    const graph = createFoliageFan("plant-1", seed, BASE);
    const before = serializePlantGraph(graph);
    const stem = graph.branches.get("plant-1:stem")!;
    const opening = graph.branches.get("plant-1:arm-opening")!;
    const grabbed = sampleBranch(opening, opening.activeLength * 0.7);
    const aimed = aimBranch(graph, opening.id, grabbed.position, add(grabbed.position, vec3(0.45, 0.2, -0.25)));
    assert.deepEqual(validatePlantGraph(aimed), []);
    for (const branch of graph.branches.values()) {
      assert.deepEqual(aimed.branches.get(branch.id)!.restLengths, branch.restLengths);
    }
    const station = stem.activeLength * 0.54;
    const bent = bendBranch(graph, {
      branchId: stem.id,
      stationDistance: station,
      target: add(sampleBranch(stem, station).position, vec3(0.35, -0.15, 0.1)),
    });
    assert.deepEqual(validatePlantGraph(bent), []);
    assert.deepEqual(bent.branches.get(stem.id)!.restLengths, stem.restLengths);
    assert.notDeepEqual(bent.branches.get(stem.id)!.points, stem.points);
    for (const armId of ["plant-1:arm-opening", "plant-1:arm-answering", "plant-1:arm-crown"]) {
      assert.deepEqual(bent.branches.get(armId)!.restLengths, graph.branches.get(armId)!.restLengths);
    }
    assert.equal(serializePlantGraph(graph), before);

    const plan = previewPrune(graph, opening.id, FOLIAGE_FAN_OPENING_CUT);
    assert.equal(serializePlantGraph(graph), before, "prune preview writes nothing");
    const removedPetioles = ["plant-1:petiole-opening-1", "plant-1:petiole-opening-2", "plant-1:petiole-opening-3"];
    const removedLeaves = ["plant-1:leaf-opening-1", "plant-1:leaf-opening-2", "plant-1:leaf-opening-3"];
    assert.deepEqual(plan.removedBranchIds, removedPetioles);
    assert.deepEqual(plan.removedOrganIds, removedLeaves);
    const cut = applyPrune(graph, plan);
    assert.deepEqual(validatePlantGraph(cut), []);
    assert.equal(cut.branches.size, graph.branches.size);
    assert.equal(cut.organs.size, graph.organs.size);
    const stub = cut.branches.get(opening.id)!;
    assert.equal(stub.active, true);
    assert.ok(stub.activeLength < 0.25);
    assert.ok(bounds(cut).width < bounds(graph).width - 0.7);
    for (const [id, branch] of graph.branches) {
      if (id === opening.id) continue;
      if (removedPetioles.includes(id)) {
        assert.equal(cut.branches.get(id)!.active, false);
        assert.deepEqual(cut.branches.get(id)!.points, branch.points);
        continue;
      }
      assert.deepEqual(cut.branches.get(id), branch);
    }
    for (const [id, organ] of graph.organs) {
      const kept = cut.organs.get(id)!;
      if (removedLeaves.includes(id)) {
        assert.equal(kept.active, false);
        assert.equal(kept.scale, organ.scale);
        assert.equal(kept.spin, organ.spin);
        assert.equal(kept.branchId, organ.branchId);
        continue;
      }
      assert.deepEqual(kept, organ);
    }
    assert.equal(serializePlantGraph(deserializePlantGraph(serializePlantGraph(cut))), serializePlantGraph(cut));
  }
});

test("a loaded fan keeps its copied stiffness instead of reapplying the profile", () => {
  const graph = createFoliageFan("plant-1", 8278, BASE);
  const stem = graph.branches.get("plant-1:stem")!;
  assert.equal(stem.stiffness, FOLIAGE_FAN_RESPONSE.stem);
  stem.stiffness = 0.91;
  const loaded = deserializePlantGraph(serializePlantGraph(graph));
  assert.equal(loaded.branches.get("plant-1:stem")!.stiffness, 0.91);
  assert.notEqual(loaded.branches.get("plant-1:stem")!.stiffness, FOLIAGE_FAN_RESPONSE.stem);
  assert.equal(loaded.branches.get("plant-1:arm-opening")!.stiffness, FOLIAGE_FAN_RESPONSE.arm);
});

test("the study bowl keeps a leafy line, a full fan, and one opened side", () => {
  const graphs = buildFoliageFanStudyGraphs();
  assert.equal(graphs.length, 3);
  const leafy = graphs[0]!;
  const full = graphs[1]!;
  const opened = graphs[2]!;
  assert.equal(leafy.generatorVersion, "leafy-shoot-v1");
  assert.equal(full.generatorVersion, "foliage-fan-v1");
  assert.equal(opened.generatorVersion, "foliage-fan-v1");
  assert.equal(leafy.seed, 8278);
  assert.equal(full.seed, 9255);
  assert.equal(opened.seed, 10232);
  assert.ok(bounds(leafy).maxY > bounds(full).maxY + 1.2);
  assert.ok(bounds(full).width > bounds(leafy).width + 0.9);
  assert.equal(opened.branches.get("plant-3:arm-opening")!.activeLength < 0.25, true);
  assert.equal(opened.branches.get("plant-3:arm-answering")!.active, true);
  assert.equal(opened.branches.get("plant-3:arm-crown")!.active, true);
  assert.equal([...opened.organs.values()].filter((organ) => organ.id.includes("opening") && organ.active).length, 0);
  assert.equal([...opened.organs.values()].filter((organ) => organ.id.includes("answering") && organ.active).length, 3);
  assert.equal([...opened.organs.values()].filter((organ) => organ.id.includes("crown") && organ.active).length, 2);
  const stock = translatePlantBase(createFoliageFan("plant-3", 10232, BASE), FOLIAGE_FAN_STUDY_PLACEMENTS[2]!.base);
  assert.deepEqual(opened.branches.get("plant-3:arm-answering"), stock.branches.get("plant-3:arm-answering"));
  assert.deepEqual(opened.branches.get("plant-3:arm-crown"), stock.branches.get("plant-3:arm-crown"));
  assert.deepEqual(opened.organs.get("plant-3:leaf-answering-2"), stock.organs.get("plant-3:leaf-answering-2"));
  assert.deepEqual(opened.organs.get("plant-3:leaf-crown-1"), stock.organs.get("plant-3:leaf-crown-1"));
  for (const graph of graphs) {
    assert.deepEqual(validatePlantGraph(graph), []);
    const root = graph.branches.get(graph.rootBranchId)!.points[0]!;
    assert.ok(Math.hypot(root.x, root.z) <= 1.22 + 1e-8);
  }
  assert.equal(successfulSeatIdentity(2).seed, 9255);

  const loaded = parseGarden(JSON.stringify(studyBackup));
  const built = foliageFanStudyGardenDocument();
  assert.deepEqual(loaded, JSON.parse(JSON.stringify(built)));
  assert.equal(loaded.entries[0]?.title, "A leafy line beside an opened fan");
  assert.deepEqual(loaded.entries[0]?.arrangement.camera, canonicalCameraPose("front"));
  const values = new Map<string, string>();
  const garden = new GardenStore(GARDEN_KEY, {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => { values.set(key, value); },
  });
  garden.load();
  garden.keep(built.entries[0]!);
  const copy = structuredClone(garden.load().entries[0]!.arrangement);
  const copiedFan = fromCanonical(copy.plants[1]!);
  const arm = copiedFan.branches.get("plant-2:arm-opening")!;
  copy.plants[1] = toCanonicalPlantGraph(applyPrune(copiedFan, previewPrune(copiedFan, arm.id, FOLIAGE_FAN_OPENING_CUT)));
  assert.deepEqual(
    garden.load().entries[0]!.arrangement,
    JSON.parse(JSON.stringify(built.entries[0]!.arrangement)),
  );
  assert.notDeepEqual(copy.plants[1], garden.load().entries[0]!.arrangement.plants[1]);
});

function fromCanonical(plant: ReturnType<typeof toCanonicalPlantGraph>): PlantGraph {
  return deserializePlantGraph(plant);
}

test("registering foliage-fan leaves reference-pair, mixed, all-four, and Round 3 profiles unchanged", () => {
  const pair = createWorkbenchFixture("reference-pair", 8278, 6, { remember: false });
  const mixed = createWorkbenchFixture("mixed", 8278, 6, { remember: false });
  assert.deepEqual(mixed, pair);
  assert.deepEqual(pair.plants.map((plant) => plant.generatorVersion), [
    "one-branch-v1", "leafy-shoot-v1", "one-branch-v1",
    "leafy-shoot-v1", "one-branch-v1", "leafy-shoot-v1",
  ]);
  const allFour = createWorkbenchFixture("all-four", 8278, 6, { remember: false });
  assert.deepEqual(allFour.plants.map((plant) => plant.generatorVersion), [
    "one-branch-v1", "leafy-shoot-v1", "bare-branch-v1", "single-flower-v1",
    "one-branch-v1", "leafy-shoot-v1",
  ]);
  const round3 = createWorkbenchFixture("round3-three", 8278, 6, { remember: false });
  assert.deepEqual(round3.plants.map((plant) => plant.generatorVersion), [
    "reed-v1", "flower-volume-v1", "arching-trailer-v1",
    "reed-v1", "flower-volume-v1", "arching-trailer-v1",
  ]);
  const palette = createWorkbenchFixture("round3-palette", 8278, 6, { remember: false });
  assert.deepEqual(palette.plants.map((plant) => plant.generatorVersion), [
    "one-branch-v1", "leafy-shoot-v1", "bare-branch-v1", "single-flower-v1", "reed-v1", "flower-volume-v1",
  ]);
  const comparison = createWorkbenchFixture("references-plus-foliage-fan", 8278, 6, { remember: false });
  assert.deepEqual(comparison.plants.map((plant) => plant.generatorVersion), [
    "one-branch-v1", "leafy-shoot-v1", "foliage-fan-v1",
    "one-branch-v1", "leafy-shoot-v1", "foliage-fan-v1",
  ]);
  assert.deepEqual(comparison.plants.find((plant) => plant.id === "plant-1"), pair.plants.find((plant) => plant.id === "plant-1"));
  assert.deepEqual(comparison.plants.find((plant) => plant.id === "plant-2"), pair.plants.find((plant) => plant.id === "plant-2"));
  const single = createWorkbenchFixture("foliage-fan", 8278, 1, { remember: false });
  assert.deepEqual(JSON.parse(JSON.stringify(single.plants[0])), fixture);
  const dynamic = createWorkbenchFixture("all-registered-materials", 8278, 6, { remember: false });
  assert.equal(dynamic.plants.some((plant) => plant.generatorVersion === "foliage-fan-v1"), false);
});

test("golden foliage-fan fixture file is the serialized plant-1 graph", () => {
  const raw = readFileSync(new URL("../../fixtures/plant-1-foliage-fan-v1.json", import.meta.url), "utf8");
  assert.equal(raw, serializePlantGraph(createFoliageFan("plant-1", 8278, BASE), 2) + "\n");
});

test("buildFoliageFanStudyGraph is the cut used by the garden backup", () => {
  const opened = buildFoliageFanStudyGraph(FOLIAGE_FAN_STUDY_PLACEMENTS[2]!);
  assert.equal(opened.id, "plant-3");
  assert.equal(opened.branches.get("plant-3:petiole-opening-1")!.active, false);
  assert.equal(opened.organs.get("plant-3:leaf-answering-1")!.active, true);
});
