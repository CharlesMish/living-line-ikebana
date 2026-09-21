import assert from "node:assert/strict";
import test from "node:test";
import { createWorkbenchFixture, describeFixture, getLastWorkbenchFixtureLoad } from "../../src/app/workbench.ts";
import {
  createWorkbenchReport,
  describeUnavailableCapture,
  describeWorkbenchCaptureEnvironment,
  WORKBENCH_CAPTURE_NOTES,
  WORKBENCH_REPORT_VERSION,
} from "../../src/app/workbenchReport.ts";
import { canonicalCameraPose } from "../../src/app/camera.ts";

test("capture environment keeps CSS viewport, window, drawing buffer and pixel ratio distinct", () => {
  const camera = canonicalCameraPose("front");
  const capture = describeWorkbenchCaptureEnvironment({
    cssViewport: { width: 390, height: 844 },
    drawingBuffer: { width: 1170, height: 2532 },
    devicePixelRatio: 3,
    rendererPixelRatio: 1.8,
    rendererPixelRatioCap: 1.8,
    browserWindow: { width: 1280, height: 800 },
    visualViewport: { width: 390, height: 700, scale: 1 },
    userAgent: "HeadlessTest",
    camera,
  });
  assert.equal(capture.status, "captured");
  assert.equal(capture.cssViewport.source, "canvas-client-rect");
  assert.equal(capture.cssViewport.width, 390);
  assert.equal(capture.drawingBuffer.source, "canvas-drawing-buffer");
  assert.equal(capture.drawingBuffer.width, 1170);
  assert.equal(capture.browserWindow.source, "window-inner");
  assert.equal(capture.browserWindow.width, 1280);
  assert.equal(capture.pixelRatio.device, 3);
  assert.equal(capture.pixelRatio.renderer, 1.8);
  assert.equal(capture.pixelRatio.rendererCap, 1.8);
  assert.ok(!("deviceMode" in capture));
  assert.ok(capture.notes.includes(WORKBENCH_CAPTURE_NOTES[0]));
  assert.match(capture.notes.join(" "), /not FPS/);
});

test("workbench reports name profile, sequence, seed, count and actual composition", () => {
  const snapshot = createWorkbenchFixture("reference-pair", 8278, 6);
  const load = getLastWorkbenchFixtureLoad();
  assert.ok(load);
  const report = createWorkbenchReport({
    mode: "workbench",
    capturedAt: "2026-09-21T00:00:00.000Z",
    snapshot,
    loadedFixture: load,
    renderer: {
      calls: 10, triangles: 100, lines: 0, geometries: 4, textures: 2, programs: 3,
      drawingBuffer: { width: 800, height: 600 },
      pixelRatio: 1,
      note: "Draw calls and triangles are resource counts from one render, not FPS or phone performance.",
    },
    presentation: { plantIds: snapshot.plants.map((plant) => plant.id) },
    capture: describeUnavailableCapture(snapshot.camera),
  });
  assert.equal(report.reportVersion, WORKBENCH_REPORT_VERSION);
  assert.equal(report.loadedFixture?.profileId, "reference-pair");
  assert.equal(report.loadedFixture?.seed, 8278);
  assert.equal(report.loadedFixture?.count, 6);
  assert.deepEqual(report.loadedFixture?.materialSequence, ["flowering-branch", "leafy-shoot"]);
  assert.equal(report.loadedFixture?.composition.balancedEqualCopies, true);
  assert.equal(report.loadedFixture?.bowlMatchesLoadedFixture, true);
  assert.equal(report.capture.status, "not-captured-in-this-environment");
  assert.equal(report.capture.cssViewport.source, "canvas-client-rect");
  assert.equal(report.arrangement.camera.position.z, 15);
  assert.match(report.renderer.note, /not FPS/);
  assert.deepEqual(describeFixture(snapshot).plantsInIdentityOrder.map((plant) => plant.seed), [
    8278, 9255, 10232, 11209, 12186, 13163,
  ]);
});

test("six-cutting all-four reports must not be described as two of each", () => {
  const snapshot = createWorkbenchFixture("reference-pair", 8278, 6, { remember: false });
  const composition = {
    materialSequence: ["flowering-branch", "leafy-shoot", "bare-branch", "single-flower"],
    assignedMaterialIds: [
      "flowering-branch", "leafy-shoot", "bare-branch", "single-flower", "flowering-branch", "leafy-shoot",
    ],
    countsByMaterialId: {
      "flowering-branch": 2, "leafy-shoot": 2, "bare-branch": 1, "single-flower": 1,
    },
    balancedEqualCopies: false,
    warnings: ["A six-cutting four-material cycle is 2+2+1+1 in sequence order, not two of each."],
  };
  const report = createWorkbenchReport({
    mode: "workbench",
    capturedAt: "2026-09-21T00:00:00.000Z",
    snapshot,
    loadedFixture: {
      fixtureId: "all-four",
      profileId: "all-four",
      kind: "stable-profile",
      dynamic: false,
      seed: 8278,
      count: 6,
      materialSequence: composition.materialSequence,
      composition,
      construction: [],
      notes: "synthetic composition check",
      cameraView: "front",
    },
    renderer: {
      calls: 0, triangles: 0, lines: 0, geometries: 0, textures: 0, programs: 0,
      drawingBuffer: { width: 0, height: 0 },
      note: "Draw calls and triangles are resource counts from one render, not FPS or phone performance.",
    },
    presentation: {},
    capture: describeUnavailableCapture(canonicalCameraPose("front")),
  });
  assert.equal(report.loadedFixture?.count, 6);
  assert.equal(report.loadedFixture?.composition.balancedEqualCopies, false);
  assert.notEqual(report.loadedFixture?.composition.countsByMaterialId["bare-branch"], 2);
  assert.match(report.loadedFixture?.composition.warnings.join(" ") ?? "", /not two of each/);
});

test("a count-12 single-material report cannot be filled from a mixed-6 snapshot", () => {
  const mixedSix = createWorkbenchFixture("reference-pair", 8278, 6, { remember: false });
  const floweringTwelve = createWorkbenchFixture("flowering-branch", 8278, 12);
  assert.equal(mixedSix.plants.length, 6);
  assert.equal(floweringTwelve.plants.length, 12);
  assert.notEqual(describeFixture(mixedSix).plants.length, 12);
  const twelveLoad = getLastWorkbenchFixtureLoad();
  assert.equal(twelveLoad?.count, 12);
  assert.equal(twelveLoad?.materialSequence.length, 1);
  assert.notEqual(twelveLoad?.count, mixedSix.plants.length);
});
