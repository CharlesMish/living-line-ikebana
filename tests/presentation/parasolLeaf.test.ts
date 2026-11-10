import assert from "node:assert/strict";
import test from "node:test";
import * as THREE from "three";
import { createParasolLeaf, previewPrune, applyPrune, serializePlantGraph } from "../../src/core/index.ts";
import { createLeafGeometry, createLeafVeinGeometry } from "../../src/presentation/botanicalGeometry.ts";
import { getMaterialAppearance } from "../../src/presentation/materialAppearance.ts";
import { botanicalFamily, resolveBotanicalAppearance } from "../../src/presentation/botanicalTones.ts";
import { createParasolBladeGeometry, createParasolRibGeometry, createParasolFurlGeometry, parasolRibCount,
  PARASOL_BLADE_RADIUS, PARASOL_BLADE_DEPTH, PARASOL_FURL_HEIGHT, PARASOL_FURL_RADIUS,
} from "../../src/presentation/parasolLeafGeometry.ts";
import { studioFixture } from "./studioFixture.ts";

const SEEDS = [0, 8278, 9255, 10232, 0xffffffff];
const BASE = { x: 0, y: 0.55, z: 0 };
const finite = (geometry: THREE.BufferGeometry) => ["position", "normal", "color"].every(key =>
  Array.from(geometry.getAttribute(key).array).every(Number.isFinite));
function topology(geometry: THREE.BufferGeometry) {
  const p = geometry.getAttribute("position"), ix = geometry.index!;
  const edges = new Map<string, number>(); let volume = 0;
  for (let i = 0; i < ix.count; i += 3) {
    const v = [ix.getX(i), ix.getX(i + 1), ix.getX(i + 2)];
    const a = new THREE.Vector3().fromBufferAttribute(p, v[0]!), b = new THREE.Vector3().fromBufferAttribute(p, v[1]!), c = new THREE.Vector3().fromBufferAttribute(p, v[2]!);
    volume += a.dot(b.clone().cross(c)) / 6;
    assert.ok(b.sub(a).cross(c.sub(a)).lengthSq() > 1e-18, "no degenerate triangle");
    for (let e = 0; e < 3; e++) { const key = [v[e]!, v[(e + 1) % 3]!].sort((x, y) => x - y).join(":"); edges.set(key, (edges.get(key) ?? 0) + 1); }
  }
  return { volume, edges: [...edges.values()] };
}

test("the open blade is one closed, round, shallow bowl with distinct upper and lower faces", () => {
  for (const seed of SEEDS) {
    const blade = createParasolBladeGeometry(seed), repeat = createLeafGeometry(seed, "parasol");
    try {
      assert.ok(finite(blade));
      for (const key of ["position", "normal", "color"]) assert.deepEqual(blade.getAttribute(key).array, repeat.getAttribute(key).array);
      const { volume, edges } = topology(blade);
      assert.ok(volume > 0.01, "outward winding around a real thickness");
      assert.ok(edges.every(count => count === 2), "closed: no open edge and no doubled sheet");
      const box = blade.boundingBox!;
      // Across local X/Z, centred on the stalk attachment, and round.
      for (const extent of [box.max.x, -box.min.x, box.max.z, -box.min.z]) {
        assert.ok(extent > PARASOL_BLADE_RADIUS * 0.93 && extent < PARASOL_BLADE_RADIUS * 1.07, `radius ${extent}`);
      }
      // Shallow: the rim rises above the attachment, well short of a cup.
      assert.ok(box.max.y > PARASOL_BLADE_DEPTH * 0.7 && box.max.y < PARASOL_BLADE_DEPTH * 2);
      assert.ok(box.min.y < 0 && box.min.y > -0.04);
      const normal = blade.getAttribute("normal"), color = blade.getAttribute("color"), faceSize = normal.count / 2;
      assert.ok(normal.getY(0) > 0.9, "upper face looks along the supporting tangent");
      assert.ok(normal.getY(faceSize) < -0.9, "lower face looks back down the stalk");
      // The reverse is paler than the upper face at the same station.
      for (const index of [faceSize - 1, faceSize - 20, 200]) assert.ok(color.getX(faceSize + index) > color.getX(index) + 0.1);
      // Entire margin: every boundary vertex stays within the undulation, so
      // there is no notch for the silhouette to lose at a distance.
      const p = blade.getAttribute("position");
      for (let i = faceSize - 56; i < faceSize; i++) {
        const r = Math.hypot(p.getX(i), p.getZ(i));
        assert.ok(r > PARASOL_BLADE_RADIUS * 0.94 && r < PARASOL_BLADE_RADIUS * 1.06);
      }
    } finally { blade.dispose(); repeat.dispose(); }
  }
  const a = createParasolBladeGeometry(8278), b = createParasolBladeGeometry(9255);
  assert.notDeepEqual(a.getAttribute("position").array, b.getAttribute("position").array, "seeded, not one stamped disc");
  a.dispose(); b.dispose();
});

test("ribs radiate from the attachment on both faces, divide once, and stay on the blade", () => {
  for (const seed of SEEDS) {
    const ribs = createParasolRibGeometry(seed), repeat = createLeafVeinGeometry(seed, "parasol");
    try {
      assert.ok(finite(ribs));
      assert.deepEqual(ribs.getAttribute("position").array, repeat.getAttribute("position").array);
      const count = parasolRibCount(seed);
      assert.ok(count >= 13 && count <= 15);
      // Per face and rib: one 4-station trunk (3 quads) and two 3-station forks (2 quads each).
      assert.equal(ribs.index!.count / 3, 2 * count * (3 + 2 + 2) * 2);
      const p = ribs.getAttribute("position");
      let upper = 0, lower = 0;
      for (let i = 0; i < p.count; i++) {
        const r = Math.hypot(p.getX(i), p.getZ(i));
        assert.ok(r < PARASOL_BLADE_RADIUS * 1.0, "a rib never overhangs the margin");
        assert.ok(Math.abs(p.getY(i)) < PARASOL_BLADE_DEPTH * 2);
        if (i < p.count / 2) upper++; else lower++;
      }
      assert.equal(upper, lower);
      topology(ribs);
    } finally { ribs.dispose(); repeat.dispose(); }
  }
});

test("the furled leaf is a slender pointed roll along its stalk, with a real spiral step", () => {
  for (const seed of SEEDS) {
    const furl = createParasolFurlGeometry(seed), repeat = createParasolFurlGeometry(seed);
    try {
      assert.ok(finite(furl));
      assert.deepEqual(furl.getAttribute("position").array, repeat.getAttribute("position").array);
      const box = furl.boundingBox!;
      assert.equal(box.min.y, 0);
      assert.ok(Math.abs(box.max.y - PARASOL_FURL_HEIGHT) < 1e-6);
      const width = Math.max(box.max.x - box.min.x, box.max.z - box.min.z);
      assert.ok(width < PARASOL_FURL_RADIUS * 2.6 && width > PARASOL_FURL_RADIUS * 1.4, `width ${width}`);
      assert.ok(PARASOL_FURL_HEIGHT / width > 3.4, "reads as a spear, not a bud");
      const { volume, edges } = topology(furl);
      assert.ok(volume > 0, "outward winding");
      // Open only at the stalk and at the point: 15 boundary edges at each end.
      assert.equal(edges.filter(count => count === 1).length, 30);
      assert.ok(edges.every(count => count === 1 || count === 2));
      // The outer wrap stands proud of the roll beneath it at every height.
      // Measured across the roll, so the spear's slight lean does not matter:
      // the wrap's two ends share one direction from the roll's own axis.
      const p = furl.getAttribute("position"), row = 15;
      const at = (ring: number, side: number) => new THREE.Vector3().fromBufferAttribute(p, ring * row + side);
      for (let ring = 1; ring < 14; ring++) {
        const inner = at(ring, 0), outer = at(ring, 14), opposite = at(ring, 7);
        const step = outer.clone().sub(inner), across = inner.clone().sub(opposite);
        assert.ok(step.length() > across.length() * 0.15, `ring ${ring} step`);
        assert.ok(step.clone().normalize().dot(across.clone().normalize()) > 0.99, `ring ${ring} step faces outward`);
      }
    } finally { furl.dispose(); repeat.dispose(); }
  }
});

test("only the real leaf surfaces acquire, each for its own stalk, and the water beside a blade stays free", () => {
  for (const seed of [8278, 9255, 10232]) {
    const graph = createParasolLeaf("plant-1", seed, BASE);
    const { visual, dispose } = studioFixture(graph);
    try {
      const leaf = visual.organs.get("plant-1:leaf")!, furl = visual.organs.get("plant-1:furl")!;
      const meshes = (group: THREE.Group) => group.children.filter((n): n is THREE.Mesh => n instanceof THREE.Mesh);
      const blade = meshes(leaf.group).find(m => m.geometry.name === "living-line/parasol-blade")!;
      const ribs = meshes(leaf.group).find(m => m.geometry.name === "living-line/parasol-ribs")!;
      const roll = meshes(furl.group).find(m => m.geometry.name === "living-line/parasol-furl")!;
      assert.ok(blade && ribs && roll);
      assert.equal(leaf.hit.geometry.getAttribute("position").count,
        blade.geometry.getAttribute("position").count + ribs.geometry.getAttribute("position").count);
      assert.equal(furl.hit.geometry.getAttribute("position").count, roll.geometry.getAttribute("position").count);
      assert.notEqual(furl.hit.geometry, roll.geometry, "the pick proxy owns its copy");
      assert.deepEqual(leaf.hit.userData, { plantId: "plant-1", branchId: "plant-1:neck", organId: "plant-1:leaf", targetKind: "organ" });
      assert.deepEqual(furl.hit.userData, { plantId: "plant-1", branchId: "plant-1:shoot", organId: "plant-1:furl", targetKind: "organ" });

      // Along the blade's own normal, from both faces: on the blade it is hit;
      // just outside its margin there is nothing to grab.
      leaf.group.updateMatrixWorld(true);
      const centre = new THREE.Vector3().setFromMatrixPosition(leaf.group.matrixWorld);
      const axes = [new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3()] as const;
      leaf.group.matrixWorld.extractBasis(axes[0], axes[1], axes[2]);
      const [side, normal] = [axes[0].clone().normalize(), axes[1].clone().normalize()];
      const scale = graph.organs.get("plant-1:leaf")!.scale;
      for (const face of [1, -1]) {
        const probe = (radius: number) => {
          const origin = centre.clone().addScaledVector(side, radius * scale).addScaledVector(normal, face * 2);
          return new THREE.Raycaster(origin, normal.clone().multiplyScalar(-face)).intersectObject(leaf.hit).length;
        };
        assert.ok(probe(PARASOL_BLADE_RADIUS * 0.5) > 0, "the blade surface acquires from either face");
        assert.equal(probe(PARASOL_BLADE_RADIUS * 1.12), 0, "open water beside the blade does not");
      }

      // A cut on the young stalk hides only the furled leaf.
      const shoot = graph.branches.get("plant-1:shoot")!;
      const cut = applyPrune(graph, previewPrune(graph, shoot.id, shoot.activeLength * 0.5));
      const before = serializePlantGraph(graph);
      const after = studioFixture(cut);
      try {
        assert.equal(after.visual.organs.get("plant-1:furl")!.group.visible, false);
        assert.equal(after.visual.organs.get("plant-1:leaf")!.group.visible, true);
        assert.deepEqual(
          Array.from((after.visual.organs.get("plant-1:leaf")!.group.children[0] as THREE.Mesh).geometry.getAttribute("position").array),
          Array.from(blade.geometry.getAttribute("position").array), "the kept blade is not regenerated");
      } finally { after.dispose(); }
      assert.equal(serializePlantGraph(graph), before);
    } finally { dispose(); }
  }
});

test("appearance resolves by generator version, uses exact surfaces, and adds no tone family", () => {
  const appearance = getMaterialAppearance("parasol-leaf-v1");
  assert.equal(appearance.leaf.form, "parasol");
  assert.equal(appearance.leaf.surfacePicking, true);
  assert.equal(appearance.leaf.hitRadius, 0);
  assert.deepEqual(appearance.bud, { form: "furled-leaf", roughness: 0.6 });
  // Natural only, like reed and trailer: saved scenes gain no new tone keys.
  assert.equal(botanicalFamily("parasol-leaf-v1"), undefined);
  assert.equal(resolveBotanicalAppearance("parasol-leaf-v1", appearance).leaf.color, appearance.leaf.color);
  // Every other material keeps its original flower-bud sphere.
  for (const version of ["one-branch-v1", "silver-seed-v1", "lobed-leaf-v1"]) assert.equal(getMaterialAppearance(version).bud, undefined);
});
