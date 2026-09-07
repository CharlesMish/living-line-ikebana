import type { BranchKind } from "../core/types.ts";
import type { LeafForm } from "./botanicalGeometry.ts";

/** Rebuildable appearance keyed by the durable generator version, never topology
 * heuristics (a trunk may be green). No construction or bend settings live here.
 */
export interface MaterialAppearance {
  readonly branchColors: Readonly<Record<BranchKind, number>>;
  readonly stemRoughness: number;
  readonly leaf: Readonly<{
    form: LeafForm; color: number; veinColor: number; roughness: number;
    hitRadius: number; hitCenterY: number;
  }>;
  readonly bloom: Readonly<{ color: number; roughness: number }>;
}

const flowering: MaterialAppearance = Object.freeze({
  branchColors: Object.freeze({ trunk: 0x4e3529, lateral: 0x5e3f30,
    twig: 0x6d4934, pedicel: 0x687551, petiole: 0x53704d }),
  stemRoughness: 0.88,
  leaf: Object.freeze({ form: "elliptic", color: 0x56755a, veinColor: 0x819260,
    roughness: 0.78, hitRadius: 0.34, hitCenterY: 0 }),
  bloom: Object.freeze({ color: 0xe2a0a4, roughness: 0.74 }),
});
const leafy: MaterialAppearance = Object.freeze({
  branchColors: Object.freeze({ trunk: 0x69804b, lateral: 0x69804b,
    twig: 0x7b8e56, pedicel: 0x77874d, petiole: 0x7b8e56 }),
  stemRoughness: 0.69,
  leaf: Object.freeze({ form: "lanceolate", color: 0x466b44, veinColor: 0x83965c,
    roughness: 0.62, hitRadius: 0.56, hitCenterY: 0.5 }),
  bloom: flowering.bloom,
});
const appearances: Readonly<Record<string, MaterialAppearance>> = Object.freeze({
  "one-branch-v1": flowering,
  "leafy-shoot-v1": leafy,
});
export function getMaterialAppearance(generatorVersion: string): MaterialAppearance {
  const appearance = appearances[generatorVersion];
  if (!appearance) throw new Error(`Missing material appearance: ${generatorVersion}`);
  return appearance;
}
