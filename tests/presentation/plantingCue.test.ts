import assert from "node:assert/strict";
import test from "node:test";
import { createReed } from "../../src/core/index.ts";
import { plantingOutline } from "../../src/presentation/plantingOutline.ts";
import {
  PLANTING_BED_RADIUS,
  PLANTING_PLATE_TOP_RADIUS,
  isPlateRim,
  plantingCueContains,
  plantingCueEllipses,
} from "../../src/presentation/plantingCue.ts";
import { VESSEL_PROFILES, inPlantingArea } from "../../src/study/vesselProfiles.ts";
import { studioFixture } from "./studioFixture.ts";

const REQUIRED_LAYOUTS = [
  "original", "compact", "petite", "pinbed-small", "pinbed-single",
  "offset", "pinbed-medium-oval", "long-bed", "islands", "vessel-pair",
];

test("planting cue geometry matches validation on every layout", () => {
  const ids = VESSEL_PROFILES.map((profile) => profile.id);
  for (const id of REQUIRED_LAYOUTS) assert.ok(ids.includes(id), id);
  for (const profile of VESSEL_PROFILES) {
    assert.deepEqual(plantingCueEllipses(profile), profile.areas);
    const width = 0.035;
    const geometry = plantingOutline(profile, width);
    const position = geometry.getAttribute("position");
    const allowance = profile.id === "original" ? width / PLANTING_BED_RADIUS + 1e-4 : width + 1e-3;
    for (let index = 0; index < position.count; index += 1) {
      const x = position.getX(index);
      const y = position.getY(index);
      let nearest = Infinity;
      for (const area of profile.areas) {
        const normalized = Math.hypot((x - area.x) / area.rx, (y - area.z) / area.rz);
        nearest = Math.min(nearest, Math.abs(normalized - 1));
      }
      assert.ok(nearest <= allowance, `${profile.id} outline vertex left the accepted ellipse`);
    }
    geometry.dispose();

    for (const area of profile.areas) {
      assert.equal(plantingCueContains({ x: area.x, z: area.z }, profile), true);
      assert.equal(inPlantingArea({ x: area.x, z: area.z }, profile), true);
      for (const angle of [0, Math.PI / 2, Math.PI, (3 * Math.PI) / 2]) {
        const inside = {
          x: area.x + Math.cos(angle) * area.rx * 0.99,
          z: area.z + Math.sin(angle) * area.rz * 0.99,
        };
        const outside = {
          x: area.x + Math.cos(angle) * area.rx * 1.01,
          z: area.z + Math.sin(angle) * area.rz * 1.01,
        };
        const rim = {
          x: area.x + Math.cos(angle) * area.rx * 1.05,
          z: area.z + Math.sin(angle) * area.rz * 1.05,
        };
        const beyond = {
          x: area.x + Math.cos(angle) * area.rx * (PLANTING_PLATE_TOP_RADIUS / PLANTING_BED_RADIUS + 0.08),
          z: area.z + Math.sin(angle) * area.rz * (PLANTING_PLATE_TOP_RADIUS / PLANTING_BED_RADIUS + 0.08),
        };
        assert.equal(plantingCueContains(inside, profile), inPlantingArea(inside, profile));
        assert.equal(plantingCueContains(inside, profile), true, `${profile.id} inside`);
        assert.equal(plantingCueContains(outside, profile), false, `${profile.id} outside`);
        assert.equal(inPlantingArea(outside, profile), false);
        assert.equal(isPlateRim(rim, profile), true, `${profile.id} rim`);
        assert.equal(inPlantingArea(rim, profile), false);
        assert.equal(isPlateRim(beyond, profile), false, `${profile.id} beyond the plate`);
      }
    }
    if (profile.areas.length > 1) {
      assert.equal(inPlantingArea({ x: 0, z: 0 }, profile), false, `${profile.id} gap`);
      assert.equal(plantingCueContains({ x: 0, z: 0 }, profile), false);
    }
  }
});

test("the cue rim is opt-in and the default plate stays the wide cylinder", () => {
  const { studio, scene, dispose } = studioFixture(createReed("p", 8278, { x: 0, y: 0.55, z: 0 }));
  try {
    studio.buildStudio();
    assert.equal(scene.getObjectByName("planting-cue"), undefined);
    assert.equal(scene.getObjectByName("planting-rim"), undefined);
    const wide = scene.children.find((child) => child.geometry?.parameters?.radiusTop === PLANTING_PLATE_TOP_RADIUS);
    assert.ok(wide, "ordinary play keeps the 1.34 plate");
    studio.options.placeCue = true;
    studio.buildStudio();
    const cue = scene.getObjectByName("planting-cue");
    const rim = scene.getObjectByName("planting-rim");
    const bed = scene.getObjectByName("planting-bed");
    assert.ok(cue && rim && bed);
    assert.equal(bed.geometry.parameters.radiusTop, PLANTING_BED_RADIUS);
    assert.equal(rim.geometry.parameters.innerRadius, PLANTING_BED_RADIUS);
    assert.equal(rim.geometry.parameters.outerRadius, PLANTING_PLATE_TOP_RADIUS);
    assert.equal(cue.visible, false);
    studio.setPlantingCue("quiet");
    assert.equal(cue.visible, true);
    assert.ok(cue.material.opacity < 0.5);
    studio.setPlantingCue("strong");
    assert.ok(cue.material.opacity > 0.9);
    studio.setPlantingCue("off");
    assert.equal(cue.visible, false);
  } finally {
    dispose();
  }
});
