import { clonePlantGraph } from "./clone.ts";
import { clamp } from "./math.ts";
import type { PlantGraph } from "./types.ts";

/** One acquired roll may turn the bloom at most halfway around its stalk. */
export const BLOOM_ROLL_LIMIT = Math.PI;

/**
 * Turns one bloom's persistent spin around the supporting tangent.
 *
 * `deltaRadians` is applied to the acquisition snapshot. A later preview does
 * not accumulate on the previous preview. Points, rest lengths, reference
 * normals, and every other organ stay on that snapshot. Leaves are unchanged:
 * this is the bloom's heading, not a blade deformation and not a stalk twist.
 */
export function rollBloomSpin(
  snapshot: PlantGraph,
  organId: string,
  deltaRadians: number,
): PlantGraph {
  const graph = clonePlantGraph(snapshot);
  const source = snapshot.organs.get(organId);
  const destination = graph.organs.get(organId);
  if (!source?.active || !destination?.active || source.kind !== "bloom") return graph;
  if (!Number.isFinite(deltaRadians)) return graph;
  destination.spin = source.spin + clamp(deltaRadians, -BLOOM_ROLL_LIMIT, BLOOM_ROLL_LIMIT);
  return graph;
}
