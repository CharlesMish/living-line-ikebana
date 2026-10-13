import { applyAimRotation } from "./edit.ts";
import { clonePlantGraph } from "./clone.ts";
import { quaternionFromAxisAngle } from "./math.ts";
import type { PlantGraph } from "./types.ts";

/**
 * Turn the complete active cutting around the vertical line through its seat.
 * Unlike Aim, this preserves every point's height and the cutting's lean.
 * Material frames travel with the stock; inactive cut records stay frozen.
 */
export function turnCutting(snapshot: PlantGraph, radians: number): PlantGraph {
  if (!Number.isFinite(radians) || radians === 0) return clonePlantGraph(snapshot);
  return applyAimRotation(snapshot, snapshot.rootBranchId,
    quaternionFromAxisAngle({ x: 0, y: 1, z: 0 }, radians));
}
