import { sampleBranch } from "./arcLength.ts";
import { addBranch, makeChain } from "./generatorSupport.ts";
import { add, normalize, scale, vec3, type Vec3 } from "./math.ts";
import { PARASOL_LEAF_RESPONSE } from "./materialResponse.ts";
import { Mulberry32 } from "./prng.ts";
import { SCHEMA_VERSION, type PlantGraph } from "./types.ts";

export const PARASOL_LEAF_VERSION = "parasol-leaf-v1" as const;

/** One round leaf held away from its root on a slender stalk, plus a shorter
 * young leaf that is still furled. The open blade is a single `leaf` organ at
 * the tip of a short neck, so its face follows that neck: a plane the arranger
 * can hover and tilt over the water. The furled leaf is a `bud` organ at the
 * tip of its own stalk, which leaves the main stalk just above the waterline.
 *
 * A generic authored cutting inspired by leaves that are raised above water
 * on a central stalk. It is not a species reconstruction, and the blade is one
 * rigid surface: there is no leaf-surface bending and no axial roll.
 * Randomness is consumed only here. Every attachment persists. */
export function createParasolLeaf(id: string, seed: number, base: Vec3): PlantGraph {
  const random = new Mulberry32(seed);
  const graph: PlantGraph = {
    schemaVersion: SCHEMA_VERSION, generatorVersion: PARASOL_LEAF_VERSION,
    id, seed: seed >>> 0, rootBranchId: `${id}:stalk`, branches: new Map(), organs: new Map(),
  };

  // The side the stalk leans to is also the side its blade faces.
  const azimuth = random.next() * Math.PI * 2;
  const outward = vec3(Math.cos(azimuth), 0, Math.sin(azimuth));
  const length = 1.7 + random.next() * 1.0;
  const lean = 0.09 + random.next() * 0.09;
  const bow = 0.26 + random.next() * 0.16;
  const stalk = addBranch(graph, {
    id: graph.rootBranchId, label: "leaf stalk", kind: "trunk", parentId: null, parentDistance: 0,
    points: makeChain(base, length, 14, add(scale(outward, lean), vec3(0, 1, 0)),
      add(scale(outward, bow), vec3(0, -0.04, 0))),
    radius: 0.03, stiffness: PARASOL_LEAF_RESPONSE.stalk,
  });

  // A short neck tips the blade toward the lean, so the rest pose reads as a
  // disc from an ordinary front view instead of an edge-on line.
  const tip = sampleBranch(stalk, stalk.activeLength);
  const neck = addBranch(graph, {
    id: `${id}:neck`, label: "leaf neck", kind: "petiole", parentId: stalk.id, parentDistance: stalk.activeLength,
    points: makeChain(tip.position, 0.15, 3,
      normalize(add(scale(tip.tangent, 0.88), scale(outward, 0.34 + random.next() * 0.14))), vec3(0, 0, 0)),
    radius: 0.024, stiffness: PARASOL_LEAF_RESPONSE.neck,
  });
  graph.organs.set(`${id}:leaf`, {
    id: `${id}:leaf`, kind: "leaf", branchId: neck.id, distance: neck.activeLength,
    spin: random.next() * Math.PI * 2, scale: 0.92 + random.next() * 0.22, active: true,
  });

  // The young leaf rises on the far side of the lean, clear of the open blade,
  // and stays well below it. Its attachment sits beneath the minimum trunk cut,
  // so a cut on the main stalk can remove the open leaf and keep this one.
  const shootDistance = 0.17 + random.next() * 0.05;
  const anchor = sampleBranch(stalk, shootDistance);
  const shootAzimuth = azimuth + Math.PI * (0.72 + random.next() * 0.56);
  const shoot = addBranch(graph, {
    id: `${id}:shoot`, label: "young leaf stalk", kind: "lateral", parentId: stalk.id, parentDistance: shootDistance,
    points: makeChain(anchor.position, length * (0.27 + random.next() * 0.1), 9,
      normalize(add(scale(anchor.tangent, 0.84), vec3(Math.cos(shootAzimuth) * 0.56, 0, Math.sin(shootAzimuth) * 0.56))),
      vec3(0, 0.22, 0)),
    radius: 0.021, stiffness: PARASOL_LEAF_RESPONSE.shoot,
  });
  graph.organs.set(`${id}:furl`, {
    id: `${id}:furl`, kind: "bud", branchId: shoot.id, distance: shoot.activeLength,
    spin: random.next() * Math.PI * 2, scale: 0.86 + random.next() * 0.16, active: true,
  });
  return graph;
}
