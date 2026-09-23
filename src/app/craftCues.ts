import type { Branch, CutPlan, OrganKind, PlantGraph } from "../core/types.ts";

export interface CraftCue {
  kind: "aim" | "bend" | "base" | "cut";
  title: string;
  detail: string;
}

function pedicelCarriesOnly(graph: PlantGraph, branchId: string, kind: OrganKind): boolean {
  let matched = false;
  for (const organ of graph.organs.values()) {
    if (organ.branchId !== branchId || !organ.active) continue;
    if (organ.kind !== kind) return false;
    matched = true;
  }
  return matched;
}

export function materialName(branch: Branch, graph?: PlantGraph): string {
  if (branch.kind === "trunk") return "Main stem";
  if (branch.kind === "petiole") return "Leaf stem";
  if (branch.kind === "pedicel") {
    if (graph && pedicelCarriesOnly(graph, branch.id, "berry")) return "Berry stem";
    return "Flower stem";
  }
  return branch.kind === "twig" ? "Twig" : "Branch";
}

/** Describe the exact domain preview, never guess a cut from the hit organ. */
export function cutCue(graph: PlantGraph, plan: CutPlan, acquired: boolean): CraftCue {
  const counts = { leaf: 0, bloom: 0, bud: 0, berry: 0 };
  for (const id of plan.removedOrganIds) {
    const organ = graph.organs.get(id);
    if (organ?.active) counts[organ.kind] += 1;
  }
  const parts: string[] = [];
  if (counts.leaf) parts.push(`${counts.leaf} ${counts.leaf === 1 ? "leaf" : "leaves"}`);
  if (counts.bloom) parts.push(`${counts.bloom} ${counts.bloom === 1 ? "flower" : "flowers"}`);
  if (counts.bud) parts.push(`${counts.bud} ${counts.bud === 1 ? "bud" : "buds"}`);
  if (counts.berry) parts.push(`${counts.berry} ${counts.berry === 1 ? "berry" : "berries"}`);
  const branch = graph.branches.get(plan.branchId);
  const removedStems = plan.removedBranchIds.filter((id) => graph.branches.get(id)?.active).length;
  if (removedStems) parts.unshift(`${removedStems} ${removedStems === 1 ? "attached stem" : "attached stems"}`);
  const shortens = branch && plan.distance < branch.activeLength - 1e-8;
  if (!shortens && parts.length === 0) {
    return { kind: "cut", title: "No further cut here", detail: "This stem is at its shortest retained length." };
  }
  const consequence = parts.length ? `Tip + ${parts.join(", ")}` : "Tip only";
  return {
    kind: "cut",
    title: `Cut ${branch ? materialName(branch, graph).toLowerCase() : "stem"}`,
    detail: `${consequence} · ${acquired ? "release to cut" : "drag to choose the cut"}`,
  };
}

export function shapeCue(branch: Branch, kind: "aim" | "bend" | "base", acquired = false, graph?: PlantGraph): CraftCue {
  const name = materialName(branch, graph).toLowerCase();
  if (kind === "base") return { kind, title: "Slide the base", detail: "Slide the ring across the pins." };
  if (kind === "bend") return {
    kind, title: `Bend ${name}`,
    detail: acquired ? "A broad curve · release to keep it." : "Drag here to curve the line.",
  };
  return {
    kind, title: `Aim ${name}`,
    detail: acquired ? "This continuation moves together." : "Drag to change its direction.",
  };
}
