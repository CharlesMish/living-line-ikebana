import { add, normalize, quaternionFromAxisAngle, scale, type Quat, type Vec3 } from "../core/math.ts";
import type { PlantGraph } from "../core/types.ts";

/** A petal drag tilts the face; a stalk drag continues to point the stalk.
 * These are CSS-pixel controls, independent of display resolution and bloom
 * radius. A 30px gesture requests 30 degrees, capped short of a half turn.
 * The frame and gain are captured once; updates never accumulate rotations.
 */
export const HEAD_TILT_RADIANS_PER_PIXEL = Math.PI / 180;
export const HEAD_TILT_MAX_RADIANS = Math.PI * 2 / 3;
export interface FlowerHeadTiltFrame {
  readonly right: Readonly<Vec3>;
  readonly up: Readonly<Vec3>;
  readonly radiansPerPixel: number;
  readonly maximumRadians: number;
}
export function singleFlowerHead(graph: PlantGraph, branchId: string, organId: string | undefined): boolean {
  const organ = organId ? graph.organs.get(organId) : null;
  return graph.generatorVersion === "single-flower-v1"
    && graph.branches.get(branchId)?.kind === "pedicel"
    && organ?.active === true && organ.kind === "bloom" && organ.branchId === branchId;
}
export function captureFlowerHeadTilt(axes: { right: Vec3; up: Vec3 }): FlowerHeadTiltFrame {
  return Object.freeze({
    right: Object.freeze({ ...axes.right }), up: Object.freeze({ ...axes.up }),
    radiansPerPixel: HEAD_TILT_RADIANS_PER_PIXEL, maximumRadians: HEAD_TILT_MAX_RADIANS,
  });
}
export function flowerHeadTiltRotation(frame: FlowerHeadTiltFrame, dx: number, dy: number): Quat {
  const pixels = Math.hypot(dx, dy);
  if (!Number.isFinite(pixels) || pixels < 1e-8) return { x: 0, y: 0, z: 0, w: 1 };
  // Drag right: turn about screen-up. Drag down: turn about screen-right.
  // The axis lies in the screen plane: this does not add a separate roll verb.
  const axis = normalize(add(scale(frame.up, dx), scale(frame.right, dy)));
  return quaternionFromAxisAngle(axis, Math.min(frame.maximumRadians, pixels * frame.radiansPerPixel));
}
