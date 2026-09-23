import assert from "node:assert/strict";
import test from "node:test";
import fixture from "../../fixtures/plant-1-berry-twig-v1.json";
import floweringFixture from "../../fixtures/plant-1-one-branch-v1.json";
import leafyFixture from "../../fixtures/plant-2-leafy-shoot-v1.json";
import { canonicalCameraPose } from "../../src/app/camera.ts";
import { createDomainAdapters } from "../../src/app/domainAdapters.ts";
import { GARDEN_KEY, GardenStore, parseGarden } from "../../src/app/garden.ts";
import { prepareMaterialInsertionForApp } from "../../src/app/materialInsertion.ts";
import { createWorkbenchFixture, describeFixture } from "../../src/app/workbench.ts";
import { cutCue } from "../../src/app/craftCues.ts";
import { IkebanaApp } from "../../src/app/IkebanaApp.ts";
import {
  BERRY_TWIG_VERSION,
  aimBranch,
  applyPrune,
  bendBranch,
  createBareBranch,
  createBerryTwig,
  createBlossomSpray,
  createFlowerVolume,
  createFloweringBranch,
  createLeafyShoot,
  deserializePlantGraph,
  distance,
  getMaterialDefinition,
  legalBendStation,
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
import { BERRY_TWIG_RESPONSE, BARE_RESPONSE, FLOWERING_RESPONSE } from "../../src/core/materialResponse.ts";
import { getMaterialAppearance } from "../../src/presentation/materialAppearance.ts";
import { TransactionCoordinator } from "../../src/input/index.ts";

const BASE = { x: 0, y: 0.55, z: 0 };
const SEEDS = [8278, 9255, 10232] as const;

function fnv1a(text: string) {
  let hash = 0x811c9dc5;
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}

function canonicalHash(graph: PlantGraph) {
  return fnv1a(JSON.stringify(toCanonicalPlantGraph(graph)));
}

function clustersOf(graph: PlantGraph) {
  return [...graph.branches.values()].filter((branch) => branch.kind === "lateral").sort((a, b) => a.id.localeCompare(b.id));
}

function berriesOf(graph: PlantGraph, clusterId?: string) {
  return [...graph.organs.values()].filter((organ) => {
    if (organ.kind !== "berry") return false;
    if (!clusterId) return true;
    const stem = graph.branches.get(organ.branchId);
    return stem?.parentId === clusterId;
  });
}

function berryPositions(graph: PlantGraph, organs = berriesOf(graph)) {
  return organs
    .map((organ) => organPosition(graph, organ.id))
    .filter((position): position is NonNullable<typeof position> => position !== null);
}

function nearestGap(positions: readonly { x: number; y: number; z: number }[]) {
  let min = Infinity;
  for (let i = 0; i < positions.length; i += 1) {
    for (let j = i + 1; j < positions.length; j += 1) min = Math.min(min, distance(positions[i]!, positions[j]!));
  }
  return min;
}

function centroid(positions: readonly { x: number; y: number; z: number }[]) {
  const sum = positions.reduce((acc, position) => add(acc, position), vec3(0, 0, 0));
  return { x: sum.x / positions.length, y: sum.y / positions.length, z: sum.z / positions.length };
}

test("berry-twig catalog entry is additive and leaves frozen profiles and goldens unchanged", () => {
  const material = getMaterialDefinition("berry-twig");
  assert.ok(material);
  assert.equal(material.materialId, "berry-twig");
  assert.equal(material.generator.generatorVersion, BERRY_TWIG_VERSION);
  assert.equal(material.generator.generate, createBerryTwig);

  const flowering = toCanonicalPlantGraph(createFloweringBranch("plant-1", 8278, BASE));
  assert.equal(flowering.branches.length, floweringFixture.branches.length);
  assert.equal(flowering.organs.length, floweringFixture.organs.length);
  assert.deepEqual(flowering.organs, floweringFixture.organs);
  const leafy = createLeafyShoot("plant-2", 9255, BASE);
  assert.deepEqual(JSON.parse(serializePlantGraph(leafy)), leafyFixture);

  const pair = describeFixture(createWorkbenchFixture("reference-pair", 8278, 6, { remember: false }));
  const mixed = describeFixture(createWorkbenchFixture("mixed", 8278, 6, { remember: false }));
  assert.deepEqual(mixed.plantsInIdentityOrder, pair.plantsInIdentityOrder);
  const round4 = describeFixture(createWorkbenchFixture("round4-palette", 8278, 12, { remember: false }));
  assert.equal(round4.plantsInIdentityOrder.some((plant) => plant.generatorVersion === BERRY_TWIG_VERSION), false);
  const candidates = describeFixture(createWorkbenchFixture("round4-candidates", 8278, 6, { remember: false }));
  assert.deepEqual(candidates.plantsInIdentityOrder.map((plant) => plant.generatorVersion), [
    "foliage-fan-v1", "blossom-spray-v1", "nodding-flower-v1",
    "foliage-fan-v1", "blossom-spray-v1", "nodding-flower-v1",
  ]);

  const compared = createWorkbenchFixture("references-plus-berry-twig", 8278, 6, { remember: false });
  assert.deepEqual(compared.plants.map((plant) => plant.generatorVersion), [
    "one-branch-v1", "leafy-shoot-v1", BERRY_TWIG_VERSION,
    "one-branch-v1", "leafy-shoot-v1", BERRY_TWIG_VERSION,
  ]);
  const pairSnapshot = createWorkbenchFixture("reference-pair", 8278, 6, { remember: false });
  assert.deepEqual(
    compared.plants.find((plant) => plant.id === "plant-1"),
    pairSnapshot.plants.find((plant) => plant.id === "plant-1"),
  );
  assert.deepEqual(
    compared.plants.find((plant) => plant.id === "plant-2"),
    pairSnapshot.plants.find((plant) => plant.id === "plant-2"),
  );
});

test("berry-twig-v1 puts small berry clusters on a woody line and freezes the seed samples", () => {
  const hashes: Record<number, string> = {};
  for (const seed of SEEDS) {
    const first = createBerryTwig("plant-1", seed, BASE);
    const second = createBerryTwig("plant-1", seed, BASE);
    assert.equal(serializePlantGraph(first), serializePlantGraph(second));
    assert.deepEqual(validatePlantGraph(first), []);
    assert.equal(first.generatorVersion, BERRY_TWIG_VERSION);
    hashes[seed] = canonicalHash(first);
    const wood = first.branches.get(first.rootBranchId)!;
    assert.equal(wood.kind, "trunk");
    assert.equal(wood.label, "woody twig");
    assert.equal(wood.points.length, 17);
    assert.equal(wood.radius, 0.052);
    assert.equal(wood.stiffness, BERRY_TWIG_RESPONSE.wood);
    assert.ok(wood.stiffness > FLOWERING_RESPONSE.trunk);
    assert.ok(wood.stiffness < BARE_RESPONSE.trunk);
    const bare = createBareBranch("plant-1", seed, BASE);
    assert.ok(wood.radius < bare.branches.get(bare.rootBranchId)!.radius);
    assert.ok(wood.radius > createBlossomSpray("plant-1", seed, BASE).branches.get("plant-1:stem")!.radius * 1.5);

    const clusters = clustersOf(first);
    const berries = berriesOf(first);
    const stems = [...first.branches.values()].filter((branch) => branch.kind === "pedicel");
    assert.ok(clusters.length >= 2 && clusters.length <= 3, `${seed} clusters ${clusters.length}`);
    assert.equal(stems.length, berries.length);
    assert.equal([...first.organs.values()].every((organ) => organ.kind === "berry"), true);
    assert.ok(berries.length >= 6 && berries.length <= 10, `${seed} berries ${berries.length}`);
    const stations = clusters.map((cluster) => cluster.parentDistance).sort((a, b) => a - b);
    assert.ok(stations[0]! > 1, "the basal wood stays clear for seating");
    for (let index = 1; index < stations.length; index += 1) {
      assert.ok(stations[index]! - stations[index - 1]! > 0.8, "clusters leave a gap along the wood");
    }
    const centroids = [];
    for (const cluster of clusters) {
      assert.equal(cluster.parentId, wood.id);
      assert.equal(cluster.label, "berry cluster");
      assert.equal(cluster.stiffness, BERRY_TWIG_RESPONSE.cluster);
      assert.ok(legalBendStation(cluster) !== null, "a cluster lateral is a bendable line");
      const group = berriesOf(first, cluster.id);
      assert.ok(group.length >= 3 && group.length <= 4);
      const positions = berryPositions(first, group);
      const center = centroid(positions);
      centroids.push(center);
      const cloud = Math.max(...positions.map((position) => distance(position, center)));
      assert.ok(cloud < 0.62, `${cluster.id} cloud ${cloud} must stay a cluster, not a flower head`);
      for (const berry of group) {
        const stem = first.branches.get(berry.branchId)!;
        assert.equal(stem.kind, "pedicel");
        assert.equal(stem.label, "berry stem");
        assert.equal(stem.parentId, cluster.id);
        assert.equal(stem.stiffness, BERRY_TWIG_RESPONSE.stem);
        assert.equal(legalBendStation(stem), null, "a berry stem is not a bend handle");
        assert.equal(berry.distance, stem.activeLength);
        assert.ok(stem.activeLength > 0.17 && stem.activeLength < 0.26);
        assert.ok(berry.scale >= 0.9 && berry.scale <= 1.06);
      }
      assert.ok(nearestGap(positions) > 0.12, "berries in one cluster stay individually pickable");
    }
    for (let index = 1; index < centroids.length; index += 1) {
      assert.ok(distance(centroids[index - 1]!, centroids[index]!) > 1, "cluster centers stay apart");
    }
    const all = berryPositions(first);
    const ys = all.map((position) => position.y);
    const ySpan = Math.max(...ys) - Math.min(...ys);
    const volume = berryPositions(createFlowerVolume("plant-1", seed, BASE));
    const volumeYs = volume.map((position) => position.y);
    const volumeSpan = Math.max(...volumeYs) - Math.min(...volumeYs);
    assert.ok(ySpan > volumeSpan * 2.5, `berry line ${ySpan} must not collapse into a flower-volume head ${volumeSpan}`);
    assert.equal(first.branches.size < createFloweringBranch("plant-1", seed, BASE).branches.size, true);
  }

  assert.deepEqual(hashes, { 8278: "cbc40796", 9255: "89732d86", 10232: "a33184af" });

  const prepared = prepareMaterialInsertion("berry-twig", 1, BASE);
  assert.equal(prepared.ok, true);
  if (!prepared.ok) return;
  assert.equal(prepared.seed, 8278);
  assert.equal(prepared.plantId, "plant-1");
  assert.deepEqual(JSON.parse(serializePlantGraph(prepared.graph)), fixture);
  assert.equal("materialId" in prepared.graph, false);
  assert.doesNotMatch(serializePlantGraph(prepared.graph), /"materialId"/);
  const appearance = getMaterialAppearance(BERRY_TWIG_VERSION);
  assert.equal(appearance.branchColors.trunk, 0x6a4532);
  assert.equal(appearance.berry?.color, 0x8a2e45);
  assert.equal(appearance.berry?.radius, 0.07);
  assert.notEqual(appearance.bloom.form, "tufted");
  assert.equal(appearance.bloom, getMaterialAppearance("one-branch-v1").bloom);
  assert.notEqual(appearance.branchColors.trunk, getMaterialAppearance("bare-branch-v1").branchColors.trunk);
  assert.notEqual(appearance.branchColors.trunk, getMaterialAppearance("blossom-spray-v1").branchColors.trunk);

  for (const ordinal of [2, 3, 17, 64]) {
    const seated = prepareMaterialInsertion("berry-twig", ordinal, BASE);
    assert.equal(seated.ok, true);
    if (!seated.ok) return;
    assert.deepEqual(validatePlantGraph(seated.graph), []);
    assert.equal(seated.graph.generatorVersion, BERRY_TWIG_VERSION);
    assert.equal(seated.graph.id, `plant-${ordinal}`);
    assert.equal(seated.seed, (7301 + ordinal * 977) >>> 0);
  }

  let sawTwo = false;
  let sawThree = false;
  for (let seed = 0; seed < 400; seed += 1) {
    const graph = createBerryTwig("scan", seed, BASE);
    assert.deepEqual(validatePlantGraph(graph), []);
    const clusters = clustersOf(graph);
    const berries = berriesOf(graph);
    if (clusters.length === 2) sawTwo = true;
    if (clusters.length === 3) sawThree = true;
    assert.ok(clusters.length === 2 || clusters.length === 3);
    assert.ok(berries.length >= 6 && berries.length <= 10);
    assert.equal([...graph.organs.values()].every((organ) => organ.kind === "berry"), true);
  }
  assert.equal(sawTwo && sawThree, true);
});

test("seed variation changes the twig without rerolling during aim or bend", () => {
  const graphs = SEEDS.map((seed) => serializePlantGraph(createBerryTwig("plant-1", seed, BASE)));
  assert.notEqual(graphs[0], graphs[1]);
  assert.notEqual(graphs[1], graphs[2]);
  const graph = createBerryTwig("plant-1", 8278, BASE);
  const before = serializePlantGraph(graph);
  const wood = graph.branches.get(graph.rootBranchId)!;
  const cluster = graph.branches.get("plant-1:cluster-1")!;
  const station = cluster.activeLength * 0.54;
  const bent = bendBranch(graph, {
    branchId: cluster.id,
    stationDistance: station,
    target: add(sampleBranch(cluster, station).position, vec3(0.7, 0.3, -0.35)),
  });
  assert.deepEqual(validatePlantGraph(bent), []);
  assert.notDeepEqual(bent.branches.get(cluster.id)!.points, cluster.points);
  for (const branch of graph.branches.values()) {
    assert.deepEqual(bent.branches.get(branch.id)!.restLengths, branch.restLengths);
    assert.equal(bent.branches.get(branch.id)!.stiffness, branch.stiffness);
  }
  assert.deepEqual(bent.branches.get(wood.id)!.points, wood.points);
  assert.deepEqual(bent.branches.get("plant-1:cluster-2")!.points, graph.branches.get("plant-1:cluster-2")!.points);
  for (const organ of graph.organs.values()) {
    assert.equal(bent.organs.get(organ.id)!.spin, organ.spin);
    assert.equal(bent.organs.get(organ.id)!.scale, organ.scale);
    assert.equal(bent.organs.get(organ.id)!.kind, "berry");
    assert.equal(bent.organs.get(organ.id)!.active, true);
  }

  const stem = graph.branches.get("plant-1:stem-1-1")!;
  const grabbed = sampleBranch(stem, stem.activeLength * 0.62);
  const aimed = aimBranch(graph, stem.id, grabbed.position, add(grabbed.position, vec3(0.3, 0.15, -0.2)));
  assert.deepEqual(validatePlantGraph(aimed), []);
  assert.notDeepEqual(aimed.branches.get(stem.id)!.points, stem.points);
  assert.deepEqual(aimed.branches.get(cluster.id)!.points, cluster.points);
  assert.deepEqual(aimed.branches.get(wood.id)!.points, wood.points);
  assert.notDeepEqual(organPosition(aimed, "plant-1:berry-1-1"), organPosition(graph, "plant-1:berry-1-1"));
  assert.deepEqual(organPosition(aimed, "plant-1:berry-1-2"), organPosition(graph, "plant-1:berry-1-2"));
  assert.equal(serializePlantGraph(graph), before);

  const woodStation = wood.activeLength * 0.54;
  const woodBent = bendBranch(graph, {
    branchId: wood.id,
    stationDistance: woodStation,
    target: add(sampleBranch(wood, woodStation).position, vec3(0.9, -0.2, 0.4)),
  });
  assert.deepEqual(validatePlantGraph(woodBent), []);
  for (const branch of graph.branches.values()) {
    assert.deepEqual(woodBent.branches.get(branch.id)!.restLengths, branch.restLengths);
  }
  assert.equal(serializePlantGraph(deserializePlantGraph(serializePlantGraph(woodBent))), serializePlantGraph(woodBent));
});

test("cutting one berry stem removes that berry; cutting its lateral removes the cluster", () => {
  const graph = createBerryTwig("plant-1", 8278, BASE);
  const before = serializePlantGraph(graph);
  const clusters = clustersOf(graph);
  assert.ok(clusters.length >= 2);
  const opened = clusters.length === 3 ? graph.branches.get("plant-1:cluster-2")! : clusters[0]!;
  const kept = clusters.find((cluster) => cluster.id !== opened.id)!;
  const openedBerries = berriesOf(graph, opened.id).sort((a, b) => a.id.localeCompare(b.id));
  const one = openedBerries[0]!;
  const stem = graph.branches.get(one.branchId)!;
  const onePlan = previewPrune(graph, stem.id, one.distance);
  assert.equal(serializePlantGraph(graph), before, "preview must not mutate");
  assert.deepEqual(onePlan.removedBranchIds, []);
  assert.deepEqual(onePlan.removedOrganIds, [one.id]);
  const oneCue = cutCue(graph, onePlan, true);
  assert.equal(oneCue.title, "Cut berry stem");
  assert.match(oneCue.detail, /1 berry/);
  const plucked = applyPrune(graph, onePlan);
  assert.equal(serializePlantGraph(graph), before);
  assert.equal(plucked.organs.get(one.id)!.active, false);
  assert.equal(plucked.organs.get(one.id)!.spin, one.spin);
  assert.equal(plucked.branches.get(stem.id)!.active, true);
  assert.ok(plucked.branches.get(stem.id)!.activeLength < stem.activeLength);
  for (const berry of openedBerries.slice(1)) assert.equal(plucked.organs.get(berry.id)!.active, true);
  assert.deepEqual(plucked.branches.get(opened.id)!.points, opened.points);
  assert.equal(plucked.branches.size, graph.branches.size);
  assert.equal(plucked.organs.size, graph.organs.size);

  const groupPlan = previewPrune(graph, opened.id, 0.12);
  assert.deepEqual(
    groupPlan.removedBranchIds,
    [...graph.branches.values()].filter((branch) => branch.parentId === opened.id).map((branch) => branch.id).sort(),
  );
  assert.deepEqual(groupPlan.removedOrganIds, openedBerries.map((berry) => berry.id).sort());
  const groupCue = cutCue(graph, groupPlan, false);
  assert.equal(groupCue.title, "Cut branch");
  assert.match(groupCue.detail, /berries/);
  assert.match(groupCue.detail, /attached stems/);
  const removed = applyPrune(graph, groupPlan);
  assert.equal(removed.branches.get(opened.id)!.active, true);
  assert.ok(removed.branches.get(opened.id)!.activeLength < 0.2);
  assert.equal(removed.branches.get(kept.id)!.active, true);
  assert.deepEqual(removed.branches.get(kept.id)!.points, kept.points);
  assert.deepEqual(removed.branches.get(graph.rootBranchId)!.points, graph.branches.get(graph.rootBranchId)!.points);
  for (const id of groupPlan.removedBranchIds) assert.equal(removed.branches.get(id)!.active, false);
  for (const berry of openedBerries) assert.equal(removed.organs.get(berry.id)!.active, false);
  for (const berry of berriesOf(graph, kept.id)) assert.deepEqual(removed.organs.get(berry.id), graph.organs.get(berry.id));
  assert.ok([...removed.organs.values()].filter((organ) => organ.active).length >= 3);
  assert.deepEqual(validatePlantGraph(removed), []);
  const flowering = createFloweringBranch("plant-1", 8278, BASE);
  const floweringPedicel = [...flowering.branches.values()].find((branch) => branch.kind === "pedicel")!;
  const floweringOrgan = [...flowering.organs.values()].find((organ) => organ.branchId === floweringPedicel.id)!;
  const floweringCue = cutCue(flowering, previewPrune(flowering, floweringPedicel.id, floweringOrgan.distance), true);
  assert.equal(floweringCue.title, "Cut flower stem");
  assert.doesNotMatch(floweringCue.detail, /berry/);

  for (const seed of SEEDS) {
    const specimen = createBerryTwig("plant-1", seed, BASE);
    const lateral = clustersOf(specimen)[0]!;
    const stems = [...specimen.branches.values()].filter((branch) => branch.parentId === lateral.id);
    const berry = berriesOf(specimen, lateral.id)[0]!;
    const single = previewPrune(specimen, berry.branchId, berry.distance);
    assert.deepEqual(single.removedOrganIds, [berry.id]);
    assert.equal(single.removedBranchIds.length, 0);
    const whole = previewPrune(specimen, lateral.id, 0.12);
    assert.equal(whole.removedOrganIds.length, stems.length);
    assert.deepEqual(whole.removedBranchIds, stems.map((stem) => stem.id).sort());
  }
});

test("cancelled berry-twig insertion and prune write nothing; a committed cluster cut reloads", () => {
  const saves: unknown[] = [];
  const coordinator = new TransactionCoordinator(createDomainAdapters(), {
    plants: new Map(),
    camera: canonicalCameraPose("front"),
    selectedPlantId: null,
    successfulPlantOrdinal: 0,
  }, { onAutosave: (event) => saves.push(event) });

  const prepared = prepareMaterialInsertionForApp("berry-twig", 0);
  assert.equal(prepared.ok, true);
  if (!prepared.ok) return;
  const reservation = {
    ordinal: prepared.ordinal,
    plantId: prepared.plantId,
    seed: prepared.seed,
    graph: prepared.graph,
  };
  coordinator.beginInsert("berry-cancel", reservation, {}, { base: BASE, valid: true });
  coordinator.pointerCancel("berry-cancel");
  assert.equal(coordinator.getDebugState().successfulPlantOrdinal, 0);
  assert.equal(coordinator.getDocumentSnapshot().plants.size, 0);
  assert.equal(saves.length, 0);

  coordinator.beginInsert("berry", reservation, {}, { base: BASE, valid: true });
  coordinator.release("berry");
  assert.equal(coordinator.getDebugState().successfulPlantOrdinal, 1);
  assert.equal(saves.length, 1);

  const seated = coordinator.getDocumentSnapshot().plants.get("plant-1")!;
  const intact = serializePlantGraph(seated);
  const opened = clustersOf(seated).length === 3 ? "plant-1:cluster-2" : "plant-1:cluster-1";
  const keptBerry = berriesOf(seated).find((berry) => seated.branches.get(berry.branchId)!.parentId !== opened)!;
  coordinator.commandTool("prune");
  const spec = {
    plantId: "plant-1",
    branchId: opened,
    acquiredMaterialDistance: 0.12,
    context: {},
  };
  coordinator.beginPrune("cut-cancel", spec, { distance: 0.12 });
  assert.equal(coordinator.getPresentationState().active?.kind, "prune");
  coordinator.pointerCancel("cut-cancel");
  assert.equal(coordinator.getPresentationState().active, null);
  assert.equal(saves.length, 1);
  assert.equal(serializePlantGraph(coordinator.getDocumentSnapshot().plants.get("plant-1")!), intact);

  coordinator.beginPrune("cut", spec, { distance: 0.12 });
  coordinator.release("cut");
  const edited = coordinator.getDocumentSnapshot().plants.get("plant-1")!;
  for (const berry of berriesOf(seated, opened)) assert.equal(edited.organs.get(berry.id)!.active, false);
  assert.equal(edited.organs.get(keptBerry.id)!.active, true);
  assert.equal(edited.branches.get(opened)!.active, true);
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
  assert.equal(reloaded.generatorVersion, BERRY_TWIG_VERSION);
  for (const berry of berriesOf(seated, opened)) assert.equal(reloaded.organs.get(berry.id)!.active, false);
  assert.equal(reloaded.organs.get(keptBerry.id)!.active, true);
  assert.equal(reloaded.branches.get("plant-1:cluster-1")!.active, true);
});

test("Garden keep leaves the berry-twig original intact when a copy loses one cluster", () => {
  const intactPlants = [
    toCanonicalPlantGraph(createBerryTwig("plant-1", 8278, BASE)),
    toCanonicalPlantGraph(createFloweringBranch("plant-2", 9255, BASE)),
    toCanonicalPlantGraph(createLeafyShoot("plant-3", 10232, BASE)),
  ];
  const editedPlant = structuredClone(intactPlants[0]!);
  const opened = editedPlant.branches.some((branch) => branch.id === "plant-1:cluster-2")
    ? "plant-1:cluster-2"
    : "plant-1:cluster-1";
  for (const branch of editedPlant.branches) {
    if (branch.parentId === opened) branch.active = false;
  }
  for (const organ of editedPlant.organs) {
    const stem = editedPlant.branches.find((branch) => branch.id === organ.branchId);
    if (stem?.parentId === opened) organ.active = false;
  }
  const camera = canonicalCameraPose("front");
  const document = {
    gardenVersion: 1 as const,
    entries: [
      {
        id: "berry-beside-refs",
        title: "Berry twig beside flowering branch and leafy shoot",
        keptAt: "2026-09-23T00:00:00.000Z",
        thumbnail: null,
        arrangement: { plants: intactPlants, successfulPlantOrdinal: 3, camera },
      },
      {
        id: "berry-cluster-removed",
        title: "Copy with one berry cluster removed",
        keptAt: "2026-09-23T00:05:00.000Z",
        thumbnail: null,
        arrangement: {
          plants: [editedPlant, intactPlants[1]!, intactPlants[2]!],
          successfulPlantOrdinal: 3,
          camera,
        },
      },
    ],
  };
  const garden = parseGarden(JSON.stringify(document));
  assert.equal(garden.entries.length, 2);
  assert.equal(garden.entries[0]!.arrangement.plants[0]!.generatorVersion, BERRY_TWIG_VERSION);
  assert.equal(garden.entries[1]!.arrangement.plants[0]!.organs.some((organ) => organ.active === false), true);
  assert.deepEqual(garden.entries[1]!.arrangement.plants[1], garden.entries[0]!.arrangement.plants[1]);
  const values = new Map<string, string>();
  const store = new GardenStore(GARDEN_KEY, {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => { values.set(key, value); },
  });
  store.load();
  store.keep(garden.entries[0]!);
  const copy = structuredClone(store.load().entries[0]!.arrangement);
  copy.plants[0] = garden.entries[1]!.arrangement.plants[0]!;
  assert.deepEqual(store.load().entries[0]!.arrangement, garden.entries[0]!.arrangement);
  assert.notDeepEqual(copy.plants[0], store.load().entries[0]!.arrangement.plants[0]);
});
