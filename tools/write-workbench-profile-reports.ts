import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import { canonicalCameraPose } from "../src/app/camera.ts";
import {
  createWorkbenchFixture,
  describeFixture,
  describeMaterialSequenceComposition,
  getLastWorkbenchFixtureLoad,
  listWorkbenchFixtureOptions,
  resolveWorkbenchFixture,
} from "../src/app/workbench.ts";
import {
  createWorkbenchReport,
  describeUnavailableCapture,
} from "../src/app/workbenchReport.ts";

const directory = path.resolve(process.cwd(), "docs/development/reports/workbench-profiles");
const capturedAt = "2026-09-21T14:00:00.000Z";
const unmatchedRenderer = {
  calls: 0,
  triangles: 0,
  lines: 0,
  geometries: 0,
  textures: 0,
  programs: 0,
  drawingBuffer: { width: 0, height: 0 },
  pixelRatio: 0,
  note: "Renderer resource counts were not captured in this Node identity sample. Draw calls/triangles are never FPS.",
};

function identityReport(fixtureId: string, seed: number, count: 1 | 2 | 6 | 12) {
  const snapshot = createWorkbenchFixture(fixtureId, seed, count);
  return createWorkbenchReport({
    mode: "workbench",
    capturedAt,
    snapshot,
    loadedFixture: getLastWorkbenchFixtureLoad(),
    renderer: unmatchedRenderer,
    presentation: describeFixture(snapshot),
    capture: describeUnavailableCapture(snapshot.camera),
    includeArrangement: false,
    checks: {
      bend: "not recorded",
      cut: "not recorded",
      cancel: "not recorded",
      reload: "not recorded",
      physicalPhone: "not recorded",
      captureEnvironment: "not recorded — Node identity sample; CSS viewport / drawing-buffer / pixel ratio require a browser download",
    },
  });
}

function unavailable(profileId: string, seed: number, count: 1 | 2 | 6 | 12) {
  const resolved = resolveWorkbenchFixture(profileId);
  return {
    reportVersion: 2,
    schema: "living-line-workbench-report",
    status: "unavailable-on-this-checkout",
    capturedAt,
    loadedFixture: {
      fixtureId: profileId,
      profileId,
      kind: resolved.kind,
      dynamic: resolved.dynamic,
      seed,
      count,
      materialSequence: resolved.materialSequence,
      missingMaterialIds: resolved.missingMaterialIds,
      composition: describeMaterialSequenceComposition(resolved.materialSequence, count),
      cameraView: "front",
      notes: resolved.notes,
    },
    capture: describeUnavailableCapture(canonicalCameraPose("front")),
    warning: "Do not substitute another profile's renderer counts for this scene.",
  };
}

await mkdir(directory, { recursive: true });

const scenes: Array<[string, 1 | 6 | 12]> = [
  ["flowering-branch", 1],
  ["flowering-branch", 12],
  ["leafy-shoot", 1],
  ["leafy-shoot", 12],
  ["bare-branch", 1],
  ["bare-branch", 12],
  ["single-flower", 1],
  ["single-flower", 12],
  ["reference-pair", 6],
  ["reference-pair", 12],
  ["references-plus-bare", 6],
  ["references-plus-single-flower", 6],
  ["references-plus-single-flower", 12],
  ["all-four", 6],
  ["all-four", 12],
];

for (const [fixtureId, count] of scenes) {
  const available = listWorkbenchFixtureOptions().find((option) => option.id === fixtureId)?.available ?? false;
  const report = available
    ? identityReport(fixtureId, 8278, count)
    : unavailable(fixtureId, 8278, count);
  await writeFile(
    path.join(directory, `${fixtureId}-seed8278-count${count}.json`),
    `${JSON.stringify(report, null, 2)}\n`,
  );
}

await writeFile(
  path.join(directory, "single-flower-count12-correction.json"),
  `${JSON.stringify(
    listWorkbenchFixtureOptions().find((option) => option.id === "single-flower")?.available
      ? identityReport("single-flower", 8278, 12)
      : unavailable("single-flower", 8278, 12),
    null,
    2,
  )}\n`,
);

console.log(`Wrote workbench profile identity reports to ${directory}`);
