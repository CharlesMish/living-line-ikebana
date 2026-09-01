/**
 * Framework-neutral interaction types.
 *
 * Spatial intersections, screen-space hit arbitration, and botanical geometry
 * are deliberately outside this module.  The app/presentation layer resolves
 * those values before acquiring a transaction; the coordinator freezes their
 * identities and lifecycle.
 */

export type PlantId = string;
export type BranchId = string;
export type OwnerToken = string | number;

export type Posture = "arrange" | "step-back";
export type Tool = "shape" | "prune";
export type CanonicalView = "front" | "three-quarter" | "above";

/**
 * `bead` freezes the configured arc-length bead station.
 * `touch` freezes the material distance acquired from the touched middle span.
 * The downstream bend adapter is identical for both variants.
 */
export type BendVariant = "bead" | "touch";

export type TransactionKind =
  | "insert"
  | "aim"
  | "bend"
  | "base"
  | "prune"
  | "camera";

export type GraphCommitKind = Exclude<TransactionKind, "camera">;

export interface OperationInputMap {
  insert: unknown;
  aim: unknown;
  bend: unknown;
  base: unknown;
  prune: unknown;
  camera: unknown;
}

export interface OperationContextMap {
  insert: unknown;
  aim: unknown;
  bend: unknown;
  base: unknown;
  prune: unknown;
  camera: unknown;
}

export interface InsertReservation<Graph> {
  /** Successful-seat ordinal, starting at one. */
  readonly ordinal: number;
  readonly plantId: PlantId;
  readonly seed: number;
  /** The complete graph that is both ghosted and, on valid release, seated. */
  readonly graph: Graph;
}

export interface InsertSpec<Graph, Context> {
  readonly reservation: InsertReservation<Graph>;
  readonly context: Context;
}

export interface AimSpec<Context> {
  readonly plantId: PlantId;
  readonly branchId: BranchId;
  readonly grabbedMaterialDistance: number;
  /** Frozen edit-plane/acquisition information supplied by the adapter. */
  readonly context: Context;
}

export interface BendCandidate<Context> {
  readonly plantId: PlantId;
  readonly branchId: BranchId;
  /** Rest-arc station used by the visible fixed bead experiment. */
  readonly beadStationDistance: number;
  /** Rest-arc station resolved from the actual touched material span. */
  readonly touchMaterialDistance: number;
  /** Frozen edit-plane/acquisition information supplied by the adapter. */
  readonly context: Context;
}

export interface BendSpec<Context> {
  readonly plantId: PlantId;
  readonly branchId: BranchId;
  readonly variant: BendVariant;
  /** Chosen once at acquisition; never recalculated during the gesture. */
  readonly stationDistance: number;
  readonly context: Context;
}

export interface BaseSpec<Context> {
  readonly plantId: PlantId;
  readonly context: Context;
}

export interface PruneSpec<Context> {
  readonly plantId: PlantId;
  readonly branchId: BranchId;
  /** Material distance resolved at acquisition. */
  readonly acquiredMaterialDistance: number;
  readonly context: Context;
}

export interface CameraSpec<Context> {
  readonly context: Context;
}

export interface InsertPreview<Graph> {
  readonly graph: Graph;
  readonly isValid: boolean;
}

export interface TransactionAdapters<
  Graph,
  Camera,
  PrunePlan,
  Inputs extends OperationInputMap = OperationInputMap,
  Contexts extends OperationContextMap = OperationContextMap,
> {
  /** Must preserve every canonical graph field and inactive identity. */
  readonly cloneGraph: (graph: Graph) => Graph;
  readonly cloneCamera: (camera: Camera) => Camera;

  readonly placePending: (
    acquisitionGraph: Graph,
    spec: InsertSpec<Graph, Contexts["insert"]>,
    input: Inputs["insert"],
  ) => InsertPreview<Graph>;

  readonly aim: (
    acquisitionGraph: Graph,
    spec: AimSpec<Contexts["aim"]>,
    input: Inputs["aim"],
  ) => Graph;

  /** Shared by both bend variants; only spec.stationDistance differs. */
  readonly bend: (
    acquisitionGraph: Graph,
    spec: BendSpec<Contexts["bend"]>,
    input: Inputs["bend"],
  ) => Graph;

  readonly moveBase: (
    acquisitionGraph: Graph,
    spec: BaseSpec<Contexts["base"]>,
    input: Inputs["base"],
  ) => Graph;

  /** Creates a non-mutating exact distal-ID preview plan. */
  readonly previewPrune: (
    acquisitionGraph: Graph,
    spec: PruneSpec<Contexts["prune"]>,
    input: Inputs["prune"],
  ) => PrunePlan;

  /** Applies the frozen current plan once, against the acquisition graph. */
  readonly applyPrune: (acquisitionGraph: Graph, plan: PrunePlan) => Graph;

  readonly updateCamera: (
    acquisitionCamera: Camera,
    spec: CameraSpec<Contexts["camera"]>,
    input: Inputs["camera"],
  ) => Camera;

  /** Optional policy validation for plant-N / seed conventions. */
  readonly validateInsertReservation?: (
    reservation: InsertReservation<Graph>,
  ) => boolean;
}

export interface InitialDocument<Graph, Camera> {
  readonly plants?: ReadonlyMap<PlantId, Graph> | Iterable<readonly [PlantId, Graph]>;
  readonly camera: Camera;
  readonly selectedPlantId?: PlantId | null;
  /** Highest successfully seated ordinal. Empty launch state is zero. */
  readonly successfulPlantOrdinal?: number;
}

export interface CoordinatorOptions<Graph, Camera> {
  readonly posture?: Posture;
  readonly tool?: Tool;
  readonly view?: CanonicalView;
  readonly bendVariant?: BendVariant;
  /** Camera commits are excluded from autosave unless explicitly enabled. */
  readonly autosaveCameraCommits?: boolean;
  readonly onChange?: () => void;
  readonly onCancel?: (event: CancelEvent) => void;
  readonly onAutosave?: (event: AutosaveEvent<Graph, Camera>) => void;
}

export type CancelReason =
  | "pointer-cancel"
  | "lost-capture"
  | "visibility-hidden"
  | "posture-command"
  | "tool-command"
  | "view-command"
  | "selection-command"
  | "experiment-command"
  | "system-interruption"
  | "explicit-cancel";

export interface CancelEvent {
  readonly operation: TransactionKind;
  readonly reason: CancelReason;
  readonly owner: OwnerToken;
}

export interface DocumentSnapshot<Graph, Camera> {
  readonly plants: ReadonlyMap<PlantId, Graph>;
  readonly camera: Camera;
  readonly selectedPlantId: PlantId | null;
  readonly successfulPlantOrdinal: number;
}

export interface AutosaveEvent<Graph, Camera> {
  readonly sequence: number;
  readonly domain: "graph" | "camera";
  readonly operation: TransactionKind | "canonical-view";
  readonly plantId?: PlantId;
  /** A defensive committed-only snapshot; never a live preview. */
  readonly document: DocumentSnapshot<Graph, Camera>;
}

export type CommandFailure =
  | "busy"
  | "idle"
  | "owner-mismatch"
  | "wrong-transaction"
  | "wrong-posture"
  | "wrong-tool"
  | "plant-not-found"
  | "plant-not-selected"
  | "duplicate-plant"
  | "ordinal-mismatch"
  | "invalid-reservation"
  | "invalid-material-distance";

export type CommandResult =
  | { readonly ok: true }
  | { readonly ok: false; readonly reason: CommandFailure };

export interface CoordinatorDebugState {
  readonly posture: Posture;
  readonly tool: Tool;
  readonly view: CanonicalView;
  readonly bendVariant: BendVariant;
  readonly selectedPlantId: PlantId | null;
  readonly successfulPlantOrdinal: number;
  readonly commitSequence: number;
  readonly active: ActiveDebugState | null;
}

export type ActiveDebugState =
  | {
      readonly kind: "insert";
      readonly owner: OwnerToken;
      readonly plantId: PlantId;
      readonly seed: number;
      readonly ordinal: number;
      readonly isValid: boolean;
    }
  | {
      readonly kind: "aim";
      readonly owner: OwnerToken;
      readonly plantId: PlantId;
      readonly branchId: BranchId;
      readonly grabbedMaterialDistance: number;
    }
  | {
      readonly kind: "bend";
      readonly owner: OwnerToken;
      readonly plantId: PlantId;
      readonly branchId: BranchId;
      readonly variant: BendVariant;
      readonly stationDistance: number;
    }
  | {
      readonly kind: "base";
      readonly owner: OwnerToken;
      readonly plantId: PlantId;
    }
  | {
      readonly kind: "prune";
      readonly owner: OwnerToken;
      readonly plantId: PlantId;
      readonly branchId: BranchId;
      readonly acquiredMaterialDistance: number;
    }
  | {
      readonly kind: "camera";
      readonly owner: OwnerToken;
    };

export type ActivePresentation<Graph, Camera, PrunePlan> =
  | {
      readonly kind: "insert";
      readonly plantId: PlantId;
      readonly graph: Graph;
      readonly isValid: boolean;
    }
  | {
      readonly kind: "aim" | "bend" | "base";
      readonly plantId: PlantId;
      readonly graph: Graph;
    }
  | {
      readonly kind: "prune";
      readonly plantId: PlantId;
      readonly plan: PrunePlan;
    }
  | {
      readonly kind: "camera";
      readonly camera: Camera;
    };

export interface PresentationState<Graph, Camera, PrunePlan> {
  /** Committed data only. Active previews are carried separately below. */
  readonly document: DocumentSnapshot<Graph, Camera>;
  readonly active: ActivePresentation<Graph, Camera, PrunePlan> | null;
}
