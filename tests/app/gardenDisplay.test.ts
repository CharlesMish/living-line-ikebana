import test from "node:test";
import assert from "node:assert/strict";
import { GardenDisplayStore, changeGardenDisplay, parseGardenDisplay, recentGardenDisplay, resolveGardenDisplay } from "../../src/app/gardenDisplay.ts";
import type { GardenEntry } from "../../src/app/garden.ts";
import { createWorkbenchFixture } from "../../src/app/workbench.ts";

const make = (id: string, day: number): GardenEntry => ({ id, title: id, keptAt: `2026-10-${day}T12:00:00Z`, thumbnail: null, arrangement: createWorkbenchFixture("flowering-branch", 8278, 1) });
const entries = [make("a", 12), make("b", 14), make("c", 13), make("d", 11)];
function setup(initial: string | null = null) {
  let raw = initial, fail = false, writes = 0;
  const store = new GardenDisplayStore("display", { getItem: () => raw, setItem: (_key, value) => { if (fail) throw new Error("quota"); raw = value; writes++; } });
  return { store, raw: () => raw, writes: () => writes, fail: (value: boolean) => { fail = value; }, external: (value: string) => { raw = value; } };
}

test("Visit starts with three newest moments without writes or changing original order", () => {
  const before = JSON.stringify(entries), h = setup();
  assert.deepEqual(recentGardenDisplay(entries), ["b", "c", "a"]);
  assert.deepEqual(h.store.load(entries), ["b", "c", "a"]);
  assert.equal(h.writes(), 0);
  assert.equal(h.raw(), null);
  assert.equal(JSON.stringify(entries), before);
  assert.deepEqual(recentGardenDisplay([]), [null, null, null]);
});

test("Choosing a displayed moment swaps references, never moves plants or duplicates the entry", () => {
  const before = JSON.stringify(entries), h = setup(); h.store.load(entries);
  const next = h.store.choose(0, "a", entries);
  assert.deepEqual(next, ["a", "c", "b"]);
  assert.deepEqual(parseGardenDisplay(h.raw()!), next);
  assert.equal(h.writes(), 1);
  assert.equal(JSON.stringify(entries), before);
  assert.deepEqual(changeGardenDisplay(["a", "b", null], 2, "a"), [null, "b", "a"]);
});

test("Explicit empty choices and pinned references survive newer entries and reopening", () => {
  const h = setup(); h.store.load(entries);
  h.store.choose(1, null, entries);
  h.store.choose(2, "d", entries);
  assert.deepEqual(h.store.load([make("new", 15), ...entries]), ["b", null, "d"]);
  assert.equal(h.writes(), 2);
});

test("Opening an orphaned display leaves data untouched and resolves just that position as empty", () => {
  const initial = JSON.stringify({ displayVersion: 1, slots: ["missing", "a", null] });
  const h = setup(initial), slots = h.store.load(entries);
  assert.deepEqual(resolveGardenDisplay(slots, entries).map(entry => entry?.id ?? null), [null, "a", null]);
  assert.equal(h.raw(), initial);
  assert.equal(h.writes(), 0);
  assert.deepEqual(h.store.choose(2, "c", entries), [null, "a", "c"]);
});

test("A failed choice write preserves previous choices for a successful retry", () => {
  const h = setup(); h.store.load(entries); h.store.choose(2, "d", entries);
  const before = h.raw(); h.fail(true);
  assert.throws(() => h.store.choose(0, "a", entries), /could not be saved/);
  assert.equal(h.raw(), before);
  h.fail(false);
  assert.deepEqual(h.store.choose(1, null, entries), ["b", null, "d"]);
});

test("Stale or unsupported preferences are not overwritten", () => {
  const h = setup(); h.store.load(entries);
  const other = JSON.stringify({ displayVersion: 1, slots: ["d", null, null] }); h.external(other);
  assert.throws(() => h.store.choose(0, "a", entries), /another tab/);
  assert.equal(h.raw(), other);
  for (const raw of ["bad", '{"displayVersion":2,"slots":[null,null,null]}', '{"displayVersion":1,"slots":["a","a",null]}']) {
    const bad = setup(raw);
    assert.throws(() => bad.store.load(entries));
    assert.throws(() => bad.store.choose(0, "a", entries), /Reopen/);
    assert.equal(bad.raw(), raw);
    assert.equal(bad.writes(), 0);
  }
});

test("Invalid positions and absent entry choices fail without writes", () => {
  const h = setup(); h.store.load(entries);
  assert.throws(() => h.store.choose(3, "a", entries));
  assert.throws(() => h.store.choose(-1, null, entries));
  assert.throws(() => h.store.choose(.5, "a", entries));
  assert.throws(() => h.store.choose(0, "missing", entries), /no longer/);
  assert.equal(h.writes(), 0);
});
