import type { Branch, PlantGraph } from "./types.ts";

export const childrenOf = (graph: PlantGraph, branchId: string) =>
  [...graph.branches.values()].filter((branch) => branch.active && branch.parentId === branchId);

/** Active adjacency in source-map order, reusable for one traversal. */
export const activeChildrenByParent = (graph: PlantGraph): Map<string, Branch[]> => {
  const children = new Map<string, Branch[]>();
  for (const branch of graph.branches.values()) {
    if (!branch.active || branch.parentId === null) continue;
    const siblings = children.get(branch.parentId) ?? [];
    siblings.push(branch);
    children.set(branch.parentId, siblings);
  }
  return children;
};

export const descendantIds = (
  graph: PlantGraph,
  branchId: string,
  result = new Set<string>(),
): Set<string> => {
  // Build the active adjacency once. A stack preserves the original depth-first,
  // map-order traversal without recursive calls or rescanning every branch.
  const children = activeChildrenByParent(graph);
  const pending = [...(children.get(branchId) ?? [])].reverse();
  const visited = new Set<string>([branchId]);
  while (pending.length) {
    const { id } = pending.pop()!;
    if (visited.has(id)) continue;
    visited.add(id);
    result.add(id);
    const next = children.get(id) ?? [];
    for (let index = next.length - 1; index >= 0; index--) pending.push(next[index]);
  }
  return result;
};

export const activeIdentity = (graph: PlantGraph): { branches: string[]; organs: string[] } => ({
  branches: [...graph.branches.values()].filter((branch) => branch.active).map((branch) => branch.id).sort(),
  organs: [...graph.organs.values()].filter((organ) => organ.active).map((organ) => organ.id).sort(),
});

