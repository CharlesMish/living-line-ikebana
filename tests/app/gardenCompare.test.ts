import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { join } from "node:path";
import { IkebanaApp } from "../../src/app/IkebanaApp.ts";
import { canonicalCameraPose, type CameraPose } from "../../src/app/camera.ts";
import { GARDEN_KEY, GardenStore, type GardenEntry } from "../../src/app/garden.ts";
import {
  beginGardenComparison,
  COMPARISON_VERTICAL_FOV,
  COMPARISON_WORLD_SCALE,
  dollyComparison,
  matchedFrames,
  orbitComparison,
  panComparison,
  presentComparison,
  presetComparison,
  TABLE_TALK_STUDY_NOTE,
  TABLE_TALK_STUDY_PROMPT,
  toggleComparisonChoice,
  type ComparisonViewport,
  type GardenComparison,
} from "../../src/app/gardenCompare.ts";
import { createWorkbenchFixture } from "../../src/app/workbench.ts";
import type { CanonicalPlantGraph } from "../../src/core/index.ts";
import { fromCanonicalPlantGraph } from "../../src/core/index.ts";
import { STUDIO_VERTICAL_FOV } from "../../src/presentation/index.ts";

const PROMPT = "Make a lower arrangement for a table where people will talk across it.";

function radius(pose: CameraPose) {
  return Math.hypot(
    pose.position.x - pose.target.x,
    pose.position.y - pose.target.y,
    pose.position.z - pose.target.z,
  );
}

function kept(id: string, view: "front" | "three-quarter" | "above"): GardenEntry {
  const arrangement = createWorkbenchFixture("flowering-branch", view === "above" ? 9255 : 8278, 1);
  arrangement.camera = canonicalCameraPose(view);
  return { id, title: id, keptAt: "2026-09-22T12:00:00.000Z", thumbnail: null, arrangement };
}

function memory() {
  const values = new Map<string, string>();
  return {
    values,
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => { values.set(key, value); },
  };
}

function fakeViewport() {
  const calls: Array<{ pose: CameraPose; verticalFov: number; worldScale: number }> = [];
  let graphs: CanonicalPlantGraph[] = [];
  let destroyed = false;
  const viewport: ComparisonViewport & {
    calls: typeof calls;
    graphs: CanonicalPlantGraph[];
    destroyed: boolean;
  } = {
    calls,
    get graphs() { return graphs; },
    set graphs(value) { graphs = value; },
    get destroyed() { return destroyed; },
    setGraphs(plants) { graphs = plants; },
    applyMatchedView(pose, verticalFov, worldScale) {
      calls.push({ pose, verticalFov, worldScale });
    },
    destroy() { destroyed = true; },
  };
  return viewport;
}

test("the across-the-table prompt is a human brief, not a measured result", () => {
  assert.equal(TABLE_TALK_STUDY_PROMPT, PROMPT);
  assert.match(TABLE_TALK_STUDY_NOTE, /no table/i);
  assert.match(TABLE_TALK_STUDY_NOTE, /no sightline/i);
  assert.match(TABLE_TALK_STUDY_NOTE, /cannot decide|nothing here can decide/i);
  const html = readFileSync(join(process.cwd(), "index.html"), "utf8");
  const guide = html.slice(html.indexOf('data-testid="table-talk-study"'), html.indexOf("Choose any study"));
  assert.match(guide, new RegExp(PROMPT.replace(/[.]/g, "\\.")));
  assert.match(guide, /nothing here can decide whether an arrangement passes/);
  const ui = readFileSync(join(process.cwd(), "src/app/gardenUI.ts"), "utf8");
  assert.match(ui, /TABLE_TALK_STUDY_PROMPT/);
  assert.match(ui, /TABLE_TALK_STUDY_NOTE/);
  assert.equal(COMPARISON_VERTICAL_FOV, STUDIO_VERTICAL_FOV);
  assert.equal(COMPARISON_WORLD_SCALE, 1);
});

test("comparison clones both entries and frames them with one camera and one scale", () => {
  const left = kept("original", "above");
  const right = kept("revision", "three-quarter");
  right.arrangement.plants[0].branches[0].points[0].x += 0.35;
  const beforeLeft = JSON.stringify(left);
  const beforeRight = JSON.stringify(right);
  assert.throws(() => beginGardenComparison([left, right], "original", "original"), /different/);
  assert.throws(() => beginGardenComparison([left, right], "original", "missing"), /two kept/);
  const selected = ["original"];
  assert.deepEqual(toggleComparisonChoice(selected, "revision"), ["original", "revision"]);
  assert.deepEqual(selected, ["original"]);
  assert.deepEqual(toggleComparisonChoice(["original", "revision"], "other"), ["original", "revision"]);

  const session = beginGardenComparison([left, right], left.id, right.id);
  assert.deepEqual(session.camera, canonicalCameraPose("front"));
  assert.equal("score" in session, false);
  assert.equal("passed" in session, false);
  assert.notEqual(session.left, left);
  assert.notEqual(session.left.arrangement.camera, left.arrangement.camera);
  session.left.arrangement.plants[0].branches[0].points[0].x = 80;
  session.left.title = "changed clone";
  const storedLeftCamera = JSON.stringify(session.left.arrangement.camera);
  const moved = panComparison(dollyComparison(orbitComparison(session, 36, -12), 0.82), 20, -8, 390);
  assert.equal(JSON.stringify(left), beforeLeft);
  assert.equal(JSON.stringify(right), beforeRight);
  assert.equal(JSON.stringify(moved.left.arrangement.camera), storedLeftCamera);
  assert.equal(JSON.stringify(moved.right.arrangement.camera), JSON.stringify(right.arrangement.camera));
  assert.deepEqual(moved.left.arrangement.camera, canonicalCameraPose("above"));
  assert.deepEqual(moved.right.arrangement.camera, canonicalCameraPose("three-quarter"));

  const frames = matchedFrames(moved);
  assert.notEqual(frames.left.camera, frames.right.camera);
  assert.deepEqual(frames.left.camera, frames.right.camera);
  assert.deepEqual(frames.left, {
    camera: frames.right.camera,
    verticalFov: STUDIO_VERTICAL_FOV,
    worldScale: 1,
  });
  assert.equal(radius(frames.left.camera), radius(frames.right.camera));
  assert.notDeepEqual(frames.left.camera, left.arrangement.camera);
  assert.notDeepEqual(frames.left.camera, right.arrangement.camera);
  assert.notEqual(radius(frames.left.camera), radius(canonicalCameraPose("above")));

  const above = presetComparison(moved, "above");
  const aboveFrames = matchedFrames(above);
  assert.deepEqual(aboveFrames.left.camera, aboveFrames.right.camera);
  assert.deepEqual(aboveFrames.left.camera, canonicalCameraPose("above"));
  assert.deepEqual(above.right.arrangement.camera, canonicalCameraPose("three-quarter"));
  assert.equal(above.verticalFov, STUDIO_VERTICAL_FOV);
  assert.equal(above.worldScale, 1);

  const tampered = { ...above, verticalFov: 12, worldScale: 4 } as GardenComparison;
  const presentedLeft = fakeViewport();
  const presentedRight = fakeViewport();
  presentComparison(tampered, presentedLeft, presentedRight);
  const leftCall = presentedLeft.calls.at(-1)!;
  const rightCall = presentedRight.calls.at(-1)!;
  assert.notEqual(leftCall.pose, rightCall.pose);
  assert.deepEqual(leftCall.pose, rightCall.pose);
  assert.equal(leftCall.verticalFov, STUDIO_VERTICAL_FOV);
  assert.equal(rightCall.verticalFov, STUDIO_VERTICAL_FOV);
  assert.equal(leftCall.worldScale, 1);
  assert.equal(rightCall.worldScale, 1);
  assert.equal(
    presentedRight.graphs[0].branches[0].points[0].x,
    right.arrangement.plants[0].branches[0].points[0].x,
  );
  assert.notEqual(
    presentedLeft.graphs[0].branches[0].points[0].x,
    presentedRight.graphs[0].branches[0].points[0].x,
  );
  presentedRight.graphs[0].branches[0].points[0].x = 400;
  assert.equal(JSON.stringify(left), beforeLeft);
  assert.equal(JSON.stringify(right), beforeRight);
  assert.notEqual(presentedRight.graphs[0], above.right.arrangement.plants[0]);
});

test("comparison does not write Garden storage", () => {
  const storage = memory();
  const garden = new GardenStore(GARDEN_KEY, storage);
  const left = kept("original", "above");
  const right = kept("revision", "three-quarter");
  garden.load();
  garden.keep(left);
  garden.keep(right);
  const before = garden.exportRaw();
  const loaded = garden.load();
  const session = beginGardenComparison(loaded.entries, "original", "revision");
  presentComparison(orbitComparison(session, 10, 4), fakeViewport(), fakeViewport());
  assert.equal(garden.exportRaw(), before);
  assert.equal(storage.values.size, 1);
});

function harness() {
  const writes: unknown[] = [];
  const state = { posture: "arrange", tool: "shape", view: "front", cameraMode: "orbit" };
  const app = Object.assign(Object.create(IkebanaApp.prototype), {
    workingSession: null,
    gardenComparison: null,
    config: { workbench: false },
    bendVariant: "bead",
    selectedBranchId: "plant-1:trunk",
    cameraIsFree: false,
    hovering: false,
    gesture: null,
    autosaveWrites: [],
    sound: { unlock() {} },
    telemetryStore: { clear() {} },
    metrics: { resetAttempt() {} },
    resolvePendingAcquisition() {},
    syncPresentation() {},
    ui: { state, setState: (patch: object) => Object.assign(state, patch), setStatus() {} },
    store: { save(ordinal: number, plants: unknown) { writes.push({ ordinal, plants }); return true; } },
  });
  const snapshot = createWorkbenchFixture("flowering-branch", 8278, 1);
  app.replaceCoordinator(new Map(snapshot.plants.map((graph: CanonicalPlantGraph) => [graph.id, fromCanonicalPlantGraph(graph)])), 1);
  return { app, writes };
}

test("showing and leaving a comparison leaves the working bowl, its camera, and writes untouched", () => {
  const { app, writes } = harness();
  const before = JSON.stringify(app.arrangementSnapshot());
  const coordinator = app.coordinator;
  const created: ReturnType<typeof fakeViewport>[] = [];
  app.createComparisonViewports = () => {
    const viewports = [fakeViewport(), fakeViewport()] as const;
    created.push(...viewports);
    return viewports;
  };
  const left = kept("original", "above");
  const right = kept("revision", "three-quarter");
  right.arrangement.plants[0].branches[0].points[0].z -= 0.2;
  const leftJson = JSON.stringify(left);
  const rightJson = JSON.stringify(right);
  const session = app.beginGardenComparisonView(left, right, { left: {}, right: {} });
  assert.equal(app.coordinator, coordinator);
  assert.equal(app.workingSession, null);
  assert.equal(JSON.stringify(app.arrangementSnapshot()), before);
  assert.equal(writes.length, 0);
  assert.equal(JSON.stringify(left), leftJson);
  assert.equal(JSON.stringify(right), rightJson);
  assert.equal(created.length, 2);
  const leftView = created[0].calls.at(-1)!;
  const rightView = created[1].calls.at(-1)!;
  assert.deepEqual(leftView.pose, rightView.pose);
  assert.deepEqual(leftView.pose, canonicalCameraPose("front"));
  assert.notDeepEqual(leftView.pose, left.arrangement.camera);
  assert.notDeepEqual(rightView.pose, right.arrangement.camera);
  assert.equal(leftView.verticalFov, rightView.verticalFov);
  assert.equal(leftView.verticalFov, STUDIO_VERTICAL_FOV);
  assert.equal(leftView.worldScale, 1);
  assert.equal(rightView.worldScale, 1);
  assert.equal(radius(leftView.pose), radius(rightView.pose));

  const synced = app.syncGardenComparisonView(orbitComparison(session, 48, 10));
  const shared = created[0].calls.at(-1)!;
  assert.deepEqual(shared.pose, created[1].calls.at(-1)!.pose);
  assert.deepEqual(shared.pose, synced.camera);
  assert.equal(shared.verticalFov, STUDIO_VERTICAL_FOV);
  assert.equal(shared.worldScale, 1);
  assert.notDeepEqual(shared.pose, left.arrangement.camera);
  assert.deepEqual(synced.left.arrangement.camera, canonicalCameraPose("above"));
  assert.equal(JSON.stringify(app.arrangementSnapshot()), before);
  assert.equal(app.coordinator, coordinator);
  assert.equal(writes.length, 0);

  app.endGardenComparisonView();
  assert.equal(app.gardenComparison, null);
  assert.equal(created.every((viewport) => viewport.destroyed), true);
  assert.equal(JSON.stringify(app.arrangementSnapshot()), before);
  assert.equal(JSON.stringify(left), leftJson);
  assert.equal(JSON.stringify(right), rightJson);
  assert.equal(writes.length, 0);
});
