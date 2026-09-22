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
  "A brief for you to interpret. Nothing here decides whether an arrangement passes.";

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

/** One pointer owns a comparison drag. The start pose is frozen for recomputation. */
export interface ComparisonDrag {
  pointerId: number;
  startX: number;
  startY: number;
  startCamera: CameraPose;
  height: number;
}

export type ComparisonDragMode = "orbit" | "move";

export interface ComparisonGesture {
  session: GardenComparison;
  drag: ComparisonDrag | null;
  mode: ComparisonDragMode;
}

export type ComparisonGestureAction =
  | { type: "pointerdown"; pointerId: number; button: number; x: number; y: number; height: number }
  | { type: "pointermove"; pointerId: number; pointerType: string; buttons: number; x: number; y: number }
  | { type: "pointerup"; pointerId: number }
  | { type: "pointercancel"; pointerId: number }
  | { type: "lostcapture"; pointerId: number }
  | { type: "wheel"; deltaY: number }
  | { type: "interrupt" }
  | { type: "escape" }
  | { type: "preset"; view: CanonicalView }
  | { type: "dolly"; zoomScale: number }
  | { type: "mode"; mode: ComparisonDragMode };

export interface ComparisonGestureEffect {
  gesture: ComparisonGesture;
  /** The shared preview changed and should be shown. */
  preview: boolean;
  /** The drag was cancelled and the shared camera returned to its start pose. */
  rolledBack: boolean;
  /** Escape with no active drag: leave the comparison. */
  leave: boolean;
  /** A non-owner, extra button, or wheel during a drag. Ownership stays as it was. */
  ignored: boolean;
}

const WHEEL_DOLLY = 0.0011;

const unchanged = (
  gesture: ComparisonGesture,
  ignored: boolean,
  leave = false,
): ComparisonGestureEffect => ({
  gesture,
  preview: false,
  rolledBack: false,
  leave,
  ignored,
});

function restoreDragStart(gesture: ComparisonGesture): ComparisonGesture {
  if (!gesture.drag) return gesture;
  return {
    session: withSharedCamera(gesture.session, gesture.drag.startCamera),
    drag: null,
    mode: gesture.mode,
  };
}

function rolledBack(gesture: ComparisonGesture): ComparisonGestureEffect {
  return {
    gesture: restoreDragStart(gesture),
    preview: true,
    rolledBack: true,
    leave: false,
    ignored: false,
  };
}

/**
 * Comparison camera gestures. A second pointer cannot replace the owner or the
 * frozen start pose. Release keeps the temporary preview. Cancel paths restore
 * that start pose. Nothing here writes storage.
 */
export function reduceComparisonGesture(
  gesture: ComparisonGesture,
  action: ComparisonGestureAction,
): ComparisonGestureEffect {
  switch (action.type) {
    case "pointerdown": {
      if (action.button !== 0 || gesture.drag) return unchanged(gesture, true);
      return {
        gesture: {
          ...gesture,
          drag: {
            pointerId: action.pointerId,
            startX: action.x,
            startY: action.y,
            startCamera: cloneCameraPose(gesture.session.camera),
            height: action.height,
          },
        },
        preview: false,
        rolledBack: false,
        leave: false,
        ignored: false,
      };
    }
    case "pointermove": {
      const drag = gesture.drag;
      if (!drag || action.pointerId !== drag.pointerId) return unchanged(gesture, true);
      if (action.pointerType === "mouse" && (action.buttons & 1) === 0) return rolledBack(gesture);
      const basis = { ...gesture.session, camera: drag.startCamera };
      const next = gesture.mode === "move"
        ? panComparison(basis, action.x - drag.startX, action.y - drag.startY, drag.height)
        : orbitComparison(basis, action.x - drag.startX, action.y - drag.startY);
      return {
        gesture: { ...gesture, session: next, drag },
        preview: true,
        rolledBack: false,
        leave: false,
        ignored: false,
      };
    }
    case "pointerup": {
      if (!gesture.drag || gesture.drag.pointerId !== action.pointerId) return unchanged(gesture, true);
      return {
        gesture: { ...gesture, drag: null },
        preview: false,
        rolledBack: false,
        leave: false,
        ignored: false,
      };
    }
    case "pointercancel":
    case "lostcapture": {
      if (!gesture.drag || gesture.drag.pointerId !== action.pointerId) return unchanged(gesture, true);
      return rolledBack(gesture);
    }
    case "wheel": {
      if (gesture.drag) return unchanged(gesture, true);
      return {
        gesture: {
          ...gesture,
          session: dollyComparison(gesture.session, Math.exp(action.deltaY * WHEEL_DOLLY)),
        },
        preview: true,
        rolledBack: false,
        leave: false,
        ignored: false,
      };
    }
    case "interrupt":
      return gesture.drag ? rolledBack(gesture) : unchanged(gesture, true);
    case "escape":
      return gesture.drag ? rolledBack(gesture) : unchanged(gesture, false, true);
    case "preset":
    case "dolly":
    case "mode": {
      const hadDrag = gesture.drag !== null;
      const restored = hadDrag ? restoreDragStart(gesture) : gesture;
      const session = action.type === "preset"
        ? presetComparison(restored.session, action.view)
        : action.type === "dolly"
          ? dollyComparison(restored.session, action.zoomScale)
          : restored.session;
      return {
        gesture: {
          session,
          drag: null,
          mode: action.type === "mode" ? action.mode : restored.mode,
        },
        preview: action.type !== "mode" || hadDrag,
        rolledBack: hadDrag,
        leave: false,
        ignored: false,
      };
    }
    default:
      return unchanged(gesture, true);
  }
}

export interface ComparisonPaneBox {
  width: number;
  height: number;
}

/**
 * Both panes get one canvas box. A taller or wrapping title consumes the shared
 * title band (side by side) or its own title row (stacked), never one canvas alone.
 */
export function comparisonCanvasSlots(
  stage: { width: number; height: number },
  titles: { leftHeight: number; rightHeight: number },
  options: { stacked: boolean; columnGap: number; rowGap: number },
): { left: ComparisonPaneBox; right: ComparisonPaneBox } {
  const stageWidth = Math.max(0, optionsNumber(stage.width));
  const stageHeight = Math.max(0, optionsNumber(stage.height));
  const leftHeight = Math.max(0, optionsNumber(titles.leftHeight));
  const rightHeight = Math.max(0, optionsNumber(titles.rightHeight));
  const columnGap = Math.max(0, optionsNumber(options.columnGap));
  const rowGap = Math.max(0, optionsNumber(options.rowGap));
  const box = options.stacked
    ? {
      width: Math.floor(stageWidth),
      height: Math.floor(Math.max(0, stageHeight - leftHeight - rightHeight - rowGap * 3) / 2),
    }
    : {
      width: Math.floor(Math.max(0, stageWidth - columnGap) / 2),
      height: Math.floor(Math.max(0, stageHeight - Math.max(leftHeight, rightHeight) - rowGap)),
    };
  return { left: { ...box }, right: { ...box } };
}

/** Safety clamp: both canvases use the smaller measured width and height. */
export function equalCanvasBox(left: ComparisonPaneBox, right: ComparisonPaneBox): ComparisonPaneBox {
  return {
    width: Math.max(0, Math.min(optionsNumber(left.width), optionsNumber(right.width))),
    height: Math.max(0, Math.min(optionsNumber(left.height), optionsNumber(right.height))),
  };
}

function optionsNumber(value: number): number {
  return Number.isFinite(value) ? value : 0;
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
