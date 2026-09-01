import { ATTACHMENT_TOLERANCE, truncateBranchGeometry } from "./arcLength.ts";
import { clonePlantGraph } from "./clone.ts";
import { childrenOf, descendantIds } from "./graph.ts";
import { clamp } from "./math.ts";
import type { CutPlan, PlantGraph } from "./types.ts";

export const previewPrune = (
  graph: PlantGraph,
  branchId: string,
  requestedDistance: number,
): CutPlan => {
  const branch = graph.branches.get(branchId);
  if (!branch?.active) {
    return { branchId, distance: 0, removedBranchIds: [], removedOrganIds: [] };
  }

  const minimum = branch.kind === "trunk" ? 0.62 : 0.045;
  const upper = Math.max(minimum, branch.activeLength - 0.025);
  const distance = Math.min(branch.activeLength, clamp(requestedDistance, minimum, upper));
  const removedBranches = new Set<string>();
  for (const child of childrenOf(graph, branch.id)) {
    if (child.parentDistance > distance + ATTACHMENT_TOLERANCE) {
      removedBranches.add(child.id);
      descendantIds(graph, child.id, removedBranches);
    }
  }

  const removedOrgans = new Set<string>();
  for (const organ of graph.organs.values()) {
    if (!organ.active) continue;
    if (
      removedBranches.has(organ.branchId)
      || (organ.branchId === branch.id && organ.distance > distance + ATTACHMENT_TOLERANCE)
    ) {
      removedOrgans.add(organ.id);
    }
  }

  return {
    branchId,
    distance,
    removedBranchIds: [...removedBranches].sort(),
    removedOrganIds: [...removedOrgans].sort(),
  };
};

export const applyPrune = (snapshot: PlantGraph, plan: CutPlan): PlantGraph => {
  const graph = clonePlantGraph(snapshot);
  const branch = graph.branches.get(plan.branchId);
  if (!branch?.active) return graph;

  const truncated = truncateBranchGeometry(branch, plan.distance);
  branch.points = truncated.points;
  branch.restLengths = truncated.restLengths;
  branch.activeLength = truncated.activeLength;
  for (const id of plan.removedBranchIds) {
    const removed = graph.branches.get(id);
    if (removed?.active) removed.active = false;
  }
  for (const id of plan.removedOrganIds) {
    const removed = graph.organs.get(id);
    if (removed?.active) removed.active = false;
  }

  // Defensive agreement with the shared tolerance law: applying a valid plan
  // may never leave an active organ floating beyond the new distal endpoint.
  for (const organ of graph.organs.values()) {
    if (organ.active && organ.branchId === branch.id && organ.distance > branch.activeLength + ATTACHMENT_TOLERANCE) {
      organ.active = false;
    }
  }
  return graph;
};

export const pruneBranch = (
  snapshot: PlantGraph,
  branchId: string,
  requestedDistance: number,
): PlantGraph => applyPrune(snapshot, previewPrune(snapshot, branchId, requestedDistance));

