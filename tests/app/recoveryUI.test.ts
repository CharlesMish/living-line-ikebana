import assert from "node:assert/strict";
import { setMaxListeners } from "node:events";
import test from "node:test";
import { createUIBindings, type UICommand } from "../../src/app/ui.ts";

// Exercise the production binding/event paths without requiring a GPU or a DOM
// dependency. Layout and physical touch remain browser/owner checks.
setMaxListeners(0);

class ElementStub extends EventTarget {
  dataset: Record<string, string> = {};
  style: Record<string, string> = {};
  attributes = new Map<string, string>();
  hidden = false;
  disabled = false;
  inert = false;
  textContent = "";
  clientHeight = 0;
  scrollHeight = 0;
  scrollTop = 0;
  parent: ElementStub | null = null;
  constructor(readonly ownerDocument: DocumentStub) { super(); }
  setAttribute(name: string, value: string) { this.attributes.set(name, value); }
  getAttribute(name: string) { return this.attributes.get(name) ?? null; }
  focus() { this.ownerDocument.activeElement = this; }
  contains(candidate: ElementStub | null): boolean {
    return candidate === this || (candidate?.parent ? this.contains(candidate.parent) : false);
  }
  querySelector(selector: string) { return this.ownerDocument.element(selector); }
  querySelectorAll(selector: string) { return this.ownerDocument.matches.get(selector) ?? []; }
}

class DocumentStub extends EventTarget {
  elements = new Map<string, ElementStub>();
  matches = new Map<string, ElementStub[]>();
  activeElement: ElementStub | null = null;
  element(selector: string): ElementStub {
    if (!this.elements.has(selector)) this.elements.set(selector, new ElementStub(this));
    return this.elements.get(selector)!;
  }
}

function setup() {
  const document = new DocumentStub();
  document.element("#selected-cutting").dataset.materialId = "flowering-branch";
  document.matches.set("[data-bend-station]", ["lower", "middle", "upper"].map((station) => {
    const element = document.element(`[data-bend-station='${station}']`);
    element.dataset.bendStation = station;
    return element;
  }));
  const choice = document.element("flowering-choice");
  choice.dataset.materialChoice = "flowering-branch";
  document.matches.set("[data-material-choice]", [choice]);
  for (const selector of ["#edit-toggle", "#edit-options", "#undo-edit", "#remove-cutting"]) {
    document.element(selector).parent = document.element(".edit-menu");
  }
  const observerBefore = globalThis.ResizeObserver;
  const frameBefore = globalThis.requestAnimationFrame;
  globalThis.ResizeObserver = class { observe() {} disconnect() {} } as unknown as typeof ResizeObserver;
  globalThis.requestAnimationFrame = () => 1;
  const ui = createUIBindings({ root: document.element("#app") as unknown as HTMLElement, search: "" });
  const commands: UICommand[] = [];
  ui.onCommand((command) => {
    commands.push(command);
    // Command ownership stays in the app. This listener only mirrors its menu state.
    if (command.kind === "set-edit-menu") ui.setState({ editMenuOpen: command.open });
    if (command.kind === "set-view-menu") ui.setState({ viewMenuOpen: command.open });
    if (command.kind === "set-material-menu") ui.setState({ materialMenuOpen: command.open });
  });
  return {
    document, ui, commands,
    click(selector: string) { document.element(selector).dispatchEvent(new Event("click")); },
    close() {
      ui.destroy();
      globalThis.ResizeObserver = observerBefore;
      globalThis.requestAnimationFrame = frameBefore;
    },
  };
}

test("recovery commands follow application availability in both postures", () => {
  const h = setup();
  try {
    assert.equal(h.document.element("#undo-edit").disabled, true);
    assert.equal(h.document.element("#remove-cutting").disabled, true);
    h.click("#undo-edit");
    h.click("#remove-cutting");
    assert.deepEqual(h.commands, []);

    h.ui.setState({ posture: "step-back", canUndo: true, canRemove: false });
    h.click("#undo-edit");
    h.click("#remove-cutting");
    assert.deepEqual(h.commands, [{ kind: "undo-edit" }]);

    h.ui.setState({ posture: "arrange", canUndo: false, canRemove: true });
    h.click("#undo-edit");
    h.click("#remove-cutting");
    assert.deepEqual(h.commands, [{ kind: "undo-edit" }, { kind: "remove-cutting" }]);
  } finally { h.close(); }
});

test("Edit shares disclosure ownership with View and Materials and returns action focus", () => {
  const h = setup();
  try {
    h.click("#materials-toggle");
    assert.equal(h.ui.state.materialMenuOpen, true);
    h.click("#edit-toggle");
    assert.equal(h.ui.state.materialMenuOpen, false);
    assert.equal(h.ui.state.editMenuOpen, true);
    assert.equal(h.document.element("#edit-options").hidden, false);
    assert.equal(h.document.element("#edit-toggle").getAttribute("aria-expanded"), "true");
    h.click("#view-toggle");
    assert.equal(h.ui.state.editMenuOpen, false);
    assert.equal(h.ui.state.viewMenuOpen, true);
    h.click("#edit-toggle");
    assert.equal(h.ui.state.viewMenuOpen, false);
    h.ui.setState({ canRemove: true });
    h.click("#remove-cutting");
    assert.equal(h.ui.state.editMenuOpen, false);
    assert.equal(h.document.element("#edit-options").hidden, true);
    assert.equal(h.document.activeElement, h.document.element("#edit-toggle"));
    assert.equal(h.commands.at(-1)?.kind, "remove-cutting");
  } finally { h.close(); }
});

test("Escape, outside press and focus leaving Edit dismiss without a recovery command", () => {
  const h = setup();
  try {
    h.click("#edit-toggle");
    const escape = new Event("keydown", { cancelable: true });
    Object.defineProperty(escape, "key", { value: "Escape" });
    h.document.dispatchEvent(escape);
    assert.equal(escape.defaultPrevented, true);
    assert.equal(h.ui.state.editMenuOpen, false);
    assert.equal(h.document.activeElement, h.document.element("#edit-toggle"));

    h.click("#edit-toggle");
    const outside = new Event("pointerdown", { cancelable: true });
    h.document.dispatchEvent(outside);
    assert.equal(outside.defaultPrevented, false, "a scene press remains available to the scene");
    assert.equal(h.ui.state.editMenuOpen, false);

    h.click("#edit-toggle");
    const insideFocus = new Event("focusout");
    Object.defineProperty(insideFocus, "relatedTarget", { value: h.document.element("#undo-edit") });
    h.document.element(".edit-menu").dispatchEvent(insideFocus);
    assert.equal(h.ui.state.editMenuOpen, true);
    h.document.element(".edit-menu").dispatchEvent(new Event("focusout"));
    assert.equal(h.ui.state.editMenuOpen, false);
    assert.equal(h.commands.every((command) => command.kind === "set-edit-menu"), true);
  } finally { h.close(); }
});

test("stem inspection toggle exposes scope/count and returns focus without changing camera", () => {
  const h = setup();
  try {
    assert.equal(h.document.element("#stem-overlaps-toggle").getAttribute("aria-pressed"), "false");
    assert.equal(h.document.element("#stem-overlaps-note").hidden, true);
    h.ui.setState({ viewMenuOpen: true });
    h.click("#stem-overlaps-toggle");
    assert.deepEqual(h.commands, [{ kind: "set-stem-overlaps", visible: true }]);
    assert.equal(h.document.activeElement, h.document.element("#view-toggle"));
    h.ui.setState({ showStemOverlaps: true, stemOverlapCount: 2 });
    assert.equal(h.document.element("#stem-overlaps-toggle").getAttribute("aria-pressed"), "true");
    assert.match(h.document.element("#stem-overlaps-note").textContent, /2 possible overlap areas/);
    assert.match(h.document.element("#stem-overlaps-note").textContent, /separate cuttings only/);
    h.ui.setState({ stemOverlapCount: 0 });
    assert.match(h.document.element("#stem-overlaps-note").textContent, /No stem overlaps detected/);
  } finally { h.close(); }
});

test("prevention is an explicit default-off study and returns focus to View", () => {
 const h=setup();
 try {
  const button=h.document.element('#stem-prevention-toggle');
  assert.equal(button.getAttribute('aria-pressed'),'false');
  h.click('#view-toggle');h.click('#stem-prevention-toggle');
  assert.deepEqual(h.commands.at(-1),{kind:'set-stem-prevention',enabled:true});
  h.ui.setState({preventStemOverlaps:true});
  assert.equal(button.getAttribute('aria-pressed'),'true');
  assert.equal(h.document.element('#stem-prevention-note').hidden,false);
  assert.equal(h.document.activeElement,h.document.element('#view-toggle'));
 } finally {h.close();}
});
