import assert from "node:assert/strict";
import test from "node:test";
import { bakedPlaceMode, placeFlagsFrom, readExperimentConfig } from "../../src/app/config.ts";
import { PLACE_TAP_THRESHOLD_PX, placePointerKind, placePointerTravel } from "../../src/app/placeTap.ts";

test("placement flags default off and tap implies the cue", () => {
  const absent = readExperimentConfig(new URL("http://localhost/"));
  assert.equal(absent.placeCue, false);
  assert.equal(absent.placeTap, false);
  assert.equal(readExperimentConfig(new URL("http://localhost/?placeCue=1")).placeCue, true);
  assert.equal(readExperimentConfig(new URL("http://localhost/?placeCue=1")).placeTap, false);
  assert.equal(readExperimentConfig(new URL("http://localhost/?placeTap=1")).placeTap, true);
  assert.equal(readExperimentConfig(new URL("http://localhost/?placeTap=1")).placeCue, true);
  assert.equal(readExperimentConfig(new URL("http://localhost/?placeCue=true&placeTap=0")).placeCue, false);
  assert.equal(readExperimentConfig(new URL("http://localhost/?vesselStudy=original")).placeCue, false);
  const bakedTap = placeFlagsFrom(new URL("http://localhost/"), "tap");
  assert.deepEqual(bakedTap, { placeCue: true, placeTap: true });
  const bakedCue = placeFlagsFrom(new URL("http://localhost/?placeTap=1"), "cue");
  assert.equal(bakedCue.placeTap, true);
  assert.equal(bakedPlaceMode({ __LL_PLACE__: "1" } as typeof globalThis), "cue");
  assert.equal(bakedPlaceMode({ __LL_PLACE__: "2" } as typeof globalThis), "tap");
  assert.equal(bakedPlaceMode({} as typeof globalThis), "off");
});

test("tap stays a tap through the threshold and becomes a drag beyond it", () => {
  assert.equal(PLACE_TAP_THRESHOLD_PX, 8);
  assert.equal(placePointerKind(0), "tap");
  assert.equal(placePointerKind(placePointerTravel(0, 0, 6, 0)), "tap");
  assert.equal(placePointerKind(8), "tap");
  assert.equal(placePointerKind(8.01), "drag");
  assert.equal(placePointerKind(placePointerTravel(4, 9, 4, 18.5)), "drag");
});
