import { sampleBranch } from "./arcLength.ts";
import { addBranch, basisFor, makeChain } from "./generatorSupport.ts";
import { add, normalize, scale, vec3, type Vec3 } from "./math.ts";
import { FERN_FROND_RESPONSE } from "./materialResponse.ts";
import { Mulberry32 } from "./prng.ts";
import { SCHEMA_VERSION, type PlantGraph } from "./types.ts";

export const FERN_FROND_VERSION = "fern-frond-v1" as const;

const PINNA_COUNT = 8;

/**
 * A fine fern-like frond. One slender rachis and eight alternating pinnae.
 * Each pinna is one stalk and one divided leaflet, so a cut removes that
 * feather rather than a swarm of pinnules. Generic study, not a named species.
 * Randomness is consumed only during construction. Aim, bend, and prune stay
 * shared. The rachis is the only bendable branch.
 */
export function createFernFrond(id: string, seed: number, base: Vec3): PlantGraph {
  const random = new Mulberry32(seed);
  const graph: PlantGraph = {
    schemaVersion: SCHEMA_VERSION,
    generatorVersion: FERN_FROND_VERSION,
    id,
    seed: seed >>> 0,
    rootBranchId: `${id}:rachis`,
    branches: new Map(),
    organs: new Map(),
  };

  const hand = random.next() < 0.5 ? -1 : 1;
  // Aim has no axial roll. Keep the feather's plane near the front view.
  const azimuth = (random.next() - 0.5) * 0.5;
  const length = 3.65 + random.next() * 0.22;
  const rachis = addBranch(graph, {
    id: graph.rootBranchId,
    label: "frond rachis",
    kind: "trunk",
    parentId: null,
    parentDistance: 0,
    points: makeChain(
      base,
      length,
      16,
      vec3(hand * 0.04, 1, 0.015),
      vec3(hand * 0.11, -0.03, 0.04),
    ),
    radius: 0.027,
    stiffness: FERN_FROND_RESPONSE.rachis,
  });

  for (let index = 0; index < PINNA_COUNT; index += 1) {
    const fraction = 0.3 + index * 0.082 + (random.next() - 0.5) * 0.008;
    const parentDistance = rachis.activeLength * fraction;
    const anchor = sampleBranch(rachis, parentDistance);
    const sideSign = index % 2 === 0 ? 1 : -1;
    const spin = azimuth + sideSign * (Math.PI / 2 + 0.16);
    const side = basisFor(anchor.tangent, spin);
    const direction = normalize(add(
      add(scale(side, 0.92), scale(anchor.tangent, 0.26)),
      vec3(0, 0.06, 0),
    ));
    const stalk = addBranch(graph, {
      id: `${id}:pinna-${index + 1}`,
      label: "pinna stalk",
      kind: "petiole",
      parentId: rachis.id,
      parentDistance,
      points: makeChain(
        anchor.position,
        0.11 + random.next() * 0.03,
        3,
        direction,
        scale(anchor.tangent, -0.04),
      ),
      radius: 0.01,
      stiffness: FERN_FROND_RESPONSE.stalk,
    });
    const envelope = Math.sin((Math.PI * (index + 1)) / (PINNA_COUNT + 1));
    const organId = `${id}:pinna-blade-${index + 1}`;
    graph.organs.set(organId, {
      id: organId,
      kind: "leaf",
      branchId: stalk.id,
      distance: stalk.activeLength,
      spin: (random.next() - 0.5) * 0.22,
      scale: (0.64 + envelope * 0.26) * (0.97 + random.next() * 0.04),
      active: true,
    });
  }

  return graph;
}
