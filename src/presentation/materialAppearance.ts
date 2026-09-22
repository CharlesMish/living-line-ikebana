import type { BranchKind } from "../core/types.ts";
import type { BloomForm, LeafForm } from "./botanicalGeometry.ts";

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
  readonly bloom: Readonly<{
    form: BloomForm; color: number; roughness: number; hitRadius: number;
  }>;
}

const flowering: MaterialAppearance = Object.freeze({
  branchColors: Object.freeze({ trunk: 0x4e3529, lateral: 0x5e3f30,
    twig: 0x6d4934, pedicel: 0x687551, petiole: 0x53704d }),
  stemRoughness: 0.88,
  leaf: Object.freeze({ form: "elliptic", color: 0x56755a, veinColor: 0x819260,
    roughness: 0.78, hitRadius: 0.34, hitCenterY: 0 }),
  bloom: Object.freeze({ form: "cupped", color: 0xe2a0a4, roughness: 0.74, hitRadius: 0.46 }),
});
const leafy: MaterialAppearance = Object.freeze({
  branchColors: Object.freeze({ trunk: 0x69804b, lateral: 0x69804b,
    twig: 0x7b8e56, pedicel: 0x77874d, petiole: 0x7b8e56 }),
  stemRoughness: 0.69,
  leaf: Object.freeze({ form: "lanceolate", color: 0x466b44, veinColor: 0x83965c,
    roughness: 0.62, hitRadius: 0.56, hitCenterY: 0.5 }),
  bloom: flowering.bloom,
});
const bare: MaterialAppearance = Object.freeze({
  branchColors: Object.freeze({ trunk: 0x3c322c, lateral: 0x4a3c33,
    twig: 0x574538, pedicel: 0x5c4a3c, petiole: 0x5c4a3c }),
  stemRoughness: 0.94,
  leaf: flowering.leaf,
  bloom: flowering.bloom,
});
const singleFlower: MaterialAppearance = Object.freeze({
  branchColors: Object.freeze({ trunk: 0x5c7048, lateral: 0x5c7048,
    twig: 0x6a7d52, pedicel: 0x6d8454, petiole: 0x6a7d52 }),
  stemRoughness: 0.64,
  leaf: Object.freeze({ form: "elliptic", color: 0x4d6848, veinColor: 0x8a9a62,
    roughness: 0.7, hitRadius: 0.34, hitCenterY: 0 }),
  bloom: Object.freeze({ form: "open-face", color: 0xf0d2ae, roughness: 0.62, hitRadius: 0.7 }),
});
const reed: MaterialAppearance = Object.freeze({
  branchColors: Object.freeze({ trunk: 0x4e6240, lateral: 0x4e6240,
    twig: 0x5d704c, pedicel: 0x5d704c, petiole: 0x5d704c }),
  stemRoughness: 0.8,
  // No leaves or blooms are generated. The record still requires both slots.
  leaf: flowering.leaf,
  bloom: flowering.bloom,
});
const appearances: Readonly<Record<string, MaterialAppearance>> = Object.freeze({
  "one-branch-v1": flowering,
  "leafy-shoot-v1": leafy,
  "bare-branch-v1": bare,
  "single-flower-v1": singleFlower,
  "reed-v1": reed,
});
export function getMaterialAppearance(generatorVersion: string): MaterialAppearance {
  const appearance = appearances[generatorVersion];
  if (!appearance) throw new Error(`Missing material appearance: ${generatorVersion}`);
  return appearance;
}
