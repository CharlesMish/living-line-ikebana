import type { Vec3 } from "../core/math.ts";
import type { PlantGraph } from "../core/types.ts";

/**
 * Presentation-only water surface. The botanical insertion plane stays at the
 * kenzan top (0.55); the water now covers it, so each seated stem visibly leaves
 * the water instead of starting on an exposed pin frog. Nothing here enters the
 * graph, the solver, hit arbitration or persistence.
 */
export const WATER_Y = 0.59;
export const KENZAN_TOP_Y = 0.55;

/** Inner vessel wall radius at `y`, read from the lathe profile's inner wall. */
export function innerWallRadiusAt(y: number) {
  // Inner wall runs from (2.38, 0.61) down to (2.30, 0.27) in vessel.ts.
  const t = Math.min(1, Math.max(0, (y - 0.27) / (0.61 - 0.27)));
  return 2.30 + (2.38 - 2.30) * t;
}

export interface WaterlineCrossing {
  branchId: string;
  /** Point on the branch centerline at the water surface. */
  point: Vec3;
  /** Unit branch tangent at the crossing, pointing along increasing material distance. */
  tangent: Vec3;
  radius: number;
  /** Material distance along the branch at the crossing, for prune-preview hiding. */
  distance: number;
  /** True where the material rises out of the water, false where it dips back in. */
  emerging: boolean;
}

/**
 * Every place an active branch centerline crosses the water plane, within the
 * vessel basin. Derived from current points on every call; it holds no state.
 */
export function waterlineCrossings(graph: PlantGraph, waterY = WATER_Y): WaterlineCrossing[] {
  const crossings: WaterlineCrossing[] = [];
  const basinRadius = innerWallRadiusAt(waterY);
  const branches = [...graph.branches.values()]
    .filter((branch) => branch.active && branch.points.length >= 2)
    .sort((a, b) => a.id.localeCompare(b.id));
  for (const branch of branches) {
    let cursor = 0;
    for (let index = 0; index < branch.points.length - 1; index += 1) {
      const a = branch.points[index];
      const b = branch.points[index + 1];
      const segmentStart = cursor;
      cursor += branch.restLengths[index] ?? Math.hypot(b.x - a.x, b.y - a.y, b.z - a.z);
      const da = a.y - waterY;
      const db = b.y - waterY;
      // Half-open test so a vertex lying exactly on the surface counts once.
      if (!((da < 0 && db >= 0) || (da >= 0 && db < 0))) continue;
      const t = da / (da - db);
      const point = { x: a.x + (b.x - a.x) * t, y: waterY, z: a.z + (b.z - a.z) * t };
      if (Math.hypot(point.x, point.z) > basinRadius) continue;
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const dz = b.z - a.z;
      const length = Math.hypot(dx, dy, dz);
      if (length <= 1e-9) continue;
      crossings.push({
        branchId: branch.id,
        point,
        tangent: { x: dx / length, y: dy / length, z: dz / length },
        radius: branch.radius,
        distance: segmentStart + (cursor - segmentStart) * t,
        emerging: db >= 0,
      });
    }
  }
  return crossings;
}
