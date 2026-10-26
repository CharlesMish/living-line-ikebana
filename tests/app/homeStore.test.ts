import test from "node:test";
import assert from "node:assert/strict";
import { HomeStore, initialHomePlacements, parseHomePlacements, placeInHome, placeOfEntry, emptyHomePlacements } from "../../src/app/homeStore.ts";
import type { GardenEntry } from "../../src/app/garden.ts";
import { createWorkbenchFixture } from "../../src/app/workbench.ts";
import { HOME_PLACES, HOME_ROOM, arrangementExtent, homePlace, placeFit } from "../../src/presentation/homePlaces.ts";

const make = (id: string, day: number, thumbnail: string | null = null): GardenEntry => ({
  id, title: id, keptAt: `2026-10-${day}T12:00:00Z`, thumbnail,
  arrangement: createWorkbenchFixture("flowering-branch", 8278, 1),
});
const entries = [make("a", 12), make("b", 14, "data:image/jpeg;base64,AA=="), make("c", 13), make("d", 11)];
function setup(initial: string | null = null, display: string | null = null) {
  const values = new Map<string, string>();
  if (initial !== null) values.set("home", initial);
  if (display !== null) values.set("display", display);
  let fail = false, writes = 0;
  const store = new HomeStore("home", "display", {
    getItem: key => values.get(key) ?? null,
    setItem: (key, value) => { if (fail) throw new Error("quota"); values.set(key, value); writes++; },
  });
  return { store, raw: () => values.get("home") ?? null, writes: () => writes, fail: (value: boolean) => { fail = value; }, external: (value: string) => values.set("home", value) };
}

test("a first visit seeds from the newest kept arrangements and writes nothing", () => {
  const before = JSON.stringify(entries), h = setup();
  const placed = h.store.load(entries);
  assert.equal(placed.tokonoma, "b");
  assert.equal(placed.table, "c");
  assert.equal(placed.shoin, "a");
  assert.equal(placed["shelf-low"], null);
  assert.equal(placed.scroll, "b", "the tokonoma piece's photograph hangs as the scroll");
  assert.equal(h.writes(), 0);
  assert.equal(h.raw(), null);
  assert.equal(JSON.stringify(entries), before);
});

test("a first visit honours an existing Visit display: centre to the tokonoma", () => {
  const display = JSON.stringify({ displayVersion: 1, slots: ["d", "a", null] });
  const placed = initialHomePlacements(entries, display);
  assert.equal(placed.tokonoma, "a");
  assert.equal(placed.table, "d");
  assert.equal(placed.shoin, null);
  assert.equal(placed.scroll, "b", "falls back to the newest photograph when the tokonoma piece has none");
  assert.equal(initialHomePlacements(entries, "{broken").tokonoma, "b", "an unreadable display falls back to newest");
  assert.deepEqual(initialHomePlacements([], null), emptyHomePlacements());
});

test("placing swaps arrangement places, never duplicates, and the scroll is independent", () => {
  let placed = placeInHome(emptyHomePlacements(), "tokonoma", "a");
  placed = placeInHome(placed, "table", "b");
  placed = placeInHome(placed, "table", "a");
  assert.equal(placed.table, "a");
  assert.equal(placed.tokonoma, "b", "the two pieces trade places");
  placed = placeInHome(placed, "shelf-low", "c");
  placed = placeInHome(placed, "shelf-low", "d");
  assert.equal(placed["shelf-low"], "d");
  assert.equal(placeOfEntry(placed, "c"), null, "a displaced piece returns to the Garden");
  placed = placeInHome(placed, "scroll", "a");
  assert.equal(placed.scroll, "a");
  assert.equal(placed.table, "a", "the same moment may stand in a place and hang as the scroll");
  assert.throws(() => placeInHome(placed, "attic" as never, "a"), /valid place/);
});

test("saved placements round-trip; malformed or duplicated documents are refused", () => {
  const h = setup(); h.store.load(entries);
  const next = h.store.place("shelf-low", "d", entries);
  assert.equal(h.writes(), 1);
  assert.deepEqual(parseHomePlacements(h.raw()!), next);
  assert.throws(() => parseHomePlacements(JSON.stringify({ homeVersion: 2, places: {} })), /cannot be read/);
  assert.throws(() => parseHomePlacements(JSON.stringify({ homeVersion: 1, places: { attic: "a" } })), /does not have/);
  assert.throws(() => parseHomePlacements(JSON.stringify({ homeVersion: 1, places: { table: "a", tokonoma: "a" } })), /only one place/);
  assert.equal(parseHomePlacements(JSON.stringify({ homeVersion: 1, places: { table: "a", scroll: "a" } })).scroll, "a");
});

test("a stale tab or failed save changes nothing; missing entries are refused", () => {
  const h = setup(); h.store.load(entries);
  h.store.place("table", "a", entries);
  const saved = h.raw();
  h.fail(true);
  assert.throws(() => h.store.place("table", "d", entries), /could not be saved/);
  assert.equal(h.raw(), saved);
  h.fail(false);
  h.external(JSON.stringify({ homeVersion: 1, places: { table: "c" } }));
  assert.throws(() => h.store.place("table", "d", entries), /another tab/);
  h.store.load(entries);
  assert.throws(() => h.store.place("table", "zz", entries), /no longer in your Garden/);
  assert.throws(() => new HomeStore("x", null, { getItem: () => null, setItem: () => {} }).place("table", "a", entries), /Reopen/);
});

test("fit is physical: headroom and surface size, matching the room's geometry", () => {
  const branch = arrangementExtent(createWorkbenchFixture("flowering-branch", 8278, 1));
  assert.ok(branch.height > 5.5 && branch.height < 8, `flowering branch stands about ${branch.height}`);
  assert.ok(Math.abs(branch.vesselHalfX - 2.64) < 1e-9);
  for (const place of HOME_PLACES) {
    if (place.id === "shelf-high") continue;
    assert.equal(placeFit(place, branch).fits, true, `${place.id} takes a single flowering branch`);
  }
  // The upper shelf is deliberately the tight place: a full flowering branch is too tall for it.
  assert.equal(placeFit(homePlace("shelf-high")!, branch).fits, false);
  const violet = arrangementExtent(createWorkbenchFixture("violet-sprig", 8278, 1));
  assert.equal(placeFit(homePlace("shelf-high")!, violet).fits, true, "a short violet sprig fits the upper shelf");

  const high = homePlace("shelf-high")!;
  assert.equal(high.clearance, HOME_ROOM.cupboardBottom - HOME_ROOM.shelfHighTop - .5);
  const tall = { height: high.clearance + .3, vesselHalfX: 1, vesselHalfZ: 1 };
  const verdict = placeFit(high, tall);
  assert.equal(verdict.fits, false);
  assert.match(verdict.fits ? "" : verdict.reason, /Too tall/);
  assert.equal(placeFit(homePlace("tokonoma")!, tall).fits, true);
  assert.equal(placeFit(homePlace("shoin")!, { height: 3, vesselHalfX: 4, vesselHalfZ: 1 }).fits, false, "too deep for the sill");
  assert.equal(placeFit(homePlace("scroll")!, null).fits, true);

  const petite = arrangementExtent({ plants: [], scene: { layoutId: "petite" } });
  assert.ok(Math.abs(petite.vesselHalfX - 2.64 * .64) < 1e-9);
  const pair = arrangementExtent({ plants: [], scene: { layoutId: "vessel-pair" } });
  assert.ok(Math.abs(pair.vesselHalfX - (1.65 + 2.64 * .54)) < 1e-9);
});

test("a first visit opened to place a new keep leaves that keep for the visitor to place", () => {
  const h = setup();
  const placed = h.store.load(entries, "b");
  assert.equal(Object.values(placed).includes("b"), false);
  assert.equal(placed.tokonoma, "c");
  assert.equal(h.writes(), 0);
});

test("the store refuses any placement whose swap would leave a piece where it cannot fit", () => {
  const short = make("s", 20); short.arrangement = createWorkbenchFixture("violet-sprig", 8278, 1);
  const all = [...entries, short];
  const h = setup(); h.store.load(all);
  h.store.place("shelf-high", "s", all);
  h.store.place("shelf-low", "a", all);
  const saved = h.raw();
  assert.throws(() => h.store.place("shelf-low", "s", all), /would move “a” to the upper shelf\. Too tall here/);
  assert.equal(h.raw(), saved, "nothing written");
  assert.throws(() => h.store.place("shelf-high", "a", all), /^Error: Too tall here/);
  assert.throws(() => h.store.place("scroll", "a", all), /without a photograph/);
  // Swapping with the table would put the table's tall branch on the upper shelf too.
  assert.throws(() => h.store.place("table", "s", all), /would move “b” to the upper shelf/);
  // Moving the short piece somewhere empty still works.
  h.store.place("tokonoma", "s", all);
  assert.equal(JSON.parse(h.raw()!).places["shelf-high"], null);
  assert.equal(JSON.parse(h.raw()!).places.tokonoma, "s");
});

test("first-visit seeding only puts a piece where it fits", () => {
  const tall = make("tall", 25);
  tall.arrangement = { ...tall.arrangement, plants: tall.arrangement.plants.map(plant => ({ ...plant, branches: plant.branches.map(branch => ({ ...branch, points: branch.points.map(point => ({ ...point, y: point.y * 3 })) })) })) };
  const placed = initialHomePlacements([tall, ...entries], null);
  assert.equal(placed.tokonoma, "tall", "the tokonoma has the headroom");
  const shoinOnly = initialHomePlacements([make("x", 1), tall], JSON.stringify({ displayVersion: 1, slots: [null, "x", "tall"] }));
  assert.equal(shoinOnly.tokonoma, "x");
  assert.equal(shoinOnly.table, "tall");
  assert.notEqual(shoinOnly.shoin, "tall", "too tall for the window desk, so it is not seeded there");
});
