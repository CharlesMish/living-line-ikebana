import assert from "node:assert/strict";
import test from "node:test";
import { CameraViews } from "../../src/app/cameraViews.ts";
import { IkebanaApp } from "../../src/app/IkebanaApp.ts";
import { canonicalCameraPose, dollyCameraPose, orbitCameraPose, panCameraPose } from "../../src/app/camera.ts";
import { createDomainAdapters } from "../../src/app/domainAdapters.ts";
import { readExperimentConfig } from "../../src/app/config.ts";
import { sceneStorageKeys } from "../../src/app/scenePersistence.ts";
import { createReed, toCanonicalPlantGraph } from "../../src/core/index.ts";
import { TransactionCoordinator } from "../../src/input/index.ts";

const whole = () => canonicalCameraPose("three-quarter");
const detail = () => panCameraPose(dollyCameraPose(orbitCameraPose(whole(), 70, -25), .45), 45, 60, 850, 44);

test("empty, independent camera slots retain exact angle/focus/distance without aliasing", () => {
  const views = new CameraViews(), a = whole(), b = detail();
  assert.equal(views.recall("A"), null); assert.equal(views.recall("B"), null);
  views.store("A", a); views.store("B", b);
  a.position.x += 10; b.target.y += 10;
  assert.deepEqual(views.recall("A"), whole()); assert.deepEqual(views.recall("B"), detail());
  const copy = views.recall("B")!; copy.up.z += 5;
  assert.deepEqual(views.recall("B"), detail());
  assert.equal(views.matches("A", whole()), true); assert.equal(views.matches("A", detail()), false);
  views.store("A", canonicalCameraPose("above"));
  assert.deepEqual(views.recall("B"), detail());
  assert.deepEqual(views.recall("A"), canonicalCameraPose("above"));
  views.clear(); assert.equal(views.recall("A"), null); assert.equal(views.recall("B"), null);
});

function harness() {
  const graph = createReed("plant-1", 8278, { x: 0, y: .55, z: 0 });
  const saves: any[] = [], statuses: string[] = [];
  const c = new TransactionCoordinator(createDomainAdapters(), {
    plants: new Map([[graph.id, graph]]), camera: whole(), selectedPlantId: graph.id, successfulPlantOrdinal: 1,
  }, { autosaveCameraCommits: true, onAutosave: e => saves.push(e) });
  const app = Object.assign(Object.create(IkebanaApp.prototype), {
    coordinator: c, cameraViews: new CameraViews(), cameraIsFree: false,
    config: { cameraViewsStudy: true }, workingSession: null, gesture: null,
    clearHover() {}, syncPresentation() {}, metrics: { resetAttempt() {} },
    root: { querySelector: () => ({ focus() {} }) },
    ui: { setState() {}, setStatus: (s: string) => statuses.push(s) },
  });
  return { app, c, graph, saves, statuses };
}

test("Store cancels a live camera preview, stores its committed pose and writes nothing", () => {
  const { app, c, saves } = harness();
  c.commandPosture("step-back"); c.beginCamera(1, {}, { pose: whole() }); c.updateCamera(1, { pose: detail() });
  app.storeCameraView("A");
  assert.equal(c.getDebugState().active, null);
  assert.deepEqual(app.cameraViews.recall("A"), whole());
  assert.deepEqual(c.getDocumentSnapshot().camera, whole());
  c.release(1); assert.equal(saves.length, 0);
});

test("Recall cancels a live plant preview, commits only the camera and retains meaningful Undo", () => {
  const { app, c, graph, saves } = harness();
  c.beginBase(1, { plantId: graph.id, context: {} }, { base: { x: .3, y: .55, z: 0 } }); c.release(1);
  const before = toCanonicalPlantGraph(c.getDocumentSnapshot().plants.get(graph.id)!);
  app.cameraViews.store("B", detail());
  c.beginBase(2, { plantId: graph.id, context: {} }, { base: { x: -.8, y: .55, z: 0 } });
  app.recallCameraView("B");
  assert.equal(c.getDebugState().active, null);
  assert.deepEqual(c.getDocumentSnapshot().camera, detail());
  assert.deepEqual(toCanonicalPlantGraph(c.getDocumentSnapshot().plants.get(graph.id)!), before);
  assert.equal(c.getDebugState().posture, "arrange"); assert.equal(c.getDebugState().successfulPlantOrdinal, 1);
  assert.equal(c.canUndo(), true); assert.equal(app.cameraIsFree, true);
  assert.equal(saves.length, 2); assert.equal(saves[1].domain, "camera");
  c.release(2); assert.equal(saves.length, 2);
  c.commandUndo(); assert.deepEqual(toCanonicalPlantGraph(c.getDocumentSnapshot().plants.get(graph.id)!), toCanonicalPlantGraph(graph));
});

test("Recall retains both Arrange/Prune and Step Back/Pan semantics, including Above up-vector", () => {
  const { app, c } = harness(); const pose = canonicalCameraPose("above");
  app.cameraViews.store("A", pose); c.commandTool("prune"); app.recallCameraView("A");
  assert.equal(c.getDebugState().tool, "prune"); assert.equal(c.getDebugState().posture, "arrange");
  c.commandPosture("step-back"); app.recallCameraView("A");
  assert.equal(c.getDebugState().posture, "step-back"); assert.deepEqual(c.getDocumentSnapshot().camera, pose);
});

test("unset, ordinary play and kept-entry contexts cannot recall or overwrite working slots", () => {
  const { app, c, saves } = harness();
  app.recallCameraView("A"); assert.equal(saves.length, 0);
  app.cameraViews.store("A", detail()); app.workingSession = {};
  app.storeCameraView("A"); app.recallCameraView("A");
  assert.deepEqual(app.cameraViews.recall("A"), detail()); assert.deepEqual(c.getDocumentSnapshot().camera, whole());
  app.workingSession = null; app.config.cameraViewsStudy = false;
  app.storeCameraView("A"); app.recallCameraView("A"); assert.equal(saves.length, 0);
});

test("only explicit study URLs enable slots and isolate every storage key from personal/legacy saves", () => {
  for (const query of ["", "?cameraViews=0", "?cameraViews=true"]) {
    const url = new URL("https://example.test/" + query);
    assert.equal(readExperimentConfig(url).cameraViewsStudy, false);
    assert.equal(sceneStorageKeys(url, false).studio, "ikebana-web-alpha:studio-v2");
  }
  const url = new URL("https://example.test/?cameraViews=1&combinedPreview=1&workbench=1");
  assert.equal(readExperimentConfig(url).cameraViewsStudy, true);
  assert.deepEqual(sceneStorageKeys(url, true, "petite"), {
    studio: "ikebana-camera-views-study:studio-v2", garden: "ikebana-camera-views-study:garden-v2", telemetry: "ikebana-camera-views-study:telemetry-v1",
  });
});
