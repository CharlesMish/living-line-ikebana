export type Posture = "arrange" | "step-back";
export type CraftTool = "shape" | "prune";
export type CanonicalView = "front" | "three-quarter" | "above";
export type BendVariant = "fixed-bead" | "touch-located";
export type StatusTone = "quiet" | "warning";

export interface UIState {
  posture: Posture;
  tool: CraftTool;
  view: CanonicalView;
  bendVariant: BendVariant;
  experimentPanelOpen: boolean;
  trayEnabled: boolean;
  trayDragging: boolean;
  activeMaterialId: string | null;
  status: string;
  statusTone: StatusTone;
}

export type UICommand =
  | { kind: "set-posture"; posture: Posture }
  | { kind: "set-tool"; tool: CraftTool }
  | { kind: "set-view"; view: CanonicalView }
  | { kind: "set-bend-variant"; bendVariant: BendVariant }
  | { kind: "set-experiment-panel"; open: boolean }
  | {
      kind: "begin-material-drag";
      materialId: string;
      pointerId: number;
      clientX: number;
      clientY: number;
    }
  | { kind: "activate-material"; materialId: string };

export type UICommandListener = (command: UICommand, sourceEvent: Event) => void;

export interface UIBindings {
  readonly root: HTMLElement;
  readonly studio: HTMLElement;
  readonly state: Readonly<UIState>;
  onCommand(listener: UICommandListener): () => void;
  setState(patch: Partial<UIState>): void;
  setStatus(message: string, tone?: StatusTone): void;
  setExperimentPanelOpen(open: boolean): void;
  setTrayEnabled(enabled: boolean): void;
  setTrayDragging(dragging: boolean, materialId?: string | null): void;
  destroy(): void;
}

export interface CreateUIBindingsOptions {
  root?: HTMLElement;
  initialState?: Partial<UIState>;
  search?: string;
}

const DEFAULT_STATE: UIState = {
  posture: "arrange",
  tool: "shape",
  view: "front",
  bendVariant: "fixed-bead",
  experimentPanelOpen: false,
  trayEnabled: true,
  trayDragging: false,
  activeMaterialId: null,
  status: "Place a cutting.",
  statusTone: "quiet",
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

export function createUIBindings(options: CreateUIBindingsOptions = {}): UIBindings {
  const rootCandidate = options.root ?? document.querySelector<HTMLElement>("#app");
  if (!rootCandidate) {
    throw new Error("UI shell is missing required element: #app");
  }
  const root: HTMLElement = rootCandidate;

  const studio = requireElement<HTMLElement>(root, "#studio");
  const status = requireElement<HTMLElement>(root, "#status");
  const craftChrome = requireElement<HTMLElement>(root, "#craft-chrome");
  const trayButtons = [...root.querySelectorAll<HTMLButtonElement>("[data-material-id]")];
  if (trayButtons.length === 0) {
    throw new Error("UI shell is missing required element: [data-material-id]");
  }
  const experimentPanel = requireElement<HTMLElement>(root, "#experiment-panel");
  const experimentToggle = requireElement<HTMLButtonElement>(root, "#experiment-toggle");
  const experimentClose = requireElement<HTMLButtonElement>(root, "#experiment-close");

  const search = options.search ?? globalThis.location?.search ?? "";
  let currentState: UIState = {
    ...DEFAULT_STATE,
    bendVariant: bendVariantFromSearch(search),
    ...options.initialState,
  };
  const listeners = new Set<UICommandListener>();
  const controller = new AbortController();
  const listenerOptions = { signal: controller.signal };

  function emit(command: UICommand, sourceEvent: Event): void {
    for (const listener of listeners) {
      listener(command, sourceEvent);
    }
  }

  function setPressed(selector: string, value: string): void {
    for (const button of root.querySelectorAll<HTMLButtonElement>(selector)) {
      const key = button.dataset.posture ?? button.dataset.tool ?? button.dataset.view ?? button.dataset.bendVariant;
      button.setAttribute("aria-pressed", String(key === value));
    }
  }

  function render(): void {
    root.dataset.posture = currentState.posture;
    root.dataset.tool = currentState.tool;
    root.dataset.view = currentState.view;
    root.dataset.bendVariant = currentState.bendVariant === "fixed-bead" ? "fixed" : "touch";

    setPressed("[data-posture]", currentState.posture);
    setPressed("[data-tool]", currentState.tool);
    setPressed("[data-view]", currentState.view);
    setPressed("[data-bend-variant]", currentState.bendVariant);

    experimentPanel.hidden = !currentState.experimentPanelOpen;
    experimentToggle.setAttribute("aria-expanded", String(currentState.experimentPanelOpen));

    craftChrome.inert = currentState.posture === "step-back";
    craftChrome.setAttribute("aria-hidden", String(currentState.posture === "step-back"));
    for (const trayButton of trayButtons) {
      const buttonDragging = currentState.trayDragging
        && currentState.activeMaterialId === trayButton.dataset.materialId;
      trayButton.disabled = !currentState.trayEnabled;
      trayButton.dataset.dragging = String(buttonDragging);
      trayButton.setAttribute("aria-busy", String(buttonDragging));
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

  commandClick<HTMLButtonElement>("[data-bend-variant]", (button) => ({
    kind: "set-bend-variant",
    bendVariant: button.dataset.bendVariant as BendVariant,
  }));

  experimentToggle.addEventListener(
    "click",
    (event) => {
      emit({ kind: "set-experiment-panel", open: !currentState.experimentPanelOpen }, event);
    },
    listenerOptions,
  );

  experimentClose.addEventListener(
    "click",
    (event) => {
      emit({ kind: "set-experiment-panel", open: false }, event);
    },
    listenerOptions,
  );

  for (const trayButton of trayButtons) {
    trayButton.addEventListener(
      "pointerdown",
      (event) => {
        const materialId = trayButton.dataset.materialId;
        if (
          !currentState.trayEnabled
          || event.button !== 0
          || !materialId
          || materialId.trim().length === 0
        ) return;
        event.preventDefault();
        emit(
          {
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

    trayButton.addEventListener(
      "click",
      (event) => {
        const materialId = trayButton.dataset.materialId;
        // Pointer activation is acquired on pointerdown; detail === 0 is keyboard activation.
        if (
          !currentState.trayEnabled
          || event.detail !== 0
          || !materialId
          || materialId.trim().length === 0
        ) return;
        emit({ kind: "activate-material", materialId }, event);
      },
      listenerOptions,
    );
  }

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
    destroy() {
      controller.abort();
      listeners.clear();
    },
  };
}
