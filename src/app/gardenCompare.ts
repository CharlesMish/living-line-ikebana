import type { CanonicalPlantGraph } from "../core/index.ts";
import type { CanonicalView } from "../input/index.ts";
import { STUDIO_VERTICAL_FOV } from "../presentation/index.ts";
import {
  canonicalCameraPose,
  cloneCameraPose,
  dollyCameraPose,
  orbitCameraPose,
  panCameraPose,
  type CameraPose,
} from "./camera.ts";
import type { GardenEntry } from "./garden.ts";

/**
 * Transient comparison of two existing Garden entries.
 * One shared pose, one shared field of view, world scale 1.
 * Stored cameras are not used as frames, and nothing here is persisted.
 */
export const COMPARISON_VERTICAL_FOV = STUDIO_VERTICAL_FOV;
export const COMPARISON_WORLD_SCALE = 1;

/** Human-interpreted brief. The scene has no table or sightline to measure. */
export const TABLE_TALK_STUDY_PROMPT =
  "Make a lower arrangement for a table where people will talk across it.";

export const TABLE_TALK_STUDY_NOTE =
  "This is a brief for you to interpret. The scene has no table and no sightline, so nothing here can decide whether an arrangement passes.";

export interface GardenComparison {
  left: GardenEntry;
  right: GardenEntry;
  camera: CameraPose;
  verticalFov: number;
  worldScale: number;
}

export interface MatchedFrame {
  camera: CameraPose;
  verticalFov: number;
  worldScale: number;
}

export interface ComparisonViewport {
  setGraphs(plants: CanonicalPlantGraph[]): void;
  applyMatchedView(pose: CameraPose, verticalFov: number, worldScale: number): void;
  destroy(): void;
}

const cloneEntry = (entry: GardenEntry): GardenEntry => JSON.parse(JSON.stringify(entry)) as GardenEntry;

const clonePlants = (plants: CanonicalPlantGraph[]): CanonicalPlantGraph[] =>
  JSON.parse(JSON.stringify(plants)) as CanonicalPlantGraph[];

/** At most two ids. A third choice is ignored until one selected id is cleared. */
export function toggleComparisonChoice(selected: readonly string[], id: string): string[] {
  if (selected.includes(id)) return selected.filter((item) => item !== id);
  if (selected.length >= 2) return [...selected];
  return [...selected, id];
}

/**
 * Copies both entries and frames them with the shared Front pose.
 * Neither entry's stored camera is applied.
 */
export function beginGardenComparison(
  entries: readonly GardenEntry[],
  leftId: string,
  rightId: string,
): GardenComparison {
  if (leftId === rightId) throw new Error("Choose two different kept moments.");
  const left = entries.find((entry) => entry.id === leftId);
  const right = entries.find((entry) => entry.id === rightId);
  if (!left || !right) throw new Error("Choose two kept moments.");
  return {
    left: cloneEntry(left),
    right: cloneEntry(right),
    camera: canonicalCameraPose("front"),
    verticalFov: COMPARISON_VERTICAL_FOV,
    worldScale: COMPARISON_WORLD_SCALE,
  };
}

/** One pose, copied twice. Field of view and world scale stay the shared constants. */
export function matchedFrames(session: GardenComparison): { left: MatchedFrame; right: MatchedFrame } {
  const camera = cloneCameraPose(session.camera);
  return {
    left: {
      camera: cloneCameraPose(camera),
      verticalFov: COMPARISON_VERTICAL_FOV,
      worldScale: COMPARISON_WORLD_SCALE,
    },
    right: {
      camera: cloneCameraPose(camera),
      verticalFov: COMPARISON_VERTICAL_FOV,
      worldScale: COMPARISON_WORLD_SCALE,
    },
  };
}

export function withSharedCamera(session: GardenComparison, camera: CameraPose): GardenComparison {
  return {
    left: session.left,
    right: session.right,
    camera: cloneCameraPose(camera),
    verticalFov: COMPARISON_VERTICAL_FOV,
    worldScale: COMPARISON_WORLD_SCALE,
  };
}

export function orbitComparison(session: GardenComparison, deltaX: number, deltaY: number): GardenComparison {
  return withSharedCamera(session, orbitCameraPose(session.camera, deltaX, deltaY));
}

export function panComparison(
  session: GardenComparison,
  deltaX: number,
  deltaY: number,
  viewportHeight: number,
): GardenComparison {
  return withSharedCamera(session, panCameraPose(session.camera, deltaX, deltaY, viewportHeight, COMPARISON_VERTICAL_FOV));
}

export function dollyComparison(session: GardenComparison, zoomScale: number): GardenComparison {
  return withSharedCamera(session, dollyCameraPose(session.camera, zoomScale));
}

export function presetComparison(session: GardenComparison, view: CanonicalView): GardenComparison {
  return withSharedCamera(session, canonicalCameraPose(view));
}

function showMatchedCamera(session: GardenComparison, left: ComparisonViewport, right: ComparisonViewport) {
  const frames = matchedFrames(session);
  left.applyMatchedView(frames.left.camera, frames.left.verticalFov, frames.left.worldScale);
  right.applyMatchedView(frames.right.camera, frames.right.verticalFov, frames.right.worldScale);
}

/** Renders clones. Both viewports receive the same pose, field of view, and world scale. */
export function presentComparison(
  session: GardenComparison,
  left: ComparisonViewport,
  right: ComparisonViewport,
): void {
  left.setGraphs(clonePlants(session.left.arrangement.plants));
  right.setGraphs(clonePlants(session.right.arrangement.plants));
  showMatchedCamera(session, left, right);
}

/** Moves the shared view without replacing either arrangement. */
export function applyMatchedCamera(
  session: GardenComparison,
  left: ComparisonViewport,
  right: ComparisonViewport,
): void {
  showMatchedCamera(session, left, right);
}
