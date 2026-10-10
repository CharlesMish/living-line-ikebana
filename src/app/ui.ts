import type { BendStationId, BendStationsMode } from "./bendStations.ts";
import type { CraftCue } from "./craftCues.ts";

export type Posture = "arrange" | "step-back";
export type CraftTool = "shape" | "prune";
// The retained internal "move" token is labeled Pan in the interface.
export type CameraMode = "orbit" | "move";
export type CanonicalView = "front" | "three-quarter" | "above";
export type BendVariant = "fixed-bead" | "touch-located";
export type StatusTone = "quiet" | "warning";

export interface UIState {
  posture: Posture;
  tool: CraftTool;
  cameraMode: CameraMode;
  view: CanonicalView | "orbit";
  viewMenuOpen: boolean;
  showStemOverlaps: boolean;
  preventStemOverlaps: boolean;
  stemOverlapCount: number;
  materialMenuOpen: boolean;
  editMenuOpen: boolean;
  moreMenuOpen: boolean;
  canUndo: boolean;
  canRemove: boolean;
  selectedMaterialId: string;
  bendVariant: BendVariant;
  bendStationsMode: BendStationsMode;
  /** Distinct station ids worth offering. Fewer than two hides the selector. */
  bendStationChoices: readonly BendStationId[];
  bendStationSelected: BendStationId | null;
  experimentPanelOpen: boolean;
  trayEnabled: boolean;
  trayDragging: boolean;
  activeMaterialId: string | null;
  status: string;
  statusTone: StatusTone;
  /** Source card is armed for a scene tap. Only used when tap placement is on. */
  placeReady: boolean;
}

export type UICommand =
  | { kind: "stop-and-look" }
  | { kind: "set-posture"; posture: Posture }
  | { kind: "set-tool"; tool: CraftTool }
  | { kind: "set-camera-mode"; cameraMode: CameraMode }
  | { kind: "set-view"; view: CanonicalView }
  | { kind: "set-view-menu"; open: boolean }
  | { kind: "set-stem-overlaps"; visible: boolean }
  | { kind: "set-stem-prevention"; enabled: boolean }
  | { kind: "set-material-menu"; open: boolean }
  | { kind: "set-edit-menu"; open: boolean }
  | { kind: "set-more-menu"; open: boolean }
  | { kind: "undo-edit" }
  | { kind: "remove-cutting" }
  | { kind: "select-material"; materialId: string }
  | { kind: "set-bend-variant"; bendVariant: BendVariant }
  | { kind: "set-bend-station"; station: BendStationId }
  | { kind: "set-experiment-panel"; open: boolean }
  | {
      kind: "begin-material-drag";
      materialId: string;
      pointerId: number;
      clientX: number;
      clientY: number;
    }
  | { kind: "activate-material"; materialId: string }
  | {
      kind: "arm-material-pointer";
      materialId: string;
      pointerId: number;
      clientX: number;
      clientY: number;
    }
  | { kind: "cancel-place" }
  | { kind: "export-telemetry" };

export type UICommandListener = (command: UICommand, sourceEvent: Event) => void;

export interface UIBindings {
  readonly root: HTMLElement;
  readonly studio: HTMLElement;
  readonly state: Readonly<UIState>;
  onCommand(listener: UICommandListener): () => void;
  setState(patch: Partial<UIState>): void;
  setStatus(message: string, tone?: StatusTone): void;
  setCraftCue(cue: CraftCue | null, announce?: boolean): void;
  setExperimentPanelOpen(open: boolean): void;
  setTrayEnabled(enabled: boolean): void;
  setTrayDragging(dragging: boolean, materialId?: string | null): void;
  focusSourceCard(): void;
  focusStatus(): void;
  /** Shows the manual-copy telemetry panel with `text`, or hides it when `null`. */
  showTelemetryFallback(text: string | null): void;
  destroy(): void;
}

export interface CreateUIBindingsOptions {
  root?: HTMLElement;
  initialState?: Partial<UIState>;
  search?: string;
  /** Source-card tap placement. Absent keeps the immediate drag. */
  placeTap?: boolean;
}

/** Whether a scrollport still has rows past either edge. Subpixel remainder is not another row. */
export function materialListOverflow(
  scrollTop: number,
  clientHeight: number,
  scrollHeight: number,
): { above: boolean; below: boolean } {
  const epsilon = 1;
  if (![scrollTop, clientHeight, scrollHeight].every((value) => Number.isFinite(value))) {
    return { above: false, below: false };
  }
  return {
    above: scrollTop > epsilon,
    below: scrollHeight - clientHeight - scrollTop > epsilon,
  };
}

const DEFAULT_STATE: UIState = {
  posture: "arrange",
  tool: "shape",
  cameraMode: "orbit",
  view: "front",
  viewMenuOpen: false,
  showStemOverlaps: false,
  preventStemOverlaps: false,
  stemOverlapCount: 0,
  materialMenuOpen: false,
  editMenuOpen: false,
  moreMenuOpen: false,
  canUndo: false,
  canRemove: false,
  selectedMaterialId: "flowering-branch",
  bendVariant: "fixed-bead",
  bendStationsMode: "off",
  bendStationChoices: [],
  bendStationSelected: null,
  experimentPanelOpen: false,
  trayEnabled: true,
  trayDragging: false,
  activeMaterialId: null,
  status: "Place a cutting.",
  statusTone: "quiet",
  placeReady: false,
};

function requireElement<T extends Element>(scope: ParentNode, selector: string): T {
  const element = scope.querySelector<T>(selector);
  if (!element) {
    throw new Error(`UI shell is missing required element: ${selector}`);
  }
  return element;
}

export function bendVariantFromSearch(search: string): BendVariant {
  const raw = new URLSearchParams(search).get("bend")?.trim().toLowerCase();
  return raw === "touch" || raw === "touched" || raw === "touch-located" || raw === "b"
    ? "touch-located"
    : "fixed-bead";
}

function createPlaceCancel(root: HTMLElement): HTMLButtonElement {
  const existing = root.querySelector<HTMLButtonElement>("#place-cancel");
  if (existing) return existing;
  const button = root.ownerDocument.createElement("button");
  button.type = "button";
  button.id = "place-cancel";
  button.className = "place-cancel";
  button.dataset.testid = "place-cancel";
  button.textContent = "Cancel";
  button.setAttribute("aria-label", "Cancel placement");
  button.hidden = true;
  root.append(button);
  return button;
}

export function createUIBindings(options: CreateUIBindingsOptions = {}): UIBindings {
  const rootCandidate = options.root ?? document.querySelector<HTMLElement>("#app");
  if (!rootCandidate) {
    throw new Error("UI shell is missing required element: #app");
  }
  const root: HTMLElement = rootCandidate;
  const placeTap = options.placeTap === true;

  const studio = requireElement<HTMLElement>(root, "#studio");
  const status = requireElement<HTMLElement>(root, "#status");
  const craftCue = requireElement<HTMLElement>(root, "#craft-cue");
  const cueTitle = requireElement<HTMLElement>(craftCue, "[data-cue-title]");
  const cueDetail = requireElement<HTMLElement>(craftCue, "[data-cue-detail]");
  const bendGuide = requireElement<HTMLElement>(root, "[data-guide-bend]");
  const bendStations = requireElement<HTMLElement>(root, "#bend-stations");
  const bendStationControl = requireElement<HTMLElement>(root, ".bend-station-control");
  const bendStationButtons = [...root.querySelectorAll<HTMLButtonElement>("[data-bend-station]")];
  if (bendStationButtons.length !== 3) {
    throw new Error("UI shell is missing required element: [data-bend-station]");
  }
  const bendStationsExclusion = requireElement<HTMLElement>(root, "#bend-stations-exclusion");
  const craftChrome = requireElement<HTMLElement>(root, "#craft-chrome");
  const cameraChrome = requireElement<HTMLElement>(root, "#camera-chrome");
  const viewMenu = requireElement<HTMLElement>(root, ".view-menu");
  const viewToggle = requireElement<HTMLButtonElement>(root, "#view-toggle");
  const viewOptions = requireElement<HTMLElement>(root, "#view-options");
  const preventionToggle = requireElement<HTMLButtonElement>(root, "#stem-prevention-toggle");
  const preventionNote = requireElement<HTMLElement>(root, "#stem-prevention-note");
  const overlapsToggle = requireElement<HTMLButtonElement>(root, "#stem-overlaps-toggle");
  const overlapsNote = requireElement<HTMLElement>(root, "#stem-overlaps-note");
  const editMenu = requireElement<HTMLElement>(root, ".edit-menu");
  const editToggle = requireElement<HTMLButtonElement>(root, "#edit-toggle");
  const editOptions = requireElement<HTMLElement>(root, "#edit-options");
  const undoEdit = requireElement<HTMLButtonElement>(root, "#undo-edit");
  const removeCutting = requireElement<HTMLButtonElement>(root, "#remove-cutting");
  const materialMenu = requireElement<HTMLElement>(root, ".material-menu");
  const materialsToggle = requireElement<HTMLButtonElement>(root, "#materials-toggle");
  const materialOptionsFrame = requireElement<HTMLElement>(root, ".material-options-frame");
  const materialOptions = requireElement<HTMLElement>(root, "#material-options");
  const materialsMoreAbove = requireElement<HTMLElement>(root, "[data-testid='materials-more-above']");
  const materialsMoreBelow = requireElement<HTMLElement>(root, "[data-testid='materials-more-below']");
  const sourceCard = requireElement<HTMLButtonElement>(root, "#selected-cutting");
  if (!sourceCard.dataset.materialId) {
    throw new Error("UI shell is missing required element: [data-material-id]");
  }
  const placeCancel = placeTap ? createPlaceCancel(root) : null;
  if (placeTap) status.tabIndex = -1;
  const paletteChoices = [...root.querySelectorAll<HTMLButtonElement>("[data-material-choice]")];
  if (paletteChoices.length === 0) {
    throw new Error("UI shell is missing required element: [data-material-choice]");
  }
  let sourceInnerMaterialId = sourceCard.dataset.materialId;
  const studyTools = requireElement<HTMLElement>(root, "#study-tools");
  const experimentPanel = requireElement<HTMLElement>(root, "#experiment-panel");
  const experimentToggle = requireElement<HTMLButtonElement>(root, "#experiment-toggle");
  const experimentClose = requireElement<HTMLButtonElement>(root, "#experiment-close");
  const telemetryExportTrigger = requireElement<HTMLButtonElement>(root, "#telemetry-export-trigger");
  const telemetryExportPanel = requireElement<HTMLElement>(root, "#telemetry-export-panel");
  const telemetryExportText = requireElement<HTMLTextAreaElement>(root, "#telemetry-export-text");
  const telemetryExportClose = requireElement<HTMLButtonElement>(root, "#telemetry-export-close");

  const search = options.search ?? globalThis.location?.search ?? "";
  const moreMenu = requireElement<HTMLElement>(root, ".more-menu");
  const moreToggle = requireElement<HTMLButtonElement>(root, "#more-toggle");
  const moreOptions = requireElement<HTMLElement>(root, "#more-options");
  const showTestingTools = new URLSearchParams(search).get("debug") === "1";
  studyTools.hidden = !showTestingTools;
  studyTools.inert = !showTestingTools;
  let currentState: UIState = {
    ...DEFAULT_STATE,
    bendVariant: bendVariantFromSearch(search),
    ...options.initialState,
  };
  const listeners = new Set<UICommandListener>();
  const controller = new AbortController();
  const listenerOptions = { signal: controller.signal };

  function emit(command: UICommand, sourceEvent: Event): void {
    if (command.kind !== "set-more-menu" && currentState.moreMenuOpen) {
      setState({ moreMenuOpen: false });
    }
    if (command.kind !== "set-edit-menu" && currentState.editMenuOpen) {
      setState({ editMenuOpen: false });
      if (command.kind === "undo-edit" || command.kind === "remove-cutting") {
        editToggle.focus({ preventScroll: true });
      }
    }
    if (command.kind !== "set-view-menu" && currentState.viewMenuOpen) {
      setState({ viewMenuOpen: false });
      if (command.kind === "set-view" || command.kind === "set-stem-overlaps" || command.kind === "set-stem-prevention") viewToggle.focus({ preventScroll: true });
    }
    if (
      command.kind !== "set-material-menu"
      && command.kind !== "select-material"
      && currentState.materialMenuOpen
    ) {
      setState({ materialMenuOpen: false });
    }
    for (const listener of listeners) {
      listener(command, sourceEvent);
    }
  }

  function fillSourceCard(materialId: string): void {
    const template = root.querySelector<HTMLTemplateElement>(`#material-template-${materialId}`);
    const label = template?.dataset.materialLabel ?? materialId.replaceAll("-", " ");
    sourceCard.dataset.materialId = materialId;
    sourceCard.setAttribute("aria-label", `Drag ${label} to the kenzan`);
    if (!template) return;
    const fragment = template.content.cloneNode(true) as DocumentFragment;
    sourceCard.replaceChildren(...Array.from(fragment.childNodes));
    sourceInnerMaterialId = materialId;
  }

  function setPressed(selector: string, value: string): void {
    for (const button of root.querySelectorAll<HTMLButtonElement>(selector)) {
      const key = button.dataset.posture ?? button.dataset.tool ?? button.dataset.view ?? button.dataset.bendVariant ?? button.dataset.cameraMode;
      button.setAttribute("aria-pressed", String(key === value));
    }
  }

  let materialMenuWasOpen = false;

  function syncMaterialScrollCues(): void {
    if (materialOptions.hidden || materialOptions.clientHeight === 0) {
      materialsMoreAbove.hidden = true;
      materialsMoreBelow.hidden = true;
      return;
    }
    const overflow = materialListOverflow(
      materialOptions.scrollTop,
      materialOptions.clientHeight,
      materialOptions.scrollHeight,
    );
    materialsMoreAbove.hidden = !overflow.above;
    materialsMoreBelow.hidden = !overflow.below;
  }

  function revealPressedMaterialChoice(): void {
    const pressed = paletteChoices.find((choice) => choice.getAttribute("aria-pressed") === "true");
    if (!pressed || materialOptions.clientHeight === 0) return;
    const panelRect = materialOptions.getBoundingClientRect();
    const borderTop = Number.parseFloat(getComputedStyle(materialOptions).borderTopWidth) || 0;
    const viewTop = panelRect.top + borderTop;
    const viewBottom = viewTop + materialOptions.clientHeight;
    const box = pressed.getBoundingClientRect();
    const inset = 28;
    if (box.bottom > viewBottom - inset) {
      materialOptions.scrollTop += box.bottom - (viewBottom - inset);
    } else if (materialOptions.scrollTop > 1 && box.top < viewTop + inset) {
      materialOptions.scrollTop -= (viewTop + inset) - box.top;
    }
    const last = paletteChoices[paletteChoices.length - 1];
    if (pressed === last) materialOptions.scrollTop = materialOptions.scrollHeight;
  }

  function render(): void {
    preventionToggle.setAttribute("aria-pressed", String(currentState.preventStemOverlaps));
    preventionToggle.textContent = `Prevent overlaps (study): ${currentState.preventStemOverlaps ? "on" : "off"}`;
    preventionNote.hidden = !currentState.preventStemOverlaps;
    overlapsToggle.setAttribute("aria-pressed", String(currentState.showStemOverlaps));
    overlapsToggle.textContent = `Stem overlaps: ${currentState.showStemOverlaps ? "on" : "off"}`;
    overlapsNote.hidden = !currentState.showStemOverlaps;
    const areas = currentState.stemOverlapCount;
    overlapsNote.textContent = `${areas ? `${areas} possible overlap ${areas === 1 ? "area" : "areas"}.` : "No stem overlaps detected."} Angular brackets are indicators, not drag handles. Main stems of separate cuttings only. ${areas > 32 ? "Up to 32 visible areas marked." : "Orbit to inspect the marks."}`;
    moreToggle.setAttribute("aria-expanded", String(currentState.moreMenuOpen));
    moreOptions.hidden = !currentState.moreMenuOpen;
    editToggle.setAttribute("aria-expanded", String(currentState.editMenuOpen));
    editOptions.hidden = !currentState.editMenuOpen;
    undoEdit.disabled = !currentState.canUndo;
    removeCutting.disabled = !currentState.canRemove;
    viewToggle.setAttribute("aria-expanded", String(currentState.viewMenuOpen));
    viewOptions.hidden = !currentState.viewMenuOpen;
    const stationChoices = currentState.bendStationsMode === "on" ? currentState.bendStationChoices : [];
    const showStations = stationChoices.length >= 2;
    bendGuide.textContent = currentState.bendVariant === "fixed-bead"
      ? showStations
        ? "Choose Lower, Middle, or Upper, then drag the pale point. The stem keeps its length."
        : "Drag the pale point into a broad curve. The stem keeps its length."
      : "Drag the middle of a selected branch into a broad curve. The stem keeps its length.";
    bendStations.hidden = !showStations;
    bendStationControl.style.gridTemplateColumns = `repeat(${Math.max(stationChoices.length, 1)}, minmax(0, 1fr))`;
    for (const button of bendStationButtons) {
      const id = button.dataset.bendStation;
      const available = showStations && stationChoices.includes(id as BendStationId);
      button.hidden = !available;
      button.disabled = !available;
      button.setAttribute("aria-pressed", String(available && id === currentState.bendStationSelected));
    }
    bendStationsExclusion.hidden = currentState.bendStationsMode !== "excluded";
    root.dataset.bendStations = currentState.bendStationsMode;
    root.dataset.posture = currentState.posture;
    root.dataset.tool = currentState.tool;
    root.dataset.cameraMode = currentState.cameraMode;
    root.dataset.view = currentState.view;
    root.dataset.bendVariant = currentState.bendVariant === "fixed-bead" ? "fixed" : "touch";
    root.dataset.selectedMaterial = currentState.selectedMaterialId;
    root.dataset.materialMenu = currentState.materialMenuOpen ? "open" : "closed";

    setPressed("[data-posture]", currentState.posture);
    setPressed("[data-tool]", currentState.tool);
    setPressed("[data-camera-mode]", currentState.cameraMode);
    setPressed("[data-view]", currentState.view);
    setPressed("[data-bend-variant]", currentState.bendVariant);

    experimentPanel.hidden = !currentState.experimentPanelOpen;
    experimentToggle.setAttribute("aria-expanded", String(currentState.experimentPanelOpen));
    materialsToggle.setAttribute("aria-expanded", String(currentState.materialMenuOpen));
    const openingMaterialMenu = currentState.materialMenuOpen && !materialMenuWasOpen;
    materialOptionsFrame.hidden = !currentState.materialMenuOpen;
    materialOptions.hidden = !currentState.materialMenuOpen;
    if (!currentState.materialMenuOpen) {
      materialsMoreAbove.hidden = true;
      materialsMoreBelow.hidden = true;
    } else if (openingMaterialMenu) {
      requestAnimationFrame(() => {
        if (!currentState.materialMenuOpen) return;
        revealPressedMaterialChoice();
        syncMaterialScrollCues();
      });
    }
    materialMenuWasOpen = currentState.materialMenuOpen;
    materialsToggle.disabled = !currentState.trayEnabled;
    for (const choice of paletteChoices) {
      choice.disabled = !currentState.trayEnabled;
      choice.setAttribute("aria-pressed", String(choice.dataset.materialChoice === currentState.selectedMaterialId));
    }

    craftChrome.inert = currentState.posture === "step-back";
    cameraChrome.hidden = currentState.posture !== "step-back";
    cameraChrome.inert = currentState.posture !== "step-back";
    craftChrome.setAttribute("aria-hidden", String(currentState.posture === "step-back"));
    const buttonDragging = currentState.trayDragging
      && currentState.activeMaterialId === currentState.selectedMaterialId;
    sourceCard.disabled = !currentState.trayEnabled;
    sourceCard.dataset.dragging = String(buttonDragging);
    sourceCard.setAttribute("aria-busy", String(buttonDragging));
    // Keep the captured source node identity through a drag. Inner content
    // updates only after cancellation/selection, never on pointerdown.
    if (!currentState.trayDragging && sourceInnerMaterialId !== currentState.selectedMaterialId) {
      fillSourceCard(currentState.selectedMaterialId);
    } else if (sourceCard.dataset.materialId !== currentState.selectedMaterialId && !currentState.trayDragging) {
      sourceCard.dataset.materialId = currentState.selectedMaterialId;
    }
    if (placeTap) {
      const ready = currentState.placeReady;
      const label = sourceCard.querySelector(".material-name")?.textContent?.trim() || "cutting";
      sourceCard.setAttribute("aria-pressed", String(ready));
      sourceCard.setAttribute("aria-label", ready
        ? `${label}. Ready to place. Tap inside the pins.`
        : `Drag ${label} to the pins, or tap to ready it`);
      const verb = sourceCard.querySelector(".material-verb");
      if (verb) verb.textContent = ready ? "tap inside the pins" : "drag to the pins";
      if (placeCancel) placeCancel.hidden = !ready;
    }

    status.textContent = currentState.status;
    status.dataset.tone = currentState.statusTone;
  }

  function setState(patch: Partial<UIState>): void {
    currentState = { ...currentState, ...patch };
    render();
  }

  function commandClick<T extends HTMLElement>(
    selector: string,
    read: (element: T) => UICommand,
  ): void {
    for (const element of root.querySelectorAll<T>(selector)) {
      element.addEventListener(
        "click",
        (event) => {
          emit(read(element), event);
        },
        listenerOptions,
      );
    }
  }

  commandClick<HTMLButtonElement>("[data-posture]", (button) => ({
    kind: "set-posture",
    posture: button.dataset.posture as Posture,
  }));

  commandClick<HTMLButtonElement>("[data-tool]", (button) => ({
    kind: "set-tool",
    tool: button.dataset.tool as CraftTool,
  }));

  commandClick<HTMLButtonElement>("[data-view]", (button) => ({
    kind: "set-view",
    view: button.dataset.view as CanonicalView,
  }));

  commandClick<HTMLButtonElement>("[data-camera-mode]", (button) => ({
    kind: "set-camera-mode",
    cameraMode: button.dataset.cameraMode as CameraMode,
  }));

  if (showTestingTools) commandClick<HTMLButtonElement>("[data-bend-variant]", (button) => ({
    kind: "set-bend-variant",
    bendVariant: button.dataset.bendVariant as BendVariant,
  }));

  commandClick<HTMLButtonElement>("[data-bend-station]", (button) => ({
    kind: "set-bend-station",
    station: button.dataset.bendStation as BendStationId,
  }));

  viewToggle.addEventListener("click", (event) => {
    emit({ kind: "set-view-menu", open: !currentState.viewMenuOpen }, event);
  }, listenerOptions);

  preventionToggle.addEventListener("click", (event) => {
    emit({ kind: "set-stem-prevention", enabled: !currentState.preventStemOverlaps }, event);
  }, listenerOptions);
  overlapsToggle.addEventListener("click", (event) => {
    emit({ kind: "set-stem-overlaps", visible: !currentState.showStemOverlaps }, event);
  }, listenerOptions);

  editToggle.addEventListener("click", (event) => {
    emit({ kind: "set-edit-menu", open: !currentState.editMenuOpen }, event);
  }, listenerOptions);

  moreToggle.addEventListener("click", (event) => {
    emit({ kind: "set-more-menu", open: !currentState.moreMenuOpen }, event);
  }, listenerOptions);
  // Garden owns its own open/cancel boundary. Close this disclosure before
  // that listener runs; its return focus target is the visible More button.
  requireElement<HTMLButtonElement>(root, "#garden-open").addEventListener("click", () => {
    setState({ moreMenuOpen: false });
  }, listenerOptions);
  requireElement<HTMLButtonElement>(root, "#workbench-open").addEventListener("click", () => {
    setState({ moreMenuOpen: false });
  }, listenerOptions);

  undoEdit.addEventListener("click", (event) => {
    if (currentState.canUndo) emit({ kind: "undo-edit" }, event);
  }, listenerOptions);

  removeCutting.addEventListener("click", (event) => {
    if (currentState.canRemove) emit({ kind: "remove-cutting" }, event);
  }, listenerOptions);

  materialsToggle.addEventListener("click", (event) => {
    emit({ kind: "set-material-menu", open: !currentState.materialMenuOpen }, event);
  }, listenerOptions);

  materialOptions.addEventListener("scroll", () => {
    syncMaterialScrollCues();
  }, listenerOptions);
  const materialScrollCueObserver = new ResizeObserver(() => {
    syncMaterialScrollCues();
  });
  materialScrollCueObserver.observe(materialOptions);

  // Dismissal never consumes a scene press or turns it into a UI command.
  root.ownerDocument.addEventListener("pointerdown", (event) => {
    if (currentState.moreMenuOpen && !event.composedPath().includes(moreMenu)) {
      setState({ moreMenuOpen: false });
    }
    if (currentState.editMenuOpen && !event.composedPath().includes(editMenu)) {
      setState({ editMenuOpen: false });
    }
    if (currentState.viewMenuOpen && !event.composedPath().includes(viewMenu)) {
      setState({ viewMenuOpen: false });
    }
    if (currentState.materialMenuOpen && !event.composedPath().includes(materialMenu)) {
      emit({ kind: "set-material-menu", open: false }, event);
    }
  }, { ...listenerOptions, capture: true });

  editMenu.addEventListener("focusout", (event) => {
    if (!editMenu.contains(event.relatedTarget as Node | null)) setState({ editMenuOpen: false });
  }, listenerOptions);

  moreMenu.addEventListener("focusout", (event) => {
    if (!moreMenu.contains(event.relatedTarget as Node | null)) setState({ moreMenuOpen: false });
  }, listenerOptions);

  viewMenu.addEventListener("focusout", (event) => {
    if (!viewMenu.contains(event.relatedTarget as Node | null)) setState({ viewMenuOpen: false });
  }, listenerOptions);

  materialMenu.addEventListener("focusout", (event) => {
    if (!materialMenu.contains(event.relatedTarget as Node | null)) {
      emit({ kind: "set-material-menu", open: false }, event);
    }
  }, listenerOptions);

  root.ownerDocument.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && currentState.moreMenuOpen) {
      event.preventDefault();
      setState({ moreMenuOpen: false });
      moreToggle.focus({ preventScroll: true });
    } else if (event.key === "Escape" && currentState.editMenuOpen) {
      event.preventDefault();
      setState({ editMenuOpen: false });
      editToggle.focus({ preventScroll: true });
    } else if (event.key === "Escape" && currentState.materialMenuOpen) {
      event.preventDefault();
      emit({ kind: "set-material-menu", open: false }, event);
      materialsToggle.focus({ preventScroll: true });
    } else if (event.key === "Escape" && currentState.viewMenuOpen) {
      event.preventDefault();
      setState({ viewMenuOpen: false });
      viewToggle.focus({ preventScroll: true });
    } else if (event.key === "Escape" && currentState.experimentPanelOpen) {
      event.preventDefault();
      emit({ kind: "set-experiment-panel", open: false }, event);
      moreToggle.focus({ preventScroll: true });
    }
  }, listenerOptions);

  experimentToggle.addEventListener(
    "click",
    (event) => {
      emit({ kind: "set-experiment-panel", open: !currentState.experimentPanelOpen }, event);
      if (currentState.experimentPanelOpen) experimentClose.focus({ preventScroll: true });
    },
    listenerOptions,
  );

  experimentClose.addEventListener(
    "click",
    (event) => {
      emit({ kind: "set-experiment-panel", open: false }, event);
      moreToggle.focus({ preventScroll: true });
    },
    listenerOptions,
  );

  requireElement<HTMLButtonElement>(root, "#stop-and-look").addEventListener("click", (event) => {
    emit({ kind: "stop-and-look" }, event);
    // The guide closes: return keyboard focus to a visible way back to making.
    requireElement<HTMLButtonElement>(root, '[data-posture="arrange"]').focus({ preventScroll: true });
  }, listenerOptions);

  telemetryExportTrigger.addEventListener(
    "click",
    (event) => {
      if (showTestingTools) emit({ kind: "export-telemetry" }, event);
    },
    listenerOptions,
  );

  telemetryExportClose.addEventListener(
    "click",
    () => {
      telemetryExportPanel.hidden = true;
      telemetryExportText.value = "";
    },
    listenerOptions,
  );

  for (const choice of paletteChoices) {
    choice.addEventListener(
      "click",
      (event) => {
        const materialId = choice.dataset.materialChoice;
        if (!currentState.trayEnabled || !materialId || materialId.trim().length === 0) return;
        emit({ kind: "select-material", materialId }, event);
        sourceCard.focus({ preventScroll: true });
      },
      listenerOptions,
    );
  }

  sourceCard.addEventListener(
    "pointerdown",
    (event) => {
      const materialId = sourceCard.dataset.materialId;
      if (
        !currentState.trayEnabled
        || event.button !== 0
        || !materialId
        || materialId.trim().length === 0
      ) return;
      event.preventDefault();
      emit(
        placeTap
          ? {
              kind: "arm-material-pointer",
              materialId,
              pointerId: event.pointerId,
              clientX: event.clientX,
              clientY: event.clientY,
            }
          : {
              kind: "begin-material-drag",
              materialId,
              pointerId: event.pointerId,
              clientX: event.clientX,
              clientY: event.clientY,
            },
        event,
      );
    },
    listenerOptions,
  );

  placeCancel?.addEventListener(
    "click",
    (event) => {
      emit({ kind: "cancel-place" }, event);
      sourceCard.focus({ preventScroll: true });
    },
    listenerOptions,
  );

  sourceCard.addEventListener(
    "click",
    (event) => {
      const materialId = sourceCard.dataset.materialId;
      // Pointer presses are owned by pointerdown. A following click must not
      // seat, including a touch click whose detail is 0. Keyboard activation
      // is a click that is not a mouse, touch, or pen pointer.
      const pointerType = "pointerType" in event ? event.pointerType : "";
      if (
        !currentState.trayEnabled
        || pointerType === "mouse"
        || pointerType === "touch"
        || pointerType === "pen"
        || event.detail !== 0
        || !materialId
        || materialId.trim().length === 0
      ) return;
      emit({ kind: "activate-material", materialId }, event);
    },
    listenerOptions,
  );

  render();

  return {
    root,
    studio,
    get state() {
      return Object.freeze({ ...currentState });
    },
    onCommand(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    setState,
    setStatus(message, tone = "quiet") {
      setState({ status: message, statusTone: tone });
    },
    setCraftCue(cue, announce = false) {
      craftCue.hidden = cue === null;
      root.dataset.cue = cue?.kind ?? "none";
      craftCue.setAttribute("aria-live", announce ? "polite" : "off");
      if (!cue) return;
      craftCue.dataset.kind = cue.kind;
      if (cueTitle.textContent !== cue.title) cueTitle.textContent = cue.title;
      if (cueDetail.textContent !== cue.detail) cueDetail.textContent = cue.detail;
    },
    setExperimentPanelOpen(open) {
      setState({ experimentPanelOpen: open });
    },
    setTrayEnabled(enabled) {
      setState({ trayEnabled: enabled });
    },
    setTrayDragging(dragging, materialId = null) {
      setState({
        trayDragging: dragging,
        activeMaterialId: dragging ? materialId : null,
      });
    },
    focusSourceCard() {
      sourceCard.focus({ preventScroll: true });
    },
    focusStatus() {
      status.focus({ preventScroll: true });
    },
    showTelemetryFallback(text) {
      telemetryExportPanel.hidden = text === null;
      telemetryExportText.value = text ?? "";
      if (text !== null) telemetryExportText.select();
    },
    destroy() {
      materialScrollCueObserver.disconnect();
      controller.abort();
      listeners.clear();
    },
  };
}
