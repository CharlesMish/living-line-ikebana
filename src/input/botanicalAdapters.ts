import {
  aimBranch,
  applyPrune,
  bendBranch,
  clonePlantGraph,
  previewPrune,
  sampleBranch,
  translatePlantBase,
  translatePendingGraph,
  validatePlantGraph,
  type CutPlan,
  type PlantGraph,
  type Vec3,
} from "../core/index.ts";
import type {
  OperationContextMap,
  OperationInputMap,
  TransactionAdapters,
} from "./types";

export interface PendingPlacementInput {
  readonly targetBase: Vec3;
  readonly usableRadius?: number;
  readonly isValid: boolean;
}

export interface AimInput {
  readonly target: Vec3;
}

export interface BendInput {
  readonly target: Vec3;
}

export interface BaseInput {
  readonly targetBase: Vec3;
  readonly usableRadius?: number;
}

export interface PruneInput {
  readonly materialDistance: number;
}

export interface BotanicalInputMap<CameraInput> extends OperationInputMap {
  insert: PendingPlacementInput;
  aim: AimInput;
  bend: BendInput;
  base: BaseInput;
  prune: PruneInput;
  camera: CameraInput;
}

export interface CameraAdapter<Camera, CameraInput> {
  readonly clone: (camera: Camera) => Camera;
  /** Must derive every update from the supplied acquisition camera. */
  readonly update: (acquisitionCamera: Camera, input: CameraInput) => Camera;
}

/**
 * Wires the renderer-free botanical core into the generic transaction
 * lifecycle. Camera state remains presentation-owned and is injected here.
 * Acquisition contexts are retained by the coordinator for the caller but do
 * not enter domain geometry: all spatial targets are already resolved Vec3s.
 */
export function createBotanicalTransactionAdapters<Camera, CameraInput>(
  camera: CameraAdapter<Camera, CameraInput>,
): TransactionAdapters<
  PlantGraph,
  Camera,
  CutPlan,
  BotanicalInputMap<CameraInput>,
  OperationContextMap
> {
  return {
    cloneGraph: clonePlantGraph,
    cloneCamera: camera.clone,
    validateInsertReservation: (reservation) =>
      reservation.plantId === `plant-${reservation.ordinal}` &&
      reservation.seed === ((7301 + reservation.ordinal * 977) >>> 0) &&
      reservation.graph.id === reservation.plantId &&
      reservation.graph.seed === reservation.seed &&
      validatePlantGraph(reservation.graph).length === 0,
    placePending: (snapshot, _spec, input) => ({
      // Validity is presentation feedback, not a reason to pin an invalid ghost
      // to the field rim. A valid location is already inside the usable radius
      // and therefore seats as this same pending graph without a silhouette pop.
      graph: translatePendingGraph(snapshot, input.targetBase),
      isValid: input.isValid,
    }),
    aim: (snapshot, spec, input) => {
      const branch = snapshot.branches.get(spec.branchId);
      if (!branch?.active) return clonePlantGraph(snapshot);
      const grabbedPoint = sampleBranch(
        branch,
        spec.grabbedMaterialDistance,
      ).position;
      return aimBranch(snapshot, spec.branchId, grabbedPoint, input.target);
    },
    bend: (snapshot, spec, input) =>
      bendBranch(snapshot, {
        branchId: spec.branchId,
        stationDistance: spec.stationDistance,
        target: input.target,
      }),
    moveBase: (snapshot, _spec, input) =>
      translatePlantBase(snapshot, input.targetBase, input.usableRadius),
    previewPrune: (snapshot, spec, input) =>
      previewPrune(snapshot, spec.branchId, input.materialDistance),
    applyPrune,
    updateCamera: (snapshot, _spec, input) => camera.update(snapshot, input),
  };
}
