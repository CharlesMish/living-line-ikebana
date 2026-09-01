import type { PlantGraph } from "./types.ts";

export const childrenOf = (graph: PlantGraph, branchId: string) =>
  [...graph.branches.values()].filter((branch) => branch.active && branch.parentId === branchId);

export const descendantIds = (
  graph: PlantGraph,
  branchId: string,
  result = new Set<string>(),
): Set<string> => {
  for (const child of childrenOf(graph, branchId)) {
    result.add(child.id);
    descendantIds(graph, child.id, result);
  }
  return result;
};

export const activeIdentity = (graph: PlantGraph): { branches: string[]; organs: string[] } => ({
  branches: [...graph.branches.values()].filter((branch) => branch.active).map((branch) => branch.id).sort(),
  organs: [...graph.organs.values()].filter((organ) => organ.active).map((organ) => organ.id).sort(),
});

