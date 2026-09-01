import type {
  ActiveDebugState,
  ActivePresentation,
  AimSpec,
  AutosaveEvent,
  BaseSpec,
  BendCandidate,
  BendSpec,
  BendVariant,
  CameraSpec,
  CancelReason,
  CanonicalView,
  CommandFailure,
  CommandResult,
  CoordinatorDebugState,
  CoordinatorOptions,
  DocumentSnapshot,
  InitialDocument,
  InsertReservation,
  InsertSpec,
  OperationContextMap,
  OperationInputMap,
  OwnerToken,
  PlantId,
  Posture,
  PresentationState,
  PruneSpec,
  Tool,
  TransactionAdapters,
  TransactionKind,
} from "./types";

const OK: CommandResult = Object.freeze({ ok: true });

function fail(reason: CommandFailure): CommandResult {
  return Object.freeze({ ok: false, reason });
}

interface BaseActive {
  readonly owner: OwnerToken;
}

interface InsertActive<Graph, Context> extends BaseActive {
  readonly kind: "insert";
  readonly spec: InsertSpec<Graph, Context>;
  readonly snapshot: Graph;
  preview: Graph;
  isValid: boolean;
}

interface AimActive<Graph, Context> extends BaseActive {
  readonly kind: "aim";
  readonly spec: AimSpec<Context>;
  readonly snapshot: Graph;
  preview: Graph;
}

interface BendActive<Graph, Context> extends BaseActive {
  readonly kind: "bend";
  readonly spec: BendSpec<Context>;
  readonly snapshot: Graph;
  preview: Graph;
}

interface BaseMoveActive<Graph, Context> extends BaseActive {
  readonly kind: "base";
  readonly spec: BaseSpec<Context>;
  readonly snapshot: Graph;
  preview: Graph;
}

interface PruneActive<Graph, PrunePlan, Context> extends BaseActive {
  readonly kind: "prune";
  readonly spec: PruneSpec<Context>;
  readonly snapshot: Graph;
  plan: PrunePlan;
}

interface CameraActive<Camera, Context> extends BaseActive {
  readonly kind: "camera";
  readonly spec: CameraSpec<Context>;
  readonly snapshot: Camera;
  preview: Camera;
}

type ActiveTransaction<
  Graph,
  Camera,
  PrunePlan,
  Contexts extends OperationContextMap,
> =
  | InsertActive<Graph, Contexts["insert"]>
  | AimActive<Graph, Contexts["aim"]>
  | BendActive<Graph, Contexts["bend"]>
  | BaseMoveActive<Graph, Contexts["base"]>
  | PruneActive<Graph, PrunePlan, Contexts["prune"]>
  | CameraActive<Camera, Contexts["camera"]>;

/**
 * Owns exactly one acquired interaction and keeps previews separate from the
 * committed document.  No method depends on DOM events, pointer geometry, or
 * Three.js; owner tokens and already-constrained inputs are supplied by callers.
 */
export class TransactionCoordinator<
  Graph,
  Camera,
  PrunePlan,
  Inputs extends OperationInputMap = OperationInputMap,
  Contexts extends OperationContextMap = OperationContextMap,
> {
  private readonly adapters: TransactionAdapters<
    Graph,
    Camera,
    PrunePlan,
    Inputs,
    Contexts
  >;
  private readonly options: CoordinatorOptions<Graph, Camera>;

  private readonly plants = new Map<PlantId, Graph>();
  private camera: Camera;
  private selectedPlantId: PlantId | null;
  private successfulPlantOrdinal: number;
  private posture: Posture;
  private tool: Tool;
  private view: CanonicalView;
  private bendVariant: BendVariant;
  private commitSequence = 0;
  private active: ActiveTransaction<Graph, Camera, PrunePlan, Contexts> | null = null;

  public constructor(
    adapters: TransactionAdapters<Graph, Camera, PrunePlan, Inputs, Contexts>,
    initial: InitialDocument<Graph, Camera>,
    options: CoordinatorOptions<Graph, Camera> = {},
  ) {
    this.adapters = adapters;
    this.options = options;
    for (const [plantId, graph] of initial.plants ?? []) {
      this.plants.set(plantId, adapters.cloneGraph(graph));
    }
    this.camera = adapters.cloneCamera(initial.camera);
    this.selectedPlantId = initial.selectedPlantId ?? null;
    if (this.selectedPlantId !== null && !this.plants.has(this.selectedPlantId)) {
      this.selectedPlantId = null;
    }
    this.successfulPlantOrdinal = initial.successfulPlantOrdinal ?? 0;
    this.posture = options.posture ?? "arrange";
    this.tool = options.tool ?? "shape";
    this.view = options.view ?? "front";
    this.bendVariant = options.bendVariant ?? "bead";
  }

  /** Plain, serializable lifecycle metadata suitable for __IKEBANA_DEBUG__. */
  public getDebugState(): CoordinatorDebugState {
    return Object.freeze({
      posture: this.posture,
      tool: this.tool,
      view: this.view,
      bendVariant: this.bendVariant,
      selectedPlantId: this.selectedPlantId,
      successfulPlantOrdinal: this.successfulPlantOrdinal,
      commitSequence: this.commitSequence,
      active: this.debugActive(),
    });
  }

  /** Defensive committed snapshot for serialization, testing, or autosave. */
  public getDocumentSnapshot(): DocumentSnapshot<Graph, Camera> {
    const plants = new Map<PlantId, Graph>();
    for (const [plantId, graph] of this.plants) {
      plants.set(plantId, this.adapters.cloneGraph(graph));
    }
    return Object.freeze({
      plants,
      camera: this.adapters.cloneCamera(this.camera),
      selectedPlantId: this.selectedPlantId,
      successfulPlantOrdinal: this.successfulPlantOrdinal,
    });
  }

  /**
   * Read-only render frame: committed state plus one separately identified
   * preview. Consumers must never mutate values in this view.
   */
  public getPresentationState(): PresentationState<Graph, Camera, PrunePlan> {
    return Object.freeze({
      document: Object.freeze({
        plants: new Map(this.plants),
        camera: this.camera,
        selectedPlantId: this.selectedPlantId,
        successfulPlantOrdinal: this.successfulPlantOrdinal,
      }),
      active: this.presentationActive(),
    });
  }

  public beginInsert(
    owner: OwnerToken,
    reservation: InsertReservation<Graph>,
    context: Contexts["insert"],
    input: Inputs["insert"],
  ): CommandResult {
    const gate = this.requireIdle("arrange");
    if (!gate.ok) return gate;
    if (this.plants.has(reservation.plantId)) return fail("duplicate-plant");
    if (reservation.ordinal !== this.successfulPlantOrdinal + 1) {
      return fail("ordinal-mismatch");
    }
    if (this.adapters.validateInsertReservation?.(reservation) === false) {
      return fail("invalid-reservation");
    }

    const snapshot = this.adapters.cloneGraph(reservation.graph);
    const spec: InsertSpec<Graph, Contexts["insert"]> = Object.freeze({
      reservation: Object.freeze({
        ordinal: reservation.ordinal,
        plantId: reservation.plantId,
        seed: reservation.seed,
        graph: snapshot,
      }),
      context,
    });
    const placed = this.adapters.placePending(
      this.adapters.cloneGraph(snapshot),
      spec,
      input,
    );
    this.active = {
      kind: "insert",
      owner,
      spec,
      snapshot,
      preview: this.adapters.cloneGraph(placed.graph),
      isValid: placed.isValid,
    };
    this.changed();
    return OK;
  }

  public updateInsert(owner: OwnerToken, input: Inputs["insert"]): CommandResult {
    const active = this.requireOwned("insert", owner);
    if (!active.ok) return active.result;
    const placed = this.adapters.placePending(
      this.adapters.cloneGraph(active.value.snapshot),
      active.value.spec,
      input,
    );
    active.value.preview = this.adapters.cloneGraph(placed.graph);
    active.value.isValid = placed.isValid;
    this.changed();
    return OK;
  }

  public beginAim(
    owner: OwnerToken,
    spec: AimSpec<Contexts["aim"]>,
    input: Inputs["aim"],
  ): CommandResult {
    const graph = this.acquireGraph(spec.plantId, "shape", false);
    if (!graph.ok) return graph.result;
    if (!finiteMaterialDistance(spec.grabbedMaterialDistance)) {
      return fail("invalid-material-distance");
    }
    const frozenSpec = Object.freeze({ ...spec });
    const preview = this.adapters.aim(
      this.adapters.cloneGraph(graph.snapshot),
      frozenSpec,
      input,
    );
    this.selectedPlantId = spec.plantId;
    this.active = {
      kind: "aim",
      owner,
      spec: frozenSpec,
      snapshot: graph.snapshot,
      preview: this.adapters.cloneGraph(preview),
    };
    this.changed();
    return OK;
  }

  public updateAim(owner: OwnerToken, input: Inputs["aim"]): CommandResult {
    const active = this.requireOwned("aim", owner);
    if (!active.ok) return active.result;
    active.value.preview = this.adapters.cloneGraph(
      this.adapters.aim(
        this.adapters.cloneGraph(active.value.snapshot),
        active.value.spec,
        input,
      ),
    );
    this.changed();
    return OK;
  }

  public beginBend(
    owner: OwnerToken,
    candidate: BendCandidate<Contexts["bend"]>,
    input: Inputs["bend"],
  ): CommandResult {
    const graph = this.acquireGraph(candidate.plantId, "shape", true);
    if (!graph.ok) return graph.result;
    const stationDistance =
      this.bendVariant === "bead"
        ? candidate.beadStationDistance
        : candidate.touchMaterialDistance;
    if (!finiteMaterialDistance(stationDistance)) {
      return fail("invalid-material-distance");
    }
    const spec: BendSpec<Contexts["bend"]> = Object.freeze({
      plantId: candidate.plantId,
      branchId: candidate.branchId,
      variant: this.bendVariant,
      stationDistance,
      context: candidate.context,
    });
    const preview = this.adapters.bend(
      this.adapters.cloneGraph(graph.snapshot),
      spec,
      input,
    );
    this.active = {
      kind: "bend",
      owner,
      spec,
      snapshot: graph.snapshot,
      preview: this.adapters.cloneGraph(preview),
    };
    this.changed();
    return OK;
  }

  public updateBend(owner: OwnerToken, input: Inputs["bend"]): CommandResult {
    const active = this.requireOwned("bend", owner);
    if (!active.ok) return active.result;
    active.value.preview = this.adapters.cloneGraph(
      this.adapters.bend(
        this.adapters.cloneGraph(active.value.snapshot),
        active.value.spec,
        input,
      ),
    );
    this.changed();
    return OK;
  }

  public beginBase(
    owner: OwnerToken,
    spec: BaseSpec<Contexts["base"]>,
    input: Inputs["base"],
  ): CommandResult {
    const graph = this.acquireGraph(spec.plantId, "shape", true);
    if (!graph.ok) return graph.result;
    const frozenSpec = Object.freeze({ ...spec });
    const preview = this.adapters.moveBase(
      this.adapters.cloneGraph(graph.snapshot),
      frozenSpec,
      input,
    );
    this.active = {
      kind: "base",
      owner,
      spec: frozenSpec,
      snapshot: graph.snapshot,
      preview: this.adapters.cloneGraph(preview),
    };
    this.changed();
    return OK;
  }

  public updateBase(owner: OwnerToken, input: Inputs["base"]): CommandResult {
    const active = this.requireOwned("base", owner);
    if (!active.ok) return active.result;
    active.value.preview = this.adapters.cloneGraph(
      this.adapters.moveBase(
        this.adapters.cloneGraph(active.value.snapshot),
        active.value.spec,
        input,
      ),
    );
    this.changed();
    return OK;
  }

  public beginPrune(
    owner: OwnerToken,
    spec: PruneSpec<Contexts["prune"]>,
    input: Inputs["prune"],
  ): CommandResult {
    const graph = this.acquireGraph(spec.plantId, "prune", false);
    if (!graph.ok) return graph.result;
    if (!finiteMaterialDistance(spec.acquiredMaterialDistance)) {
      return fail("invalid-material-distance");
    }
    const frozenSpec = Object.freeze({ ...spec });
    const plan = this.adapters.previewPrune(
      this.adapters.cloneGraph(graph.snapshot),
      frozenSpec,
      input,
    );
    this.selectedPlantId = spec.plantId;
    this.active = {
      kind: "prune",
      owner,
      spec: frozenSpec,
      snapshot: graph.snapshot,
      plan,
    };
    this.changed();
    return OK;
  }

  public updatePrune(owner: OwnerToken, input: Inputs["prune"]): CommandResult {
    const active = this.requireOwned("prune", owner);
    if (!active.ok) return active.result;
    active.value.plan = this.adapters.previewPrune(
      this.adapters.cloneGraph(active.value.snapshot),
      active.value.spec,
      input,
    );
    this.changed();
    return OK;
  }

  public beginCamera(
    owner: OwnerToken,
    context: Contexts["camera"],
    input: Inputs["camera"],
  ): CommandResult {
    const gate = this.requireIdle("step-back");
    if (!gate.ok) return gate;
    const snapshot = this.adapters.cloneCamera(this.camera);
    const spec: CameraSpec<Contexts["camera"]> = Object.freeze({ context });
    const preview = this.adapters.updateCamera(
      this.adapters.cloneCamera(snapshot),
      spec,
      input,
    );
    this.active = {
      kind: "camera",
      owner,
      spec,
      snapshot,
      preview: this.adapters.cloneCamera(preview),
    };
    this.changed();
    return OK;
  }

  public updateCamera(owner: OwnerToken, input: Inputs["camera"]): CommandResult {
    const active = this.requireOwned("camera", owner);
    if (!active.ok) return active.result;
    active.value.preview = this.adapters.cloneCamera(
      this.adapters.updateCamera(
        this.adapters.cloneCamera(active.value.snapshot),
        active.value.spec,
        input,
      ),
    );
    this.changed();
    return OK;
  }

  /** Ordinary release is the only acquired plant-edit commit path. */
  public release(owner: OwnerToken): CommandResult {
    const active = this.active;
    if (active === null) return fail("idle");
    if (active.owner !== owner) return fail("owner-mismatch");

    // Clear ownership before adapters/callbacks run so finish is idempotent and
    // re-entrant commands cannot commit this transaction a second time.
    this.active = null;

    switch (active.kind) {
      case "insert": {
        if (!active.isValid) {
          this.changed();
          return OK;
        }
        const { reservation } = active.spec;
        this.plants.set(
          reservation.plantId,
          this.adapters.cloneGraph(active.preview),
        );
        this.selectedPlantId = reservation.plantId;
        this.successfulPlantOrdinal = reservation.ordinal;
        this.committed("graph", "insert", reservation.plantId);
        return OK;
      }
      case "aim":
      case "bend":
      case "base": {
        this.plants.set(
          active.spec.plantId,
          this.adapters.cloneGraph(active.preview),
        );
        this.committed("graph", active.kind, active.spec.plantId);
        return OK;
      }
      case "prune": {
        const committedGraph = this.adapters.applyPrune(
          this.adapters.cloneGraph(active.snapshot),
          active.plan,
        );
        this.plants.set(
          active.spec.plantId,
          this.adapters.cloneGraph(committedGraph),
        );
        this.committed("graph", "prune", active.spec.plantId);
        return OK;
      }
      case "camera": {
        this.camera = this.adapters.cloneCamera(active.preview);
        this.commitSequence += 1;
        this.changed();
        if (this.options.autosaveCameraCommits) {
          this.emitAutosave("camera", "camera");
        }
        return OK;
      }
    }
  }

  /** Owner-bound cancellation. Wrong pointers cannot finish someone else's drag. */
  public cancel(owner: OwnerToken, reason: CancelReason = "explicit-cancel"): CommandResult {
    const active = this.active;
    if (active === null) return fail("idle");
    if (active.owner !== owner) return fail("owner-mismatch");
    this.finishCancelled(active, reason);
    return OK;
  }

  public pointerCancel(owner: OwnerToken): CommandResult {
    return this.cancel(owner, "pointer-cancel");
  }

  public lostCapture(owner: OwnerToken): CommandResult {
    return this.cancel(owner, "lost-capture");
  }

  /** System/UI interruption is intentionally not owner-bound. */
  public interrupt(reason: CancelReason = "system-interruption"): CommandResult {
    if (this.active === null) return fail("idle");
    this.finishCancelled(this.active, reason);
    return OK;
  }

  public visibilityHidden(): CommandResult {
    return this.interrupt("visibility-hidden");
  }

  public commandPosture(posture: Posture): void {
    this.cancelForCommand("posture-command");
    this.posture = posture;
    this.changed();
  }

  public commandTool(tool: Tool): void {
    this.cancelForCommand("tool-command");
    this.tool = tool;
    this.changed();
  }

  public commandView(view: CanonicalView, camera: Camera): void {
    this.cancelForCommand("view-command");
    this.view = view;
    this.camera = this.adapters.cloneCamera(camera);
    if (this.options.autosaveCameraCommits) {
      this.commitSequence += 1;
      this.changed();
      this.emitAutosave("camera", "canonical-view");
    } else {
      this.changed();
    }
  }

  public commandSelection(plantId: PlantId | null): CommandResult {
    if (plantId !== null && !this.plants.has(plantId)) {
      return fail("plant-not-found");
    }
    if (plantId !== this.selectedPlantId) {
      this.cancelForCommand("selection-command");
      this.selectedPlantId = plantId;
      this.changed();
    }
    return OK;
  }

  public commandBendVariant(variant: BendVariant): void {
    this.cancelForCommand("experiment-command");
    this.bendVariant = variant;
    this.changed();
  }

  private requireIdle(posture: Posture): CommandResult {
    if (this.active !== null) return fail("busy");
    if (this.posture !== posture) return fail("wrong-posture");
    return OK;
  }

  private acquireGraph(
    plantId: PlantId,
    tool: Tool,
    mustAlreadyBeSelected: boolean,
  ):
    | { readonly ok: true; readonly snapshot: Graph }
    | { readonly ok: false; readonly result: CommandResult } {
    const gate = this.requireIdle("arrange");
    if (!gate.ok) return { ok: false, result: gate };
    if (this.tool !== tool) return { ok: false, result: fail("wrong-tool") };
    const graph = this.plants.get(plantId);
    if (graph === undefined) {
      return { ok: false, result: fail("plant-not-found") };
    }
    if (mustAlreadyBeSelected && this.selectedPlantId !== plantId) {
      return { ok: false, result: fail("plant-not-selected") };
    }
    return { ok: true, snapshot: this.adapters.cloneGraph(graph) };
  }

  private requireOwned<Kind extends TransactionKind>(
    kind: Kind,
    owner: OwnerToken,
  ):
    | {
        readonly ok: true;
        readonly value: Extract<
          ActiveTransaction<Graph, Camera, PrunePlan, Contexts>,
          { readonly kind: Kind }
        >;
      }
    | { readonly ok: false; readonly result: CommandResult } {
    if (this.active === null) {
      return { ok: false, result: fail("idle") };
    }
    if (this.active.owner !== owner) {
      return { ok: false, result: fail("owner-mismatch") };
    }
    if (this.active.kind !== kind) {
      return { ok: false, result: fail("wrong-transaction") };
    }
    return {
      ok: true,
      value: this.active as Extract<
        ActiveTransaction<Graph, Camera, PrunePlan, Contexts>,
        { readonly kind: Kind }
      >,
    };
  }

  private cancelForCommand(reason: CancelReason): void {
    if (this.active !== null) this.finishCancelled(this.active, reason);
  }

  private finishCancelled(
    active: ActiveTransaction<Graph, Camera, PrunePlan, Contexts>,
    reason: CancelReason,
  ): void {
    if (this.active !== active) return;
    this.active = null;
    this.changed();
    this.options.onCancel?.({
      operation: active.kind,
      reason,
      owner: active.owner,
    });
  }

  private committed(
    domain: "graph",
    operation: Exclude<TransactionKind, "camera">,
    plantId: PlantId,
  ): void {
    this.commitSequence += 1;
    this.changed();
    this.emitAutosave(domain, operation, plantId);
  }

  private emitAutosave(
    domain: "graph" | "camera",
    operation: TransactionKind | "canonical-view",
    plantId?: PlantId,
  ): void {
    if (this.options.onAutosave === undefined) return;
    const event: AutosaveEvent<Graph, Camera> = Object.freeze({
      sequence: this.commitSequence,
      domain,
      operation,
      plantId,
      document: this.getDocumentSnapshot(),
    });
    this.options.onAutosave(event);
  }

  private changed(): void {
    this.options.onChange?.();
  }

  private debugActive(): ActiveDebugState | null {
    const active = this.active;
    if (active === null) return null;
    switch (active.kind) {
      case "insert":
        return Object.freeze({
          kind: "insert",
          owner: active.owner,
          plantId: active.spec.reservation.plantId,
          seed: active.spec.reservation.seed,
          ordinal: active.spec.reservation.ordinal,
          isValid: active.isValid,
        });
      case "aim":
        return Object.freeze({
          kind: "aim",
          owner: active.owner,
          plantId: active.spec.plantId,
          branchId: active.spec.branchId,
          grabbedMaterialDistance: active.spec.grabbedMaterialDistance,
        });
      case "bend":
        return Object.freeze({
          kind: "bend",
          owner: active.owner,
          plantId: active.spec.plantId,
          branchId: active.spec.branchId,
          variant: active.spec.variant,
          stationDistance: active.spec.stationDistance,
        });
      case "base":
        return Object.freeze({
          kind: "base",
          owner: active.owner,
          plantId: active.spec.plantId,
        });
      case "prune":
        return Object.freeze({
          kind: "prune",
          owner: active.owner,
          plantId: active.spec.plantId,
          branchId: active.spec.branchId,
          acquiredMaterialDistance: active.spec.acquiredMaterialDistance,
        });
      case "camera":
        return Object.freeze({ kind: "camera", owner: active.owner });
    }
  }

  private presentationActive(): ActivePresentation<Graph, Camera, PrunePlan> | null {
    const active = this.active;
    if (active === null) return null;
    switch (active.kind) {
      case "insert":
        return Object.freeze({
          kind: "insert",
          plantId: active.spec.reservation.plantId,
          graph: active.preview,
          isValid: active.isValid,
        });
      case "aim":
      case "bend":
      case "base":
        return Object.freeze({
          kind: active.kind,
          plantId: active.spec.plantId,
          graph: active.preview,
        });
      case "prune":
        return Object.freeze({
          kind: "prune",
          plantId: active.spec.plantId,
          plan: active.plan,
        });
      case "camera":
        return Object.freeze({ kind: "camera", camera: active.preview });
    }
  }
}

function finiteMaterialDistance(value: number): boolean {
  return Number.isFinite(value) && value >= 0;
}
