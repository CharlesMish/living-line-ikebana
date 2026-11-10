import assert from "node:assert/strict";
import test from "node:test";
import {
  add,
  aimBranch,
  applyPrune,
  bendBranch,
  createLanternSpray,
  deserializePlantGraph,
  organPosition,
  prepareMaterialInsertion,
  previewPrune,
  sampleBranch,
  serializePlantGraph,
  validatePlantGraph,
} from "../../src/core/index.ts";
import { canonicalCameraPose } from "../../src/app/camera.ts";
import { cutCue, materialName } from "../../src/app/craftCues.ts";
import { DEFAULT_SCENE, withBotanicalTones } from "../../src/app/scene.ts";
import { SceneCommittedStore, SceneGardenStore } from "../../src/app/scenePersistence.ts";
import type { PlantGraph } from "../../src/core/types.ts";

const BASE = { x: 0, y: 0.55, z: 0 };
const SEEDS = [8278, 9255, 10232];
const activeLanterns = (graph: PlantGraph) =>
  [...graph.organs.values()].filter((organ) => organ.active && organ.kind === "bloom");

test("lantern-spray is deterministic across seeds, valid, additive, and suspends five lanterns on drooping pedicels", () => {
  for (const seed of SEEDS) {
    const graph = createLanternSpray("plant-1", seed, BASE);
    const serialized = serializePlantGraph(graph);
    assert.equal(serializePlantGraph(createLanternSpray("plant-1", seed, BASE)), serialized);
    assert.equal(serializePlantGraph(deserializePlantGraph(serialized)), serialized);
    assert.deepEqual(validatePlantGraph(graph), []);
    assert.equal(graph.generatorVersion, "lantern-spray-v1");
    assert.equal(graph.branches.size, 9);
    assert.equal(graph.organs.size, 7);

    const lanterns = activeLanterns(graph);
    assert.equal(lanterns.length, 5);
    for (const lantern of lanterns) {
      const stalk = graph.branches.get(lantern.branchId)!;
      assert.equal(stalk.kind, "pedicel");
      assert.ok(stalk.activeLength >= 0.34);
      assert.equal(lantern.distance, stalk.activeLength);
      assert.equal(materialName(stalk, graph), "Flower stem");
      const tipSample = sampleBranch(stalk, stalk.activeLength);
      assert.ok(tipSample.tangent.y < -0.7, "lantern pedicel droops downward so the bell hangs");
    }
  }

  const prepared = prepareMaterialInsertion("lantern-spray", 1, BASE);
  assert.equal(prepared.ok, true);
  if (prepared.ok) {
    assert.equal(prepared.graph.generatorVersion, "lantern-spray-v1");
    assert.deepEqual(validatePlantGraph(prepared.graph), []);
  }
});

test("pruning individual lantern stalks or the distal arch retains proximal lanterns, and both stem and arch shape cleanly", () => {
  for (const seed of SEEDS) {
    const graph = createLanternSpray("plant-1", seed, BASE);
    const before = serializePlantGraph(graph);
    const stem = graph.branches.get("plant-1:stem")!;
    const arch = graph.branches.get("plant-1:arch")!;

    // Cut the distal arch between lantern-4 (0.48) and lantern-5 (0.95)
    const archPlan = previewPrune(graph, arch.id, arch.activeLength * 0.72);
    const archCut = applyPrune(graph, archPlan);
    assert.equal(activeLanterns(archCut).length, 4);
    assert.match(cutCue(graph, archPlan, true).detail, /1 flower/);

    // Cut an individual hanging lantern stalk
    const secondStalk = graph.branches.get("plant-1:lantern-stalk-2")!;
    const stalkPlan = previewPrune(graph, secondStalk.id, secondStalk.activeLength * 0.45);
    const stalkCut = applyPrune(graph, stalkPlan);
    assert.equal(activeLanterns(stalkCut).length, 4);
    assert.equal(stalkCut.organs.get("plant-1:lantern-2")!.active, false);

    // Aim and bend both stem and arch while preserving stock rest lengths
    const stemMid = stem.activeLength * 0.54;
    const stemBent = bendBranch(graph, {
      branchId: stem.id,
      stationDistance: stemMid,
      target: add(sampleBranch(stem, stemMid).position, { x: -0.42, y: 0.12, z: 0.18 }),
    });
    const archAimPoint = sampleBranch(arch, arch.activeLength * 0.8).position;
    const archAimed = aimBranch(
      stemBent,
      arch.id,
      archAimPoint,
      add(archAimPoint, { x: -0.35, y: -0.15, z: 0.1 }),
    );

    for (const branch of graph.branches.values()) {
      assert.deepEqual(archAimed.branches.get(branch.id)!.restLengths, branch.restLengths);
    }
    for (const candidate of [archCut, stalkCut, stemBent, archAimed]) {
      assert.deepEqual(validatePlantGraph(candidate), []);
      const roundTrip = serializePlantGraph(deserializePlantGraph(serializePlantGraph(candidate)));
      assert.equal(roundTrip, serializePlantGraph(candidate));
    }
    assert.notDeepEqual(
      organPosition(archAimed, "plant-1:lantern-5"),
      organPosition(graph, "plant-1:lantern-5"),
    );
    assert.equal(serializePlantGraph(graph), before);
  }
});

test("lantern-spray graphs and tones round-trip through working scene, Garden backup, and working copy", () => {
  const map = new Map<string, string>();
  const storage = {
    getItem: (key: string) => map.get(key) ?? null,
    setItem: (key: string, value: string) => {
      map.set(key, value);
    },
  };
  const graph = createLanternSpray("plant-1", 8278, BASE);
  const stalk = graph.branches.get("plant-1:lantern-stalk-3")!;
  const pruned = applyPrune(graph, previewPrune(graph, stalk.id, stalk.activeLength * 0.4));
  const plants = [JSON.parse(serializePlantGraph(pruned))];
  const scene = withBotanicalTones(DEFAULT_SCENE, { "lantern-spray": "persimmon" });
  const camera = canonicalCameraPose("front");

  const working = new SceneCommittedStore("working", undefined, () => ({ scene, camera }), storage);
  working.load();
  assert.ok(working.save(2, plants));
  assert.deepEqual(working.load()?.plants, plants);

  const garden = new SceneGardenStore("garden", undefined, storage);
  garden.load();
  garden.keep({
    id: "lantern-moment",
    title: "Lanterns Across the Ford",
    thumbnail: null,
    keptAt: "2026-11-10T00:00:00Z",
    arrangement: { successfulPlantOrdinal: 1, plants, camera, scene },
  });

  const imported = new SceneGardenStore("imported", undefined, storage);
  imported.load();
  assert.equal(imported.importBackup(garden.exportRaw()), 1);
  const entry = imported.load().entries[0]!;
  assert.deepEqual(entry.arrangement.plants, plants);
  assert.deepEqual(entry.arrangement.scene, scene);
});
