import { createBlossomSprayV2, BLOSSOM_SPRAY_V2_VERSION } from "../../src/core/index.ts";
import assert from "node:assert/strict";
import test from "node:test";
import fixture from "../../fixtures/plant-1-blossom-spray-v1.json";
import gardenBackup from "../../docs/development/reports/blossom-spray-v1/garden-backup.json";
import floweringFixture from "../../fixtures/plant-1-one-branch-v1.json";
import leafyFixture from "../../fixtures/plant-2-leafy-shoot-v1.json";
import { canonicalCameraPose } from "../../src/app/camera.ts";
import { createDomainAdapters } from "../../src/app/domainAdapters.ts";
import { GARDEN_KEY, GardenStore, parseGarden } from "../../src/app/garden.ts";
import { prepareMaterialInsertionForApp } from "../../src/app/materialInsertion.ts";
import { createWorkbenchFixture, describeFixture } from "../../src/app/workbench.ts";
import { IkebanaApp } from "../../src/app/IkebanaApp.ts";
import {
  BLOSSOM_SPRAY_VERSION,
  aimBranch,
  applyPrune,
  bendBranch,
  createBlossomSpray,
  createFlowerVolume,
  createFloweringBranch,
  createLeafyShoot,
  deserializePlantGraph,
  distance,
  getMaterialDefinition,
  organPosition,
  prepareMaterialInsertion,
  previewPrune,
  sampleBranch,
  serializePlantGraph,
  toCanonicalPlantGraph,
  validatePlantGraph,
  vec3,
  add,
  type PlantGraph,
} from "../../src/core/index.ts";
import { BLOSSOM_SPRAY_RESPONSE, FLOWERING_RESPONSE } from "../../src/core/materialResponse.ts";
import { getMaterialAppearance } from "../../src/presentation/materialAppearance.ts";
import { TransactionCoordinator } from "../../src/input/index.ts";

const BASE = { x: 0, y: 0.55, z: 0 };
const SEEDS = [8278, 9255, 10232] as const;

function bloomGaps(graph: PlantGraph) {
  const positions = [...graph.organs.values()]
    .filter((organ) => organ.kind === "bloom")
    .map((organ) => organPosition(graph, organ.id))
    .filter((position): position is NonNullable<typeof position> => position !== null);
  let min = Infinity;
  let max = 0;
  for (let i = 0; i < positions.length; i += 1) {
    for (let j = i + 1; j < positions.length; j += 1) {
      const gap = distance(positions[i]!, positions[j]!);
      min = Math.min(min, gap);
      max = Math.max(max, gap);
    }
  }
  const ys = positions.map((position) => position.y);
  return { min, max, ySpan: Math.max(...ys) - Math.min(...ys) };
}

test("blossom-spray catalog entry is additive and leaves frozen profiles and goldens unchanged", () => {
  const material = getMaterialDefinition("blossom-spray");
  assert.ok(material);
  assert.equal(material.materialId, "blossom-spray");
  assert.equal(material.generator.generatorVersion, BLOSSOM_SPRAY_V2_VERSION);
  assert.equal(material.generator.generate, createBlossomSprayV2);

  const flowering = toCanonicalPlantGraph(createFloweringBranch("plant-1", 8278, BASE));
  assert.equal(flowering.branches.length, floweringFixture.branches.length);
  assert.equal(flowering.organs.length, floweringFixture.organs.length);
  assert.deepEqual(flowering.organs, floweringFixture.organs);
  const leafy = createLeafyShoot("plant-2", 9255, BASE);
  assert.deepEqual(JSON.parse(serializePlantGraph(leafy)), leafyFixture);

  const pair = describeFixture(createWorkbenchFixture("reference-pair", 8278, 6, { remember: false }));
  const mixed = describeFixture(createWorkbenchFixture("mixed", 8278, 6, { remember: false }));
  assert.deepEqual(mixed.plantsInIdentityOrder, pair.plantsInIdentityOrder);
  assert.deepEqual(pair.plantsInIdentityOrder.map((plant) => plant.generatorVersion), [
    "one-branch-v1", "leafy-shoot-v1", "one-branch-v1", "leafy-shoot-v1", "one-branch-v1", "leafy-shoot-v1",
  ]);
  const allFour = describeFixture(createWorkbenchFixture("all-four", 8278, 6, { remember: false }));
  assert.deepEqual(allFour.plantsInIdentityOrder.map((plant) => plant.generatorVersion), [
    "one-branch-v1", "leafy-shoot-v1", "bare-branch-v1", "single-flower-v1", "one-branch-v1", "leafy-shoot-v1",
  ]);
  const round3 = describeFixture(createWorkbenchFixture("round3-three", 8278, 6, { remember: false }));
  assert.deepEqual(round3.plantsInIdentityOrder.map((plant) => plant.generatorVersion), [
    "reed-v1", "flower-volume-v1", "arching-trailer-v1", "reed-v1", "flower-volume-v1", "arching-trailer-v1",
  ]);
  const palette = describeFixture(createWorkbenchFixture("round3-palette", 8278, 6, { remember: false }));
  assert.deepEqual(palette.plantsInIdentityOrder.map((plant) => plant.generatorVersion), [
    "one-branch-v1", "leafy-shoot-v1", "bare-branch-v1", "single-flower-v1", "reed-v1", "flower-volume-v1",
  ]);
  const dynamic = describeFixture(createWorkbenchFixture("all-registered-materials", 8278, 6, { remember: false }));
  assert.deepEqual(dynamic.plantsInIdentityOrder.map((plant) => plant.generatorVersion), [
    "one-branch-v1", "leafy-shoot-v1", "bare-branch-v1", "single-flower-v1", "reed-v1", "flower-volume-v1",
  ]);

  const compared = createWorkbenchFixture("blossom-compare", 8278, 6, { remember: false });
  assert.deepEqual(compared.plants.map((plant) => plant.generatorVersion), [
    "one-branch-v1", "flower-volume-v1", "blossom-spray-v1",
    "one-branch-v1", "flower-volume-v1", "blossom-spray-v1",
  ]);
  const pairSnapshot = createWorkbenchFixture("reference-pair", 8278, 6, { remember: false });
  assert.deepEqual(
    compared.plants.find((plant) => plant.id === "plant-1"),
    pairSnapshot.plants.find((plant) => plant.id === "plant-1"),
  );
});

test("blossom-spray-v1 spaces four to six flowers on two or three laterals and matches the seed 8278 fixture", () => {
  for (const seed of SEEDS) {
    const first = createBlossomSpray("plant-1", seed, BASE);
    const second = createBlossomSpray("plant-1", seed, BASE);
    assert.equal(serializePlantGraph(first), serializePlantGraph(second));
    assert.deepEqual(validatePlantGraph(first), []);
    assert.equal(first.generatorVersion, BLOSSOM_SPRAY_VERSION);
    const stem = first.branches.get(first.rootBranchId)!;
    assert.equal(stem.kind, "trunk");
    assert.equal(stem.label, "spray stem");
    assert.equal(stem.points.length, 17);
    assert.equal(stem.radius, 0.026);
    assert.equal(stem.stiffness, BLOSSOM_SPRAY_RESPONSE.stem);
    assert.ok(stem.radius < 0.04, "stock stays thin");
    const laterals = [...first.branches.values()].filter((branch) => branch.kind === "lateral");
    const pedicels = [...first.branches.values()].filter((branch) => branch.kind === "pedicel");
    const blooms = [...first.organs.values()].filter((organ) => organ.kind === "bloom");
    assert.ok(laterals.length >= 2 && laterals.length <= 3, `${seed} groups ${laterals.length}`);
    assert.ok(blooms.length >= 4 && blooms.length <= 6, `${seed} flowers ${blooms.length}`);
    assert.equal(pedicels.length, blooms.length);
    assert.equal([...first.organs.values()].every((organ) => organ.kind === "bloom"), true);
    const stations = laterals.map((lateral) => lateral.parentDistance).sort((a, b) => a - b);
    assert.ok(stations[0]! > 1.1, "the basal stem stays clear for seating");
    assert.ok(stations.at(-1)! < stem.activeLength * 0.88, "groups are not packed into the crown");
    for (let index = 1; index < stations.length; index += 1) {
      assert.ok(stations[index]! - stations[index - 1]! > 1, "groups leave a gap along the stem");
    }
    for (const lateral of laterals) {
      assert.equal(lateral.parentId, stem.id);
      assert.equal(lateral.label, "flower group");
      assert.equal(lateral.stiffness, BLOSSOM_SPRAY_RESPONSE.lateral);
      assert.ok(lateral.points.length >= 5, "a group is a bendable line");
      const flowers = pedicels.filter((pedicel) => pedicel.parentId === lateral.id);
      assert.ok(flowers.length >= 1 && flowers.length <= 3);
      for (const pedicel of flowers) {
        assert.equal(pedicel.label, "flower stalk");
        assert.equal(pedicel.stiffness, BLOSSOM_SPRAY_RESPONSE.stalk);
        assert.ok(pedicel.activeLength > 0.45, `${pedicel.id} must be an honest supporting stalk`);
        assert.ok(pedicel.parentDistance > 0.4, "flowers sit out along the group, not at its root");
        const bloom = blooms.find((organ) => organ.branchId === pedicel.id);
        assert.ok(bloom);
        assert.equal(bloom.distance, pedicel.activeLength);
        assert.ok(bloom.scale >= 0.96 && bloom.scale <= 1.02);
      }
    }
    const sprayGaps = bloomGaps(first);
    const volumeGaps = bloomGaps(createFlowerVolume("plant-1", seed, BASE));
    assert.ok(
      sprayGaps.min > volumeGaps.max + 0.6,
      `nearest spray flowers ${sprayGaps.min} must leave air beyond a flower-volume head span ${volumeGaps.max}`,
    );
    assert.ok(sprayGaps.ySpan > volumeGaps.ySpan * 4, "the spray is a tall rhythm, not a terminal head");
    const flowering = createFloweringBranch("plant-1", seed, BASE);
    assert.ok(first.branches.size < flowering.branches.size);
    assert.ok(stem.radius < flowering.branches.get(flowering.rootBranchId)!.radius * 0.35);
    assert.ok(stem.stiffness < FLOWERING_RESPONSE.trunk);
  }

  const prepared = prepareMaterialInsertion("blossom-spray", 1, BASE);
  assert.equal(prepared.ok, true);
  if (!prepared.ok) return;
  assert.equal(prepared.seed, 8278);
  assert.deepEqual(JSON.parse(serializePlantGraph(createBlossomSpray("plant-1", 8278, BASE))), fixture);
  assert.equal(prepared.graph.generatorVersion, BLOSSOM_SPRAY_V2_VERSION);
  assert.equal("materialId" in prepared.graph, false);
  assert.doesNotMatch(serializePlantGraph(prepared.graph), /"materialId"/);
  const appearance = getMaterialAppearance(BLOSSOM_SPRAY_VERSION);
  assert.equal(appearance.bloom.form, "tufted");
  assert.equal(appearance.bloom.hitRadius, getMaterialAppearance("flower-volume-v1").bloom.hitRadius);
  assert.ok(
    (appearance.bloom.tuftScatter?.azimuth ?? 0)
      > (getMaterialAppearance("flower-volume-v1").bloom.tuftScatter?.azimuth ?? 0),
    "separated blossoms scatter more than the packed head",
  );
  assert.equal(getMaterialAppearance("one-branch-v1").bloom.tuftScatter, undefined);
  assert.equal(getMaterialAppearance("single-flower-v1").bloom.tuftScatter, undefined);
  assert.notEqual(appearance.bloom.color, getMaterialAppearance("flower-volume-v1").bloom.color);
  assert.notEqual(appearance.bloom.color, getMaterialAppearance("one-branch-v1").bloom.color);
  assert.notEqual(appearance.branchColors.trunk, getMaterialAppearance("flower-volume-v1").branchColors.trunk);
  assert.notEqual(appearance.branchColors.trunk, getMaterialAppearance("one-branch-v1").branchColors.trunk);

  for (const ordinal of [2, 3, 17, 64]) {
    const seated = prepareMaterialInsertion("blossom-spray", ordinal, BASE);
    assert.equal(seated.ok, true);
    if (!seated.ok) return;
    assert.deepEqual(validatePlantGraph(seated.graph), []);
    assert.equal(seated.graph.generatorVersion, BLOSSOM_SPRAY_V2_VERSION);
  }
  const third = prepareMaterialInsertion("blossom-spray", 3, BASE);
  assert.equal(third.ok, true);
  if (!third.ok) return;
  assert.equal(third.seed, 10232);
});

test("seed variation changes the spray without rerolling during aim or bend", () => {
  const graphs = SEEDS.map((seed) => serializePlantGraph(createBlossomSpray("plant-1", seed, BASE)));
  assert.notEqual(graphs[0], graphs[1]);
  assert.notEqual(graphs[1], graphs[2]);
  const graph = createBlossomSpray("plant-1", 8278, BASE);
  const before = serializePlantGraph(graph);
  const stem = graph.branches.get(graph.rootBranchId)!;
  const lateral = graph.branches.get("plant-1:group-1")!;
  const station = lateral.activeLength * 0.54;
  const bent = bendBranch(graph, {
    branchId: lateral.id,
    stationDistance: station,
    target: add(sampleBranch(lateral, station).position, vec3(0.8, 0.35, -0.4)),
  });
  assert.deepEqual(validatePlantGraph(bent), []);
  assert.notDeepEqual(bent.branches.get(lateral.id)!.points, lateral.points);
  for (const branch of graph.branches.values()) {
    assert.deepEqual(bent.branches.get(branch.id)!.restLengths, branch.restLengths);
    assert.equal(bent.branches.get(branch.id)!.stiffness, branch.stiffness);
  }
  assert.deepEqual(bent.branches.get(stem.id)!.points, stem.points);
  assert.deepEqual(bent.branches.get("plant-1:group-2")!.points, graph.branches.get("plant-1:group-2")!.points);
  assert.deepEqual(bent.branches.get("plant-1:group-3")!.points, graph.branches.get("plant-1:group-3")!.points);
  for (const organ of graph.organs.values()) {
    assert.equal(bent.organs.get(organ.id)!.spin, organ.spin);
    assert.equal(bent.organs.get(organ.id)!.scale, organ.scale);
    assert.equal(bent.organs.get(organ.id)!.active, true);
  }

  const stalk = graph.branches.get("plant-1:stalk-1-1")!;
  const grabbed = sampleBranch(stalk, stalk.activeLength * 0.62);
  const aimed = aimBranch(graph, stalk.id, grabbed.position, add(grabbed.position, vec3(0.35, 0.2, -0.25)));
  assert.deepEqual(validatePlantGraph(aimed), []);
  assert.notDeepEqual(aimed.branches.get(stalk.id)!.points, stalk.points);
  assert.deepEqual(aimed.branches.get(lateral.id)!.points, lateral.points);
  assert.deepEqual(aimed.branches.get("plant-1:stalk-1-2")!.points, graph.branches.get("plant-1:stalk-1-2")!.points);
  assert.deepEqual(aimed.branches.get(stem.id)!.points, stem.points);
  for (const branch of graph.branches.values()) {
    assert.deepEqual(aimed.branches.get(branch.id)!.restLengths, branch.restLengths);
  }
  assert.notDeepEqual(organPosition(aimed, "plant-1:bloom-1-1"), organPosition(graph, "plant-1:bloom-1-1"));
  assert.deepEqual(organPosition(aimed, "plant-1:bloom-1-2"), organPosition(graph, "plant-1:bloom-1-2"));
  assert.equal(serializePlantGraph(graph), before);
  assert.equal(serializePlantGraph(deserializePlantGraph(serializePlantGraph(bent))), serializePlantGraph(bent));
});

test("cutting one flower stalk removes that bloom; cutting its lateral removes the whole group", () => {
  const graph = createBlossomSpray("plant-1", 8278, BASE);
  const before = serializePlantGraph(graph);
  const bloom = graph.organs.get("plant-1:bloom-2-1")!;
  const stalk = graph.branches.get(bloom.branchId)!;
  const stalkPlan = previewPrune(graph, stalk.id, bloom.distance);
  assert.equal(serializePlantGraph(graph), before, "preview must not mutate");
  assert.deepEqual(stalkPlan.removedBranchIds, []);
  assert.deepEqual(stalkPlan.removedOrganIds, ["plant-1:bloom-2-1"]);
  const stalkCut = applyPrune(graph, stalkPlan);
  assert.equal(serializePlantGraph(graph), before);
  assert.equal(stalkCut.organs.get(bloom.id)!.active, false);
  assert.equal(stalkCut.organs.get(bloom.id)!.spin, bloom.spin);
  assert.equal(stalkCut.organs.get(bloom.id)!.scale, bloom.scale);
  assert.equal(stalkCut.branches.get(stalk.id)!.active, true);
  assert.ok(stalkCut.branches.get(stalk.id)!.activeLength < stalk.activeLength);
  assert.equal(stalkCut.organs.get("plant-1:bloom-2-2")!.active, true);
  assert.deepEqual(stalkCut.branches.get("plant-1:group-2")!.points, graph.branches.get("plant-1:group-2")!.points);
  assert.equal(stalkCut.branches.size, graph.branches.size);
  assert.equal(stalkCut.organs.size, graph.organs.size);

  const opened = previewPrune(graph, "plant-1:group-2", 1.2);
  assert.deepEqual(opened.removedBranchIds, ["plant-1:stalk-2-2"]);
  assert.deepEqual(opened.removedOrganIds, ["plant-1:bloom-2-2"]);
  const thinned = applyPrune(graph, opened);
  assert.equal(thinned.organs.get("plant-1:bloom-2-1")!.active, true);
  assert.equal(thinned.branches.get("plant-1:group-2")!.active, true);
  assert.ok(thinned.branches.get("plant-1:group-2")!.activeLength < graph.branches.get("plant-1:group-2")!.activeLength);

  const group = graph.branches.get("plant-1:group-2")!;
  const groupPlan = previewPrune(graph, group.id, 0.12);
  assert.deepEqual(groupPlan.removedBranchIds, ["plant-1:stalk-2-1", "plant-1:stalk-2-2"]);
  assert.deepEqual(groupPlan.removedOrganIds, ["plant-1:bloom-2-1", "plant-1:bloom-2-2"]);
  const removed = applyPrune(graph, groupPlan);
  assert.equal(removed.branches.get(group.id)!.active, true);
  assert.ok(removed.branches.get(group.id)!.activeLength < 0.2);
  for (const id of ["plant-1:group-1", "plant-1:group-3", graph.rootBranchId, "plant-1:stalk-1-1", "plant-1:stalk-3-2"]) {
    assert.deepEqual(removed.branches.get(id)!.points, graph.branches.get(id)!.points, `${id} moved`);
    assert.equal(removed.branches.get(id)!.active, true);
  }
  for (const id of groupPlan.removedBranchIds) assert.equal(removed.branches.get(id)!.active, false);
  for (const id of ["plant-1:bloom-1-1", "plant-1:bloom-1-2", "plant-1:bloom-3-1", "plant-1:bloom-3-2"]) {
    assert.deepEqual(removed.organs.get(id), graph.organs.get(id));
  }
  assert.equal([...removed.organs.values()].filter((organ) => organ.active).length, 4);
  assert.deepEqual(validatePlantGraph(removed), []);
  const remaining = bloomGaps(removed);
  assert.ok(remaining.ySpan > 1.5, "removing the middle group keeps a tall line of accents");

  for (const seed of SEEDS) {
    const specimen = createBlossomSpray("plant-1", seed, BASE);
    const lateral = [...specimen.branches.values()].find((branch) => branch.kind === "lateral")!;
    const flowers = [...specimen.branches.values()].filter((branch) => branch.parentId === lateral.id);
    const one = flowers[0]!;
    const oneBloom = [...specimen.organs.values()].find((organ) => organ.branchId === one.id)!;
    const onePlan = previewPrune(specimen, one.id, oneBloom.distance);
    assert.deepEqual(onePlan.removedOrganIds, [oneBloom.id]);
    assert.equal(onePlan.removedBranchIds.length, 0);
    const groupPlanForSeed = previewPrune(specimen, lateral.id, 0.12);
    assert.deepEqual(groupPlanForSeed.removedBranchIds, flowers.map((flower) => flower.id).sort());
    assert.equal(groupPlanForSeed.removedOrganIds.length, flowers.length);
    const otherBlooms = [...specimen.organs.values()].filter((organ) => !groupPlanForSeed.removedOrganIds.includes(organ.id));
    assert.ok(otherBlooms.length >= 2);
  }
});

test("cancelled blossom-spray insertion and prune write nothing; a committed group cut reloads", () => {
  const saves: unknown[] = [];
  const coordinator = new TransactionCoordinator(createDomainAdapters(), {
    plants: new Map(),
    camera: canonicalCameraPose("front"),
    selectedPlantId: null,
    successfulPlantOrdinal: 0,
  }, { onAutosave: (event) => saves.push(event) });

  const prepared = prepareMaterialInsertionForApp("blossom-spray", 0);
  assert.equal(prepared.ok, true);
  if (!prepared.ok) return;
  const reservation = {
    ordinal: prepared.ordinal,
    plantId: prepared.plantId,
    seed: prepared.seed,
    graph: prepared.graph,
  };
  coordinator.beginInsert("spray-cancel", reservation, {}, { base: BASE, valid: true });
  coordinator.pointerCancel("spray-cancel");
  assert.equal(coordinator.getDebugState().successfulPlantOrdinal, 0);
  assert.equal(coordinator.getDocumentSnapshot().plants.size, 0);
  assert.equal(saves.length, 0);

  coordinator.beginInsert("spray", reservation, {}, { base: BASE, valid: true });
  coordinator.release("spray");
  assert.equal(coordinator.getDebugState().successfulPlantOrdinal, 1);
  assert.equal(saves.length, 1);

  const seated = coordinator.getDocumentSnapshot().plants.get("plant-1")!;
  const intact = serializePlantGraph(seated);
  coordinator.commandTool("prune");
  const spec = {
    plantId: "plant-1",
    branchId: "plant-1:group-2",
    acquiredMaterialDistance: 0.12,
    context: {},
  };
  coordinator.beginPrune("cut-cancel", spec, { distance: 0.12 });
  assert.equal(coordinator.getPresentationState().active?.kind, "prune");
  coordinator.pointerCancel("cut-cancel");
  assert.equal(coordinator.getPresentationState().active, null);
  assert.equal(saves.length, 1);
  assert.equal(serializePlantGraph(coordinator.getDocumentSnapshot().plants.get("plant-1")!), intact);
  assert.equal(coordinator.getDocumentSnapshot().plants.get("plant-1")!.organs.get("plant-1:bloom-2-1")!.active, true);

  coordinator.beginPrune("cut", spec, { distance: 0.12 });
  coordinator.release("cut");
  const edited = coordinator.getDocumentSnapshot().plants.get("plant-1")!;
  assert.equal(edited.organs.get("plant-1:bloom-2-1")!.active, false);
  assert.equal(edited.organs.get("plant-1:bloom-2-2")!.active, false);
  assert.equal(edited.organs.get("plant-1:bloom-1-1")!.active, true);
  assert.equal(edited.organs.get("plant-1:bloom-3-2")!.active, true);
  assert.equal(edited.branches.get("plant-1:group-2")!.active, true);
  assert.equal(edited.branches.get("plant-1:stalk-2-1")!.active, false);
  assert.equal(edited.organs.size, seated.organs.size);
  assert.equal(edited.branches.size, seated.branches.size);
  assert.equal(saves.length, 2);
  assert.deepEqual(validatePlantGraph(edited), []);

  const payload = JSON.parse(JSON.stringify({
    storageVersion: 1,
    nextSuccessfulOrdinal: 2,
    plants: [...coordinator.getDocumentSnapshot().plants.values()].map(toCanonicalPlantGraph),
  }));
  const app = Object.assign(Object.create(IkebanaApp.prototype), {
    config: { fresh: false },
    store: { load: () => payload },
  });
  const loaded = app.loadInitialDocument();
  assert.equal(loaded.successfulPlantOrdinal, 1);
  const reloaded = [...loaded.plants.values()][0]!;
  assert.equal(reloaded.generatorVersion, BLOSSOM_SPRAY_V2_VERSION);
  assert.equal(reloaded.organs.get("plant-1:bloom-2-1")!.active, false);
  assert.equal(reloaded.organs.get("plant-1:bloom-1-1")!.active, true);
  assert.equal(reloaded.branches.get("plant-1:group-1")!.active, true);
});

test("Garden backup keeps the spray beside both references, and a copy can lose one group", () => {
  const garden = parseGarden(JSON.stringify(gardenBackup));
  assert.equal(garden.entries.length, 2);
  const intact = garden.entries[0]!;
  const edited = garden.entries[1]!;
  assert.equal(intact.title, "Spray beside flowering branch and flower volume");
  assert.equal(intact.arrangement.successfulPlantOrdinal, 3);
  assert.deepEqual(intact.arrangement.camera, canonicalCameraPose("front"));
  assert.deepEqual(intact.arrangement.plants.map((plant) => plant.generatorVersion), [
    "blossom-spray-v1", "one-branch-v1", "flower-volume-v1",
  ]);
  assert.deepEqual(intact.arrangement.plants[0], JSON.parse(serializePlantGraph(createBlossomSpray("plant-1", 8278, BASE))));
  assert.deepEqual(intact.arrangement.plants[1], JSON.parse(serializePlantGraph(createFloweringBranch("plant-2", 9255, BASE))));
  assert.deepEqual(intact.arrangement.plants[2], JSON.parse(serializePlantGraph(createFlowerVolume("plant-3", 10232, BASE))));
  assert.equal(edited.arrangement.plants[0]!.organs.find((organ) => organ.id === "plant-1:bloom-2-1")!.active, false);
  assert.equal(edited.arrangement.plants[0]!.organs.find((organ) => organ.id === "plant-1:bloom-2-2")!.active, false);
  assert.equal(edited.arrangement.plants[0]!.branches.find((branch) => branch.id === "plant-1:group-2")!.active, true);
  assert.equal(edited.arrangement.plants[0]!.organs.find((organ) => organ.id === "plant-1:bloom-1-1")!.active, true);
  assert.equal(edited.arrangement.plants[0]!.organs.find((organ) => organ.id === "plant-1:bloom-3-2")!.active, true);
  assert.deepEqual(edited.arrangement.plants[1], intact.arrangement.plants[1]);
  assert.deepEqual(edited.arrangement.plants[2], intact.arrangement.plants[2]);

  const values = new Map<string, string>();
  const store = new GardenStore(GARDEN_KEY, {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => { values.set(key, value); },
  });
  store.load();
  store.keep(intact);
  const copy = structuredClone(store.load().entries[0]!.arrangement);
  copy.plants[0] = edited.arrangement.plants[0]!;
  assert.deepEqual(store.load().entries[0]!.arrangement, intact.arrangement);
  assert.notDeepEqual(copy.plants[0], store.load().entries[0]!.arrangement.plants[0]);
});
