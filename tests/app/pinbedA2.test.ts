import assert from "node:assert/strict";
import test from "node:test";
import { canonicalCameraPose } from "../../src/app/camera.ts";
import { createDomainAdapters } from "../../src/app/domainAdapters.ts";
import { TransactionCoordinator } from "../../src/input/TransactionCoordinator.ts";
import { plantingOutline } from "../../src/presentation/plantingOutline.ts";
import { createReed, serializePlantGraph } from "../../src/core/index.ts";
import {
  EXPERIMENTAL_VESSEL_PROFILES,
  VESSEL_PROFILES,
  inPlantingArea,
  keyboardPlantingPoint,
  plantingPins,
  readVesselStudy,
  vesselProfilesForSelection,
  type VesselProfile,
} from "../../src/study/vesselProfiles.ts";

const profile = (id: string): VesselProfile => {
  const found = [...VESSEL_PROFILES, ...EXPERIMENTAL_VESSEL_PROFILES].find(candidate => candidate.id === id);
  assert.ok(found, `missing profile ${id}`);
  return found;
};
const point = (x = 0, z = 0) => ({ x, y: .55, z });

test("A2 profile changes only Small bed field radius to .391; ceramic stays .54/.54", () => {
  const control = profile("pinbed-small");
  const a2 = profile("pinbed-small-a2");
  assert.equal(control.scaleX, .54);
  assert.equal(control.scaleZ, .54);
  assert.equal(a2.scaleX, .54);
  assert.equal(a2.scaleZ, .54);
  assert.deepEqual(control.areas[0], { x: 0, z: 0, rx: .34, rz: .34 });
  assert.deepEqual(a2.areas[0], { x: 0, z: 0, rx: .391, rz: .391 });
});

test("A2 remains opt-in and preserves default catalog order when absent", () => {
  assert.equal(readVesselStudy(new URL("https://example.test/?vesselStudy=pinbed-small-a2")), undefined);
  assert.equal(readVesselStudy(new URL("https://example.test/?campaignA2=1&vesselStudy=pinbed-small-a2"))?.id, "pinbed-small-a2");
  assert.deepEqual(
    vesselProfilesForSelection(false).map(candidate => candidate.id),
    VESSEL_PROFILES.map(candidate => candidate.id),
  );
});

test("A2 area drives pins/outline/pointer boundary and keyboard placement from one definition", () => {
  const control = profile("pinbed-small");
  const a2 = profile("pinbed-small-a2");
  assert.ok(plantingPins(a2).length > plantingPins(control).length);
  for (const [x, z] of plantingPins(a2)) assert.ok(inPlantingArea(point(x, z), a2));
  for (let ordinal = 1; ordinal <= 200; ordinal += 1) assert.ok(inPlantingArea(keyboardPlantingPoint(ordinal, a2), a2));

  for (let step = 0; step < 24; step += 1) {
    const angle = (step / 24) * Math.PI * 2;
    const nearInside = point(Math.cos(angle) * .391 * .999, Math.sin(angle) * .391 * .999);
    const nearOutside = point(Math.cos(angle) * .391 * 1.001, Math.sin(angle) * .391 * 1.001);
    assert.equal(inPlantingArea(nearInside, a2), true);
    assert.equal(inPlantingArea(nearOutside, a2), false);
  }

  const controlOutline = plantingOutline(control, .035);
  const a2Outline = plantingOutline(a2, .035);
  try {
    // Circular layout uses TorusGeometry; larger r must produce a larger x-span.
    controlOutline.computeBoundingBox();
    a2Outline.computeBoundingBox();
    const controlWidth = (controlOutline.boundingBox!.max.x - controlOutline.boundingBox!.min.x);
    const a2Width = (a2Outline.boundingBox!.max.x - a2Outline.boundingBox!.min.x);
    assert.ok(a2Width > controlWidth);
  } finally {
    controlOutline.dispose();
    a2Outline.dispose();
  }
});

test("layout switch to A2 preserves coordinates on acquisition/no-motion release, including out-of-field roots", () => {
  const control = profile("pinbed-small");
  const a2 = profile("pinbed-small-a2");
  let current = control;
  const graph = createReed("plant-1", 8278, point(1.1, .2));
  const before = serializePlantGraph(graph);
  const coordinator = new TransactionCoordinator(
    createDomainAdapters(undefined, () => current),
    {
      plants: new Map([[graph.id, graph]]),
      selectedPlantId: graph.id,
      camera: canonicalCameraPose("front"),
      successfulPlantOrdinal: 1,
    },
  );

  current = a2;
  coordinator.beginBase(1, { plantId: graph.id, context: {} }, { base: point(1.1, .2) });
  assert.equal(serializePlantGraph(coordinator.getPresentationState().active.graph), before);
  coordinator.release(1);
  assert.equal(serializePlantGraph(coordinator.getDocumentSnapshot().plants.get(graph.id)!), before);
  assert.equal(coordinator.canUndo(), false);
});
