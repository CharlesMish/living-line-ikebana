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
    /** Offset along the organ's local supporting tangent. Existing forms stay at 0. */
    hitCenterY?: number;
  }>;
  /** Present only for a generator that emits berry organs. One sphere per organ. */
  readonly berry?: Readonly<{
    color: number;
    roughness: number;
    radius: number;
    hitRadius: number;
    /** Center along local +Y, the supporting tangent, so the fruit sits past the stem tip. */
    centerY: number;
  }>;
}

// Elliptic blades run from local Y -0.115 to 0.609. Center acquisition on
// the blade, rather than its attachment, so the visible tip stays pickable.
const ellipticLeafHit = Object.freeze({ hitRadius: 0.37, hitCenterY: 0.247 });

const flowering: MaterialAppearance = Object.freeze({
  branchColors: Object.freeze({ trunk: 0x4e3529, lateral: 0x5e3f30,
    twig: 0x6d4934, pedicel: 0x687551, petiole: 0x53704d }),
  stemRoughness: 0.88,
  leaf: Object.freeze({ form: "elliptic", color: 0x56755a, veinColor: 0x819260,
    roughness: 0.78, ...ellipticLeafHit }),
  // Include the petal tips inside the faceted acquisition mesh, not only its
  // ideal sphere radius (the ten-sided mesh has a slightly smaller envelope).
  bloom: Object.freeze({ form: "cupped", color: 0xe2a0a4, roughness: 0.74, hitRadius: 0.6 }),
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
    roughness: 0.7, ...ellipticLeafHit }),
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
const flowerVolume: MaterialAppearance = Object.freeze({
  branchColors: Object.freeze({ trunk: 0x3f5a40, lateral: 0x4a6648,
    twig: 0x567252, pedicel: 0x5d7a52, petiole: 0x567252 }),
  stemRoughness: 0.72,
  leaf: Object.freeze({ form: "elliptic", color: 0x3d5a42, veinColor: 0x7d8f58,
    roughness: 0.7, ...ellipticLeafHit }),
  bloom: Object.freeze({ form: "tufted", color: 0xc45d7a, roughness: 0.58, hitRadius: 0.56 }),
});
const blossomSpray: MaterialAppearance = Object.freeze({
  branchColors: Object.freeze({ trunk: 0x7d9a55, lateral: 0x8aab62,
    twig: 0x8aab62, pedicel: 0x96b56e, petiole: 0x8aab62 }),
  stemRoughness: 0.66,
  // No leaves are generated. The record still requires a leaf slot.
  leaf: flowering.leaf,
  // Existing tufted surface and the flower-volume acquisition envelope.
  // Separation is topological. This does not add a smaller proxy or a new mesh.
  bloom: Object.freeze({ form: "tufted", color: 0xf6d0d8, roughness: 0.66, hitRadius: 0.56 }),
});
const noddingFlower: MaterialAppearance = Object.freeze({
  branchColors: Object.freeze({ trunk: 0x516846, lateral: 0x516846,
    twig: 0x5d7450, pedicel: 0x6a8458, petiole: 0x5d7450 }),
  stemRoughness: 0.7,
  leaf: Object.freeze({ form: "elliptic", color: 0x3e5c44, veinColor: 0x7d945c,
    roughness: 0.7, ...ellipticLeafHit }),
  bloom: Object.freeze({
    form: "bell", color: 0x7d94b8, roughness: 0.56, hitRadius: 0.66, hitCenterY: 0.32,
  }),
});
const berryTwig: MaterialAppearance = Object.freeze({
  branchColors: Object.freeze({ trunk: 0x6a4532, lateral: 0x7b5540,
    twig: 0x7b5540, pedicel: 0x8d684c, petiole: 0x7b5540 }),
  stemRoughness: 0.9,
  // No leaves or blooms are generated. The record still requires both slots.
  leaf: flowering.leaf,
  bloom: flowering.bloom,
  berry: Object.freeze({
    color: 0x8a2e45, roughness: 0.4, radius: 0.07, hitRadius: 0.145, centerY: 0.055,
  }),
});
const archingTrailer: MaterialAppearance = Object.freeze({
  branchColors: Object.freeze({ trunk: 0x3d6d62, lateral: 0x3d6d62,
    twig: 0x4d7c6a, pedicel: 0x5a8460, petiole: 0x4f7a58 }),
  stemRoughness: 0.58,
  leaf: Object.freeze({ form: "elliptic", color: 0x2f5c48, veinColor: 0x7f9460,
    roughness: 0.66, ...ellipticLeafHit }),
  bloom: flowering.bloom,
});
const foliageFan: MaterialAppearance = Object.freeze({
  branchColors: Object.freeze({ trunk: 0x7c9a34, lateral: 0x739332,
    twig: 0x86a44a, pedicel: 0x86a44a, petiole: 0x6f8c3c }),
  stemRoughness: 0.64,
  leaf: Object.freeze({ form: "elliptic", color: 0x5a8a3c, veinColor: 0x9aaf62,
    roughness: 0.6, ...ellipticLeafHit }),
  bloom: flowering.bloom,
});
const appearances: Readonly<Record<string, MaterialAppearance>> = Object.freeze({
  "one-branch-v1": flowering,
  "leafy-shoot-v1": leafy,
  "bare-branch-v1": bare,
  "single-flower-v1": singleFlower,
  "reed-v1": reed,
  "flower-volume-v1": flowerVolume,
  "arching-trailer-v1": archingTrailer,
  "foliage-fan-v1": foliageFan,
  "blossom-spray-v1": blossomSpray,
  "nodding-flower-v1": noddingFlower,
  "berry-twig-v1": berryTwig,
});
export function getMaterialAppearance(generatorVersion: string): MaterialAppearance {
  const appearance = appearances[generatorVersion];
  if (!appearance) throw new Error(`Missing material appearance: ${generatorVersion}`);
  return appearance;
}
