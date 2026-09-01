import { cloneVec3 } from "./math.ts";
import type { Branch, Organ, PlantGraph } from "./types.ts";

export const cloneBranch = (branch: Branch): Branch => ({
  ...branch,
  points: branch.points.map(cloneVec3),
  restLengths: [...branch.restLengths],
  referenceNormal: cloneVec3(branch.referenceNormal),
});

export const cloneOrgan = (organ: Organ): Organ => ({ ...organ });

export const clonePlantGraph = (graph: PlantGraph): PlantGraph => ({
  ...graph,
  branches: new Map([...graph.branches].map(([id, branch]) => [id, cloneBranch(branch)])),
  organs: new Map([...graph.organs].map(([id, organ]) => [id, cloneOrgan(organ)])),
});

