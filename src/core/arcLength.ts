import { addScaled, clamp, cloneVec3, distance, lerp, normalize, subtract } from "./math.ts";
import type { Branch, BranchSample } from "./types.ts";

export const GEOMETRY_EPSILON = 1e-6;
export const ATTACHMENT_TOLERANCE = 1e-8;

export const segmentLengths = (points: readonly { x: number; y: number; z: number }[]): number[] =>
  points.slice(0, -1).map((point, index) => distance(point, points[index + 1]));

export const polylineLength = (points: readonly { x: number; y: number; z: number }[]): number =>
  segmentLengths(points).reduce((sum, value) => sum + value, 0);

export const restArcLength = (branch: Pick<Branch, "restLengths">): number =>
  branch.restLengths.reduce((sum, value) => sum + value, 0);

export const cumulativeRestDistances = (branch: Pick<Branch, "restLengths">): number[] => {
  const result = [0];
  for (const value of branch.restLengths) result.push(result[result.length - 1] + value);
  return result;
};

export const sampleBranch = (branch: Branch, requestedDistance: number): BranchSample => {
  if (branch.points.length === 0) {
    throw new Error(`Cannot sample branch ${branch.id}: it has no points`);
  }
  if (branch.points.length === 1 || branch.restLengths.length === 0) {
    return {
      position: cloneVec3(branch.points[0]),
      tangent: { x: 0, y: 1, z: 0 },
      segmentIndex: 0,
      segmentT: 0,
      distance: 0,
    };
  }

  const target = clamp(requestedDistance, 0, branch.activeLength);
  let cursor = 0;
  for (let index = 0; index < branch.restLengths.length; index += 1) {
    const restLength = branch.restLengths[index];
    if (target <= cursor + restLength + GEOMETRY_EPSILON) {
      const segmentT = restLength <= GEOMETRY_EPSILON
        ? 0
        : clamp((target - cursor) / restLength, 0, 1);
      return {
        position: lerp(branch.points[index], branch.points[index + 1], segmentT),
        tangent: normalize(subtract(branch.points[index + 1], branch.points[index]), { x: 0, y: 1, z: 0 }),
        segmentIndex: index,
        segmentT,
        distance: target,
      };
    }
    cursor += restLength;
  }

  const last = branch.points.length - 1;
  return {
    position: cloneVec3(branch.points[last]),
    tangent: normalize(subtract(branch.points[last], branch.points[Math.max(0, last - 1)]), { x: 0, y: 1, z: 0 }),
    segmentIndex: Math.max(0, last - 1),
    segmentT: 1,
    distance: target,
  };
};

export const legalBendStation = (branch: Branch, requestedDistance = branch.activeLength * 0.54): number | null => {
  if (!branch.active || (branch.kind !== "trunk" && branch.kind !== "lateral" && branch.kind !== "twig")) return null;
  if (branch.points.length < 4 || branch.restLengths.length < 3) return null;
  const minimum = branch.restLengths[0];
  const maximum = branch.activeLength - branch.restLengths[branch.restLengths.length - 1];
  if (!(maximum - minimum > GEOMETRY_EPSILON)) return null;
  return clamp(requestedDistance, minimum, maximum);
};

export const bendStationAtFraction = (branch: Branch, fraction = 0.54): number | null =>
  legalBendStation(branch, branch.activeLength * clamp(fraction, 0, 1));

export interface TruncatedBranchGeometry {
  points: Branch["points"];
  restLengths: number[];
  activeLength: number;
}

export const truncateBranchGeometry = (branch: Branch, requestedDistance: number): TruncatedBranchGeometry => {
  const target = clamp(requestedDistance, 0, branch.activeLength);
  const points = [cloneVec3(branch.points[0])];
  const restLengths: number[] = [];
  let cursor = 0;

  for (let index = 0; index < branch.restLengths.length; index += 1) {
    const restLength = branch.restLengths[index];
    if (cursor + restLength <= target) {
      points.push(cloneVec3(branch.points[index + 1]));
      restLengths.push(restLength);
      cursor += restLength;
      continue;
    }
    const partial = target - cursor;
    if (partial > 0) {
      points.push(lerp(branch.points[index], branch.points[index + 1], partial / restLength));
      restLengths.push(partial);
    }
    break;
  }

  return {
    points,
    restLengths,
    activeLength: restLengths.reduce((sum, value) => sum + value, 0),
  };
};

export const reconstructFromDirections = (
  anchor: Branch["points"][number],
  directions: readonly Branch["points"][number][],
  lengths: readonly number[],
): Branch["points"] => {
  const points = [cloneVec3(anchor)];
  for (let index = 0; index < lengths.length; index += 1) {
    points.push(addScaled(points[index], normalize(directions[index]), lengths[index]));
  }
  return points;
};
