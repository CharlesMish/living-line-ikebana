import { add, addScaled, clamp, distance, dot, scale, subtract, type Vec3 } from "./math.ts";
import type { Branch, PlantGraph } from "./types.ts";

/** Inspection only: round segment envelopes, not a collision constraint or mesh test. */
export interface StemOverlap {
  plantA: string;
  branchA: string;
  plantB: string;
  branchB: string;
  position: Vec3;
  penetration: number;
}

export const isStructuralStem = (branch: Branch) => branch.active
  && (branch.kind === "trunk" || branch.kind === "lateral" || branch.kind === "twig");

/** Closest points of two finite segments, including parallel and degenerate cases. */
export function closestStemSegments(a0: Vec3, a1: Vec3, b0: Vec3, b1: Vec3): [Vec3, Vec3] {
  const u = subtract(a1, a0), v = subtract(b1, b0), w = subtract(a0, b0);
  const a = dot(u, u), b = dot(u, v), c = dot(v, v), d = dot(u, w), e = dot(v, w);
  const tiny = 1e-20;
  let s = 0, t = 0;
  if (a <= tiny && c <= tiny) return [{ ...a0 }, { ...b0 }];
  if (a <= tiny) t = clamp(e / c, 0, 1);
  else if (c <= tiny) s = clamp(-d / a, 0, 1);
  else {
    const denominator = a * c - b * b;
    s = denominator > a * c * 1e-12 ? clamp((b * e - c * d) / denominator, 0, 1) : 0;
    t = (b * s + e) / c;
    if (t < 0) { t = 0; s = clamp(-d / a, 0, 1); }
    else if (t > 1) { t = 1; s = clamp((b - d) / a, 0, 1); }
  }
  return [addScaled(a0, u, s), addScaled(b0, v, t)];
}

type Segment = { a: Vec3; b: Vec3; index: number; min: Vec3; max: Vec3 };
type Stem = { plant: string; branch: Branch; segments: Segment[]; min: Vec3; max: Vec3 };
const axes = ["x", "y", "z"] as const;
const intersects = (a: { min: Vec3; max: Vec3 }, b: { min: Vec3; max: Vec3 }) =>
  axes.every(axis => a.min[axis] <= b.max[axis] && b.min[axis] <= a.max[axis]);
const compareIds = (a: string, b: string) => a < b ? -1 : a > b ? 1 : 0;

/** Stable order also makes camera-only inspection cacheable, independent of map order. */
export function structuralStems(graphs: Iterable<PlantGraph>): { plant: string; branch: Branch }[] {
  return [...graphs].flatMap(graph => [...graph.branches.values()]
    .filter(branch => isStructuralStem(branch) && branch.points.length >= 2 && branch.radius > 0)
    .map(branch => ({ plant: graph.id, branch })))
    .sort((a, b) => compareIds(a.plant, b.plant) || compareIds(a.branch.id, b.branch.id));
}

export function findStemOverlaps(graphs: Iterable<PlantGraph>): StemOverlap[] {
  const stems: Stem[] = structuralStems(graphs).map(stem => {
    const r = stem.branch.radius;
    const segments = stem.branch.points.slice(1).map((point, index) => {
      const a = stem.branch.points[index], b = point;
      const min = { x: 0, y: 0, z: 0 }, max = { x: 0, y: 0, z: 0 };
      for (const axis of axes) { min[axis] = Math.min(a[axis], b[axis]) - r; max[axis] = Math.max(a[axis], b[axis]) + r; }
      return { a, b, index, min, max };
    });
    const min = { x: Infinity, y: Infinity, z: Infinity }, max = { x: -Infinity, y: -Infinity, z: -Infinity };
    for (const segment of segments) for (const axis of axes) {
      min[axis] = Math.min(min[axis], segment.min[axis]); max[axis] = Math.max(max[axis], segment.max[axis]);
    }
    return { ...stem, segments, min, max };
  });
  const result: StemOverlap[] = [];
  for (let i = 0; i < stems.length; i++) for (let j = i + 1; j < stems.length; j++) {
    const a = stems[i], b = stems[j];
    // Separate cuttings only. Natural junctions and same-plant folds need their own policy.
    if (a.plant === b.plant || !intersects(a, b)) continue;
    const hits = new Map<string, { i: number; j: number; position: Vec3; penetration: number }>();
    const tolerance = Math.max(1e-5, Math.min(a.branch.radius, b.branch.radius) * 0.1);
    for (const sa of a.segments) for (const sb of b.segments) {
      if (!intersects(sa, sb)) continue;
      const [pa, pb] = closestStemSegments(sa.a, sa.b, sb.a, sb.b);
      const penetration = a.branch.radius + b.branch.radius - distance(pa, pb);
      if (penetration <= tolerance) continue; // Mere touching/numerical grazing is not a warning.
      hits.set(`${sa.index}:${sb.index}`, { i: sa.index, j: sb.index, position: scale(add(pa, pb), 0.5), penetration });
    }
    // Adjacent intersecting segment pairs form one area, not a necklace of duplicate marks.
    // Separate crossings of the same two branches remain separate components.
    while (hits.size) {
      const first = hits.values().next().value!;
      const queue = [first]; hits.delete(`${first.i}:${first.j}`);
      let deepest = first;
      for (let q = 0; q < queue.length; q++) {
        const hit = queue[q];
        if (hit.penetration > deepest.penetration) deepest = hit;
        for (let di = -1; di <= 1; di++) for (let dj = -1; dj <= 1; dj++) {
          const key = `${hit.i + di}:${hit.j + dj}`, next = hits.get(key);
          if (next) { queue.push(next); hits.delete(key); }
        }
      }
      result.push({ plantA: a.plant, branchA: a.branch.id, plantB: b.plant, branchB: b.branch.id,
        position: deepest.position, penetration: deepest.penetration });
    }
  }
  return result;
}
