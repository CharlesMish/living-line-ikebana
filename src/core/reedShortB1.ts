import { createReedWithLengthScale } from "./reed.ts";
import type { Vec3 } from "./math.ts";

export const REED_SHORT_B1_VERSION = "reed-short-b1-v1" as const;
const REED_SHORT_B1_LENGTH_SCALE = 0.85;

/**
 * Campaign 01 B1 experimental reed. Identical construction/sampling order to
 * reed-v1 except for a shorter authored stock length multiplier.
 */
export function createReedShortB1(id: string, seed: number, base: Vec3) {
  const graph = createReedWithLengthScale(id, seed, base, REED_SHORT_B1_LENGTH_SCALE);
  graph.generatorVersion = REED_SHORT_B1_VERSION;
  return graph;
}
