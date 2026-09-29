import { applyPrune } from "../core/prune.ts";
import type { PlantGraph } from "../core/types.ts";

/** Adapt the presentation snapshot, never the stored document. */
export function stemOverlapPreview(
  plants: ReadonlyMap<string, PlantGraph>,
  active: { kind: string; plantId?: string; graph?: PlantGraph; plan?: Parameters<typeof applyPrune>[1] } | null,
  pendingVisible: boolean,
): PlantGraph[] {
  const shown = new Map(plants);
  if (active?.graph && (active.kind !== "insert" || pendingVisible)) shown.set(active.graph.id, active.graph);
  if (active?.kind === "prune" && active.plantId && active.plan) {
    const graph = shown.get(active.plantId);
    if (graph) shown.set(graph.id, applyPrune(graph, active.plan));
  }
  return [...shown.values()];
}
