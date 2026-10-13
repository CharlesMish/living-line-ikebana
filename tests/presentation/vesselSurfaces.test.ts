import assert from "node:assert/strict";
import test from "node:test";
import * as THREE from "three";
import { createReed } from "../../src/core/index.ts";
import { applyVesselAppearance, createVesselFinishTextures, createVesselGrain } from "../../src/presentation/vesselAppearance.ts";
import { studioFixture } from "./studioFixture.ts";

test("new ceramic maps are deterministic, independently owned and disposed once", () => {
  for (const finish of ["satin", "speckled"]) {
    const first = createVesselFinishTextures(finish)!, second = createVesselFinishTextures(finish)!;
    assert.notEqual(first.bump, second.bump);
    assert.notEqual(first.bump.image.data, second.bump.image.data);
    assert.deepEqual(first.bump.image.data, second.bump.image.data);
    assert.deepEqual(first.color?.image.data, second.color?.image.data);
    assert.ok(new Set(first.bump.image.data).size > 8, "microrelief has actual height variation");
    assert.equal(first.bump.colorSpace, THREE.NoColorSpace);
    assert.equal(first.roughness.colorSpace, THREE.NoColorSpace);
    if (finish === "speckled") {
      assert.equal(first.color?.colorSpace, THREE.SRGBColorSpace);
      assert.ok(new Set(first.color!.image.data).size > 30, "mineral flecks have a graded, nonuniform albedo");
    } else assert.equal(first.color, undefined, "satin keeps the chosen body color");
    const maps = [first.bump, first.roughness, first.color].filter(Boolean) as THREE.DataTexture[];
    const disposals = maps.map(() => 0);
    maps.forEach((map, i) => map.addEventListener("dispose", () => disposals[i]++));
    first.dispose(); first.dispose(); second.dispose();
    assert.deepEqual(disposals, maps.map(() => 1));
  }
});

test("returning from a new ceramic finish clears maps and preserves the old glaze and stoneware", () => {
  const body = new THREE.MeshPhysicalMaterial(), rim = new THREE.MeshStandardMaterial();
  const grain = createVesselGrain(), speckled = createVesselFinishTextures("speckled")!;
  try {
    applyVesselAppearance(body, rim, { colorId: "iron", finishId: "speckled" }, grain, speckled);
    assert.equal(body.map, speckled.color); assert.equal(rim.roughnessMap, speckled.roughness);
    applyVesselAppearance(body, rim, { colorId: "sand", finishId: "glaze" }, grain);
    assert.equal(body.color.getHex(THREE.SRGBColorSpace), 0xbcb09b);
    assert.equal(rim.color.getHex(THREE.SRGBColorSpace), 0xd2c7b3);
    assert.equal(body.roughness, .38); assert.equal(body.clearcoat, .65); assert.equal(rim.roughness, .35);
    assert.equal(body.bumpScale, 0); assert.equal(rim.bumpScale, 0);
    for (const material of [body, rim]) {
      assert.equal(material.map, null); assert.equal(material.bumpMap, null); assert.equal(material.roughnessMap, null);
    }
    applyVesselAppearance(body, rim, { colorId: "sand", finishId: "stoneware" }, grain);
    assert.equal(body.bumpMap, grain); assert.equal(rim.bumpMap, grain);
    assert.equal(body.bumpScale, .008); assert.equal(body.roughness, .76); assert.equal(body.clearcoat, .06);
    assert.equal(rim.roughness, .72);
    assert.equal(body.map, null); assert.equal(body.roughnessMap, null);
  } finally { body.dispose(); rim.dispose(); grain.dispose(); speckled.dispose(); }
});

test("studios cache their own ceramic maps and release them when the renderer closes", () => {
  const first = studioFixture(createReed("first", 8278, { x: 0, y: .55, z: 0 })).studio;
  const second = studioFixture(createReed("second", 8278, { x: 0, y: .55, z: 0 })).studio;
  first.renderer = second.renderer = { dispose() {} };
  const choice = { colorId: "chalk", finishId: "speckled" };
  first.setVesselAppearance(choice); second.setVesselAppearance(choice);
  const firstMaps = first.vesselFinishTextures.get("speckled"), secondMaps = second.vesselFinishTextures.get("speckled");
  assert.notEqual(firstMaps.bump, secondMaps.bump);
  first.setVesselAppearance({ colorId: "iron", finishId: "satin" });
  first.setVesselAppearance(choice);
  assert.equal(first.vesselFinishTextures.get("speckled"), firstMaps);
  let disposed = 0;
  for (const maps of first.vesselFinishTextures.values()) {
    for (const map of [maps.bump, maps.roughness, maps.color].filter(Boolean)) map.addEventListener("dispose", () => disposed++);
  }
  first.dispose(); first.dispose();
  assert.equal(disposed, 5); assert.equal(first.vesselFinishTextures.size, 0);
  assert.equal(second.vesselFinishTextures.size, 1, "closing one renderer does not dispose another renderer's maps");
  second.dispose();
});
