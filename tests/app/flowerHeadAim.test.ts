import assert from "node:assert/strict";
import test from "node:test";
import * as THREE from "three";
import { IkebanaApp } from "../../src/app/IkebanaApp.ts";
import { canonicalCameraPose } from "../../src/app/camera.ts";
import { createDomainAdapters } from "../../src/app/domainAdapters.ts";
import { captureFlowerHeadTilt, flowerHeadTiltRotation, HEAD_TILT_MAX_RADIANS } from "../../src/app/flowerHeadAim.ts";
import { StemPrevention } from "../../src/app/stemPrevention.ts";
import { add, aimBranch, applyPrune, createSingleFlower, deserializePlantGraph, distance, dot, previewPrune, quaternionFromAxisAngle, rotateVector, sampleMaterialFrame, serializePlantGraph, subtract } from "../../src/core/index.ts";
import { TransactionCoordinator } from "../../src/input/index.ts";
import { studioFixture } from "../presentation/studioFixture.ts";
import { assertAttachmentCoincidence, assertRestLengthsPreserved } from "../core/helpers.ts";

function face(graph: any) {
  const organ = graph.organs.get("plant-1:bloom");
  const frame = sampleMaterialFrame(graph.branches.get(organ.branchId), organ.distance);
  return rotateVector(frame.normal, quaternionFromAxisAngle(frame.tangent, organ.spin));
}
const degreesBetween = (a: any, b: any) => Math.acos(Math.max(-1, Math.min(1, dot(a, b)))) * 180 / Math.PI;
function harness(seed = 8278, prevent = false) {
  const stock = createSingleFlower("plant-1", seed, { x: 0, y: 0.55, z: 0 });
  // Keep an inactive record in the acquisition to protect actual pruning history.
  const graph = applyPrune(stock, previewPrune(stock, "plant-1:petiole-1", 0.1));
  const before = serializePlantGraph(graph);
  const h = studioFixture(graph);
  const organ = graph.organs.get("plant-1:bloom")!;
  const group = h.visual.organs.get(organ.id).group;
  const center = new THREE.Box3().setFromObject(group).getCenter(new THREE.Vector3());
  const projected = h.studio.projectPoint(center);
  const hits: any[] = [];
  for (let dy = -35; dy <= 35; dy += 3) for (let dx = -35; dx <= 35; dx += 3) {
    const x = projected.clientX + dx, y = projected.clientY + dy;
    const candidate = h.studio.collectHitCandidates(x, y)[0];
    if (candidate?.organId === organ.id && candidate.aimPoint) hits.push({ candidate, x, y });
  }
  hits.sort((a, b) => Math.hypot(a.x - projected.clientX, a.y - projected.clientY)
    - Math.hypot(b.x - projected.clientX, b.y - projected.clientY));
  assert.ok(hits[0], "real head geometry must expose a pickable surface");
  const { candidate, x, y } = hits[0];
  const saves: unknown[] = [];
  let coordinator: any;
  const protection = new StemPrevention(() => prevent, () => coordinator.getDocumentSnapshot().plants.values());
  coordinator = new TransactionCoordinator(createDomainAdapters(protection), {
    plants: new Map([[graph.id, graph]]), camera: canonicalCameraPose("front"),
    selectedPlantId: graph.id, successfulPlantOrdinal: 1,
  }, { onAutosave: event => saves.push(event) });
  const app: any = Object.assign(Object.create(IkebanaApp.prototype), {
    coordinator, studio: h.studio, canvas: {},
    canonicalHash: () => before, assignSelectedBranch() {}, capturePointer() {}, recordHit() {},
    ui: { setStatus() {} },
  });
  const begin = (c = candidate) => app.beginAim({ pointerId: 7, clientX: x, clientY: y }, c);
  const move = (dx: number, dy: number, pointerId = 7) => app.handlePointerMove({ pointerId, pointerType: "touch", buttons: 1,
    clientX: x + dx, clientY: y + dy, preventDefault() {} });
  const preview = () => coordinator.getPresentationState().active.graph;
  return { ...h, graph, before, candidate, app, coordinator, protection, saves, begin, move, preview, x, y };
}

for (const seed of [8278, 9255, 10232]) {
  test(`single flower ${seed}: real petal acquisition tilts in both axes while stalks keep normal Aim`, () => {
    const h = harness(seed);
    try {
      h.begin();
      assert.ok(h.app.gesture.headTilt);
      assert.equal(serializePlantGraph(h.preview()), h.before, "no acquisition jump");
      for (const [dx, dy] of [[40, 0], [0, 40], [-40, 0], [0, -40]]) {
        h.move(dx, dy);
        const edited = h.preview();
        assert.ok(degreesBetween(face(h.graph), face(edited)) > 24, "either axis gives useful head-facing change");
        assertRestLengthsPreserved(h.graph, edited);
        assertAttachmentCoincidence(edited);
        for (const [id, branch] of h.graph.branches) {
          if (id !== h.candidate.branchId) assert.deepEqual(edited.branches.get(id), branch, "head turns without moving the stem, leaves, or inactive history");
        }
        assert.deepEqual(edited.organs, h.graph.organs, "spin, scale, attachments and inactive organs stay exact");
      }
      h.move(0, 0);
      assert.equal(serializePlantGraph(h.preview()), h.before, "return to acquisition is exact");
      h.coordinator.pointerCancel(7);
      // A projected/proxy hit and an ordinary stalk hit use the existing world-plane law.
      for (const candidate of [{ ...h.candidate, aimPoint: undefined }, { ...h.candidate, kind: "branch", organId: undefined, aimPoint: undefined }]) {
        h.begin(candidate);
        assert.equal(h.app.gesture.headTilt, undefined);
        const gesture = h.app.gesture;
        h.move(0, 40);
        const end = h.studio.intersectClientPlane(h.x, h.y + 40, gesture.plane)!;
        const target = add(gesture.grabbedPoint, subtract(end, gesture.startPlaneHit));
        const expected = aimBranch(h.graph, candidate.branchId, gesture.grabbedPoint, target);
        assert.equal(serializePlantGraph(h.preview()), serializePlantGraph(expected));
        h.coordinator.pointerCancel(7);
      }
      assert.equal(h.saves.length, 0);
    } finally { h.dispose(); }
  });
}

test("head tilt freezes camera axes, ignores other pointers, cancels, commits, reloads and undoes", () => {
  const h = harness();
  try {
    h.begin(); h.move(20, 15);
    const first = serializePlantGraph(h.preview());
    h.move(80, 80, 8);
    assert.equal(serializePlantGraph(h.preview()), first, "another pointer cannot steer the head");
    // Even a later presentation change cannot replace the acquired axes/gain.
    h.studio.getCameraAxes = () => { throw new Error("must not reread camera axes during a head edit"); };
    h.move(-30, 30); h.move(20, 15);
    assert.equal(serializePlantGraph(h.preview()), first, "updates come from acquisition, not preceding previews");
    h.coordinator.visibilityHidden();
    assert.equal(serializePlantGraph(h.coordinator.getDocumentSnapshot().plants.get(h.graph.id)), h.before);
    assert.equal(h.saves.length, 0);
    assert.equal(h.coordinator.release(7).ok, false);
    // Restore only the acquisition API; the user starts a new transaction.
    h.studio.getCameraAxes = () => ({ right: { x: 1, y: 0, z: 0 }, up: { x: 0, y: 1, z: 0 }, forward: { x: 0, y: 0, z: -1 } });
    h.begin(); h.move(25, -20);
    const final = serializePlantGraph(h.preview()); h.coordinator.release(7);
    assert.equal(h.saves.length, 1);
    assert.equal(serializePlantGraph(h.coordinator.getDocumentSnapshot().plants.get(h.graph.id)), final);
    assert.equal(serializePlantGraph(deserializePlantGraph(final)), final);
    assert.ok(!final.includes("headTilt") && !final.includes("headRotation"));
    h.coordinator.commandUndo();
    assert.equal(serializePlantGraph(h.coordinator.getDocumentSnapshot().plants.get(h.graph.id)), h.before);
    assert.equal(h.coordinator.getDebugState().successfulPlantOrdinal, 1);
  } finally { h.dispose(); }
});

test("Prevent overlaps on uses the same rigid head request on an unobstructed plant", () => {
  const free = harness(8278, false), protectedHead = harness(8278, true);
  try {
    for (const h of [free, protectedHead]) { h.begin(); h.move(35, -25); }
    for (const [id, branch] of free.preview().branches) {
      const guarded = protectedHead.preview().branches.get(id);
      branch.points.forEach((point: any, index: number) => assert.ok(distance(point, guarded.points[index]) < 1e-12));
    }
    assert.equal(protectedHead.protection.feedback.reason, "clear");
    protectedHead.move(0, 0);
    assert.equal(serializePlantGraph(protectedHead.preview()), protectedHead.before);
    protectedHead.coordinator.pointerCancel(7);
    assert.equal(protectedHead.saves.length, 0);
  } finally { free.dispose(); protectedHead.dispose(); }
});

test("head tilts are bounded, finite and keep a frozen frame", () => {
  const axes = { right: { x: 1, y: 0, z: 0 }, up: { x: 0, y: 1, z: 0 } };
  const frame = captureFlowerHeadTilt(axes); axes.up.x = 1;
  assert.equal(frame.up.x, 0);
  const identity = { x: 0, y: 0, z: 0, w: 1 };
  assert.deepEqual(flowerHeadTiltRotation(frame, 0, 0), identity);
  assert.deepEqual(flowerHeadTiltRotation(frame, Infinity, 0), identity);
  for (const [dx, dy] of [[1e5, 0], [-1e5, 0], [0, 1e5], [0, -1e5], [1e5, 1e5]]) {
    const rotation = flowerHeadTiltRotation(frame, dx, dy);
    assert.ok(Math.abs(2 * Math.acos(rotation.w) - HEAD_TILT_MAX_RADIANS) < 1e-10);
    assert.ok(Math.abs(rotation.x ** 2 + rotation.y ** 2 + rotation.z ** 2 + rotation.w ** 2 - 1) < 1e-10);
  }
});
