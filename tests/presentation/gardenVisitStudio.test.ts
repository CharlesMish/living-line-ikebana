import assert from "node:assert/strict";
import test from "node:test";
import * as THREE from "three";
import { createReed, createBroadBlade, toCanonicalPlantGraph } from "../../src/core/index.ts";
import { ThreeStudio } from "../../src/presentation/ThreeStudio.ts";
import { studioFixture } from "./studioFixture.ts";
import { createKeptGardenDisplay, gardenPrintSize, gardenVisitLayout, visibleGardenBounds, GARDEN_ARRANGEMENT_Y, type GardenVisitEntry } from "../../src/presentation/GardenVisitStudio.ts";
import { readFileSync } from "node:fs";

function entry(id = "kept-a", seed = 8278): GardenVisitEntry {
  return { id, title: "A kept reed", thumbnail: null, arrangement: {
    plants: [toCanonicalPlantGraph(createReed("plant-1", seed, { x: 0, y: .55, z: 0 }))],
    scene: { layoutId: "original", colorId: "iron", finishId: "speckled", stemFibers: true },
  } };
}
function deepFreeze(value: any) { Object.freeze(value); for (const child of Object.values(value)) if (child && typeof child === "object" && !Object.isFrozen(child)) deepFreeze(child); return value; }
function meshResources(root: THREE.Object3D) {
  const materials = new Set<THREE.Material>(), textures = new Set<THREE.Texture>();
  root.traverse(object => {
    if (!(object instanceof THREE.Mesh)) return;
    for (const material of Array.isArray(object.material) ? object.material : [object.material]) {
      materials.add(material);
      for (const value of Object.values(material)) if (value instanceof THREE.Texture) textures.add(value);
    }
  });
  return { materials, textures };
}

test("saved arrangement derivation needs no DOM or renderer and preserves the frozen canonical snapshot", () => {
  const saved = deepFreeze(entry()), before = JSON.stringify(saved);
  assert.equal(typeof document, "undefined"); assert.equal(typeof requestAnimationFrame, "undefined");
  const display = createKeptGardenDisplay(saved);
  const bounds = visibleGardenBounds(display.group);
  assert.ok(!bounds.isEmpty()); assert.ok(bounds.max.y > 4);
  assert.equal(display.group.scale.x, 1); assert.equal(display.group.scale.y, 1); assert.equal(display.group.scale.z, 1);
  assert.ok(display.group.getObjectByName("vessel:original") || display.group.children.some(child => child.name.startsWith("vessel:")));
  assert.ok(display.group.getObjectByName("plant:plant-1"));
  assert.ok(!display.group.getObjectByName("studio-floor"));
  display.group.traverse(object => assert.ok(!(object instanceof THREE.Light), "one shared room rig, no per-bowl lights"));
  assert.equal(JSON.stringify(saved), before);
  display.dispose(); display.dispose();
  assert.equal(JSON.stringify(saved), before);
});

test("recent botanical fixtures derive the accepted surfaces without regenerating or mutating saved plants", () => {
  for (const name of ["compact-flower", "blossom-spray", "starry-pincushion", "silver-seed", "broad-blade", "lobed-leaf", "violet-sprig", "indigo-spire", "nodding-flower"]) {
    const fixture = name === "broad-blade"
      ? toCanonicalPlantGraph(createBroadBlade("plant-1", 8278, { x: 0, y: .55, z: 0 }))
      : JSON.parse(readFileSync(`fixtures/plant-1-${name}-v1.json`, "utf8"));
    const saved = deepFreeze({ ...entry(name), arrangement: { plants: [fixture] } });
    const before = JSON.stringify(saved), display = createKeptGardenDisplay(saved);
    assert.ok(!visibleGardenBounds(display.group).isEmpty(), name);
    assert.equal(JSON.stringify(saved), before, name); display.dispose();
  }
});

test("duplicate plant IDs in separate saved entries own independent materials and maps", () => {
  const first = createKeptGardenDisplay(entry("a")), second = createKeptGardenDisplay(entry("b", 9255));
  const a = meshResources(first.group), b = meshResources(second.group);
  assert.ok(a.materials.size > 5); assert.ok(a.textures.size >= 3);
  for (const material of a.materials) assert.ok(!b.materials.has(material));
  for (const texture of a.textures) assert.ok(!b.textures.has(texture));
  const textureDisposals = new Map([...a.textures].map(texture => [texture, 0]));
  a.textures.forEach(texture => texture.addEventListener("dispose", () => textureDisposals.set(texture, textureDisposals.get(texture)! + 1)));
  let otherDisposals = 0; b.textures.forEach(texture => texture.addEventListener("dispose", () => otherDisposals++));
  first.dispose(); first.dispose();
  assert.ok([...textureDisposals.values()].every(count => count === 1));
  assert.equal(otherDisposals, 0); assert.ok(second.group.children.length > 0);
  second.dispose(); assert.equal(otherDisposals, b.textures.size);
});

test("hidden proxies and inactive geometry cannot enlarge a display footprint", () => {
  const group = new THREE.Group(), visible = new THREE.Mesh(new THREE.BoxGeometry(2, 4, 6), new THREE.MeshBasicMaterial());
  group.add(visible);
  const hidden = new THREE.Mesh(new THREE.BoxGeometry(200, 200, 200), new THREE.MeshBasicMaterial()); hidden.visible = false; group.add(hidden);
  const hit = new THREE.Mesh(new THREE.BoxGeometry(500, 500, 500), new THREE.MeshBasicMaterial({ colorWrite: false, opacity: 0 })); group.add(hit);
  assert.deepEqual(visibleGardenBounds(group).getSize(new THREE.Vector3()).toArray(), [2, 4, 6]);
  group.position.set(6, 1.1, 0);
  assert.deepEqual(visibleGardenBounds(group).getCenter(new THREE.Vector3()).toArray(), [6, 1.1, 0]);
});

test("wide and deep saved arrangements gain spacing at original scale, including an asymmetric lean", () => {
  const bounds = [new THREE.Box3(new THREE.Vector3(-2, 0, -2), new THREE.Vector3(2, 6, 2)),
    new THREE.Box3(new THREE.Vector3(-1, 0, -5), new THREE.Vector3(10, 8, 3)),
    new THREE.Box3(new THREE.Vector3(-3, 0, -2), new THREE.Vector3(3, 4, 2))];
  const before = bounds.map(b => [b.min.toArray(), b.max.toArray()]), layout = gardenVisitLayout(bounds);
  assert.ok(layout.widths[1] >= 20);
  for (let i = 1; i < 3; i++) assert.ok(layout.centers[i] + bounds[i].min.x - (layout.centers[i - 1] + bounds[i - 1].max.x) >= 1.5);
  assert.ok(layout.back <= -6); assert.ok(layout.depth >= 9.7);
  assert.deepEqual(bounds.map(b => [b.min.toArray(), b.max.toArray()]), before);
});

test("portrait, landscape and square saved photographs preserve aspect inside the same mount", () => {
  for (const [width, height] of [[640, 480], [480, 640], [640, 640], [300, 100]]) {
    const fitted = gardenPrintSize(width, height);
    assert.ok(Math.abs(fitted.width / fitted.height - width / height) < 1e-12);
    assert.ok(fitted.width <= 4.4 && fitted.height <= 3.3);
  }
});

test("display derivation preserves the working studio branch vertices, surface normals and appearance", () => {
  const graph = createReed("plant-1", 8278, { x: 0, y: .55, z: 0 });
  const working = studioFixture(graph), display = ThreeStudio.createDisplayGroup([graph]);
  const findStem = (root: THREE.Object3D) => {
    let found: THREE.Mesh<THREE.BufferGeometry, THREE.MeshStandardMaterial> | undefined;
    root.traverseVisible(object => { if (object instanceof THREE.Mesh && object.userData.branchId === graph.rootBranchId
      && object.material instanceof THREE.MeshStandardMaterial && object.material.opacity === 1) found = object; });
    return found!;
  };
  const a = findStem(working.scene), b = findStem(display.group);
  assert.ok(a && b); assert.notEqual(a.geometry, b.geometry);
  assert.deepEqual(b.geometry.getAttribute("position").array, a.geometry.getAttribute("position").array);
  assert.deepEqual(b.geometry.getAttribute("normal").array, a.geometry.getAttribute("normal").array);
  assert.equal(b.material.color.getHex(), a.material.color.getHex());
  assert.equal(b.material.roughness, a.material.roughness);
  working.dispose(); display.dispose();
});

test("the existing vessel underside meets the timber support without a floating gap", () => {
  const display = createKeptGardenDisplay(entry());
  display.group.position.y = GARDEN_ARRANGEMENT_Y;
  display.group.updateMatrixWorld(true);
  let tested = 0;
  display.group.traverse(object => {
    if (!(object instanceof THREE.Mesh) || !object.name.startsWith("vessel:")) return;
    object.geometry.computeBoundingBox();
    const base = object.geometry.boundingBox!.clone().applyMatrix4(object.matrixWorld).min.y;
    assert.ok(Math.abs(base - 1.1) < 1e-6); tested++;
  });
  assert.equal(tested, 1); display.dispose();
});
