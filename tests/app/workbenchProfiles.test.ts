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
  assert.deepEqual(byId["references-plus-reed"]?.materialIds, ["flowering-branch", "leafy-shoot", "reed"]);
  assert.deepEqual(byId["references-plus-flower-volume"]?.materialIds, ["flowering-branch", "leafy-shoot", "flower-volume"]);
  assert.deepEqual(byId["references-plus-arching-trailer"]?.materialIds, ["flowering-branch", "leafy-shoot", "arching-trailer"]);
  assert.deepEqual(byId["round3-three"]?.materialIds, ["reed", "flower-volume", "arching-trailer"]);
  assert.deepEqual(byId["round3-palette"]?.materialIds, [
    "flowering-branch", "leafy-shoot", "bare-branch", "single-flower", "reed", "flower-volume", "arching-trailer",
  ]);
  assert.deepEqual(byId["references-plus-foliage-fan"]?.materialIds, ["flowering-branch", "leafy-shoot", "foliage-fan"]);
  assert.deepEqual(byId["references-plus-blossom-spray"]?.materialIds, ["flowering-branch", "leafy-shoot", "blossom-spray"]);
  assert.deepEqual(byId["blossom-compare"]?.materialIds, ["flowering-branch", "flower-volume", "blossom-spray"]);
  assert.deepEqual(byId["references-plus-nodding-flower"]?.materialIds, ["flowering-branch", "leafy-shoot", "nodding-flower"]);
  assert.deepEqual(byId["round4-candidates"]?.materialIds, ["foliage-fan", "blossom-spray", "nodding-flower"]);
  assert.deepEqual(byId["references-plus-fern-frond"]?.materialIds, ["flowering-branch", "leafy-shoot", "fern-frond"]);
  assert.deepEqual(byId["round4-palette"]?.materialIds, [
    "flowering-branch", "leafy-shoot", "bare-branch", "single-flower", "reed", "flower-volume", "arching-trailer",
    "foliage-fan", "blossom-spray", "nodding-flower",
  ]);
  assert.deepEqual(byId["references-plus-berry-twig"]?.materialIds, ["flowering-branch", "leafy-shoot", "berry-twig"]);
  assert.deepEqual(byId["round5-candidates"]?.materialIds, ["berry-twig", "fern-frond"]);
  assert.deepEqual(byId["round5-palette"]?.materialIds, [
    "flowering-branch", "leafy-shoot", "bare-branch", "single-flower", "reed", "flower-volume", "arching-trailer",
    "foliage-fan", "blossom-spray", "nodding-flower", "berry-twig", "fern-frond",
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
    "one-branch-v1", "leafy-shoot-v1", "bare-branch-v1", "single-flower-v1", "reed-v1", "flower-volume-v1",
  ]);
  assert.deepEqual(describeFixture(dynamic).plantsInIdentityOrder.map((plant) => plant.id), [
    "plant-1", "plant-2", "plant-3", "plant-4", "plant-5", "plant-6",
  ]);
  assert.equal(describeFixture(pair).plantsInIdentityOrder[2]?.generatorVersion, "one-branch-v1");
  assert.equal(describeFixture(dynamic).plantsInIdentityOrder[2]?.generatorVersion, "bare-branch-v1");
  assert.equal(describeFixture(dynamic).plantsInIdentityOrder[4]?.generatorVersion, "reed-v1");
  assert.equal(describeFixture(dynamic).plantsInIdentityOrder[5]?.generatorVersion, "flower-volume-v1");
  const pairSequence = planWorkbenchCuttings(["flowering-branch", "leafy-shoot"], 8278, 6);
  const dynamicSequence = planWorkbenchCuttings(
    catalog.map((material) => material.materialId),
    8278,
    catalog.length,
  );
  assert.equal(pairSequence[2]?.materialId, "flowering-branch");
  assert.equal(dynamicSequence[2]?.materialId, "bare-branch");
  assert.equal(dynamicSequence[4]?.materialId, "reed");
  assert.equal(dynamicSequence[5]?.materialId, "flower-volume");
  assert.equal(dynamicSequence[6]?.materialId, "arching-trailer");
  assert.equal(dynamicSequence[7]?.materialId, "foliage-fan");
  assert.equal(dynamicSequence[8]?.materialId, "blossom-spray");
  assert.equal(dynamicSequence[9]?.materialId, "nodding-flower");
  assert.equal(dynamicSequence[10]?.materialId, "berry-twig");
  assert.equal(dynamicSequence[11]?.materialId, "fern-frond");
  assert.equal(dynamicSequence.at(-1)?.materialId, "unrelated-candidate");
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
  for (const id of [
    "references-plus-bare", "references-plus-single-flower", "all-four",
    "references-plus-reed", "references-plus-flower-volume", "references-plus-arching-trailer",
    "round3-three", "round3-palette",
    "references-plus-foliage-fan", "references-plus-blossom-spray", "blossom-compare",
    "references-plus-nodding-flower", "round4-candidates", "round4-palette",
    "references-plus-berry-twig", "references-plus-fern-frond",
    "round5-candidates", "round5-palette",
  ] as const) {
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
    "flowering-branch", "leafy-shoot", "bare-branch", "single-flower", "reed", "flower-volume", "arching-trailer",
    "foliage-fan", "blossom-spray", "nodding-flower", "berry-twig", "fern-frond",
    "reference-pair", "references-plus-bare", "references-plus-single-flower", "all-four",
    "references-plus-reed", "references-plus-flower-volume", "references-plus-arching-trailer",
    "round3-three", "round3-palette",
    "references-plus-foliage-fan", "references-plus-blossom-spray", "blossom-compare",
    "references-plus-nodding-flower", "round4-candidates", "round4-palette",
    "references-plus-berry-twig", "references-plus-fern-frond",
    "round5-candidates", "round5-palette", "all-registered-materials", "botanical-refinements",
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

test("round 3 profiles are explicit and do not rewrite reference-pair or all-four", () => {
  const pairBefore = createWorkbenchFixture("reference-pair", 8278, 6, { remember: false });
  const allFourBefore = createWorkbenchFixture("all-four", 8278, 6, { remember: false });
  const round3 = createWorkbenchFixture("round3-three", 8278, 6);
  const round3Load = getLastWorkbenchFixtureLoad();
  assert.deepEqual(round3Load?.materialSequence, ["reed", "flower-volume", "arching-trailer"]);
  assert.deepEqual(round3Load?.composition.countsByMaterialId, {
    reed: 2, "flower-volume": 2, "arching-trailer": 2,
  });
  assert.equal(round3Load?.composition.balancedEqualCopies, true);
  assert.deepEqual(describeFixture(round3).plantsInIdentityOrder.map((plant) => plant.generatorVersion), [
    "reed-v1", "flower-volume-v1", "arching-trailer-v1", "reed-v1", "flower-volume-v1", "arching-trailer-v1",
  ]);
  const round3Twelve = describeMaterialSequenceComposition(
    ["reed", "flower-volume", "arching-trailer"],
    12,
  );
  assert.deepEqual(round3Twelve.countsByMaterialId, { reed: 4, "flower-volume": 4, "arching-trailer": 4 });
  assert.equal(round3Twelve.balancedEqualCopies, true);

  const palette = describeMaterialSequenceComposition([
    "flowering-branch", "leafy-shoot", "bare-branch", "single-flower", "reed", "flower-volume", "arching-trailer",
  ], 6);
  assert.deepEqual(palette.assignedMaterialIds, [
    "flowering-branch", "leafy-shoot", "bare-branch", "single-flower", "reed", "flower-volume",
  ]);
  assert.match(palette.warnings.join(" "), /omits arching-trailer/);
  const paletteTwelve = describeMaterialSequenceComposition([
    "flowering-branch", "leafy-shoot", "bare-branch", "single-flower", "reed", "flower-volume", "arching-trailer",
  ], 12);
  assert.deepEqual(paletteTwelve.countsByMaterialId, {
    "flowering-branch": 2, "leafy-shoot": 2, "bare-branch": 2, "single-flower": 2,
    reed: 2, "flower-volume": 1, "arching-trailer": 1,
  });
  assert.equal(paletteTwelve.balancedEqualCopies, false);

  const pairAfter = createWorkbenchFixture("reference-pair", 8278, 6, { remember: false });
  const allFourAfter = createWorkbenchFixture("all-four", 8278, 12, { remember: false });
  assert.deepEqual(pairAfter, pairBefore);
  assert.deepEqual(describeFixture(allFourBefore).plantsInIdentityOrder.map((plant) => plant.generatorVersion), [
    "one-branch-v1", "leafy-shoot-v1", "bare-branch-v1", "single-flower-v1", "one-branch-v1", "leafy-shoot-v1",
  ]);
  assert.deepEqual(describeFixture(allFourAfter).byGeneratorVersion, {
    "one-branch-v1": 3, "leafy-shoot-v1": 3, "bare-branch-v1": 3, "single-flower-v1": 3,
  });
  assert.equal(describeFixture(pairAfter).plantsInIdentityOrder.every((plant) =>
    plant.generatorVersion === "one-branch-v1" || plant.generatorVersion === "leafy-shoot-v1"), true);
  for (const id of ["references-plus-reed", "references-plus-flower-volume", "references-plus-arching-trailer"] as const) {
    const cutting = createWorkbenchFixture(id, 8278, 6, { remember: false });
    assert.deepEqual(cutting.plants.find((plant) => plant.id === "plant-1"), pairBefore.plants.find((plant) => plant.id === "plant-1"));
    assert.deepEqual(cutting.plants.find((plant) => plant.id === "plant-2"), pairBefore.plants.find((plant) => plant.id === "plant-2"));
    assert.notDeepEqual(cutting.plants.find((plant) => plant.id === "plant-3"), pairBefore.plants.find((plant) => plant.id === "plant-3"));
  }
});

test("round 4 profiles are explicit and leave the earlier profiles unchanged", () => {
  const pairBefore = createWorkbenchFixture("reference-pair", 8278, 6, { remember: false });
  const round3Before = createWorkbenchFixture("round3-palette", 8278, 6, { remember: false });
  const candidates = createWorkbenchFixture("round4-candidates", 8278, 6);
  const candidateLoad = getLastWorkbenchFixtureLoad();
  assert.deepEqual(candidateLoad?.materialSequence, ["foliage-fan", "blossom-spray", "nodding-flower"]);
  assert.deepEqual(candidateLoad?.composition.countsByMaterialId, {
    "foliage-fan": 2, "blossom-spray": 2, "nodding-flower": 2,
  });
  assert.equal(candidateLoad?.composition.balancedEqualCopies, true);
  assert.deepEqual(describeFixture(candidates).plantsInIdentityOrder.map((plant) => plant.generatorVersion), [
    "foliage-fan-v1", "blossom-spray-v1", "nodding-flower-v1",
    "foliage-fan-v1", "blossom-spray-v1", "nodding-flower-v1",
  ]);
  const candidateTwelve = describeMaterialSequenceComposition(
    ["foliage-fan", "blossom-spray", "nodding-flower"],
    12,
  );
  assert.deepEqual(candidateTwelve.countsByMaterialId, {
    "foliage-fan": 4, "blossom-spray": 4, "nodding-flower": 4,
  });

  const paletteSix = describeMaterialSequenceComposition([
    "flowering-branch", "leafy-shoot", "bare-branch", "single-flower", "reed", "flower-volume", "arching-trailer",
    "foliage-fan", "blossom-spray", "nodding-flower",
  ], 6);
  assert.deepEqual(paletteSix.assignedMaterialIds, [
    "flowering-branch", "leafy-shoot", "bare-branch", "single-flower", "reed", "flower-volume",
  ]);
  assert.match(paletteSix.warnings.join(" "), /omits arching-trailer, foliage-fan, blossom-spray, nodding-flower/);
  const paletteTwelve = describeMaterialSequenceComposition([
    "flowering-branch", "leafy-shoot", "bare-branch", "single-flower", "reed", "flower-volume", "arching-trailer",
    "foliage-fan", "blossom-spray", "nodding-flower",
  ], 12);
  assert.deepEqual(paletteTwelve.countsByMaterialId, {
    "flowering-branch": 2, "leafy-shoot": 2, "bare-branch": 1, "single-flower": 1,
    reed: 1, "flower-volume": 1, "arching-trailer": 1,
    "foliage-fan": 1, "blossom-spray": 1, "nodding-flower": 1,
  });
  assert.equal(paletteTwelve.balancedEqualCopies, false);

  const plusBlossom = createWorkbenchFixture("references-plus-blossom-spray", 8278, 6);
  assert.deepEqual(getLastWorkbenchFixtureLoad()?.materialSequence, ["flowering-branch", "leafy-shoot", "blossom-spray"]);
  assert.deepEqual(plusBlossom.plants.find((plant) => plant.id === "plant-1"), pairBefore.plants.find((plant) => plant.id === "plant-1"));
  assert.deepEqual(plusBlossom.plants.find((plant) => plant.id === "plant-2"), pairBefore.plants.find((plant) => plant.id === "plant-2"));
  assert.deepEqual(createWorkbenchFixture("reference-pair", 8278, 6, { remember: false }), pairBefore);
  assert.deepEqual(createWorkbenchFixture("round3-palette", 8278, 6, { remember: false }), round3Before);
});

test("round 5 profiles name the two accepted cuttings and leave round 4 membership unchanged", () => {
  const round4Candidates = createWorkbenchFixture("round4-candidates", 8278, 6, { remember: false });
  const round4Palette = createWorkbenchFixture("round4-palette", 8278, 12, { remember: false });
  const round3Palette = createWorkbenchFixture("round3-palette", 8278, 6, { remember: false });
  assert.equal(describeFixture(round4Palette).plantsInIdentityOrder.some((plant) =>
    plant.generatorVersion === "berry-twig-v1" || plant.generatorVersion === "fern-frond-v1"), false);
  assert.equal(describeFixture(round3Palette).plantsInIdentityOrder.some((plant) =>
    plant.generatorVersion === "berry-twig-v1" || plant.generatorVersion === "fern-frond-v1"), false);

  const candidates = createWorkbenchFixture("round5-candidates", 8278, 6);
  assert.deepEqual(getLastWorkbenchFixtureLoad()?.materialSequence, ["berry-twig", "fern-frond"]);
  assert.deepEqual(getLastWorkbenchFixtureLoad()?.composition.countsByMaterialId, {
    "berry-twig": 3, "fern-frond": 3,
  });
  assert.deepEqual(describeFixture(candidates).plantsInIdentityOrder.map((plant) => plant.generatorVersion), [
    "berry-twig-v1", "fern-frond-v1", "berry-twig-v1", "fern-frond-v1", "berry-twig-v1", "fern-frond-v1",
  ]);
  const candidateTwelve = describeMaterialSequenceComposition(["berry-twig", "fern-frond"], 12);
  assert.deepEqual(candidateTwelve.countsByMaterialId, { "berry-twig": 6, "fern-frond": 6 });

  const paletteSix = describeMaterialSequenceComposition([
    "flowering-branch", "leafy-shoot", "bare-branch", "single-flower", "reed", "flower-volume", "arching-trailer",
    "foliage-fan", "blossom-spray", "nodding-flower", "berry-twig", "fern-frond",
  ], 6);
  assert.deepEqual(paletteSix.assignedMaterialIds, [
    "flowering-branch", "leafy-shoot", "bare-branch", "single-flower", "reed", "flower-volume",
  ]);
  assert.match(paletteSix.warnings.join(" "), /omits arching-trailer, foliage-fan, blossom-spray, nodding-flower, berry-twig, fern-frond/);
  const palette = createWorkbenchFixture("round5-palette", 8278, 12);
  assert.deepEqual(getLastWorkbenchFixtureLoad()?.composition.countsByMaterialId, {
    "flowering-branch": 1, "leafy-shoot": 1, "bare-branch": 1, "single-flower": 1,
    reed: 1, "flower-volume": 1, "arching-trailer": 1,
    "foliage-fan": 1, "blossom-spray": 1, "nodding-flower": 1,
    "berry-twig": 1, "fern-frond": 1,
  });
  assert.equal(getLastWorkbenchFixtureLoad()?.composition.balancedEqualCopies, true);
  assert.deepEqual(describeFixture(round4Candidates).plantsInIdentityOrder.map((plant) => plant.generatorVersion), [
    "foliage-fan-v1", "blossom-spray-v1", "nodding-flower-v1",
    "foliage-fan-v1", "blossom-spray-v1", "nodding-flower-v1",
  ]);
  assert.equal(describeFixture(palette).plantsInIdentityOrder.filter((plant) => plant.generatorVersion === "berry-twig-v1").length, 1);
  assert.equal(describeFixture(palette).plantsInIdentityOrder.filter((plant) => plant.generatorVersion === "fern-frond-v1").length, 1);
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
