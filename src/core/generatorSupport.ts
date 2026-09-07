/** Deterministic construction only: no appearance, gestures or renderer state. */
import { segmentLengths } from "./arcLength.ts";
import { generatorReferenceNormal } from "./frames.ts";
import { X_AXIS, Y_AXIS, add, addScaled, cloneVec3, cross, normalize, scale, subtract } from "./math.ts";
import type { Vec3 } from "./math.ts";
import type { Branch, BranchKind, PlantGraph } from "./types.ts";

export const makeChain = (
  base: Vec3,
  length: number,
  segments: number,
  direction: Vec3,
  curve: Vec3,
): Vec3[] => {
  const points = [cloneVec3(base)];
  const step = length / segments;
  for (let index = 1; index <= segments; index += 1) {
    const t = (index - 0.5) / segments;
    const envelope = Math.sin(Math.PI * t) * 0.66 + t * t * 0.34;
    const tangent = normalize(addScaled(direction, curve, envelope));
    points.push(addScaled(points[index - 1], tangent, step));
  }
  return points;
};

interface BranchInput {
  id: string;
  label: string;
  kind: BranchKind;
  parentId: string | null;
  parentDistance: number;
  points: Vec3[];
  radius: number;
  stiffness: number;
}

export const addBranch = (plant: PlantGraph, input: BranchInput): Branch => {
  const restLengths = segmentLengths(input.points);
  const firstTangent = normalize(subtract(input.points[1], input.points[0]), Y_AXIS);
  const branch: Branch = {
    ...input,
    restLengths,
    activeLength: restLengths.reduce((sum, value) => sum + value, 0),
    referenceNormal: generatorReferenceNormal(firstTangent),
    active: true,
  };
  plant.branches.set(branch.id, branch);
  return branch;
};

export const basisFor = (tangentInput: Vec3, spin: number): Vec3 => {
  const tangent = normalize(tangentInput);
  const reference = Math.abs(tangent.y) < 0.9 ? Y_AXIS : X_AXIS;
  const side = normalize(cross(tangent, reference));
  const forward = normalize(cross(side, tangent));
  return normalize(add(scale(side, Math.cos(spin)), scale(forward, Math.sin(spin))));
};

