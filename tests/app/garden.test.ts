import assert from "node:assert/strict";
import test from "node:test";
import { GardenStore, GARDEN_KEY, GARDEN_LIMIT, parseGarden, validateArrangement, type GardenEntry } from "../../src/app/garden.ts";
import { createWorkbenchFixture, WORKBENCH_SEEDS } from "../../src/app/workbench.ts";
import { fromCanonicalPlantGraph, previewPrune, applyPrune, toCanonicalPlantGraph } from "../../src/core/index.ts";

function memory() {
  const values = new Map<string, string>();
  let fail = false;
  return { values, set fail(value: boolean) { fail = value; }, getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => { if (fail) throw new Error("quota"); values.set(key, value); } };
}
function entry(id = "moment-1"): GardenEntry {
  return { id, title: "A little space", keptAt: "2026-09-18T12:00:00.000Z", thumbnail: null,
    arrangement: createWorkbenchFixture("mixed", 8278, 2) };
}
test("Garden round-trips pruned history and keeps snapshots isolated from later editing", () => {
  const storage = memory(), garden = new GardenStore(GARDEN_KEY, storage);
  garden.load();
  const kept = entry();
  const graph = fromCanonicalPlantGraph(kept.arrangement.plants[0]);
  const branch = graph.branches.get(graph.rootBranchId)!;
  const pruned = applyPrune(graph, previewPrune(graph, branch.id, branch.activeLength * .5));
  kept.arrangement.plants[0] = toCanonicalPlantGraph(pruned);
  garden.keep(kept);
  const before = garden.exportRaw();
  kept.arrangement.plants[0].branches[0].points[0].x = 100;
  const loaded = garden.load();
  assert.equal(JSON.stringify(loaded.entries[0].arrangement.plants[0]), JSON.stringify(toCanonicalPlantGraph(pruned)));
  assert.ok(loaded.entries[0].arrangement.plants[0].branches.some((branch) => !branch.active));
  loaded.entries[0].title = "Changed outside store";
  assert.equal(garden.exportRaw(), before);
  assert.equal(storage.values.size, 1);
});
test("quota, stale tab and incompatible data fail without deleting prior art", () => {
  const storage = memory(), first = new GardenStore(GARDEN_KEY, storage), second = new GardenStore(GARDEN_KEY, storage);
  first.load(); first.keep(entry()); second.load();
  first.keep(entry("moment-2"));
  const before = first.exportRaw();
  assert.throws(() => second.keep(entry("moment-3")), /another tab/);
  first.load(); storage.fail = true;
  assert.throws(() => first.keep(entry("moment-4")), /could not be saved/);
  assert.equal(first.exportRaw(), before);
  storage.fail = false;
  storage.values.set(GARDEN_KEY, '{"gardenVersion":99,"precious":"unknown"}');
  assert.throws(() => first.load());
  assert.throws(() => first.keep(entry("moment-5")), /readable Garden/);
  assert.equal(first.exportRaw(), '{"gardenVersion":99,"precious":"unknown"}');
});
test("backup merging is all-or-nothing, idempotent, and never silently drops entries", () => {
  const storage = memory(), garden = new GardenStore(GARDEN_KEY, storage);
  garden.load(); garden.keep(entry());
  assert.equal(garden.importBackup(garden.exportRaw()), 0);
  const incoming = entry("moment-2");
  assert.equal(garden.importBackup(JSON.stringify({ gardenVersion: 1, entries: [incoming] })), 1);
  const before = garden.exportRaw();
  incoming.title = "Conflicting version";
  assert.throws(() => garden.importBackup(JSON.stringify({ gardenVersion: 1, entries: [entry("moment-3"), incoming] })), /differs/);
  assert.equal(garden.exportRaw(), before);
  garden.remove("moment-2");
  assert.equal(garden.load().entries.length, 1);
});
test("invalid graphs, ordinals, cameras and thumbnails cannot enter the Garden", () => {
  const check = (mutate: (value: GardenEntry) => void) => {
    const value = entry(); mutate(value);
    assert.throws(() => parseGarden(JSON.stringify({ gardenVersion: 1, entries: [value] })));
  };
  check((value) => { value.arrangement.successfulPlantOrdinal = 0; });
  check((value) => { value.arrangement.plants[1].id = value.arrangement.plants[0].id; });
  check((value) => { value.arrangement.plants[0].generatorVersion = "unknown"; });
  check((value) => { value.arrangement.plants[0].branches[0].restLengths[0] = -1; });
  check((value) => { value.arrangement.camera.up = { x: 0, y: 0, z: 0 }; });
  check((value) => { value.thumbnail = "https://example.com/tracker.jpg"; });
  check((value) => { value.arrangement.plants = []; });
  assert.throws(() => parseGarden(JSON.stringify({ gardenVersion: 1, entries: Array.from({length: GARDEN_LIMIT + 1}, (_, i) => entry(`moment-${i}`)) })));
});
test("workbench fixtures are reproducible, valid and registered for every reference/seed/count", () => {
  for (const material of ["flowering-branch", "leafy-shoot", "bare-branch", "single-flower", "mixed"]) for (const seed of WORKBENCH_SEEDS) for (const count of [1, 2, 6, 12]) {
    const first = createWorkbenchFixture(material, seed, count);
    assert.deepEqual(first, createWorkbenchFixture(material, seed, count));
    assert.deepEqual(validateArrangement(first), first);
    assert.equal(first.plants.length, count);
    assert.equal(new Set(first.plants.map((plant) => plant.id)).size, count);
  }
  assert.throws(() => createWorkbenchFixture("unknown", 8278, 1));
  assert.throws(() => createWorkbenchFixture("mixed", -1, 1));
  assert.throws(() => createWorkbenchFixture("mixed", 8278, 100));
});
