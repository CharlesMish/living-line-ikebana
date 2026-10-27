import type { ArrangementSnapshot } from "../../src/app/garden.ts";

/**
 * A stand-in for a cutting on longer stock: the same arrangement stretched
 * upward. Every single cutting today fits under the upper shelf's cupboard, so
 * tests of a tall piece need one that does not.
 */
export function onLongerStock<T extends Pick<ArrangementSnapshot, "plants">>(arrangement: T, factor = 1.3): T {
  return { ...arrangement, plants: arrangement.plants.map(plant => ({ ...plant,
    branches: plant.branches.map(branch => ({ ...branch, points: branch.points.map(point => ({ ...point, y: point.y * factor })) })) })) };
}
