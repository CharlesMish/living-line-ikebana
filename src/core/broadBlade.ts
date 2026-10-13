import { addBranch, makeChain } from "./generatorSupport.ts";
import { orthonormalizeReferenceNormal } from "./frames.ts";
import { normalize, subtract, vec3, type Vec3 } from "./math.ts";
import { Mulberry32 } from "./prng.ts";
import { SCHEMA_VERSION, type PlantGraph } from "./types.ts";

export const BROAD_BLADE_VERSION = "broad-blade-v1" as const;

/** Immutable stock specification. In v1 this ordering is a durable contract:
 * saved seed/version recover original blade stations even after a distal cut.
 * Never evaluate width against remaining activeLength. No graph is regenerated.
 */
export function broadBladeStock(seed: number) {
  const random = new Mulberry32(seed);
  return Object.freeze({
    length: 3.8 + random.next() * 0.55,
    bladeStart: 0.78 + random.next() * 0.12,
    halfWidth: 0.52 + random.next() * 0.1,
    leanX: -0.08 + random.next() * 0.16,
    leanZ: -0.08 + random.next() * 0.1,
    bowX: 0.1 + random.next() * 0.14,
    bowZ: 0.04 + random.next() * 0.1,
    faceTurn: -0.23 + random.next() * 0.46,
  });
}

/** One petiole and midrib, with an inseparable centerline-bound lamina. The
 * trunk kind enables the shared broad bend law; there are no rigid leaf organs.
 */
export function createBroadBlade(id: string, seed: number, base: Vec3): PlantGraph {
  const stock = broadBladeStock(seed);
  const graph: PlantGraph = {
    schemaVersion: SCHEMA_VERSION, generatorVersion: BROAD_BLADE_VERSION,
    id, seed: seed >>> 0, rootBranchId: `${id}:midrib`, branches: new Map(), organs: new Map(),
  };
  const midrib = addBranch(graph, {
    id: graph.rootBranchId, label: "broad leaf", kind: "trunk", parentId: null, parentDistance: 0,
    points: makeChain(base, stock.length, 24, vec3(stock.leanX, 1, stock.leanZ),
      vec3(stock.bowX, -0.06, stock.bowZ)),
    radius: 0.024, stiffness: 0.58,
  });
  // Stable material face, initially broad to Front. Subsequent Aim transports
  // this saved normal; the adapter must never turn the leaf toward the camera.
  midrib.referenceNormal = orthonormalizeReferenceNormal(
    vec3(Math.cos(stock.faceTurn), 0, Math.sin(stock.faceTurn)),
    normalize(subtract(midrib.points[1], midrib.points[0])),
  );
  return graph;
}
