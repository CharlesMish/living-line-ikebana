import { sampleBranch } from "../core/arcLength.ts";
import type { Vec3 } from "../core/math.ts";
import type { PlantGraph } from "../core/types.ts";

/**
 * Practical facts about a delivered bowl, measured from its committed stems.
 * These are about the setting (can people see over it, does it fit the sill,
 * which way does it turn), never about whether it is beautiful.
 *
 * Units are scene units. The original bowl is 5.28 across and 0.65 tall.
 * Measurements follow stem centrelines; leaf and petal surfaces add a little.
 */
export interface ArrangementObservations {
  /** Cuttings in the bowl. */
  readonly cuttings: number;
  /** Highest point of any stem above the surface the vessel stands on. */
  readonly height: number;
  /** Farthest reach in front of or behind the vessel's centre, along the delivered view. */
  readonly depth: number;
  /**
   * Where the material sits from left to right in the delivered view:
   * the mean sideways position of all stem length. Negative is to the
   * viewer's left, positive to the right.
   */
  readonly lean: number;
}

export interface ViewPose {
  readonly position: Vec3;
  readonly target: Vec3;
  readonly up: Vec3;
}

const SAMPLE_STEP = 0.08;

/**
 * The delivered view's horizontal axes. "Forward" points away from the viewer.
 * Looking straight down, screen-up stands in for forward.
 */
export function viewAxes(view: ViewPose): { forward: { x: number; z: number }; right: { x: number; z: number } } {
  let x = view.target.x - view.position.x;
  let z = view.target.z - view.position.z;
  if (Math.hypot(x, z) < 1e-3 * Math.hypot(view.target.y - view.position.y, 1)) {
    x = view.up.x;
    z = view.up.z;
  }
  const length = Math.hypot(x, z) || 1;
  const forward = { x: x / length, z: z / length };
  // Right-handed, y up: right = forward × up.
  return { forward, right: { x: -forward.z, z: forward.x } };
}

/** Samples the active stems of every cutting, weighted evenly by stem length. */
function* stemSamples(plants: Iterable<PlantGraph>): Generator<Vec3> {
  for (const graph of plants) {
    for (const branch of graph.branches.values()) {
      if (!branch.active || branch.points.length === 0) continue;
      const steps = Math.max(1, Math.ceil(branch.activeLength / SAMPLE_STEP));
      for (let index = 0; index <= steps; index += 1) {
        yield sampleBranch(branch, (branch.activeLength * index) / steps).position;
      }
    }
  }
}

export function observeArrangement(plants: Iterable<PlantGraph>, view: ViewPose): ArrangementObservations {
  const list = [...plants];
  const { forward, right } = viewAxes(view);
  let height = 0;
  let depth = 0;
  let lateral = 0;
  let count = 0;
  for (const point of stemSamples(list)) {
    height = Math.max(height, point.y);
    depth = Math.max(depth, Math.abs(point.x * forward.x + point.z * forward.z));
    lateral += point.x * right.x + point.z * right.z;
    count += 1;
  }
  return Object.freeze({
    cuttings: list.length,
    height,
    depth,
    lean: count ? lateral / count : 0,
  });
}
