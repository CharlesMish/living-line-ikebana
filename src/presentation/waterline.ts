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

/**
 * How the centerline meets the surface. `emerging` and `submerging` pass
 * through it; `touch` reaches the surface and returns to the same side
 * (a tangent contact) or ends on it. Each contact yields exactly one mark.
 */
export type WaterlineContactKind = "emerging" | "submerging" | "touch";

export interface WaterlineCrossing {
  branchId: string;
  /** Point on the branch centerline at the water surface. */
  point: Vec3;
  /** Unit branch tangent at the contact, pointing along increasing material distance. */
  tangent: Vec3;
  radius: number;
  /** Material distance along the branch at the contact, for prune-preview hiding. */
  distance: number;
  kind: WaterlineContactKind;
  /** True only for `emerging`; kept as a convenience for callers. */
  emerging: boolean;
}

/** Heights within this of the surface count as lying on it. */
export const WATERLINE_SURFACE_TOLERANCE = 1e-9;

/**
 * Every contact between an active branch centerline and the water plane,
 * within the vessel basin. Derived from current points on every call.
 *
 * Points are classified below / on / above. A sign change between below and
 * above is a crossing, whether it happens inside one segment or through a run
 * of points lying on the surface; a run bounded by the same side on both ends,
 * or at the tip, is a touch. A run (one vertex, or a segment lying on the
 * surface) gives one mark at its material midpoint, never one per segment.
 * A run at the start of a child branch belongs to the parent's contact at
 * the attachment and is skipped; at a root it takes the kind of the side it
 * leads into.
 */
export function waterlineCrossings(graph: PlantGraph, waterY = WATER_Y): WaterlineCrossing[] {
  const crossings: WaterlineCrossing[] = [];
  const basinRadius = innerWallRadiusAt(waterY);
  const branches = [...graph.branches.values()]
    .filter((branch) => branch.active && branch.points.length >= 2)
    .sort((a, b) => a.id.localeCompare(b.id));
  for (const branch of branches) {
    const points = branch.points;
    const count = points.length;
    const along: number[] = [0];
    for (let index = 1; index < count; index += 1) {
      const a = points[index - 1];
      const b = points[index];
      along.push(along[index - 1] + (branch.restLengths[index - 1] ?? Math.hypot(b.x - a.x, b.y - a.y, b.z - a.z)));
    }
    const side = points.map((point) => {
      const height = point.y - waterY;
      return height > WATERLINE_SURFACE_TOLERANCE ? 1 : height < -WATERLINE_SURFACE_TOLERANCE ? -1 : 0;
    });
    const push = (point: Vec3, from: Vec3, to: Vec3, distance: number, kind: WaterlineContactKind) => {
      if (Math.hypot(point.x, point.z) > basinRadius) return;
      const dx = to.x - from.x;
      const dy = to.y - from.y;
      const dz = to.z - from.z;
      const length = Math.hypot(dx, dy, dz);
      if (length <= 1e-9) return;
      crossings.push({
        branchId: branch.id,
        point: { x: point.x, y: waterY, z: point.z },
        tangent: { x: dx / length, y: dy / length, z: dz / length },
        radius: branch.radius,
        distance,
        kind,
        emerging: kind === "emerging",
      });
    };
    let index = 0;
    while (index < count) {
      if (side[index] !== 0) {
        const next = index + 1;
        if (next < count && side[next] !== 0 && side[next] !== side[index]) {
          const a = points[index];
          const b = points[next];
          const t = (a.y - waterY) / (a.y - b.y);
          push(
            { x: a.x + (b.x - a.x) * t, y: waterY, z: a.z + (b.z - a.z) * t },
            a, b,
            along[index] + (along[next] - along[index]) * t,
            side[next] > 0 ? "emerging" : "submerging",
          );
        }
        index = next;
        continue;
      }
      // A maximal run of points on the surface.
      let end = index;
      while (end + 1 < count && side[end + 1] === 0) end += 1;
      const before = index > 0 ? side[index - 1] : null;
      const after = end < count - 1 ? side[end + 1] : null;
      let kind: WaterlineContactKind | null;
      if (before === null) {
        kind = branch.parentId !== null ? null
          : after === null ? "touch"
            : after > 0 ? "emerging" : "submerging";
      } else if (after === null || after === before) {
        kind = "touch";
      } else {
        kind = after > 0 ? "emerging" : "submerging";
      }
      if (kind) {
        const middle = (along[index] + along[end]) / 2;
        let segment = index;
        while (segment < end && along[segment + 1] < middle) segment += 1;
        const a = points[segment];
        const b = points[Math.min(segment + 1, end)];
        const span = along[Math.min(segment + 1, end)] - along[segment];
        const t = span > 1e-12 ? (middle - along[segment]) / span : 0;
        push(
          { x: a.x + (b.x - a.x) * t, y: waterY, z: a.z + (b.z - a.z) * t },
          points[Math.max(0, index - 1)],
          points[Math.min(count - 1, end + 1)],
          middle,
          kind,
        );
      }
      index = end + 1;
    }
  }
  return crossings;
}
