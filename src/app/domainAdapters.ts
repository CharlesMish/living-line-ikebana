import {
  aimBranch,
  applyPrune,
  bendBranch,
  clonePlantGraph,
  previewPrune,
  sampleBranch,
  successfulSeatIdentity,
  translatePendingGraph,
  translatePlantBase,
  validatePlantGraph,
  type CutPlan,
  type PlantGraph,
  type Vec3,
} from "../core/index.ts";
import type {
  OperationContextMap,
  OperationInputMap,
  TransactionAdapters,
} from "../input/index.ts";
import { cloneCameraPose, type CameraPose } from "./camera.ts";

export interface StudioInputMap extends OperationInputMap {
  insert: { base: Vec3; valid: boolean };
  aim: { target: Vec3 };
  bend: { target: Vec3 };
  base: { base: Vec3 };
  prune: { distance: number };
  camera: { pose: CameraPose };
}

export interface StudioContextMap extends OperationContextMap {
  insert: Record<string, never>;
  aim: Record<string, never>;
  bend: Record<string, never>;
  base: Record<string, never>;
  prune: Record<string, never>;
  camera: Record<string, never>;
}

function placePendingAt(graph: PlantGraph, base: Vec3): PlantGraph {
  return translatePendingGraph(graph, base);
}

export function createDomainAdapters(): TransactionAdapters<
  PlantGraph,
  CameraPose,
  CutPlan,
  StudioInputMap,
  StudioContextMap
> {
  return {
    cloneGraph: clonePlantGraph,
    cloneCamera: cloneCameraPose,
    placePending(graph, _spec, input) {
      return { graph: placePendingAt(graph, input.base), isValid: input.valid };
    },
    aim(graph, spec, input) {
      const branch = graph.branches.get(spec.branchId);
      if (!branch) return clonePlantGraph(graph);
      const grabbed = sampleBranch(branch, spec.grabbedMaterialDistance).position;
      return aimBranch(graph, spec.branchId, grabbed, input.target);
    },
    bend(graph, spec, input) {
      return bendBranch(graph, {
        branchId: spec.branchId,
        stationDistance: spec.stationDistance,
        target: input.target,
      });
    },
    moveBase(graph, _spec, input) {
      return translatePlantBase(graph, input.base);
    },
    previewPrune(graph, spec, input) {
      return previewPrune(graph, spec.branchId, input.distance);
    },
    applyPrune,
    updateCamera(_camera, _spec, input) {
      return cloneCameraPose(input.pose);
    },
    validateInsertReservation(reservation) {
      const expected = successfulSeatIdentity(reservation.ordinal);
      return (
        expected.id === reservation.plantId
        && expected.seed === reservation.seed
        && reservation.graph.id === reservation.plantId
        && reservation.graph.seed === reservation.seed
        && validatePlantGraph(reservation.graph).length === 0
      );
    },
  };
}
