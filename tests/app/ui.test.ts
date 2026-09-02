import assert from "node:assert/strict";
import test from "node:test";

import { bendVariantFromSearch, createUIBindings, type UICommand } from "../../src/app/ui.ts";

class HarnessNode {
  readonly children: HarnessNode[] = [];
  textContent = "";
  hidden = false;
  inert = false;
  disabled = false;
  tabIndex = 0;
  dataset: Record<string, string> = {};
  private readonly attrs = new Map<string, string>();
  private readonly listeners = new Map<string, Set<(event: Record<string, unknown>) => void>>();

  constructor(
    readonly tagName: string,
    readonly id: string | null = null,
    attrs: Record<string, string> = {},
  ) {
    for (const [name, value] of Object.entries(attrs)) this.setAttribute(name, value);
  }

  setAttribute(name: string, value: string) {
    this.attrs.set(name, String(value));
    if (name === "hidden") this.hidden = value !== "false";
    if (name === "tabindex") this.tabIndex = Number(value);
    if (name.startsWith("data-")) {
      this.dataset[dataToCamel(name.slice(5))] = String(value);
    }
  }

  getAttribute(name: string) {
    return this.attrs.get(name) ?? null;
  }

  removeAttribute(name: string) {
    this.attrs.delete(name);
    if (name === "tabindex") this.tabIndex = 0;
    if (name === "hidden") this.hidden = false;
  }

  append(...nodes: HarnessNode[]) {
    this.children.push(...nodes);
  }

  addEventListener(
    type: string,
    listener: (event: Record<string, unknown>) => void,
    options?: { signal?: AbortSignal },
  ) {
    const set = this.listeners.get(type) ?? new Set();
    set.add(listener);
    this.listeners.set(type, set);
    options?.signal?.addEventListener("abort", () => set.delete(listener));
  }

  dispatchEvent(event: Record<string, unknown>) {
    const next = { ...event, target: event.target ?? this };
    for (const listener of this.listeners.get(String(event.type)) ?? []) listener(next);
    return true;
  }

  querySelector(selector: string) {
    return this.querySelectorAll(selector)[0] ?? null;
  }

  querySelectorAll(selector: string) {
    const matches: HarnessNode[] = [];
    const visit = (node: HarnessNode) => {
      if (matchesSelector(node, selector)) matches.push(node);
      for (const child of node.children) visit(child);
    };
    visit(this);
    return matches;
  }
}

function dataToCamel(name: string) {
  return name.replace(/-([a-z])/g, (_, letter: string) => letter.toUpperCase());
}

function matchesSelector(node: HarnessNode, selector: string) {
  if (selector.startsWith("#")) return node.id === selector.slice(1);
  const attrEq = selector.match(/^\[([a-z0-9-]+)=["']([^"']+)["']\]$/i);
  if (attrEq) return node.getAttribute(attrEq[1]) === attrEq[2] || node.dataset[dataToCamel(attrEq[1].replace(/^data-/, ""))] === attrEq[2];
  const attr = selector.match(/^\[([a-z0-9-]+)\]$/i);
  if (attr) {
    const name = attr[1];
    if (node.getAttribute(name) != null) return true;
    if (name.startsWith("data-")) return node.dataset[dataToCamel(name.slice(5))] != null;
    return false;
  }
  return node.tagName.toLowerCase() === selector.toLowerCase();
}

function button(id: string | null, attrs: Record<string, string>) {
  return new HarnessNode("button", id, attrs);
}

function createShell() {
  const root = new HarnessNode("main", "app", { "data-testid": "app-root" });
  const studio = new HarnessNode("div", "studio");
  const status = new HarnessNode("p", "status");
  const toolChrome = new HarnessNode("nav", "tool-chrome");
  const viewChrome = new HarnessNode("nav", "view-chrome");
  const materialTray = new HarnessNode("div", "material-tray");
  const experimentPanel = new HarnessNode("section", "experiment-panel");
  const experimentToggle = button("experiment-toggle", {});
  const experimentClose = button("experiment-close", {});
  const telemetryExportTrigger = button("telemetry-export-trigger", {});
  const telemetryExportPanel = new HarnessNode("section", "telemetry-export-panel");
  const telemetryExportText = new HarnessNode("textarea", "telemetry-export-text");
  const telemetryExportClose = button("telemetry-export-close", {});
  const tray = button("flowering-cutting", { "data-material-id": "flowering-branch" });
  const postureArrange = button(null, { "data-posture": "arrange" });
  const postureStepBack = button(null, { "data-posture": "step-back" });
  const toolShape = button(null, { "data-tool": "shape" });
  const toolPrune = button(null, { "data-tool": "prune" });
  const viewFront = button(null, { "data-view": "front" });
  const viewThree = button(null, { "data-view": "three-quarter" });
  const viewAbove = button(null, { "data-view": "above" });
  const bendFixed = button(null, { "data-bend-variant": "fixed-bead" });
  const bendTouch = button(null, { "data-bend-variant": "touch-located" });

  toolChrome.append(toolShape, toolPrune);
  viewChrome.append(viewFront, viewThree, viewAbove);
  materialTray.append(tray);
  experimentPanel.append(bendFixed, bendTouch);
  root.append(
    studio,
    status,
    toolChrome,
    viewChrome,
    materialTray,
    experimentPanel,
    experimentToggle,
    experimentClose,
    telemetryExportTrigger,
    telemetryExportPanel,
    telemetryExportText,
    telemetryExportClose,
    postureArrange,
    postureStepBack,
  );

  return {
    root,
    toolChrome,
    viewChrome,
    materialTray,
    tray,
    postureStepBack,
    toolPrune,
    viewAbove,
    viewFront,
  };
}

function commandsOf(root: HarnessNode, search?: string) {
  const commands: UICommand[] = [];
  const ui = createUIBindings({
    root: root as unknown as HTMLElement,
    search,
  });
  ui.onCommand((command) => commands.push(command));
  return { ui, commands };
}

test("UI search mapping matches the public bend query", () => {
  assert.equal(bendVariantFromSearch(""), "touch-located");
  assert.equal(bendVariantFromSearch("?bend=touch"), "touch-located");
  assert.equal(bendVariantFromSearch("?bend=fixed"), "fixed-bead");
});

test("switching posture shows only the appropriate contextual row", () => {
  const shell = createShell();
  const { ui } = commandsOf(shell.root);
  assert.equal(ui.state.bendVariant, "touch-located");
  assert.equal(shell.root.dataset.contextual, "tools");
  assert.equal(shell.toolChrome.hidden, false);
  assert.equal(shell.toolChrome.inert, false);
  assert.equal(shell.viewChrome.hidden, true);
  assert.equal(shell.viewChrome.inert, true);
  assert.equal(shell.materialTray.hidden, false);

  ui.setState({ posture: "step-back" });
  assert.equal(shell.root.dataset.contextual, "views");
  assert.equal(shell.toolChrome.hidden, true);
  assert.equal(shell.toolChrome.inert, true);
  assert.equal(shell.viewChrome.hidden, false);
  assert.equal(shell.viewChrome.inert, false);
  assert.equal(shell.materialTray.hidden, true);
  assert.equal(shell.materialTray.inert, true);

  ui.setState({ posture: "arrange" });
  assert.equal(shell.materialTray.hidden, false);
  assert.equal(shell.materialTray.inert, false);
  ui.destroy();
});

test("hidden contextual controls are neither focusable nor pointer-active", () => {
  const shell = createShell();
  const { ui } = commandsOf(shell.root);

  for (const button of shell.viewChrome.querySelectorAll("button")) {
    assert.equal(button.tabIndex, -1);
    assert.equal(shell.viewChrome.inert, true);
    assert.equal(shell.viewChrome.getAttribute("aria-hidden"), "true");
  }

  ui.setState({ posture: "step-back" });
  for (const button of shell.toolChrome.querySelectorAll("button")) {
    assert.equal(button.tabIndex, -1);
  }
  assert.equal(shell.toolChrome.inert, true);
  assert.equal(shell.materialTray.inert, true);
  for (const button of shell.viewChrome.querySelectorAll("button")) {
    assert.ok(button.tabIndex !== -1 || button.getAttribute("tabindex") == null);
  }
  ui.destroy();
});

test("tray pointerdown owns insertion and does not emit a chrome command", () => {
  const shell = createShell();
  const { ui, commands } = commandsOf(shell.root);
  shell.tray.dispatchEvent({
    type: "pointerdown",
    button: 0,
    pointerId: 17,
    clientX: 200,
    clientY: 780,
    preventDefault() {},
  });
  assert.deepEqual(commands, [
    {
      kind: "begin-material-drag",
      materialId: "flowering-branch",
      pointerId: 17,
      clientX: 200,
      clientY: 780,
    },
  ]);

  shell.toolPrune.dispatchEvent({
    type: "pointerdown",
    button: 0,
    pointerId: 17,
    clientX: 40,
    clientY: 40,
    preventDefault() {},
  });
  assert.equal(commands.length, 1, "the acquired tray pointer must not activate a crossed button");
  ui.destroy();
});

test("visible chrome still emits cancel-then-command clicks from its own pointer", () => {
  const shell = createShell();
  const { ui, commands } = commandsOf(shell.root);
  shell.postureStepBack.dispatchEvent({ type: "click" });
  assert.deepEqual(commands.at(-1), { kind: "set-posture", posture: "step-back" });
  shell.viewAbove.dispatchEvent({ type: "click" });
  assert.deepEqual(commands.at(-1), { kind: "set-view", view: "above" });
  ui.destroy();
});

test("posture and tool commands do not themselves rewrite view or bend state", () => {
  const shell = createShell();
  const { ui } = commandsOf(shell.root, "?bend=touch");
  const before = { ...ui.state };
  ui.setState({ posture: "step-back" });
  assert.equal(ui.state.view, before.view);
  assert.equal(ui.state.tool, before.tool);
  assert.equal(ui.state.bendVariant, "touch-located");
  ui.setState({ posture: "arrange", tool: "prune" });
  assert.equal(ui.state.view, before.view);
  ui.destroy();
});
