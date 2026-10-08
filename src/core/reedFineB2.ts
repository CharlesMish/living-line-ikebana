import type { Vec3 } from "./math.ts";
import type { PlantGraph } from "./types.ts";
import { createReedWithSpec } from "./reed.ts";

export const REED_FINE_B2_VERSION = "reed-fine-b2-v1" as const;
export const REED_FINE_B2_RADIUS = 0.0192 as const;

const REED_FINE_B2_SPEC = Object.freeze({
  generatorVersion: REED_FINE_B2_VERSION,
  radius: REED_FINE_B2_RADIUS,
});

export function createReedFineB2(id: string, seed: number, base: Vec3): PlantGraph {
  return createReedWithSpec(id, seed, base, REED_FINE_B2_SPEC);
}
