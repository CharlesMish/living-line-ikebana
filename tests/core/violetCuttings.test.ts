import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { createVioletSprig, createIndigoSpire, createSingleFlower, createBlossomSprayV2,
  prepareMaterialInsertion, serializePlantGraph, deserializePlantGraph, validatePlantGraph,
  applyPrune, previewPrune, sampleBranch, bendBranch, aimBranch, add, organPosition, toCanonicalPlantGraph,
} from "../../src/core/index.ts";
import { createWorkbenchFixture } from "../../src/app/workbench.ts";
import { SceneCommittedStore, SceneGardenStore } from "../../src/app/scenePersistence.ts";
import { canonicalCameraPose } from "../../src/app/camera.ts";
import { DEFAULT_SCENE, withBotanicalTones } from "../../src/app/scene.ts";
import type { PlantGraph } from "../../src/core/types.ts";
const BASE = { x: 0, y: 0.55, z: 0 };
const cases = [["violet-sprig", createVioletSprig, 6], ["indigo-spire", createIndigoSpire, 12]] as const;
const activeBlooms = (g: PlantGraph) => [...g.organs.values()].filter(o => o.kind === "bloom" && o.active);

test("violet stocks are deterministic, valid and reloadable at three seat seeds; old stock stays frozen", () => {
  for (const [material, create, count] of cases) {
    const different = new Set<string>();
    for (const seed of [8278, 9255, 10232]) {
      const graph = create("plant-1", seed, BASE), bytes = serializePlantGraph(graph);
      different.add(bytes);
      assert.equal(serializePlantGraph(create("plant-1", seed, BASE)), bytes);
      assert.equal(serializePlantGraph(deserializePlantGraph(bytes)), bytes);
      assert.deepEqual(validatePlantGraph(graph), []);
      assert.equal(activeBlooms(graph).length, count);
      assert.equal(graph.schemaVersion, 1);
    }
    assert.equal(different.size, 3);
    const prepared = prepareMaterialInsertion(material, 1, BASE);
    assert.ok(prepared.ok);
    assert.equal(serializePlantGraph(prepared.graph), serializePlantGraph(create("plant-1", 8278, BASE)));
    assert.deepEqual(JSON.parse(serializePlantGraph(prepared.graph)), JSON.parse(readFileSync(`fixtures/plant-1-${prepared.graph.generatorVersion}.json`, "utf8")));
  }
  const singleFixture = JSON.parse(readFileSync("fixtures/plant-1-single-flower-v1.json", "utf8"));
  assert.deepEqual(toCanonicalPlantGraph(createSingleFlower("plant-1", 8278, BASE)), singleFixture);
  const frozen = createWorkbenchFixture("all-four", 8278, 6, { remember: false });
  assert.deepEqual(frozen.plants.slice(0, 4).map(p => p.generatorVersion), ["one-branch-v1", "leafy-shoot-v1", "bare-branch-v1", "single-flower-v1"]);
  const violet = createVioletSprig("a", 8278, BASE), spray = createBlossomSprayV2("b", 8278, BASE);
  assert.ok(violet.branches.get(violet.rootBranchId)!.activeLength < spray.branches.get(spray.rootBranchId)!.activeLength * .6);
});

test("each new cutting can shorten between flowering stations while keeping its lower flowers", () => {
  for (const [, create, count] of cases) for (const seed of [8278, 9255, 10232]) {
    const graph = create("plant-1", seed, BASE), before = serializePlantGraph(graph);
    const stem = graph.branches.get(graph.rootBranchId)!;
    const plan = previewPrune(graph, stem.id, stem.activeLength * .7);
    const cut = applyPrune(graph, plan), survivors = activeBlooms(cut);
    assert.ok(survivors.length > 0 && survivors.length < count);
    assert.equal(graph.branches.size, cut.branches.size);
    assert.equal(graph.organs.size, cut.organs.size);
    for (const organ of survivors) {
      assert.deepEqual(cut.organs.get(organ.id), graph.organs.get(organ.id));
      assert.deepEqual(organPosition(cut, organ.id), organPosition(graph, organ.id));
    }
    assert.deepEqual(validatePlantGraph(cut), []);
    assert.equal(serializePlantGraph(deserializePlantGraph(serializePlantGraph(cut))), serializePlantGraph(cut));
    assert.equal(serializePlantGraph(graph), before);
  }
});

test("one floret stalk can be aimed or cut without moving or deleting a sibling", () => {
  for (const [, create, count] of cases) {
    const graph = create("plant-1", 8278, BASE), bloom = activeBlooms(graph)[0]!;
    const grip = organPosition(graph, bloom.id)!;
    const aimed = aimBranch(graph, bloom.branchId, grip, add(grip, { x: .1, y: .08, z: -.08 }));
    assert.notDeepEqual(organPosition(aimed, bloom.id), grip);
    const cut = applyPrune(graph, previewPrune(graph, bloom.branchId, bloom.distance * .5));
    assert.equal(activeBlooms(cut).length, count - 1);
    for (const branch of graph.branches.values()) if (branch.id !== bloom.branchId) {
      assert.deepEqual(aimed.branches.get(branch.id), branch);
      assert.deepEqual(cut.branches.get(branch.id), branch);
    }
    assert.deepEqual(validatePlantGraph(aimed), []);
    assert.deepEqual(validatePlantGraph(cut), []);
  }
});

test("bending preserves new stock lengths, all organ identities and attachments", () => {
  for (const [, create] of cases) {
    const graph = create("plant-1", 9255, BASE), stem = graph.branches.get(graph.rootBranchId)!;
    const station = stem.activeLength * .5;
    const bent = bendBranch(graph, { branchId: stem.id, stationDistance: station,
      target: add(sampleBranch(stem, station).position, { x: .65, y: 0, z: -.3 }) });
    assert.notDeepEqual(bent.branches.get(stem.id)!.points, stem.points);
    for (const branch of graph.branches.values()) assert.deepEqual(bent.branches.get(branch.id)!.restLengths, branch.restLengths);
    for (const organ of graph.organs.values()) assert.deepEqual(bent.organs.get(organ.id), organ);
    assert.deepEqual(validatePlantGraph(bent), []);
  }
});

test("actual new stock and its tones survive working save, Garden backup import and working copy", () => {
  const items = new Map<string, string>();
  const storage = { getItem: (k: string) => items.get(k) ?? null, setItem: (k: string, v: string) => { items.set(k, v); } };
  const plants = cases.map(([, create], i) => JSON.parse(serializePlantGraph(create(`plant-${i + 1}`, 8278 + 977 * i, BASE))));
  const scene = withBotanicalTones(DEFAULT_SCENE, { "violet-sprig": "amethyst", "indigo-spire": "blue" });
  const camera = canonicalCameraPose("front");
  const working = new SceneCommittedStore("working", undefined, () => ({ scene, camera }), storage);
  working.load(); assert.equal(working.save(3, plants), true);
  assert.deepEqual(working.load()?.plants, plants);
  assert.deepEqual(working.load()?.scene, scene);
  const garden = new SceneGardenStore("garden", undefined, storage); garden.load();
  garden.keep({ id: "violets", title: "Violet study", thumbnail: null, keptAt: "2026-10-14T00:00:00Z",
    arrangement: { successfulPlantOrdinal: 2, plants, camera, scene } });
  const imported = new SceneGardenStore("import", undefined, storage); imported.load();
  assert.equal(imported.importBackup(garden.exportRaw()), 1);
  const entry = imported.load()!.entries[0]!;
  assert.deepEqual(entry.arrangement.plants, plants);
  const copy = new SceneCommittedStore("copy", undefined, () => ({ scene: entry.arrangement.scene!, camera }), storage);
  copy.load(); assert.ok(copy.save(3, entry.arrangement.plants));
  assert.deepEqual(copy.load()?.scene, scene);
});
