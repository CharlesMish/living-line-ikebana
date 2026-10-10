import assert from "node:assert/strict";
import test from "node:test";
import { createUIBindings, type UICommand } from "../../src/app/ui.ts";

class ElementStub extends EventTarget {
  dataset: Record<string, string> = {};
  style: Record<string, string> = {};
  attributes = new Map<string, string>();
  hidden = false;
  disabled = false;
  inert = false;
  textContent = "";
  id = "";
  className = "";
  type = "";
  tabIndex = 0;
  clientHeight = 0;
  scrollHeight = 0;
  scrollTop = 0;
  parent: ElementStub | null = null;
  constructor(readonly ownerDocument: DocumentStub) { super(); }
  setAttribute(name: string, value: string) { this.attributes.set(name, value); }
  getAttribute(name: string) { return this.attributes.get(name) ?? null; }
  focus() { this.ownerDocument.activeElement = this; }
  querySelector(selector: string) {
    if (selector === "#place-cancel") return this.ownerDocument.elements.get(selector) ?? null;
    return this.ownerDocument.element(selector);
  }
  querySelectorAll(selector: string) { return this.ownerDocument.matches.get(selector) ?? []; }
  append(child: ElementStub) {
    child.parent = this;
    if (child.id) this.ownerDocument.elements.set(`#${child.id}`, child);
  }
}

class DocumentStub extends EventTarget {
  elements = new Map<string, ElementStub>();
  matches = new Map<string, ElementStub[]>();
  activeElement: ElementStub | null = null;
  element(selector: string): ElementStub {
    if (!this.elements.has(selector)) this.elements.set(selector, new ElementStub(this));
    return this.elements.get(selector)!;
  }
  createElement(): ElementStub {
    return new ElementStub(this);
  }
}

function setup(placeTap: boolean) {
  const document = new DocumentStub();
  const source = document.element("#selected-cutting");
  source.dataset.materialId = "flowering-branch";
  document.element(".material-name").textContent = "Camellia";
  document.element(".material-verb");
  document.matches.set("[data-bend-station]", ["lower", "middle", "upper"].map((station) => {
    const element = document.element(`[data-bend-station='${station}']`);
    element.dataset.bendStation = station;
    return element;
  }));
  const choice = document.element("[data-material-choice]");
  choice.dataset.materialChoice = "flowering-branch";
  document.matches.set("[data-material-choice]", [choice]);
  const observerBefore = globalThis.ResizeObserver;
  const frameBefore = globalThis.requestAnimationFrame;
  globalThis.ResizeObserver = class { observe() {} disconnect() {} } as unknown as typeof ResizeObserver;
  globalThis.requestAnimationFrame = (() => 1) as typeof requestAnimationFrame;
  const root = document.element("#app");
  const ui = createUIBindings({
    root: root as unknown as HTMLElement,
    placeTap,
    search: "",
  });
  const commands: UICommand[] = [];
  ui.onCommand((command) => commands.push(command));
  return {
    document, ui, commands, source, root,
    close() {
      ui.destroy();
      globalThis.ResizeObserver = observerBefore;
      globalThis.requestAnimationFrame = frameBefore;
    },
  };
}

function pointerDown(target: ElementStub, partial: Record<string, unknown> = {}) {
  const event = new Event("pointerdown", { cancelable: true });
  Object.assign(event, { button: 0, pointerId: 7, clientX: 16, clientY: 24, ...partial });
  target.dispatchEvent(event);
}

function click(target: ElementStub, detail: number) {
  const event = new Event("click", { cancelable: true });
  Object.defineProperty(event, "detail", { value: detail });
  target.dispatchEvent(event);
}

test("tap mode arms on pointerdown, ignores the following click, and keeps keyboard activation", () => {
  const h = setup(true);
  try {
    assert.equal(h.source.getAttribute("aria-pressed"), "false");
    assert.equal(h.source.getAttribute("aria-label"), "Drag Camellia to the pins, or tap to ready it");
    assert.equal(h.document.element(".material-verb").textContent, "drag to the pins");
    const cancel = h.document.elements.get("#place-cancel")!;
    assert.equal(cancel.hidden, true);
    assert.equal(cancel.textContent, "Cancel");
    assert.equal(cancel.getAttribute("aria-label"), "Cancel placement");

    pointerDown(h.source);
    click(h.source, 1);
    assert.deepEqual(h.commands, [{
      kind: "arm-material-pointer",
      materialId: "flowering-branch",
      pointerId: 7,
      clientX: 16,
      clientY: 24,
    }]);

    h.ui.setState({ placeReady: true });
    assert.equal(h.source.getAttribute("aria-pressed"), "true");
    assert.equal(h.source.getAttribute("aria-label"), "Camellia. Ready to place. Tap inside the pins.");
    assert.equal(h.document.element(".material-verb").textContent, "tap inside the pins");
    assert.equal(cancel.hidden, false);

    click(cancel, 0);
    assert.equal(h.commands.at(-1)?.kind, "cancel-place");
    assert.equal(h.document.activeElement, h.source);

    click(h.source, 0);
    assert.equal(h.commands.at(-1)?.kind, "activate-material");
  } finally { h.close(); }
});

test("ordinary play still begins a drag on pointerdown and has no cancel control", () => {
  const h = setup(false);
  try {
    assert.equal(h.document.elements.has("#place-cancel"), false);
    assert.equal(h.source.getAttribute("aria-pressed"), null);
    pointerDown(h.source);
    click(h.source, 1);
    click(h.source, 0);
    assert.deepEqual(h.commands.map((command) => command.kind), ["begin-material-drag", "activate-material"]);
  } finally { h.close(); }
});
