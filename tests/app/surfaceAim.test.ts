import assert from "node:assert/strict";
import test from "node:test";
import * as THREE from "three";
import { IkebanaApp } from "../../src/app/IkebanaApp.ts";
import { canonicalCameraPose } from "../../src/app/camera.ts";
import { createDomainAdapters } from "../../src/app/domainAdapters.ts";
import { createNoddingFlowerV2, createNoddingFlower, deserializePlantGraph, distance, serializePlantGraph, sampleBranch } from "../../src/core/index.ts";
import { TransactionCoordinator } from "../../src/input/index.ts";
import { studioFixture } from "../presentation/studioFixture.ts";
import { assertAttachmentCoincidence, assertRestLengthsPreserved } from "../core/helpers.ts";

for (const create of [createNoddingFlower, createNoddingFlowerV2]) {
  test(`${create.name}: a real bell surface supplies a stable grip through the app transaction`, () => {
    const graph = create("plant-1", 8278, { x: 0, y: 0.55, z: 0 });
    const before = serializePlantGraph(graph);
    const { studio, visual, dispose } = studioFixture(graph);
    try {
      const organ = graph.organs.get("plant-1:bloom")!;
      const group = visual.organs.get(organ.id).group;
      const center = new THREE.Box3().setFromObject(group).getCenter(new THREE.Vector3());
      const projected = studio.projectPoint(center);
      let press: any = null;
      for (let dy = -20; dy <= 20 && !press; dy += 2) {
        for (let dx = -20; dx <= 20 && !press; dx += 2) {
          const x = projected.clientX + dx, y = projected.clientY + dy;
          const candidate = studio.collectHitCandidates(x, y)[0];
          if (candidate?.organId === organ.id && candidate.aimPoint
            && distance(candidate.aimPoint, candidate.worldPoint) > 0.3) press = { candidate, x, y };
        }
      }
      assert.ok(press, "an exposed bell surface must be pickable");
      const { candidate, x, y } = press;
      const branch = graph.branches.get(candidate.branchId)!;
      assert.deepEqual(candidate.worldPoint, sampleBranch(branch, organ.distance).position);
      assert.equal(candidate.materialDistance, organ.distance, "pruning retains its graph station");
      const saves: unknown[] = [];
      const coordinator = new TransactionCoordinator(createDomainAdapters(), {
        plants: new Map([[graph.id, graph]]), camera: canonicalCameraPose("front"),
        selectedPlantId: graph.id, successfulPlantOrdinal: 1,
      }, { onAutosave: event => saves.push(event) });
      const app = Object.assign(Object.create(IkebanaApp.prototype), {
        coordinator, studio, canvas: {},
        canonicalHash: () => before, assignSelectedBranch() {}, capturePointer() {}, recordHit() {},
        ui: { setStatus() {} },
      });
      app.beginAim({ pointerId: 7, clientX: x, clientY: y }, candidate);
      assert.deepEqual(app.gesture.grabbedPoint, candidate.aimPoint, "app uses the visible grip");
      assert.equal(serializePlantGraph(coordinator.getPresentationState().active.graph), before, "no acquisition jump");
      const move = (dx: number) => app.handlePointerMove({ pointerId: 7, pointerType: "touch", buttons: 1,
        clientX: x + dx, clientY: y, preventDefault() {} });
      move(8);
      const edited = coordinator.getPresentationState().active.graph;
      assertRestLengthsPreserved(graph, edited);
      assertAttachmentCoincidence(edited);
      assert.notEqual(serializePlantGraph(edited), before);
      assert.deepEqual(edited.branches.get(graph.rootBranchId), graph.branches.get(graph.rootBranchId));
      if (graph.generatorVersion.endsWith("v2")) assert.deepEqual(edited.branches.get("plant-1:neck"), graph.branches.get("plant-1:neck"));
      move(0);
      assert.equal(serializePlantGraph(coordinator.getPresentationState().active.graph), before, "returning the grip rolls back exactly");
      move(8);
      coordinator.cancel("pointer-cancel");
      assert.equal(serializePlantGraph(coordinator.getDocumentSnapshot().plants.get(graph.id)!), before);
      assert.equal(saves.length, 0);
      assert.equal(coordinator.getDebugState().successfulPlantOrdinal, 1);
      app.beginAim({ pointerId: 7, clientX: x, clientY: y }, candidate);
      move(8);
      coordinator.release(7);
      assert.equal(saves.length, 1, "ordinary owner release saves once");
      const committed = coordinator.getDocumentSnapshot().plants.get(graph.id)!;
      const encoded = serializePlantGraph(committed);
      assert.equal(serializePlantGraph(deserializePlantGraph(encoded)), encoded);
      assert.ok(!encoded.includes("surfaceGrip"), "surface grip never enters saved botanical state");
    } finally { dispose(); }
  });
}
