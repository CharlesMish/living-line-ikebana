import assert from "node:assert/strict";
import test from "node:test";
import { createDomainAdapters } from "../../src/app/domainAdapters.ts";
import { canonicalCameraPose } from "../../src/app/camera.ts";
import { createReed, serializePlantGraph } from "../../src/core/index.ts";
import { TransactionCoordinator } from "../../src/input/TransactionCoordinator.ts";
import { plantingOutline } from "../../src/presentation/plantingOutline.ts";
import { VESSEL_PROFILES, inPlantingArea, keyboardPlantingPoint, plantingPins, type VesselProfile } from "../../src/study/vesselProfiles.ts";

const profile = (id: string) => {
  const found = VESSEL_PROFILES.find(candidate => candidate.id === id);
  assert.ok(found, `missing profile ${id}`);
  return found as VesselProfile;
};
const point = (x = 0, z = 0) => ({ x, y: .55, z });

test("A1 geometry changes only ceramic X/Z scale; Small bed field remains identical", () => {
  const control = profile("pinbed-small");
  const a1 = profile("pinbed-small-a1");
  assert.equal(control.scaleX, .54);
  assert.equal(control.scaleZ, .54);
  assert.equal(a1.scaleX, .486);
  assert.equal(a1.scaleZ, .486);
  assert.deepEqual(a1.areas, control.areas);

  const outerWidth = (candidate: VesselProfile) => 2 * 2.64 * candidate.scaleX;
  const outerDepth = (candidate: VesselProfile) => 2 * 2.64 * candidate.scaleZ;
  assert.equal(outerWidth(control), 2.8512);
  assert.equal(outerDepth(control), 2.8512);
  assert.equal(outerWidth(a1), 2.56608);
  assert.equal(outerDepth(a1), 2.56608);
});

test("A1 keeps pin grid, planting validity, keyboard placement and outline identical to Small bed", () => {
  const control = profile("pinbed-small");
  const a1 = profile("pinbed-small-a1");

  assert.deepEqual(plantingPins(a1), plantingPins(control));
  for (let ordinal = 1; ordinal <= 128; ordinal += 1) {
    assert.deepEqual(keyboardPlantingPoint(ordinal, a1), keyboardPlantingPoint(ordinal, control));
  }
  for (let x = -1.5; x <= 1.5; x += .1) {
    for (let z = -1.5; z <= 1.5; z += .1) {
      assert.equal(inPlantingArea(point(x, z), a1), inPlantingArea(point(x, z), control));
    }
  }

  const controlOutline = plantingOutline(control, 0.035);
  const a1Outline = plantingOutline(a1, 0.035);
  try {
    assert.deepEqual(
      [...controlOutline.getAttribute("position").array],
      [...a1Outline.getAttribute("position").array],
    );
    assert.deepEqual(
      [...(controlOutline.index?.array ?? [])],
      [...(a1Outline.index?.array ?? [])],
    );
  } finally {
    controlOutline.dispose();
    a1Outline.dispose();
  }
});

test("layout switch to A1 preserves existing out-of-field root coordinates on acquisition and no-motion release", () => {
  const control = profile("pinbed-small");
  const a1 = profile("pinbed-small-a1");
  let current = control;
  const initial = createReed("plant-1", 8278, point(1.1, .2));
  const before = serializePlantGraph(initial);
  const coordinator = new TransactionCoordinator(
    createDomainAdapters(undefined, () => current),
    {
      plants: new Map([[initial.id, initial]]),
      selectedPlantId: initial.id,
      camera: canonicalCameraPose("front"),
      successfulPlantOrdinal: 1,
    },
  );

  current = a1;
  coordinator.beginBase(1, { plantId: initial.id, context: {} }, { base: point(1.1, .2) });
  assert.equal(serializePlantGraph(coordinator.getPresentationState().active.graph), before);
  coordinator.release(1);
  assert.equal(serializePlantGraph(coordinator.getDocumentSnapshot().plants.get(initial.id)!), before);
});
