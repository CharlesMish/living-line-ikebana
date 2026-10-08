import { addBranch, makeChain } from "./generatorSupport.ts";
import { vec3, type Vec3 } from "./math.ts";
import { REED_RESPONSE } from "./materialResponse.ts";
import { Mulberry32 } from "./prng.ts";
import { SCHEMA_VERSION, type PlantGraph } from "./types.ts";

export const REED_VERSION = "reed-v1" as const;
export const REED_SEGMENTS = 16 as const;
export const REED_LENGTH_MIN = 3.35 as const;
export const REED_LENGTH_MAX = 6.25 as const;
export const REED_RADIUS = 0.024 as const;

type ReedSpec = Readonly<{
  generatorVersion: string;
  radius: number;
}>;

const REED_V1_SPEC: ReedSpec = Object.freeze({
  generatorVersion: REED_VERSION,
  radius: REED_RADIUS,
});

/**
 * One reed cutting: a single slender culm. Several insertions make the line
 * and the interval between lines. This is not a sheaf, and it has no length
 * control — stock length is fixed at generation. Aim and bend keep that
 * length; prune is the only shortening.
 *
 * Randomness is consumed only during construction. A generic authored line,
 * not a species simulation.
 */
export function createReedWithSpec(id: string, seed: number, base: Vec3, spec: ReedSpec): PlantGraph {
  const random = new Mulberry32(seed);
  const graph: PlantGraph = {
    schemaVersion: SCHEMA_VERSION,
    generatorVersion: spec.generatorVersion,
    id,
    seed: seed >>> 0,
    rootBranchId: `${id}:culm`,
    branches: new Map(),
    organs: new Map(),
  };

  // Pose first, then length. The first Mulberry32 sample of successive seat
  // seeds sits in a narrow band; length uses a later sample so repeated
  // cuttings are not the same height. 3.35..6.25, still one rising line.
  const azimuth = random.next() * Math.PI * 2;
  const lean = 0.06 + random.next() * 0.2;
  const length = REED_LENGTH_MIN + random.next() * (REED_LENGTH_MAX - REED_LENGTH_MIN);
  const bowAzimuth = azimuth + (random.next() < 0.5 ? 1 : -1) * (0.65 + random.next() * 0.7);
  const bow = 0.1 + random.next() * 0.14;

  addBranch(graph, {
    id: graph.rootBranchId,
    label: "reed",
    kind: "trunk",
    parentId: null,
    parentDistance: 0,
    points: makeChain(
      base,
      length,
      REED_SEGMENTS,
      vec3(Math.cos(azimuth) * lean, 1, Math.sin(azimuth) * lean),
      vec3(Math.cos(bowAzimuth) * bow, -0.012, Math.sin(bowAzimuth) * bow),
    ),
    radius: spec.radius,
    stiffness: REED_RESPONSE.culm,
  });

  return graph;
}

export function createReed(id: string, seed: number, base: Vec3): PlantGraph {
  return createReedWithSpec(id, seed, base, REED_V1_SPEC);
}
