import {
  ATTACHMENT_TOLERANCE,
  GEOMETRY_EPSILON,
  legalBendStation,
  reconstructFromDirections,
  sampleBranch,
} from "./arcLength.ts";
import { clonePlantGraph } from "./clone.ts";
import { childrenOf, descendantIds } from "./graph.ts";
import { sampleMaterialFrame, transportNormal } from "./frames.ts";
import {
  add,
  addScaled,
  clamp,
  clampLength,
  cloneVec3,
  cross,
  distance,
  length,
  lengthSquared,
  normalize,
  projectPerpendicular,
  quaternionBetween,
  quaternionFromAxisAngle,
  rotateAround,
  rotateVector,
  scale,
  subtract,
} from "./math.ts";
import type { Vec3 } from "./math.ts";
import type { BendRequest, Branch, PlantGraph } from "./types.ts";

const firstTangent = (branch: Branch): Vec3 =>
  branch.points.length > 1
    ? normalize(subtract(branch.points[1], branch.points[0]), { x: 0, y: 1, z: 0 })
    : { x: 0, y: 1, z: 0 };

export interface AimOptions {
  rootAimFloor?: number;
  minimumDirectionSquared?: number;
}

/**
 * Rigidly aims one continuation and its active descendants from the provided
 * acquisition snapshot. Inactive history is deliberately untouched.
 */
export const aimBranch = (
  snapshot: PlantGraph,
  branchId: string,
  grabbedPoint: Vec3,
  requestedTarget: Vec3,
  options: AimOptions = {},
): PlantGraph => {
  const graph = clonePlantGraph(snapshot);
  const selected = snapshot.branches.get(branchId);
  if (!selected?.active) return graph;

  const anchor = selected.points[0];
  const target = cloneVec3(requestedTarget);
  const rootFloor = options.rootAimFloor ?? 0.08;
  if (selected.kind === "trunk") target.y = Math.max(anchor.y + rootFloor, target.y);
  const startDirection = subtract(grabbedPoint, anchor);
  const targetDirection = subtract(target, anchor);
  const minimumSquared = options.minimumDirectionSquared ?? 0.02;
  if (lengthSquared(startDirection) < minimumSquared || lengthSquared(targetDirection) < minimumSquared) return graph;

  const rotation = quaternionBetween(startDirection, targetDirection, selected.referenceNormal);
  const affected = descendantIds(snapshot, branchId);
  affected.add(branchId);
  for (const id of affected) {
    const source = snapshot.branches.get(id);
    const destination = graph.branches.get(id);
    if (!source?.active || !destination) continue;
    destination.points = source.points.map((point) => rotateAround(point, anchor, rotation));
    destination.referenceNormal = normalize(rotateVector(source.referenceNormal, rotation));
  }
  return graph;
};

const smootherstep = (value: number): number => {
  const t = clamp(value, 0, 1);
  return t * t * t * (t * (t * 6 - 15) + 10);
};

const remapActiveDescendants = (
  snapshot: PlantGraph,
  graph: PlantGraph,
  parentId: string,
): void => {
  const oldParent = snapshot.branches.get(parentId);
  const newParent = graph.branches.get(parentId);
  if (!oldParent || !newParent) return;

  for (const oldChild of childrenOf(snapshot, parentId)) {
    const newChild = graph.branches.get(oldChild.id);
    if (!newChild?.active) continue;
    const oldAnchor = sampleBranch(oldParent, oldChild.parentDistance);
    const newAnchor = sampleBranch(newParent, oldChild.parentDistance);
    const oldFrame = sampleMaterialFrame(oldParent, oldChild.parentDistance);
    const rotation = quaternionBetween(oldAnchor.tangent, newAnchor.tangent, oldFrame.normal);
    newChild.points = oldChild.points.map((point) =>
      add(rotateVector(subtract(point, oldAnchor.position), rotation), newAnchor.position));
    newChild.points[0] = cloneVec3(newAnchor.position);
    newChild.referenceNormal = normalize(rotateVector(oldChild.referenceNormal, rotation));
    remapActiveDescendants(snapshot, graph, oldChild.id);
  }
};

/**
 * Applies the same broad discrete-curvature law to either the default 54%
 * station or a touch-located material station. The station is an arc distance,
 * never a point index. This is intentionally not a free-chain IK solver.
 */
export const bendBranch = (snapshot: PlantGraph, request: BendRequest): PlantGraph => {
  const graph = clonePlantGraph(snapshot);
  const source = snapshot.branches.get(request.branchId);
  const branch = graph.branches.get(request.branchId);
  if (!source?.active || !branch) return graph;

  const stationDistance = legalBendStation(source, request.stationDistance);
  if (stationDistance === null) return graph;
  const station = sampleBranch(source, stationDistance);
  const requested = subtract(request.target, station.position);
  let perpendicular = projectPerpendicular(requested, station.tangent);
  if (lengthSquared(perpendicular) < GEOMETRY_EPSILON * GEOMETRY_EPSILON) return graph;

  const maximumInput = 0.55 + (1 - source.stiffness) * 0.45;
  perpendicular = scale(clampLength(perpendicular, maximumInput), 0.58 + (1 - source.stiffness) * 0.25);
  const axis = normalize(cross(station.tangent, perpendicular));
  const maximumRotation = 0.28 + (1 - source.stiffness) * 0.55;
  const totalRotation = Math.min(maximumRotation, length(perpendicular) * 1.05);
  const activeLength = source.restLengths.reduce((sum, value) => sum + value, 0);
  const meanSegmentLength = activeLength / source.restLengths.length;
  const influenceBefore = Math.max(activeLength * 0.38, meanSegmentLength * 4);
  const influenceAfter = Math.max(activeLength * 0.12, meanSegmentLength * 1.5);
  const startDistance = Math.max(0, stationDistance - influenceBefore);
  const endDistance = Math.min(activeLength, stationDistance + influenceAfter);
  const span = Math.max(meanSegmentLength, endDistance - startDistance);

  const directions: Vec3[] = [];
  let cursor = 0;
  for (let index = 0; index < source.restLengths.length; index += 1) {
    const restLength = source.restLengths[index];
    const midpoint = cursor + restLength * 0.5;
    const profile = smootherstep((midpoint - startDistance) / span);
    const restingDirection = normalize(subtract(source.points[index + 1], source.points[index]));
    directions.push(rotateVector(restingDirection, quaternionFromAxisAngle(axis, totalRotation * profile)));
    cursor += restLength;
  }

  const acquiredFirstTangent = firstTangent(source);
  branch.points = reconstructFromDirections(source.points[0], directions, source.restLengths);
  branch.referenceNormal = transportNormal(source.referenceNormal, acquiredFirstTangent, firstTangent(branch));
  remapActiveDescendants(snapshot, graph, source.id);
  return graph;
};

export const bendBranchAtFraction = (
  snapshot: PlantGraph,
  branchId: string,
  target: Vec3,
  fraction = 0.54,
): PlantGraph => {
  const branch = snapshot.branches.get(branchId);
  if (!branch) return clonePlantGraph(snapshot);
  return bendBranch(snapshot, { branchId, stationDistance: branch.activeLength * fraction, target });
};

export interface BaseTranslationResult {
  graph: PlantGraph;
  base: Vec3;
  translation: Vec3;
  clamped: boolean;
}

export const translatePlantBaseWithResult = (
  snapshot: PlantGraph,
  requestedBase: Vec3,
  usableRadius = 1.22,
): BaseTranslationResult => {
  const graph = clonePlantGraph(snapshot);
  const root = snapshot.branches.get(snapshot.rootBranchId);
  if (!root?.active || root.points.length === 0) {
    return { graph, base: cloneVec3(requestedBase), translation: { x: 0, y: 0, z: 0 }, clamped: false };
  }

  const radialLength = Math.hypot(requestedBase.x, requestedBase.z);
  const radialScale = radialLength > usableRadius ? usableRadius / radialLength : 1;
  const base = {
    x: requestedBase.x * radialScale,
    y: root.points[0].y,
    z: requestedBase.z * radialScale,
  };
  const translation = subtract(base, root.points[0]);
  for (const branch of graph.branches.values()) {
    if (!branch.active) continue;
    branch.points = branch.points.map((point) => add(point, translation));
  }
  return { graph, base, translation, clamped: radialScale !== 1 };
};

export const translatePlantBase = (
  snapshot: PlantGraph,
  requestedBase: Vec3,
  usableRadius = 1.22,
): PlantGraph => translatePlantBaseWithResult(snapshot, requestedBase, usableRadius).graph;

/**
 * Translates a complete pending graph to an unconstrained root position while
 * it is still a ghost. A valid point already lies inside the usable kenzan,
 * so seating commits this same translation. An invalid release discards the
 * preview without mutating the reservation or advancing its ordinal.
 */
export const translatePendingGraph = (snapshot: PlantGraph, requestedBase: Vec3): PlantGraph => {
  const graph = clonePlantGraph(snapshot);
  const root = snapshot.branches.get(snapshot.rootBranchId);
  if (!root?.active || root.points.length === 0) return graph;
  const translation = subtract(requestedBase, root.points[0]);
  for (const branch of graph.branches.values()) {
    if (!branch.active) continue;
    branch.points = branch.points.map((point) => add(point, translation));
  }
  return graph;
};

/** Returns the actual active organ position without storing renderer state. */
export const organPosition = (graph: PlantGraph, organId: string): Vec3 | null => {
  const organ = graph.organs.get(organId);
  if (!organ?.active) return null;
  const branch = graph.branches.get(organ.branchId);
  return branch?.active ? sampleBranch(branch, organ.distance).position : null;
};
