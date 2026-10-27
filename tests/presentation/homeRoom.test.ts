import assert from "node:assert/strict";
import test from "node:test";
import * as THREE from "three";
import { buildHomeRoom } from "../../src/presentation/homeRoom.ts";
import { mergeStaticMeshes, materialSignature } from "../../src/presentation/staticMerge.ts";
import { HOME_PLACES, HOME_ROOM, arrangementExtent, homePlace, type HomePlaceId } from "../../src/presentation/homePlaces.ts";
import { VESSEL_PROFILES } from "../../src/study/vesselProfiles.ts";
import { createKeptGardenDisplay } from "../../src/presentation/GardenVisitStudio.ts";
import { createWorkbenchFixture } from "../../src/app/workbench.ts";

const worldBox = (object: THREE.Object3D) => new THREE.Box3().setFromObject(object);
const visibleTriangles = (root: THREE.Object3D) => {
  let count = 0;
  root.traverseVisible(object => {
    if (!(object instanceof THREE.Mesh) || object instanceof THREE.InstancedMesh) return;
    const material = object.material as THREE.Material;
    if (!material.visible) return;
    count += (object.geometry.index?.count ?? object.geometry.attributes.position!.count) / 3;
  });
  return count;
};

test("merging keeps every visible triangle, hides originals instead of removing them, and is undone cleanly", () => {
  const root = new THREE.Group();
  const shared = new THREE.MeshStandardMaterial({ color: 0x336699 });
  const clone = shared.clone();
  const a = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), shared); a.position.set(2, 0, 0);
  const b = new THREE.Mesh(new THREE.BoxGeometry(1, 2, 1), clone); b.scale.set(-1, 1, 1);
  const lonely = new THREE.Mesh(new THREE.SphereGeometry(1), new THREE.MeshStandardMaterial({ color: 0xff0000 }));
  const proxy = new THREE.Mesh(new THREE.BoxGeometry(9, 9, 9), new THREE.MeshBasicMaterial({ visible: false }));
  const kept = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), shared); const excluded = new THREE.Group(); excluded.add(kept);
  root.add(a, b, lonely, proxy, excluded);
  const before = visibleTriangles(root), box = worldBox(root);
  assert.equal(materialSignature(shared), materialSignature(clone), "identical clones batch together");
  assert.notEqual(materialSignature(shared), materialSignature(lonely.material as THREE.Material));

  const merge = mergeStaticMeshes(root, new Set([excluded]));
  assert.equal(merge.merged, 2);
  assert.equal(merge.batches, 1);
  assert.equal(a.visible, false); assert.equal(b.visible, false);
  assert.equal(lonely.visible, true, "a material used once draws as before");
  assert.equal(kept.visible, true, "excluded subtrees are left alone");
  assert.equal(a.parent, root, "originals stay in place for their owner to dispose");
  assert.equal(visibleTriangles(root), before);
  assert.ok(worldBox(merge.group).min.distanceTo(new THREE.Vector3(-.5, -1, -.5)) < 1e-9);
  assert.ok(worldBox(root).equals(box));

  // The mirrored box still faces outward: its first triangle's normal agrees with its stored normal.
  const merged = merge.group.children[0] as THREE.Mesh;
  const position = merged.geometry.attributes.position!, normal = merged.geometry.attributes.normal!, index = merged.geometry.index!;
  const start = index.count - (b.geometry.index!.count);
  const [i0, i1, i2] = [index.getX(start), index.getX(start + 1), index.getX(start + 2)];
  const p = [i0, i1, i2].map(i => new THREE.Vector3().fromBufferAttribute(position, i));
  const face = new THREE.Vector3().subVectors(p[1]!, p[0]!).cross(new THREE.Vector3().subVectors(p[2]!, p[0]!)).normalize();
  assert.ok(face.dot(new THREE.Vector3().fromBufferAttribute(normal, i0)) > .99);

  merge.dispose();
  assert.equal(merge.group.parent, null);
});

test("the room builds from code, merges to a handful of batches, and releases what it owns", () => {
  const room = buildHomeRoom();
  let meshes = 0;
  room.group.traverse(object => { if (object instanceof THREE.Mesh) meshes++; });
  assert.ok(meshes > 100, `a detailed room (${meshes} meshes)`);
  const merge = mergeStaticMeshes(room.group, new Set([room.scroll.group]));
  assert.ok(merge.batches <= 20, `${merge.batches} batches`);
  assert.ok(merge.merged > 100);
  assert.equal(room.scroll.photo.visible, true, "the scroll photo stays its own mesh");

  // Every arrangement place sits on a surface of the room and below its headroom.
  const box = worldBox(room.group);
  for (const place of HOME_PLACES) {
    assert.ok(box.containsPoint(new THREE.Vector3(place.x, place.y, place.z)), `${place.id} is inside the room`);
    if (place.kind === "arrangement") assert.ok(place.clearance > 6, `${place.id} has usable headroom`);
  }
  assert.ok(HOME_ROOM.cupboardBottom > HOME_ROOM.shelfHighTop && HOME_ROOM.lintel > HOME_ROOM.cupboardBottom);

  const textures = new Set<THREE.Texture>();
  room.group.traverse(object => {
    if (!(object instanceof THREE.Mesh)) return;
    for (const value of Object.values(object.material as THREE.Material)) if (value instanceof THREE.Texture) textures.add(value);
  });
  let disposedTextures = 0;
  for (const texture of textures) texture.addEventListener("dispose", () => disposedTextures++);
  merge.dispose(); room.dispose();
  assert.equal(disposedTextures, textures.size);
  assert.equal(room.group.children.length, 0);
});

/** Boxes of every solid room mesh, before merging. */
function roomBoxes() {
  const room = buildHomeRoom(), boxes: { name: string; box: THREE.Box3 }[] = [];
  room.group.updateMatrixWorld(true);
  room.group.traverse(object => { if (object instanceof THREE.Mesh) boxes.push({ name: object.name, box: worldBox(object) }); });
  return { boxes, dispose: () => room.dispose() };
}
const hits = (boxes: { name: string; box: THREE.Box3 }[], probe: THREE.Box3) => boxes.filter(item => item.box.intersectsBox(probe)).map(item => item.name);

test("every place's vessel space is clear of the room, the window desk included", () => {
  const { boxes, dispose } = roomBoxes();
  const widest = VESSEL_PROFILES.map(profile => arrangementExtent({ plants: [], scene: { layoutId: profile.id } }));
  for (const place of HOME_PLACES) {
    if (place.kind !== "arrangement") continue;
    const halfX = Math.min(place.surfaceHalfX, Math.max(...widest.map(item => item.vesselHalfX))) - .01;
    const halfZ = Math.min(place.surfaceHalfZ, Math.max(...widest.map(item => item.vesselHalfZ))) - .01;
    const space = new THREE.Box3(new THREE.Vector3(place.x - halfX, place.y + .01, place.z - halfZ), new THREE.Vector3(place.x + halfX, place.y + .66, place.z + halfZ));
    assert.deepEqual(hits(boxes, space), [], `${place.id}: a bowl here would pass through the room`);
  }
  // The Original bowl used to reach past the shoji's inner face.
  const shoin = homePlace("shoin")!;
  assert.ok(shoin.x - 2.64 > HOME_ROOM.left - HOME_ROOM.shoinDepth + HOME_ROOM.shojiFrame, "the Original bowl stands clear of the shoji");
  dispose();
});

test("each obstacle plane is where the room's walls, paper and boards are", () => {
  const { boxes, dispose } = roomBoxes();
  // One probe per plane: the other horizontal coordinate and height, both local to the place.
  const probes: { place: HomePlaceId; label: string; other: number; y: number }[] = [
    { place: "tokonoma", label: "the back of the alcove", other: 0, y: 3 },
    { place: "tokonoma", label: "the hanging scroll", other: 4.2, y: 7 },
    { place: "tokonoma", label: "the hanging scroll", other: 0, y: 10 },
    { place: "tokonoma", label: "the side of the alcove", other: 0, y: 3 },
    { place: "shoin", label: "the shoji behind it", other: 0, y: 3 },
    { place: "shoin", label: "the side of the window bay", other: 0, y: 3 },
    { place: "shelf-low", label: "the back wall", other: 0, y: 2 },
    { place: "shelf-low", label: "the side of the shelf alcove", other: 0, y: 2 },
    { place: "shelf-low", label: "the upper shelf", other: 0, y: 3.8 },
    { place: "shelf-low", label: "the little post between the shelves", other: 2.15, y: 2 },
    { place: "shelf-high", label: "the back wall", other: 0, y: 2 },
    { place: "shelf-high", label: "the side wall", other: 0, y: 2 },
  ];
  let checked = 0;
  for (const place of HOME_PLACES) for (const obstacle of place.obstacles) {
    const probe = probes.find(item => item.place === place.id && item.label === obstacle.label
      && (obstacle.minY === undefined || item.y >= obstacle.minY) && (obstacle.maxY === undefined || item.y <= obstacle.maxY)
      && (!obstacle.across || (item.other >= obstacle.across[0] && item.other <= obstacle.across[1])));
    assert.ok(probe, `${place.id}: a probe for ${obstacle.label}`);
    const at = (offset: number) => {
      const local = { x: 0, z: 0 }; local[obstacle.axis] = obstacle.sign * (obstacle.limit + offset); local[obstacle.axis === "x" ? "z" : "x"] = probe.other;
      const centre = new THREE.Vector3(place.x + local.x, place.y + probe.y, place.z + local.z);
      return hits(boxes, new THREE.Box3().setFromCenterAndSize(centre, new THREE.Vector3(.02, .02, .02)));
    };
    assert.deepEqual(at(-.05), [], `${place.id}: just inside ${obstacle.label} is open`);
    assert.ok(at(.05).length > 0, `${place.id}: just past ${obstacle.label} is solid`);
    checked++;
  }
  assert.equal(checked, 14, "every plane has been probed");
  dispose();
});

test("a kept arrangement merges without changing what it draws", () => {
  const entry = { id: "e", title: "", thumbnail: null, arrangement: createWorkbenchFixture("blossom-spray", 8278, 1) };
  const display = createKeptGardenDisplay(entry);
  const before = visibleTriangles(display.group), bounds = worldBox(display.group);
  const merge = mergeStaticMeshes(display.group);
  assert.ok(merge.merged > merge.batches, `${merge.merged} meshes into ${merge.batches} batches`);
  assert.equal(visibleTriangles(display.group), before);
  assert.ok(worldBox(display.group).equals(bounds));
  merge.dispose(); display.dispose();
});
