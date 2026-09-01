import {
  add,
  addScaled,
  assertValidPlantGraph,
  bendStationAtFraction,
  fromCanonicalPlantGraph,
  legalBendStation,
  normalize,
  sampleBranch,
  toCanonicalPlantGraph,
  type CanonicalPlantGraph,
  type CutPlan,
  type PlantGraph,
  type Vec3,
} from "../core/index.ts";
import {
  TransactionCoordinator,
  type CancelReason,
  type CoordinatorDebugState,
} from "../input/index.ts";
import {
  ThreeStudio,
  compareHitCandidates,
  type HitCandidate,
  type KenzanIntersection,
  type SpatialPlane,
  type StudioView,
} from "../presentation/index.ts";
import {
  canonicalCameraPose,
  cloneCameraPose,
  dollyCameraPose,
  orbitCameraPose,
  type CameraPose,
} from "./camera.ts";
import { readExperimentConfig, urlForBendVariant, type BendVariant } from "./config.ts";
import {
  createDomainAdapters,
  type StudioContextMap,
  type StudioInputMap,
} from "./domainAdapters.ts";
import {
  KENZAN_BASE,
  prepareMaterialInsertionForApp,
  selectedBranchIdForSeatedGraph,
} from "./materialInsertion.ts";
import {
  createSessionId,
  SessionMetrics,
  screenRegion,
  type AcquisitionRecord,
  type TransactionOutcome,
} from "./metrics.ts";
import { CommittedStore } from "./persistence.ts";
import { CraftSound } from "./sound.ts";
import { TelemetryStore, type PersistedTelemetry } from "./telemetry.ts";
import {
  createUIBindings,
  type BendVariant as UIBendVariant,
  type UICommand,
  type UIBindings,
} from "./ui.ts";

type Coordinator = TransactionCoordinator<
  PlantGraph,
  CameraPose,
  CutPlan,
  StudioInputMap,
  StudioContextMap
>;

type PointerBase = {
  owner: number;
  capture: HTMLElement;
  acquisitionHash: string;
};

type InsertGesture = PointerBase & {
  kind: "insert";
  materialId: string;
  plantId: string;
  pendingVisible: boolean;
};

type AimGesture = PointerBase & {
  kind: "aim";
  plane: SpatialPlane;
  startPlaneHit: Vec3;
  grabbedPoint: Vec3;
};

type BendGesture = PointerBase & {
  kind: "bend";
  plane: SpatialPlane;
  startPlaneHit: Vec3;
  stationPoint: Vec3;
  stationDistance: number;
};

type BaseGesture = PointerBase & {
  kind: "base";
  startBase: Vec3;
  startPlaneHit: Vec3 | null;
  startClientX: number;
  startClientY: number;
};

type PruneGesture = PointerBase & {
  kind: "prune";
  plantId: string;
  branchId: string;
};

type CameraGesture = PointerBase & {
  kind: "camera";
  pointers: Map<number, { x: number; y: number }>;
  startClientX: number;
  startClientY: number;
  startPose: CameraPose;
  pinchStartDistance: number | null;
  pinchStartPose: CameraPose | null;
};

type Gesture = InsertGesture | AimGesture | BendGesture | BaseGesture | PruneGesture | CameraGesture;

type AutosaveAuditRecord = {
  commitSequence: number;
  canonicalHash: string;
  transactionActive: boolean;
  reason: "commit";
};

type TestHitCandidate = {
  stableId: string;
  tier: "selected-handle" | "selected-plant" | "other-plant";
  screenDistance: number;
  rayDepth: number;
};

interface IkebanaTestBridge {
  version: 1;
  ready: Promise<void>;
  getState(): unknown;
  getCanonicalSnapshot(): unknown;
  getRenderInventory(): unknown[];
  getScreenTargets(): unknown[];
  resolveHitForTest(candidates: TestHitCandidate[]): { stableId: string } | null;
  getMetrics(): unknown;
  resetMetrics(): void;
  getAutosaveAudit(): { writes: AutosaveAuditRecord[] };
  getPersistedTelemetry(): PersistedTelemetry;
  getTelemetryExportPayload(): unknown;
  resetForTest(options: { clearAutosave: boolean; bendVariant?: "fixed" | "touch" | string }): Promise<void>;
  interruptForTest(reason: string): void;
  loseContextForTest(): Promise<boolean>;
  restoreContextForTest(): Promise<boolean>;
}

declare global {
  interface Window {
    __IKEBANA_TEST__?: IkebanaTestBridge;
  }
}

const TOUCH_BEND_START = 0.24;
const TOUCH_BEND_END = 0.72;

export function placementInputFromIntersection(intersection: KenzanIntersection | null) {
  return intersection
    ? { base: intersection.point, valid: intersection.valid }
    : { base: { ...KENZAN_BASE }, valid: false };
}

function uiVariant(variant: BendVariant): UIBendVariant {
  return variant === "touch" ? "touch-located" : "fixed-bead";
}

function domainVariant(variant: UIBendVariant): BendVariant {
  return variant === "touch-located" ? "touch" : "bead";
}

function fnv1a(text: string) {
  let hash = 0x811c9dc5;
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}

function pointerDistance(
  left: { x: number; y: number },
  right: { x: number; y: number },
) {
  return Math.hypot(left.x - right.x, left.y - right.y);
}

function clonePlain<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function mean(values: number[]): number | null {
  if (values.length === 0) return null;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

/**
 * A compact, ready-to-read comparison of one variant's acquisitions. This
 * answers "which arm is easier/faster to hit and how often does an acquired
 * edit actually land" without further spreadsheet work; it does not answer
 * whether the resulting silhouette is preferred, which needs the phone card.
 */
function summarizeVariantTelemetry(records: AcquisitionRecord[]) {
  const hits = records.filter((record) => record.result === "hit");
  const misses = records.filter((record) => record.result === "miss");
  const committed = hits.filter((record) => record.outcome === "committed");
  const cancelled = hits.filter((record) => record.outcome === "cancelled");
  const declined = hits.filter((record) => record.outcome === "declined");
  return {
    totalAcquisitions: records.length,
    hits: hits.length,
    misses: misses.length,
    committed: committed.length,
    cancelled: cancelled.length,
    declined: declined.length,
    meanTimeToAcquireMs: mean(hits.map((record) => record.timeToAcquireMs ?? 0)),
    meanMissesBeforeHit: mean(hits.map((record) => record.missesBeforeHit)),
  };
}

export class IkebanaApp {
  private readonly root: HTMLElement;
  private readonly ui: UIBindings;
  private readonly canvas: HTMLCanvasElement;
  private readonly studio: ThreeStudio;
  private readonly store = new CommittedStore<CanonicalPlantGraph>();
  private readonly sound = new CraftSound();
  private readonly config = readExperimentConfig();
  private readonly sessionId = createSessionId();
  private readonly metrics = new SessionMetrics(this.sessionId, this.config.bendVariant);
  private readonly telemetryStore = new TelemetryStore();
  private readonly autosaveWrites: AutosaveAuditRecord[] = [];
  private readonly abortController = new AbortController();

  private coordinator!: Coordinator;
  private gesture: Gesture | null = null;
  private selectedBranchId: string | null = null;
  private bendVariant: BendVariant;
  /** The hit that opened the transaction currently pending commit/cancel/decline. */
  private pendingAcquisitionRecord: AcquisitionRecord | null = null;
  private cameraIsFree = false;
  private started = false;
  private disposed = false;
  private restored = false;
  private loadWarning = false;
  private lastSaveSucceeded = true;
  private removeUIListener: (() => void) | null = null;

  constructor(root: HTMLElement) {
    this.root = root;
    this.bendVariant = this.config.bendVariant;
    if (this.config.fresh) this.telemetryStore.clear();
    this.ui = createUIBindings({
      root,
      initialState: { bendVariant: uiVariant(this.bendVariant) },
    });
    this.canvas = document.createElement("canvas");
    this.canvas.className = "scene-canvas";
    this.canvas.dataset.testid = "scene-canvas";
    this.canvas.setAttribute("aria-label", "Ikebana arrangement");
    this.ui.studio.append(this.canvas);
    this.studio = new ThreeStudio(this.canvas, {
      debugHitTargets: this.config.debug,
    });

    const initial = this.loadInitialDocument();
    this.replaceCoordinator(initial.plants, initial.successfulPlantOrdinal);
  }

  start() {
    if (this.started || this.disposed) return;
    this.started = true;
    const options = { signal: this.abortController.signal };
    this.removeUIListener = this.ui.onCommand((command, event) => this.handleUICommand(command, event));
    this.canvas.addEventListener("pointerdown", this.onCanvasPointerDown, options);
    this.canvas.addEventListener("wheel", this.onWheel, { ...options, passive: false });
    this.canvas.addEventListener("contextmenu", this.preventDefault, options);
    this.canvas.addEventListener("webglcontextlost", this.onContextLost, options);
    this.canvas.addEventListener("webglcontextrestored", this.onContextRestored, options);
    window.addEventListener("pointermove", this.onPointerMove, { ...options, passive: false, capture: true });
    window.addEventListener("pointerup", this.onPointerUp, { ...options, capture: true });
    window.addEventListener("pointercancel", this.onPointerCancel, { ...options, capture: true });
    window.addEventListener("lostpointercapture", this.onLostPointerCapture, { ...options, capture: true });
    document.addEventListener("visibilitychange", this.onVisibilityChange, options);
    window.addEventListener("pagehide", this.onPageHide, options);
    window.addEventListener("resize", this.onViewportChanged, options);
    window.addEventListener("orientationchange", this.onViewportChanged, options);
    window.visualViewport?.addEventListener("resize", this.onVisualViewportChanged, options);

    this.ui.setStatus(
      this.loadWarning
        ? "Saved work could not be opened."
        : this.restored
          ? "Your arrangement is here."
          : "Place a cutting.",
      this.loadWarning ? "warning" : "quiet",
    );
    this.syncPresentation();
    this.root.dataset.ready = "true";
    if (new URL(location.href).searchParams.get("test") === "1") this.installTestBridge();
  }

  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    this.interruptActive("system-interruption", false);
    this.abortController.abort();
    this.removeUIListener?.();
    this.removeUIListener = null;
    this.ui.destroy();
    this.studio.dispose();
    if (window.__IKEBANA_TEST__) delete window.__IKEBANA_TEST__;
  }

  private loadInitialDocument() {
    const empty = { plants: new Map<string, PlantGraph>(), successfulPlantOrdinal: 0 };
    if (this.config.fresh) return empty;
    const saved = this.store.load();
    if (!saved) return empty;
    try {
      const plants = new Map<string, PlantGraph>();
      for (const document of saved.plants) {
        const graph = fromCanonicalPlantGraph(document);
        assertValidPlantGraph(graph);
        if (plants.has(graph.id)) throw new Error(`Duplicate saved plant ${graph.id}`);
        plants.set(graph.id, graph);
      }
      const successfulPlantOrdinal = saved.nextSuccessfulOrdinal - 1;
      if (successfulPlantOrdinal < 0) throw new Error("Invalid saved plant ordinal");
      this.restored = plants.size > 0;
      return { plants, successfulPlantOrdinal };
    } catch {
      this.loadWarning = true;
      return empty;
    }
  }

  private replaceCoordinator(plants: ReadonlyMap<string, PlantGraph>, successfulPlantOrdinal: number) {
    this.coordinator = new TransactionCoordinator(
      createDomainAdapters(),
      {
        plants,
        camera: canonicalCameraPose("front"),
        selectedPlantId: null,
        successfulPlantOrdinal,
      },
      {
        posture: "arrange",
        tool: "shape",
        view: "front",
        bendVariant: this.bendVariant,
        onChange: () => this.syncPresentation(),
        onCancel: (event) => {
          this.resolvePendingAcquisition("cancelled", event.reason);
        },
        onAutosave: (event) => {
          const plantsToSave = [...event.document.plants.values()]
            .sort((left, right) => left.id.localeCompare(right.id))
            .map(toCanonicalPlantGraph);
          const canonicalHash = this.hashDocument(event.document.plants, event.document.successfulPlantOrdinal);
          this.autosaveWrites.push({
            commitSequence: event.sequence,
            canonicalHash,
            transactionActive: this.coordinator.getDebugState().active !== null,
            reason: "commit",
          });
          this.resolvePendingAcquisition("committed");
          this.lastSaveSucceeded = this.store.save(
            event.document.successfulPlantOrdinal + 1,
            plantsToSave,
          );
          if (!this.lastSaveSucceeded) {
            this.ui.setStatus("Could not save this change.", "warning");
          }
        },
      },
    );
  }

  private handleUICommand(command: UICommand, sourceEvent: Event) {
    this.sound.unlock();
    switch (command.kind) {
      case "set-posture": {
        this.interruptActive("posture-command");
        this.coordinator.commandPosture(command.posture);
        this.ui.setState({ posture: command.posture });
        this.ui.setStatus(command.posture === "step-back" ? "Drag to look." : "Touch the material.");
        break;
      }
      case "set-tool": {
        this.interruptActive("tool-command");
        this.coordinator.commandTool(command.tool);
        this.ui.setState({ tool: command.tool });
        this.ui.setStatus(command.tool === "shape" ? "Shape the line." : "Choose where to cut.");
        break;
      }
      case "set-view": {
        this.interruptActive("view-command");
        this.cameraIsFree = false;
        this.coordinator.commandView(command.view, canonicalCameraPose(command.view));
        this.ui.setState({ view: command.view });
        this.ui.setStatus(command.view === "front" ? "Front." : command.view === "above" ? "Above." : "Three-quarter.");
        break;
      }
      case "set-bend-variant": {
        this.interruptActive("experiment-command");
        this.bendVariant = domainVariant(command.bendVariant);
        this.metrics.setBendVariant(this.bendVariant);
        this.coordinator.commandBendVariant(this.bendVariant);
        this.ui.setState({ bendVariant: command.bendVariant });
        history.replaceState(null, "", urlForBendVariant(this.bendVariant));
        this.ui.setStatus(this.bendVariant === "touch" ? "Bend where you touch." : "Use the pale bend point.");
        break;
      }
      case "set-experiment-panel": {
        this.interruptActive("experiment-command");
        this.ui.setExperimentPanelOpen(command.open);
        break;
      }
      case "begin-material-drag": {
        if (!(sourceEvent instanceof PointerEvent)) return;
        this.beginMaterialDrag(command, sourceEvent);
        break;
      }
      case "activate-material": {
        this.activateMaterial(command.materialId);
        break;
      }
      case "export-telemetry": {
        void this.exportTelemetry();
        break;
      }
    }
  }

  private beginMaterialDrag(
    command: Extract<UICommand, { kind: "begin-material-drag" }>,
    event: PointerEvent,
  ) {
    if (this.gesture || this.coordinator.getDebugState().posture !== "arrange") return;
    const prepared = this.prepareMaterialInsertion(command.materialId);
    if (!prepared) return;
    const reservation = {
      ordinal: prepared.ordinal,
      plantId: prepared.plantId,
      seed: prepared.seed,
      graph: prepared.graph,
    };
    const intersection = this.studio.intersectKenzanPlane(command.clientX, command.clientY);
    const input = placementInputFromIntersection(intersection);
    const capture = this.materialCaptureElement(event);
    if (!capture) return;
    const gesture: InsertGesture = {
      kind: "insert",
      materialId: command.materialId,
      owner: command.pointerId,
      capture,
      acquisitionHash: this.canonicalHash(),
      plantId: prepared.plantId,
      pendingVisible: intersection !== null,
    };
    this.gesture = gesture;
    this.capturePointer(capture, command.pointerId);
    const result = this.coordinator.beginInsert(
      command.pointerId,
      reservation,
      {},
      input,
    );
    if (!result.ok) {
      this.gesture = null;
      this.releasePointer(capture, command.pointerId);
      return;
    }
    this.trackAcquisition({
      posture: "arrange",
      tool: "shape",
      result: "hit",
      operation: "insert",
      region: screenRegion(command.clientY),
    });
    this.ui.setStatus(input.valid ? "Over the pins." : "Find the pins.");
  }

  private activateMaterial(materialId: string) {
    if (this.gesture || this.coordinator.getDebugState().posture !== "arrange") return;
    const prepared = this.prepareMaterialInsertion(materialId);
    if (!prepared) return;
    const reservation = {
      ordinal: prepared.ordinal,
      plantId: prepared.plantId,
      seed: prepared.seed,
      graph: prepared.graph,
    };
    const angle = (prepared.ordinal - 1) * 2.399963;
    const radius = Math.min(0.86, Math.sqrt(Math.max(0, prepared.ordinal - 1)) * 0.28);
    const base = { x: Math.sin(angle) * radius, y: 0.55, z: Math.cos(angle) * radius };
    const owner = `keyboard-${prepared.ordinal}`;
    const started = this.coordinator.beginInsert(
      owner,
      reservation,
      {},
      { base, valid: true },
    );
    if (!started.ok) return;
    this.trackAcquisition({
      posture: "arrange",
      tool: "shape",
      result: "hit",
      operation: "insert",
      region: "bottom",
    });
    this.lastSaveSucceeded = true;
    const released = this.coordinator.release(owner);
    if (!released.ok) return;
    const seatedGraph = this.coordinator.getDocumentSnapshot().plants.get(prepared.plantId);
    this.selectedBranchId = seatedGraph ? selectedBranchIdForSeatedGraph(seatedGraph) : null;
    this.sound.seat();
    if (this.lastSaveSucceeded) this.ui.setStatus("Seated.");
    this.syncPresentation();
  }

  private onCanvasPointerDown = (event: PointerEvent) => {
    if (event.button !== 0) return;
    event.preventDefault();
    this.sound.unlock();
    if (this.gesture) {
      if (this.gesture.kind === "camera") this.addCameraPointer(event);
      return;
    }
    const debug = this.coordinator.getDebugState();
    if (debug.posture === "step-back") {
      this.beginCamera(event);
      return;
    }

    const candidate = this.studio.collectHitCandidates(event.clientX, event.clientY)[0] ?? null;
    if (!candidate) {
      this.trackAcquisition({
        posture: "arrange",
        tool: debug.tool,
        result: "miss",
        region: screenRegion(event.clientY),
      });
      this.ui.setStatus("Step back to look around.");
      return;
    }

    if (debug.tool === "prune") {
      this.beginPrune(event, candidate);
      return;
    }
    if (candidate.kind === "base") {
      this.beginBase(event, candidate);
      return;
    }
    if (candidate.kind === "bend") {
      this.beginBend(event, candidate, candidate.materialDistance);
      return;
    }
    if (this.shouldTouchBend(candidate)) {
      this.beginBend(event, candidate, candidate.materialDistance);
      return;
    }
    this.beginAim(event, candidate);
  };

  private beginAim(event: PointerEvent, candidate: HitCandidate) {
    const graph = this.coordinator.getDocumentSnapshot().plants.get(candidate.plantId);
    const branch = graph?.branches.get(candidate.branchId);
    if (!graph || !branch?.active) return;
    const grabbedPoint = sampleBranch(branch, candidate.materialDistance).position;
    const plane = this.studio.cameraFacingPlaneThrough(grabbedPoint);
    const startPlaneHit = this.studio.intersectClientPlane(event.clientX, event.clientY, plane) ?? grabbedPoint;
    const gesture: AimGesture = {
      kind: "aim",
      owner: event.pointerId,
      capture: this.canvas,
      acquisitionHash: this.canonicalHash(),
      plane,
      startPlaneHit,
      grabbedPoint,
    };
    this.selectedBranchId = branch.id;
    this.gesture = gesture;
    this.capturePointer(this.canvas, event.pointerId);
    const result = this.coordinator.beginAim(
      event.pointerId,
      {
        plantId: graph.id,
        branchId: branch.id,
        grabbedMaterialDistance: candidate.materialDistance,
        context: {},
      },
      { target: grabbedPoint },
    );
    if (!result.ok) return this.abortFailedBegin(gesture);
    this.recordHit(event, "aim");
    this.ui.setStatus("Shape the line.");
  }

  private beginBend(event: PointerEvent, candidate: HitCandidate, requestedStation: number) {
    const graph = this.coordinator.getDocumentSnapshot().plants.get(candidate.plantId);
    const branch = graph?.branches.get(candidate.branchId);
    if (!graph || !branch?.active) return;
    const beadDistance = bendStationAtFraction(branch, 0.54);
    const touchDistance = legalBendStation(branch, requestedStation);
    if (beadDistance === null || touchDistance === null) return;
    const stationDistance = this.bendVariant === "touch" ? touchDistance : beadDistance;
    const stationPoint = sampleBranch(branch, stationDistance).position;
    const plane = this.studio.cameraFacingPlaneThrough(stationPoint);
    const startPlaneHit = this.studio.intersectClientPlane(event.clientX, event.clientY, plane) ?? stationPoint;
    const gesture: BendGesture = {
      kind: "bend",
      owner: event.pointerId,
      capture: this.canvas,
      acquisitionHash: this.canonicalHash(),
      plane,
      startPlaneHit,
      stationPoint,
      stationDistance,
    };
    this.gesture = gesture;
    this.capturePointer(this.canvas, event.pointerId);
    const result = this.coordinator.beginBend(
      event.pointerId,
      {
        plantId: graph.id,
        branchId: branch.id,
        beadStationDistance: beadDistance,
        touchMaterialDistance: touchDistance,
        context: {},
      },
      { target: stationPoint },
    );
    if (!result.ok) return this.abortFailedBegin(gesture);
    this.recordHit(event, "bend");
    this.ui.setStatus("Bend the line.");
  }

  private beginBase(event: PointerEvent, candidate: HitCandidate) {
    const graph = this.coordinator.getDocumentSnapshot().plants.get(candidate.plantId);
    const root = graph?.branches.get(graph.rootBranchId);
    if (!graph || !root?.active) return;
    const startBase = { ...root.points[0] };
    const gesture: BaseGesture = {
      kind: "base",
      owner: event.pointerId,
      capture: this.canvas,
      acquisitionHash: this.canonicalHash(),
      startBase,
      startPlaneHit: this.studio.intersectKenzanPlane(event.clientX, event.clientY)?.point ?? null,
      startClientX: event.clientX,
      startClientY: event.clientY,
    };
    this.gesture = gesture;
    this.capturePointer(this.canvas, event.pointerId);
    const result = this.coordinator.beginBase(
      event.pointerId,
      { plantId: graph.id, context: {} },
      { base: startBase },
    );
    if (!result.ok) return this.abortFailedBegin(gesture);
    this.recordHit(event, "base");
    this.ui.setStatus("Move the insertion.");
  }

  private beginPrune(event: PointerEvent, candidate: HitCandidate) {
    const graph = this.coordinator.getDocumentSnapshot().plants.get(candidate.plantId);
    const branch = graph?.branches.get(candidate.branchId);
    if (!graph || !branch?.active) return;
    const gesture: PruneGesture = {
      kind: "prune",
      owner: event.pointerId,
      capture: this.canvas,
      acquisitionHash: this.canonicalHash(),
      plantId: graph.id,
      branchId: branch.id,
    };
    this.selectedBranchId = branch.id;
    this.gesture = gesture;
    this.capturePointer(this.canvas, event.pointerId);
    const result = this.coordinator.beginPrune(
      event.pointerId,
      {
        plantId: graph.id,
        branchId: branch.id,
        acquiredMaterialDistance: candidate.materialDistance,
        context: {},
      },
      { distance: candidate.materialDistance },
    );
    if (!result.ok) return this.abortFailedBegin(gesture);
    this.recordHit(event, "prune");
    this.ui.setStatus("Release to cut.");
  }

  private beginCamera(event: PointerEvent) {
    const startPose = this.coordinator.getDocumentSnapshot().camera;
    const gesture: CameraGesture = {
      kind: "camera",
      owner: event.pointerId,
      capture: this.canvas,
      acquisitionHash: this.canonicalHash(),
      pointers: new Map([[event.pointerId, { x: event.clientX, y: event.clientY }]]),
      startClientX: event.clientX,
      startClientY: event.clientY,
      startPose,
      pinchStartDistance: null,
      pinchStartPose: null,
    };
    this.gesture = gesture;
    this.capturePointer(this.canvas, event.pointerId);
    const result = this.coordinator.beginCamera(event.pointerId, {}, { pose: startPose });
    if (!result.ok) return this.abortFailedBegin(gesture);
    this.recordHit(event, "camera");
  }

  private addCameraPointer(event: PointerEvent) {
    const gesture = this.gesture;
    if (gesture?.kind !== "camera" || gesture.pointers.has(event.pointerId)) return;
    event.preventDefault();
    this.capturePointer(this.canvas, event.pointerId);
    gesture.pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
    const points = [...gesture.pointers.values()];
    if (points.length >= 2) {
      gesture.pinchStartDistance = Math.max(12, pointerDistance(points[0], points[1]));
      const active = this.coordinator.getPresentationState().active;
      gesture.pinchStartPose = active?.kind === "camera" ? active.camera : gesture.startPose;
    }
  }

  private onPointerMove = (event: PointerEvent) => {
    const gesture = this.gesture;
    if (!gesture) return;
    if (gesture.kind === "camera") {
      if (!gesture.pointers.has(event.pointerId)) return;
      event.preventDefault();
      gesture.pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
      this.updateCamera(gesture);
      return;
    }
    if (gesture.owner !== event.pointerId) return;
    event.preventDefault();
    if (gesture.kind === "insert") {
      const intersection = this.studio.intersectKenzanPlane(event.clientX, event.clientY);
      gesture.pendingVisible = intersection !== null;
      this.coordinator.updateInsert(event.pointerId, placementInputFromIntersection(intersection));
      this.ui.setStatus(intersection?.valid ? "Over the pins." : "Find the pins.");
      return;
    }
    if (gesture.kind === "aim" || gesture.kind === "bend") {
      const hit = this.studio.intersectClientPlane(event.clientX, event.clientY, gesture.plane);
      if (!hit) return;
      const target = add(
        gesture.kind === "aim" ? gesture.grabbedPoint : gesture.stationPoint,
        { x: hit.x - gesture.startPlaneHit.x, y: hit.y - gesture.startPlaneHit.y, z: hit.z - gesture.startPlaneHit.z },
      );
      if (gesture.kind === "aim") this.coordinator.updateAim(event.pointerId, { target });
      else this.coordinator.updateBend(event.pointerId, { target });
      return;
    }
    if (gesture.kind === "base") {
      const hit = this.studio.intersectKenzanPlane(event.clientX, event.clientY)?.point ?? null;
      let base: Vec3;
      if (hit && gesture.startPlaneHit) {
        base = add(gesture.startBase, {
          x: hit.x - gesture.startPlaneHit.x,
          y: 0,
          z: hit.z - gesture.startPlaneHit.z,
        });
      } else {
        const axes = this.studio.getCameraAxes();
        const right = normalize({ x: axes.right.x, y: 0, z: axes.right.z }, { x: 1, y: 0, z: 0 });
        const forward = normalize({ x: axes.forward.x, y: 0, z: axes.forward.z }, { x: 0, y: 0, z: -1 });
        base = addScaled(
          addScaled(gesture.startBase, right, (event.clientX - gesture.startClientX) * 0.018),
          forward,
          (event.clientY - gesture.startClientY) * 0.018,
        );
      }
      this.coordinator.updateBase(event.pointerId, { base });
      return;
    }
    const projected = this.studio.closestProjectedPointOnBranch(
      gesture.plantId,
      gesture.branchId,
      event.clientX,
      event.clientY,
    );
    if (projected) this.coordinator.updatePrune(event.pointerId, { distance: projected.materialDistance });
  };

  private updateCamera(gesture: CameraGesture) {
    const points = [...gesture.pointers.values()];
    let pose: CameraPose;
    if (points.length >= 2 && gesture.pinchStartDistance && gesture.pinchStartPose) {
      const current = Math.max(12, pointerDistance(points[0], points[1]));
      pose = dollyCameraPose(gesture.pinchStartPose, gesture.pinchStartDistance / current);
    } else {
      const primary = gesture.pointers.get(gesture.owner);
      if (!primary) return;
      pose = orbitCameraPose(
        gesture.startPose,
        primary.x - gesture.startClientX,
        primary.y - gesture.startClientY,
      );
    }
    this.cameraIsFree = true;
    this.coordinator.updateCamera(gesture.owner, { pose });
  }

  private onPointerUp = (event: PointerEvent) => {
    const gesture = this.gesture;
    if (!gesture) return;
    if (gesture.kind === "camera") {
      if (!gesture.pointers.has(event.pointerId)) return;
      if (event.pointerId !== gesture.owner) {
        event.preventDefault();
        gesture.pointers.delete(event.pointerId);
        this.releasePointer(gesture.capture, event.pointerId);
        const active = this.coordinator.getPresentationState().active;
        const currentPose = cloneCameraPose(
          active?.kind === "camera" ? active.camera : gesture.startPose,
        );
        const points = [...gesture.pointers.values()];
        if (points.length >= 2) {
          gesture.pinchStartDistance = Math.max(12, pointerDistance(points[0], points[1]));
          gesture.pinchStartPose = currentPose;
        } else {
          const primary = gesture.pointers.get(gesture.owner);
          if (primary) {
            gesture.startClientX = primary.x;
            gesture.startClientY = primary.y;
            gesture.startPose = currentPose;
          }
          gesture.pinchStartDistance = null;
          gesture.pinchStartPose = null;
        }
        return;
      }
    } else if (gesture.owner !== event.pointerId) return;
    event.preventDefault();
    if (gesture.kind === "insert") {
      const intersection = this.studio.intersectKenzanPlane(event.clientX, event.clientY);
      gesture.pendingVisible = intersection !== null;
      this.coordinator.updateInsert(gesture.owner, placementInputFromIntersection(intersection));
    }
    const activeBefore = this.coordinator.getDebugState().active;
    const insertionWasValid = activeBefore?.kind === "insert" && activeBefore.isValid;
    this.gesture = null;
    this.lastSaveSucceeded = true;
    this.coordinator.release(gesture.owner);
    this.releaseGesturePointers(gesture);
    if (gesture.kind === "insert") {
      if (insertionWasValid) {
        // The coordinator's onAutosave already resolved this acquisition as "committed".
        const seatedGraph = this.coordinator.getDocumentSnapshot().plants.get(gesture.plantId);
        this.selectedBranchId = seatedGraph ? selectedBranchIdForSeatedGraph(seatedGraph) : null;
        this.sound.seat();
        if (this.lastSaveSucceeded) this.ui.setStatus("Seated.");
      } else {
        // An invalid release commits nothing and the coordinator never signals
        // cancellation for it either; that ambiguity would otherwise leave this
        // acquisition's transaction unresolved forever.
        this.resolvePendingAcquisition("declined");
        this.ui.setStatus("Returned to the tray.");
      }
    } else if (gesture.kind === "prune") {
      this.sound.cut();
      if (this.lastSaveSucceeded) this.ui.setStatus("Cut.");
    } else if (gesture.kind === "camera") {
      // Camera commits never route through the coordinator's graph autosave hook.
      this.resolvePendingAcquisition("committed");
    } else {
      if (this.lastSaveSucceeded) this.ui.setStatus("Set.");
    }
    this.syncPresentation();
  };

  private onPointerCancel = (event: PointerEvent) => {
    if (!this.gestureOwnsPointer(event.pointerId)) return;
    this.interruptActive("pointer-cancel");
  };

  private onLostPointerCapture = (event: Event) => {
    if (!(event instanceof PointerEvent) || !this.gestureOwnsPointer(event.pointerId)) return;
    this.interruptActive("lost-capture");
  };

  private onVisibilityChange = () => {
    if (document.hidden) this.interruptActive("visibility-hidden", false);
  };

  private onPageHide = () => this.interruptActive("system-interruption", false);
  private onViewportChanged = () => this.interruptActive("system-interruption", false);
  private onVisualViewportChanged = () => this.interruptActive("system-interruption", false);

  private onContextLost = (event: Event) => {
    event.preventDefault();
    this.interruptActive("system-interruption", false);
    this.ui.setStatus("Keeping the arrangement safe.");
  };

  private onContextRestored = () => {
    this.syncPresentation();
    this.ui.setStatus("Arrangement restored.");
  };

  private onWheel = (event: WheelEvent) => {
    if (this.coordinator.getDebugState().posture !== "step-back" || this.gesture) return;
    event.preventDefault();
    const owner = "wheel";
    const start = this.coordinator.getDocumentSnapshot().camera;
    if (!this.coordinator.beginCamera(owner, {}, { pose: start }).ok) return;
    this.cameraIsFree = true;
    this.coordinator.updateCamera(owner, { pose: dollyCameraPose(start, Math.exp(event.deltaY * 0.0011)) });
    this.coordinator.release(owner);
  };

  private shouldTouchBend(candidate: HitCandidate) {
    if (
      this.bendVariant !== "touch"
      || candidate.kind !== "branch"
      || candidate.branchId !== this.selectedBranchId
    ) return false;
    const graph = this.coordinator.getDocumentSnapshot().plants.get(candidate.plantId);
    const branch = graph?.branches.get(candidate.branchId);
    if (!branch?.active || !["trunk", "lateral", "twig"].includes(branch.kind)) return false;
    if (branch.points.length < 4 || branch.restLengths.length < 3) return false;
    const fraction = candidate.materialDistance / Math.max(1e-8, branch.activeLength);
    return fraction >= TOUCH_BEND_START
      && fraction <= TOUCH_BEND_END
      && legalBendStation(branch, candidate.materialDistance) !== null;
  }

  private recordHit(event: PointerEvent, operation: "aim" | "bend" | "base" | "prune" | "camera") {
    const debug = this.coordinator.getDebugState();
    this.trackAcquisition({
      posture: debug.posture === "arrange" ? "arrange" : "inspect",
      tool: debug.tool,
      result: "hit",
      operation,
      region: screenRegion(event.clientY),
    });
  }

  /**
   * Records one acquisition (hit or miss). A hit opens a transaction whose
   * outcome is not yet known, so it is held as pending and persisted only
   * once `resolvePendingAcquisition` learns whether it committed, cancelled,
   * or was declined. A miss never opens a transaction, so it is durable
   * immediately: there is nothing further to resolve.
   */
  private trackAcquisition(
    input: Parameters<SessionMetrics["recordAcquisition"]>[0],
  ): AcquisitionRecord {
    const record = this.metrics.recordAcquisition(input);
    if (record.result === "hit") {
      this.pendingAcquisitionRecord = record;
    } else {
      this.telemetryStore.append(record.bendVariant, record);
    }
    return record;
  }

  /**
   * Resolves the acquisition that opened the currently pending transaction,
   * if any, and persists it durably and exactly once. A cancelled record can
   * never have been written as committed: nothing is persisted before this
   * runs, and this runs at most once per transaction.
   */
  private resolvePendingAcquisition(outcome: TransactionOutcome, cancelReason?: string): void {
    const record = this.pendingAcquisitionRecord;
    this.pendingAcquisitionRecord = null;
    if (!record) return;
    this.metrics.resolveAcquisition(record, outcome, { cancelReason });
    this.telemetryStore.append(record.bendVariant, record);
  }

  private telemetryExportPayload() {
    const persisted = this.telemetryStore.load();
    return {
      schemaVersion: 1 as const,
      exportedAt: new Date().toISOString(),
      sessionId: this.sessionId,
      currentBendVariant: this.bendVariant,
      persisted,
      summary: {
        bead: summarizeVariantTelemetry(persisted.variants.bead.acquisitions),
        touch: summarizeVariantTelemetry(persisted.variants.touch.acquisitions),
      },
    };
  }

  private async exportTelemetry(): Promise<void> {
    const payload = this.telemetryExportPayload();
    const json = JSON.stringify(payload, null, 2);
    const filename = `living-line-telemetry-${payload.sessionId}.json`;

    if (await this.shareTelemetry(json, filename)) {
      this.ui.setStatus("Shared session data.");
      return;
    }
    if (this.downloadTelemetry(json, filename)) {
      this.ui.setStatus("Downloaded session data.");
      return;
    }
    this.ui.showTelemetryFallback(json);
    this.ui.setStatus("Select all, then copy the session data below.");
  }

  /**
   * Primary export path: the Web Share API (with a File payload) hands the
   * JSON straight to iOS Safari's native share sheet — Save to Files,
   * AirDrop, Messages, Mail — which is the most direct way to get a file off
   * an iPhone without a server. Not available in every browser/context, so
   * this fails soft to the download and manual-copy paths below.
   */
  private async shareTelemetry(json: string, filename: string): Promise<boolean> {
    const nav = navigator as Navigator & {
      canShare?: (data: { files?: File[] }) => boolean;
      share?: (data: { files?: File[]; title?: string }) => Promise<void>;
    };
    if (typeof File === "undefined" || !nav.canShare || !nav.share) return false;
    try {
      const file = new File([json], filename, { type: "application/json" });
      if (!nav.canShare({ files: [file] })) return false;
      await nav.share({ files: [file], title: "Living Line telemetry" });
      return true;
    } catch (error) {
      // AbortError means the tester dismissed the share sheet; that is not a
      // failure worth falling back from, but nothing was exported either.
      if (error instanceof DOMException && error.name === "AbortError") return true;
      return false;
    }
  }

  /**
   * Fallback export path: an anchor with `download` on a blob URL. Safari
   * (including iOS Safari in a regular tab) saves this to Files/Downloads.
   * Used when Share is unsupported/unavailable (e.g. no File/Share API, or
   * `canShare` rejects the payload).
   */
  private downloadTelemetry(json: string, filename: string): boolean {
    if (typeof document === "undefined" || typeof URL?.createObjectURL !== "function") return false;
    try {
      const blob = new Blob([json], { type: "application/json" });
      const objectUrl = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = objectUrl;
      anchor.download = filename;
      anchor.rel = "noopener";
      document.body.append(anchor);
      anchor.click();
      anchor.remove();
      setTimeout(() => URL.revokeObjectURL(objectUrl), 4000);
      return true;
    } catch {
      return false;
    }
  }

  private abortFailedBegin(gesture: Gesture) {
    if (this.gesture === gesture) this.gesture = null;
    this.releaseGesturePointers(gesture);
  }

  private interruptActive(reason: CancelReason, announce = true) {
    const gesture = this.gesture;
    if (gesture) {
      this.gesture = null;
      this.releaseGesturePointers(gesture);
    }
    const result = this.coordinator.interrupt(reason);
    if (result.ok && announce) this.ui.setStatus("Kept as it was.");
    this.syncPresentation();
  }

  private gestureOwnsPointer(pointerId: number) {
    const gesture = this.gesture;
    if (!gesture) return false;
    return gesture.kind === "camera" ? gesture.pointers.has(pointerId) : gesture.owner === pointerId;
  }

  private capturePointer(element: HTMLElement, pointerId: number) {
    try {
      element.setPointerCapture(pointerId);
    } catch {
      // A system gesture may take ownership before capture. Its cancellation path is still safe.
    }
  }

  private releasePointer(element: HTMLElement, pointerId: number) {
    try {
      if (element.hasPointerCapture(pointerId)) element.releasePointerCapture(pointerId);
    } catch {
      // Capture may already be gone after pointerup/pointercancel.
    }
  }

  private releaseGesturePointers(gesture: Gesture) {
    if (gesture.kind === "camera") {
      for (const pointerId of gesture.pointers.keys()) this.releasePointer(gesture.capture, pointerId);
    } else {
      this.releasePointer(gesture.capture, gesture.owner);
    }
  }

  private materialCaptureElement(event: PointerEvent) {
    const target = event.target;
    if (!(target instanceof Element)) return null;
    return target.closest<HTMLElement>("[data-material-id]");
  }

  private preventDefault = (event: Event) => event.preventDefault();

  private prepareMaterialInsertion(materialId: string) {
    const prepared = prepareMaterialInsertionForApp(
      materialId,
      this.coordinator.getDebugState().successfulPlantOrdinal,
    );
    if (!prepared.ok) {
      this.ui.setStatus(
        prepared.reason === "unknown-material"
          ? "Material unavailable."
          : "Material could not be prepared.",
        "warning",
      );
      return null;
    }
    return prepared;
  }

  private syncPresentation() {
    if (!this.coordinator || this.disposed) return;
    const presentation = this.coordinator.getPresentationState();
    const debug = this.coordinator.getDebugState();
    const displayGraphs = new Map(presentation.document.plants);
    if (
      presentation.active
      && ["aim", "bend", "base"].includes(presentation.active.kind)
      && "graph" in presentation.active
    ) {
      displayGraphs.set(presentation.active.plantId, presentation.active.graph);
    }
    this.studio.setGraphs(displayGraphs.values());

    if (presentation.active?.kind === "insert") {
      const visible = this.gesture?.kind === "insert" ? this.gesture.pendingVisible : true;
      this.studio.setPendingGraph(presentation.active.graph, {
        visible,
        valid: presentation.active.isValid,
      });
    } else {
      this.studio.setPendingGraph(null);
    }

    this.studio.setCutPreview(
      presentation.active?.kind === "prune"
        ? { plantId: presentation.active.plantId, plan: presentation.active.plan }
        : null,
    );

    const selectedPlantId = presentation.document.selectedPlantId;
    const selectedGraph = selectedPlantId ? displayGraphs.get(selectedPlantId) : null;
    const selectedBranch = this.selectedBranchId
      ? selectedGraph?.branches.get(this.selectedBranchId)
      : null;
    this.studio.setSelection(
      selectedPlantId && selectedBranch?.active
        ? { plantId: selectedPlantId, branchId: selectedBranch.id }
        : null,
    );
    this.studio.setShapeAffordances({
      visible: debug.posture === "arrange" && debug.tool === "shape" && Boolean(selectedBranch?.active),
      bendVariant: debug.bendVariant,
      transactionActive: debug.active !== null,
      touchCueDistance: debug.active?.kind === "bend" && debug.active.variant === "touch"
        ? debug.active.stationDistance
        : null,
      showSelection: true,
    });

    const camera = presentation.active?.kind === "camera"
      ? presentation.active.camera
      : presentation.document.camera;
    const view: StudioView = this.cameraIsFree ? "orbit" : debug.view;
    this.studio.setCameraPose(camera, view, false);

    this.root.dataset.transaction = debug.active?.kind ?? "none";
    this.root.dataset.posture = debug.posture;
    this.root.dataset.tool = debug.tool;
    this.root.dataset.view = this.cameraIsFree ? "orbit" : debug.view;
    const dragging = debug.active?.kind === "insert";
    const activeMaterialId = this.gesture?.kind === "insert" ? this.gesture.materialId : null;
    if (
      this.ui.state.trayDragging !== dragging
      || this.ui.state.activeMaterialId !== activeMaterialId
    ) {
      this.ui.setTrayDragging(dragging, activeMaterialId);
    }
  }

  private canonicalSnapshot() {
    const document = this.coordinator.getDocumentSnapshot();
    return {
      successfulPlantOrdinal: document.successfulPlantOrdinal,
      plants: [...document.plants.values()]
        .sort((left, right) => left.id.localeCompare(right.id))
        .map(toCanonicalPlantGraph),
    };
  }

  private hashDocument(plants: ReadonlyMap<string, PlantGraph>, successfulPlantOrdinal: number) {
    return fnv1a(JSON.stringify({
      successfulPlantOrdinal,
      plants: [...plants.values()]
        .sort((left, right) => left.id.localeCompare(right.id))
        .map(toCanonicalPlantGraph),
    }));
  }

  private canonicalHash() {
    const document = this.coordinator.getDocumentSnapshot();
    return this.hashDocument(document.plants, document.successfulPlantOrdinal);
  }

  private cameraHash() {
    const presentation = this.coordinator.getPresentationState();
    const camera = presentation.active?.kind === "camera"
      ? presentation.active.camera
      : presentation.document.camera;
    return fnv1a(JSON.stringify(camera));
  }

  private installTestBridge() {
    const ready = Promise.resolve();
    window.__IKEBANA_TEST__ = {
      version: 1,
      ready,
      getState: () => {
        const debug = this.coordinator.getDebugState();
        return {
          ready: this.root.dataset.ready === "true",
          posture: debug.posture,
          tool: debug.tool,
          view: this.cameraIsFree ? "orbit" : debug.view,
          bendVariant: debug.bendVariant === "touch" ? "touch" : "fixed",
          transaction: this.testTransaction(debug),
          selectedPlantId: debug.selectedPlantId,
          selectedBranchId: this.selectedBranchId,
          successfulSeatOrdinal: debug.successfulPlantOrdinal,
          cameraHash: this.cameraHash(),
          canonicalHash: this.canonicalHash(),
        };
      },
      getCanonicalSnapshot: () => clonePlain(this.canonicalSnapshot()),
      getRenderInventory: () => this.studio.getRenderInventory(),
      getScreenTargets: () => this.screenTargets(),
      resolveHitForTest: (candidates) => {
        const tier = { "selected-handle": 0, "selected-plant": 1, "other-plant": 2 } as const;
        const ranked = candidates.map((candidate): HitCandidate => ({
          kind: "branch",
          priorityTier: tier[candidate.tier],
          plantId: "test-plant",
          branchId: candidate.stableId,
          materialDistance: 0,
          worldPoint: { x: 0, y: 0, z: 0 },
          screenDistancePx: candidate.screenDistance,
          rayDepth: candidate.rayDepth,
          stableId: candidate.stableId,
        })).sort(compareHitCandidates)[0];
        return ranked ? { stableId: ranked.stableId } : null;
      },
      getMetrics: () => this.metrics.snapshot(),
      resetMetrics: () => this.metrics.reset(),
      getAutosaveAudit: () => ({ writes: this.autosaveWrites.map((write) => ({ ...write })) }),
      getPersistedTelemetry: () => clonePlain(this.telemetryStore.load()),
      getTelemetryExportPayload: () => clonePlain(this.telemetryExportPayload()),
      resetForTest: async (options) => {
        this.interruptActive("system-interruption", false);
        this.pendingAcquisitionRecord = null;
        if (options.clearAutosave) {
          this.store.clear();
          this.telemetryStore.clear();
        }
        this.autosaveWrites.length = 0;
        this.metrics.reset();
        this.selectedBranchId = null;
        this.cameraIsFree = false;
        this.bendVariant = options.bendVariant === "touch" ? "touch" : "bead";
        this.metrics.setBendVariant(this.bendVariant);
        this.studio.clearGraphs();
        this.studio.setPendingGraph(null);
        this.replaceCoordinator(new Map(), 0);
        this.ui.setState({
          posture: "arrange",
          tool: "shape",
          view: "front",
          bendVariant: uiVariant(this.bendVariant),
          experimentPanelOpen: false,
          trayDragging: false,
          activeMaterialId: null,
        });
        this.ui.setStatus("Place a cutting.");
        this.syncPresentation();
      },
      interruptForTest: (reason) => this.interruptActive(this.testCancelReason(reason), false),
      loseContextForTest: async () => {
        const supported = this.studio.debugForceContextLoss();
        if (!supported) return false;
        await new Promise((resolve) => setTimeout(resolve, 40));
        return true;
      },
      restoreContextForTest: async () => {
        const supported = this.studio.debugForceContextRestore();
        if (!supported) return false;
        await new Promise((resolve) => setTimeout(resolve, 80));
        this.syncPresentation();
        return true;
      },
    };
  }

  private testTransaction(debug: CoordinatorDebugState) {
    const active = debug.active;
    if (!active) return null;
    return {
      operation: active.kind,
      pointerId: typeof active.owner === "number" ? active.owner : -1,
      plantId: "plantId" in active ? active.plantId : undefined,
      branchId: "branchId" in active ? active.branchId : undefined,
      materialDistance: active.kind === "bend"
        ? active.stationDistance
        : active.kind === "aim"
          ? active.grabbedMaterialDistance
          : active.kind === "prune"
            ? active.acquiredMaterialDistance
            : undefined,
      acquisitionHash: this.gesture?.acquisitionHash ?? this.canonicalHash(),
    };
  }

  private screenTargets() {
    const document = this.coordinator.getDocumentSnapshot();
    const targets: Array<Record<string, unknown>> = [];
    for (const graph of document.plants.values()) {
      for (const branch of graph.branches.values()) {
        if (!branch.active) continue;
        const distance = branch.activeLength * 0.55;
        const projected = this.studio.projectPoint(sampleBranch(branch, distance).position);
        targets.push({
          role: "branch",
          plantId: graph.id,
          branchId: branch.id,
          materialDistance: distance,
          x: projected.clientX,
          y: projected.clientY,
          region: this.sixWayRegion(projected.clientX, projected.clientY),
        });
      }
    }
    return targets;
  }

  private sixWayRegion(x: number, y: number) {
    const vertical = y / Math.max(1, innerHeight) < 1 / 3
      ? "top"
      : y / Math.max(1, innerHeight) < 2 / 3
        ? "middle"
        : "bottom";
    return `${vertical}-${x < innerWidth / 2 ? "left" : "right"}`;
  }

  private testCancelReason(reason: string): CancelReason {
    if (reason === "pointercancel") return "pointer-cancel";
    if (reason === "lostpointercapture") return "lost-capture";
    if (reason === "visibilitychange") return "visibility-hidden";
    return "system-interruption";
  }
}
