import type { CameraPose } from "./camera.ts";
import type { ArrangementSnapshot } from "./garden.ts";
import {
  describeFixture,
  fixtureLoadIdentitiesMatch,
  type WorkbenchFixtureLoad,
} from "./workbench.ts";

/** Development-report schema. Not a working/Garden document version. */
export const WORKBENCH_REPORT_VERSION = 2 as const;

export const WORKBENCH_CAPTURE_NOTES = [
  "CSS viewport is the canvas layout size (getBoundingClientRect), not the browser window and not a device-mode label.",
  "Browser window innerWidth/innerHeight is the window, not the canvas CSS viewport.",
  "Drawing-buffer width/height are the WebGL backing store pixels, not CSS pixels.",
  "devicePixelRatio is the browser-reported ratio; renderer pixel ratio may be capped separately.",
  "Draw calls and triangles are resource counts from one render, not FPS or phone performance.",
] as const;

export interface Size2 {
  readonly width: number;
  readonly height: number;
}

export interface WorkbenchCaptureMeasurements {
  readonly cssViewport: Size2;
  readonly drawingBuffer: Size2;
  readonly devicePixelRatio: number;
  readonly rendererPixelRatio: number;
  readonly rendererPixelRatioCap?: number;
  readonly browserWindow: Size2;
  readonly visualViewport: { readonly width: number; readonly height: number; readonly scale: number } | null;
  readonly userAgent: string | null;
  readonly camera: CameraPose;
}

export interface WorkbenchCaptureEnvironment {
  readonly status: "captured" | "not-captured-in-this-environment";
  readonly cssViewport: Size2 & { readonly source: "canvas-client-rect" };
  readonly drawingBuffer: Size2 & { readonly source: "canvas-drawing-buffer" };
  readonly pixelRatio: {
    readonly device: number;
    readonly renderer: number;
    readonly rendererCap: number | null;
    readonly note: string;
  };
  readonly browserWindow: Size2 & { readonly source: "window-inner" };
  readonly visualViewport: { readonly width: number; readonly height: number; readonly scale: number; readonly source: "window.visualViewport" } | null;
  readonly userAgent: string | null;
  readonly camera: CameraPose;
  readonly notes: readonly string[];
}

export interface WorkbenchRendererResourceCounts {
  readonly calls: number;
  readonly triangles: number;
  readonly lines: number;
  readonly geometries: number;
  readonly textures: number;
  readonly programs: number;
  readonly drawingBuffer: Size2;
  readonly pixelRatio?: number;
  readonly pixelRatioCap?: number;
  readonly note: string;
}

export interface WorkbenchReportInput {
  readonly mode: "workbench" | "player";
  readonly capturedAt: string;
  readonly snapshot: ArrangementSnapshot;
  readonly loadedFixture: WorkbenchFixtureLoad | null;
  readonly renderer: WorkbenchRendererResourceCounts;
  readonly presentation: unknown;
  readonly capture: WorkbenchCaptureEnvironment;
  readonly checks?: Record<string, string>;
  readonly includeArrangement?: boolean;
}

export function describeWorkbenchCaptureEnvironment(
  measurements: WorkbenchCaptureMeasurements,
  status: WorkbenchCaptureEnvironment["status"] = "captured",
): WorkbenchCaptureEnvironment {
  return {
    status,
    cssViewport: { ...measurements.cssViewport, source: "canvas-client-rect" },
    drawingBuffer: { ...measurements.drawingBuffer, source: "canvas-drawing-buffer" },
    pixelRatio: {
      device: measurements.devicePixelRatio,
      renderer: measurements.rendererPixelRatio,
      rendererCap: measurements.rendererPixelRatioCap ?? null,
      note: "devicePixelRatio is not a device-mode label; renderer pixel ratio may be capped below the device ratio.",
    },
    browserWindow: { ...measurements.browserWindow, source: "window-inner" },
    visualViewport: measurements.visualViewport
      ? { ...measurements.visualViewport, source: "window.visualViewport" }
      : null,
    userAgent: measurements.userAgent,
    camera: measurements.camera,
    notes: WORKBENCH_CAPTURE_NOTES,
  };
}

export function describeUnavailableCapture(camera: CameraPose): WorkbenchCaptureEnvironment {
  return describeWorkbenchCaptureEnvironment({
    cssViewport: { width: Number.NaN, height: Number.NaN },
    drawingBuffer: { width: Number.NaN, height: Number.NaN },
    devicePixelRatio: Number.NaN,
    rendererPixelRatio: Number.NaN,
    browserWindow: { width: Number.NaN, height: Number.NaN },
    visualViewport: null,
    userAgent: null,
    camera,
  }, "not-captured-in-this-environment");
}

export function createWorkbenchReport(input: WorkbenchReportInput) {
  const fixture = describeFixture(input.snapshot);
  const loadedFixture = input.loadedFixture;
  const bowlMatchesLoadedFixture = loadedFixture
    ? fixtureLoadIdentitiesMatch(loadedFixture, input.snapshot)
    : false;
  return {
    reportVersion: WORKBENCH_REPORT_VERSION,
    schema: "living-line-workbench-report",
    mode: input.mode,
    capturedAt: input.capturedAt,
    loadedFixture: loadedFixture && {
      fixtureId: loadedFixture.fixtureId,
      profileId: loadedFixture.profileId,
      kind: loadedFixture.kind,
      dynamic: loadedFixture.dynamic,
      seed: loadedFixture.seed,
      count: loadedFixture.count,
      materialSequence: loadedFixture.materialSequence,
      composition: loadedFixture.composition,
      construction: loadedFixture.construction,
      cameraView: loadedFixture.cameraView,
      notes: loadedFixture.notes,
      bowlMatchesLoadedFixture,
    },
    fixture,
    capture: input.capture,
    renderer: {
      ...input.renderer,
      note: input.renderer.note
        || "Draw calls and triangles are resource counts from one render, not FPS or phone performance.",
    },
    presentation: input.presentation,
    arrangement: input.includeArrangement === false
      ? {
          successfulPlantOrdinal: input.snapshot.successfulPlantOrdinal,
          camera: input.snapshot.camera,
          plantIds: input.snapshot.plants.map((plant) => plant.id),
          omitted: "Full graphs omitted from this identity sample. Repeat the scene with profileId + seed + count.",
        }
      : input.snapshot,
    checks: input.checks ?? {
      bend: "not recorded",
      cut: "not recorded",
      cancel: "not recorded",
      reload: "not recorded",
      physicalPhone: "not recorded",
    },
  };
}

export type WorkbenchReport = ReturnType<typeof createWorkbenchReport>;
