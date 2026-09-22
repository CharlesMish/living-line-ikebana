import assert from "node:assert/strict";
import test from "node:test";
import { createFloweringBranch, createLeafyShoot, LEAFY_SHOOT_VERSION, getMaterialDefinitions, type MaterialDefinition } from "../../src/core/index.ts";
import {
  createWorkbenchFixture,
  describeFixture,
  describeMaterialSequenceComposition,
  getLastWorkbenchFixtureLoad,
  listWorkbenchFixtureOptions,
  MIXED_FIXTURE_ALIAS,
  planWorkbenchCuttings,
  resolveWorkbenchFixture,
  WORKBENCH_FIXTURE_PROFILES,
  WORKBENCH_SEEDS,
} from "../../src/app/workbench.ts";

const extraMaterial: MaterialDefinition = Object.freeze({
  materialId: "unrelated-candidate",
  generator: Object.freeze({ generatorVersion: LEAFY_SHOOT_VERSION, generate: createLeafyShoot }),
});

function twoMaterialCatalog(): MaterialDefinition[] {
  return getMaterialDefinitions().filter((material) =>
    material.materialId === "flowering-branch" || material.materialId === "leafy-shoot");
}

function extendedCatalog(): MaterialDefinition[] {
  return [...getMaterialDefinitions(), extraMaterial];
}

test("named fixture profiles keep explicit ordered material lists", () => {
  const byId = Object.fromEntries(WORKBENCH_FIXTURE_PROFILES.map((profile) => [profile.id, profile]));
  assert.deepEqual(byId["reference-pair"]?.materialIds, ["flowering-branch", "leafy-shoot"]);
  assert.deepEqual(byId["references-plus-bare"]?.materialIds, ["flowering-branch", "leafy-shoot", "bare-branch"]);
  assert.deepEqual(byId["references-plus-single-flower"]?.materialIds, ["flowering-branch", "leafy-shoot", "single-flower"]);
  assert.deepEqual(byId["all-four"]?.materialIds, [
    "flowering-branch", "leafy-shoot", "bare-branch", "single-flower",
  ]);
  assert.equal(byId["all-registered-materials"]?.materialIds, "catalog");
  assert.equal(byId["all-registered-materials"]?.kind, "dynamic");
  assert.equal(resolveWorkbenchFixture(MIXED_FIXTURE_ALIAS).profileId, "reference-pair");
});

test("reference-pair graphs match current mixed alias and ignore extra catalog materials", () => {
  for (const seed of WORKBENCH_SEEDS) for (const count of [1, 2, 6, 12] as const) {
    const baseline = createWorkbenchFixture("reference-pair", seed, count, { catalog: getMaterialDefinitions(), remember: false });
    const mixed = createWorkbenchFixture("mixed", seed, count, { catalog: getMaterialDefinitions(), remember: false });
    const withExtra = createWorkbenchFixture("reference-pair", seed, count, { catalog: extendedCatalog(), remember: false });
    assert.deepEqual(mixed, baseline);
    assert.deepEqual(withExtra, baseline);
    assert.equal(baseline.plants.length, count);
    assert.equal(baseline.successfulPlantOrdinal, count);
  }
  const six = createWorkbenchFixture("reference-pair", 8278, 6, { remember: false });
  const described = describeFixture(six);
  assert.deepEqual(described.plantsInIdentityOrder.map((plant) => plant.generatorVersion), [
    "one-branch-v1", "leafy-shoot-v1", "one-branch-v1", "leafy-shoot-v1", "one-branch-v1", "leafy-shoot-v1",
  ]);
  assert.deepEqual(described.byGeneratorVersion, { "one-branch-v1": 3, "leafy-shoot-v1": 3 });
});

test("adding an unrelated registered material cannot change reference-pair graphs", () => {
  const catalog = extendedCatalog();
  const pair = createWorkbenchFixture("reference-pair", 8278, 6, { catalog, remember: false });
  const dynamic = createWorkbenchFixture("all-registered-materials", 8278, 6, { catalog, remember: false });
  const liveCatalogDynamic = createWorkbenchFixture("all-registered-materials", 8278, 6, { remember: false });
  const allFour = createWorkbenchFixture("all-four", 8278, 6, { remember: false });
  assert.notDeepEqual(dynamic, pair);
  assert.notDeepEqual(liveCatalogDynamic, pair);
  assert.notDeepEqual(liveCatalogDynamic, allFour);
  assert.deepEqual(describeFixture(allFour).plantsInIdentityOrder.map((plant) => plant.generatorVersion), [
    "one-branch-v1", "leafy-shoot-v1", "bare-branch-v1", "single-flower-v1", "one-branch-v1", "leafy-shoot-v1",
  ]);
  assert.deepEqual(describeFixture(liveCatalogDynamic).plantsInIdentityOrder.map((plant) => plant.generatorVersion), [
    "one-branch-v1", "leafy-shoot-v1", "bare-branch-v1", "single-flower-v1", "reed-v1", "one-branch-v1",
  ]);
  assert.deepEqual(describeFixture(dynamic).plantsInIdentityOrder.map((plant) => plant.id), [
    "plant-1", "plant-2", "plant-3", "plant-4", "plant-5", "plant-6",
  ]);
  assert.equal(describeFixture(pair).plantsInIdentityOrder[2]?.generatorVersion, "one-branch-v1");
  assert.equal(describeFixture(dynamic).plantsInIdentityOrder[2]?.generatorVersion, "bare-branch-v1");
  assert.equal(describeFixture(dynamic).plantsInIdentityOrder[4]?.generatorVersion, "reed-v1");
  const pairSequence = planWorkbenchCuttings(["flowering-branch", "leafy-shoot"], 8278, 6);
  const dynamicSequence = planWorkbenchCuttings(
    catalog.map((material) => material.materialId),
    8278,
    6,
  );
  assert.equal(pairSequence[2]?.materialId, "flowering-branch");
  assert.equal(dynamicSequence[2]?.materialId, "bare-branch");
  assert.equal(dynamicSequence[4]?.materialId, "reed");
  assert.equal(dynamicSequence[5]?.materialId, "unrelated-candidate");
  assert.notEqual(pairSequence[4]?.materialId, dynamicSequence[4]?.materialId);
});

test("all-four six-cutting composition is 2+2+1+1, not two of each; twelve is three of each", () => {
  const sequence = ["flowering-branch", "leafy-shoot", "bare-branch", "single-flower"];
  const six = describeMaterialSequenceComposition(sequence, 6);
  assert.deepEqual(six.assignedMaterialIds, [
    "flowering-branch", "leafy-shoot", "bare-branch", "single-flower", "flowering-branch", "leafy-shoot",
  ]);
  assert.deepEqual(six.countsByMaterialId, {
    "flowering-branch": 2, "leafy-shoot": 2, "bare-branch": 1, "single-flower": 1,
  });
  assert.equal(six.balancedEqualCopies, false);
  assert.match(six.warnings.join(" "), /not two of each/);
  const twelve = describeMaterialSequenceComposition(sequence, 12);
  assert.deepEqual(twelve.countsByMaterialId, {
    "flowering-branch": 3, "leafy-shoot": 3, "bare-branch": 3, "single-flower": 3,
  });
  assert.equal(twelve.balancedEqualCopies, true);
});

test("candidate profiles stay listed and disabled until their materials are in the catalog overlay", () => {
  const catalog = twoMaterialCatalog();
  for (const id of ["references-plus-bare", "references-plus-single-flower", "all-four"] as const) {
    const resolved = resolveWorkbenchFixture(id, catalog);
    assert.ok(resolved.missingMaterialIds.length > 0, `${id} should be gated without candidates`);
    assert.throws(
      () => createWorkbenchFixture(id, 8278, 6, { catalog, remember: false }),
      /requires unregistered material/,
    );
  }
  const options = listWorkbenchFixtureOptions(catalog);
  assert.deepEqual(options.filter((option) => option.kind === "single-material").map((option) => option.id), [
    "flowering-branch", "leafy-shoot",
  ]);
  const plusBare = options.find((option) => option.id === "references-plus-bare");
  assert.equal(plusBare?.available, false);
  assert.deepEqual(plusBare?.missingMaterialIds, ["bare-branch"]);
  const plusFlower = options.find((option) => option.id === "references-plus-single-flower");
  assert.equal(plusFlower?.available, false);
  assert.deepEqual(plusFlower?.missingMaterialIds, ["single-flower"]);
  const allFour = options.find((option) => option.id === "all-four");
  assert.equal(allFour?.available, false);
  assert.deepEqual(allFour?.missingMaterialIds, ["bare-branch", "single-flower"]);
});

test("this integration catalog makes named candidate profiles available to the picker", () => {
  const options = listWorkbenchFixtureOptions();
  assert.deepEqual(options.map((option) => option.id), [
    "flowering-branch", "leafy-shoot", "bare-branch", "single-flower", "reed",
    "reference-pair", "references-plus-bare", "references-plus-single-flower", "all-four", "all-registered-materials",
  ]);
  assert.equal(options.some((option) => option.id === "mixed"), false);
  assert.ok(options.every((option) => option.available));
  for (const id of ["references-plus-bare", "references-plus-single-flower", "all-four"] as const) {
    assert.deepEqual(resolveWorkbenchFixture(id).missingMaterialIds, []);
  }
});

test("candidate profiles construct with registered materials; stubs do not rewrite reference-pair", () => {
  const stub = (materialId: string): MaterialDefinition => ({
    materialId,
    generator: { generatorVersion: "one-branch-v1", generate: createFloweringBranch },
  });
  const catalog = [...twoMaterialCatalog(), stub("bare-branch"), stub("single-flower")];
  const plusBare = createWorkbenchFixture("references-plus-bare", 8278, 6, { catalog });
  assert.deepEqual(getLastWorkbenchFixtureLoad()?.construction.map((cutting) => cutting.materialId), [
    "flowering-branch", "leafy-shoot", "bare-branch", "flowering-branch", "leafy-shoot", "bare-branch",
  ]);
  const plusFlower = createWorkbenchFixture("references-plus-single-flower", 8278, 6, { catalog });
  assert.deepEqual(getLastWorkbenchFixtureLoad()?.construction.map((cutting) => cutting.materialId), [
    "flowering-branch", "leafy-shoot", "single-flower", "flowering-branch", "leafy-shoot", "single-flower",
  ]);
  const allFour = createWorkbenchFixture("all-four", 8278, 6, { catalog });
  const allFourLoad = getLastWorkbenchFixtureLoad();
  assert.deepEqual(allFourLoad?.construction.map((cutting) => cutting.materialId), [
    "flowering-branch", "leafy-shoot", "bare-branch", "single-flower", "flowering-branch", "leafy-shoot",
  ]);
  assert.equal(allFourLoad?.composition.balancedEqualCopies, false);
  const allFourTwelve = createWorkbenchFixture("all-four", 8278, 12, { catalog });
  assert.equal(getLastWorkbenchFixtureLoad()?.composition.balancedEqualCopies, true);
  assert.deepEqual(getLastWorkbenchFixtureLoad()?.composition.countsByMaterialId, {
    "flowering-branch": 3, "leafy-shoot": 3, "bare-branch": 3, "single-flower": 3,
  });
  const pair = createWorkbenchFixture("reference-pair", 8278, 6, { catalog, remember: false });
  assert.deepEqual(pair, createWorkbenchFixture("reference-pair", 8278, 6, { remember: false }));
  const pairPlant = (id: string) => pair.plants.find((plant) => plant.id === id);
  const allFourPlant = (id: string) => allFour.plants.find((plant) => plant.id === id);
  assert.deepEqual(allFourPlant("plant-1"), pairPlant("plant-1"));
  assert.deepEqual(allFourPlant("plant-2"), pairPlant("plant-2"));
  assert.notDeepEqual(allFourPlant("plant-4"), pairPlant("plant-4"));
  assert.equal(plusBare.plants.length, 6);
  assert.equal(plusFlower.plants.length, 6);
  assert.equal(allFourTwelve.plants.length, 12);

  const liveAllFour = createWorkbenchFixture("all-four", 8278, 6, { remember: false });
  assert.deepEqual(describeFixture(liveAllFour).plantsInIdentityOrder.map((plant) => plant.generatorVersion), [
    "one-branch-v1", "leafy-shoot-v1", "bare-branch-v1", "single-flower-v1", "one-branch-v1", "leafy-shoot-v1",
  ]);
});

test("single-material fixtures stay registered-only and remember explicit construction", () => {
  const flowering = createWorkbenchFixture("flowering-branch", 8278, 12);
  assert.equal(getLastWorkbenchFixtureLoad()?.profileId, "flowering-branch");
  assert.equal(getLastWorkbenchFixtureLoad()?.count, 12);
  assert.deepEqual(getLastWorkbenchFixtureLoad()?.materialSequence, ["flowering-branch"]);
  assert.equal(describeFixture(flowering).plants.every((plant) => plant.generatorVersion === "one-branch-v1"), true);
  const single = createWorkbenchFixture("single-flower", 8278, 12, { remember: false });
  assert.equal(describeFixture(single).plants.every((plant) => plant.generatorVersion === "single-flower-v1"), true);
  const bare = createWorkbenchFixture("bare-branch", 8278, 1, { remember: false });
  assert.equal(bare.plants[0]?.generatorVersion, "bare-branch-v1");
  assert.throws(() => createWorkbenchFixture("unknown-material", 8278, 1, { remember: false }), /Unknown fixture/);
});
