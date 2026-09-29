import { distance, type Vec3 } from '../../src/core/math.ts';
import type { PlantGraph, Branch } from '../../src/core/types.ts';
export function stem(id: string, points: Vec3[], radius = .1): PlantGraph {
  const branch: Branch = { id: id + ':trunk', label: 'Stem', kind: 'trunk', parentId: null, parentDistance: 0,
    points, restLengths: points.slice(1).map((p, i) => distance(points[i], p)), activeLength: 0,
    radius, stiffness: .5, referenceNormal: { x: 0, y: 0, z: 1 }, active: true };
  branch.activeLength = branch.restLengths.reduce((a,b) => a+b,0);
  return { schemaVersion: 1, generatorVersion: 'one-branch-v1', id, seed: 1, rootBranchId: branch.id,
    branches: new Map([[branch.id, branch]]), organs: new Map() };
}
