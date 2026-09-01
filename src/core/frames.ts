import { GEOMETRY_EPSILON, sampleBranch } from "./arcLength.ts";
import {
  X_AXIS,
  Y_AXIS,
  cross,
  dot,
  lengthSquared,
  normalize,
  projectPerpendicular,
  quaternionBetween,
  rotateVector,
  subtract,
} from "./math.ts";
import type { Vec3 } from "./math.ts";
import type { Branch, MaterialFrame } from "./types.ts";

export const generatorReferenceNormal = (firstTangent: Vec3): Vec3 => {
  const tangent = normalize(firstTangent, Y_AXIS);
  const reference = Math.abs(tangent.y) < 0.9 ? Y_AXIS : X_AXIS;
  return normalize(cross(tangent, reference));
};

export const orthonormalizeReferenceNormal = (normal: Vec3, tangent: Vec3): Vec3 => {
  const perpendicular = projectPerpendicular(normal, tangent);
  return lengthSquared(perpendicular) > GEOMETRY_EPSILON * GEOMETRY_EPSILON
    ? normalize(perpendicular)
    : generatorReferenceNormal(tangent);
};

export const transportNormal = (normal: Vec3, fromTangent: Vec3, toTangent: Vec3): Vec3 => {
  const acquired = orthonormalizeReferenceNormal(normal, fromTangent);
  const rotation = quaternionBetween(fromTangent, toTangent, acquired);
  return orthonormalizeReferenceNormal(rotateVector(acquired, rotation), toTangent);
};

export const sampleMaterialFrame = (branch: Branch, requestedDistance: number): MaterialFrame => {
  const sample = sampleBranch(branch, requestedDistance);
  if (branch.points.length < 2) {
    const tangent = { x: 0, y: 1, z: 0 };
    const normal = orthonormalizeReferenceNormal(branch.referenceNormal, tangent);
    return { ...sample, tangent, normal, binormal: normalize(cross(tangent, normal)) };
  }

  let previousTangent = normalize(subtract(branch.points[1], branch.points[0]), Y_AXIS);
  let normal = orthonormalizeReferenceNormal(branch.referenceNormal, previousTangent);
  for (let segmentIndex = 1; segmentIndex <= sample.segmentIndex; segmentIndex += 1) {
    const tangent = normalize(
      subtract(branch.points[segmentIndex + 1], branch.points[segmentIndex]),
      previousTangent,
    );
    normal = transportNormal(normal, previousTangent, tangent);
    previousTangent = tangent;
  }
  normal = orthonormalizeReferenceNormal(normal, sample.tangent);
  const binormal = normalize(cross(sample.tangent, normal));
  // Eliminate tiny accumulated skew from transport before presentation uses the frame.
  normal = normalize(cross(binormal, sample.tangent));
  if (Math.abs(dot(normal, sample.tangent)) > 1e-10) {
    normal = orthonormalizeReferenceNormal(normal, sample.tangent);
  }
  return { ...sample, normal, binormal };
};

