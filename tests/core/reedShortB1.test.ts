import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import fixture from "../../fixtures/plant-1-reed-v1.json";
import {
  REED_SHORT_B1_VERSION,
  REED_VERSION,
  applyPrune,
  createReed,
  createReedShortB1,
  getMaterialDefinition,
  getMaterialDefinitions,
  getMaterialDefinitionsForCampaignB1,
  legalBendStation,
  prepareMaterialInsertion,
  previewPrune,
  serializePlantGraph,
  validatePlantGraph,
} from "../../src/core/index.ts";

const BASE = { x: 0, y: 0.55, z: 0 };
const SEEDS = [7301, 8278, 9255, 10232, 11209] as const;

function normalizedGraph(graph: ReturnType<typeof createReed>) {
  const branch = graph.branches.get(graph.rootBranchId)!;
  return {
    schemaVersion: graph.schemaVersion,
    id: graph.id,
    seed: graph.seed,
    rootBranchId: graph.rootBranchId,
    organs: [...graph.organs.values()],
    branchCore: {
      id: branch.id,
      label: branch.label,
      kind: branch.kind,
      parentId: branch.parentId,
      parentDistance: branch.parentDistance,
      radius: branch.radius,
      stiffness: branch.stiffness,
      referenceNormal: branch.referenceNormal,
      active: branch.active,
      pointCount: branch.points.length,
      restCount: branch.restLengths.length,
    },
  };
}

test("campaign B1 catalog is opt-in; default catalog order remains unchanged", () => {
  const baseCatalog = getMaterialDefinitions();
  const ids = baseCatalog.map(definition => definition.materialId);
  assert.equal(ids.includes("reed-short-b1"), false);
  assert.equal(ids.length, 12);
  assert.equal(ids[4], "reed");

  const expanded = getMaterialDefinitionsForCampaignB1(true);
  assert.deepEqual(expanded.slice(0, baseCatalog.length).map(definition => definition.materialId), ids);
  assert.equal(expanded.at(-1)?.materialId, "reed-short-b1");

  const disabled = getMaterialDefinitionsForCampaignB1(false);
  assert.deepEqual(disabled.map(definition => definition.materialId), ids);
});

test("reed-short-b1 stores a distinct material/generator identity and never aliases reed-v1", () => {
  const control = getMaterialDefinition("reed");
  assert.ok(control);
  assert.equal(control.generator.generatorVersion, REED_VERSION);
  const experiment = getMaterialDefinitionsForCampaignB1(true).find(definition => definition.materialId === "reed-short-b1");
  assert.ok(experiment);
  assert.equal(experiment.generator.generatorVersion, REED_SHORT_B1_VERSION);
  assert.notEqual(experiment.materialId, control.materialId);
  assert.notEqual(experiment.generator.generatorVersion, control.generator.generatorVersion);
});

test("reed-short-b1 is deterministic, valid, radius .024, and keeps 16 segments", () => {
  for (const seed of SEEDS) {
    const first = createReedShortB1("plant-1", seed, BASE);
    const second = createReedShortB1("plant-1", seed, BASE);
    assert.equal(serializePlantGraph(first), serializePlantGraph(second));
    assert.deepEqual(validatePlantGraph(first), []);
    const culm = first.branches.get(first.rootBranchId)!;
    assert.equal(culm.restLengths.length, 16);
    assert.equal(culm.points.length, 17);
    assert.equal(culm.radius, 0.024);
    assert.ok(legalBendStation(culm) !== null);
  }
});

test("reed-short-b1 keeps reed sampling law and differs only in length-derived fields", () => {
  for (const seed of SEEDS) {
    const reed = createReed("plant-1", seed, BASE);
    const short = createReedShortB1("plant-1", seed, BASE);
    const reedBranch = reed.branches.get(reed.rootBranchId)!;
    const shortBranch = short.branches.get(short.rootBranchId)!;

    assert.equal(short.generatorVersion, REED_SHORT_B1_VERSION);
    assert.equal(reed.generatorVersion, REED_VERSION);
    assert.deepEqual(normalizedGraph(short), normalizedGraph(reed));
    assert.ok(Math.abs(shortBranch.activeLength - reedBranch.activeLength * 0.85) < 1e-10);
    for (let index = 0; index < reedBranch.restLengths.length; index += 1) {
      assert.ok(Math.abs(shortBranch.restLengths[index]! - reedBranch.restLengths[index]! * 0.85) < 1e-10);
    }
  }
});

test("prune semantics on reed-short-b1 mirror reed-v1", () => {
  for (const seed of SEEDS) {
    const reed = createReed("plant-1", seed, BASE);
    const short = createReedShortB1("plant-1", seed, BASE);
    const reedBranch = reed.branches.get(reed.rootBranchId)!;
    const shortBranch = short.branches.get(short.rootBranchId)!;
    const reedPlan = previewPrune(reed, reedBranch.id, reedBranch.activeLength * 0.46);
    const shortPlan = previewPrune(short, shortBranch.id, shortBranch.activeLength * 0.46);
    assert.deepEqual(shortPlan.removedBranchIds, reedPlan.removedBranchIds);
    assert.deepEqual(shortPlan.removedOrganIds, reedPlan.removedOrganIds);

    const reedCut = applyPrune(reed, reedPlan);
    const shortCut = applyPrune(short, shortPlan);
    assert.deepEqual(validatePlantGraph(reedCut), []);
    assert.deepEqual(validatePlantGraph(shortCut), []);
    assert.equal(shortCut.branches.size, reedCut.branches.size);
    assert.equal(shortCut.organs.size, reedCut.organs.size);
    assert.equal(shortCut.branches.get(short.rootBranchId)!.active, true);
    assert.ok(shortCut.branches.get(short.rootBranchId)!.activeLength < shortBranch.activeLength);
  }
});

test("reed-v1 fixture bytes remain unchanged", () => {
  const raw = readFileSync(new URL("../../fixtures/plant-1-reed-v1.json", import.meta.url), "utf8");
  assert.equal(raw, serializePlantGraph(createReed("plant-1", 8278, BASE), 2) + "\n");
  assert.deepEqual(fixture, JSON.parse(serializePlantGraph(createReed("plant-1", 8278, BASE))));
});

test("material insertion requires campaign catalog overlay for reed-short-b1", () => {
  const withoutOverlay = prepareMaterialInsertion("reed-short-b1", 1, BASE);
  assert.equal(withoutOverlay.ok, false);
  if (withoutOverlay.ok) return;
  assert.equal(withoutOverlay.reason, "unknown-material");

  const withOverlay = prepareMaterialInsertion(
    "reed-short-b1",
    1,
    BASE,
    getMaterialDefinitionsForCampaignB1(true),
  );
  assert.equal(withOverlay.ok, true);
  if (!withOverlay.ok) return;
  assert.equal(withOverlay.graph.generatorVersion, REED_SHORT_B1_VERSION);
});
