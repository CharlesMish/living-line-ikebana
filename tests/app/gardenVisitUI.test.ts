import assert from "node:assert/strict";
import test from "node:test";
import { GardenVisitUI } from "../../src/app/gardenVisitUI.ts";
import { GardenDisplayStore, type GardenDisplayEntries } from "../../src/app/gardenDisplay.ts";
import { createWorkbenchFixture } from "../../src/app/workbench.ts";
import type { GardenEntry } from "../../src/app/garden.ts";
// This is a DOM event adapter, not a browser layout or GPU test.
class Element extends EventTarget {
  children: Element[] = [];
  parentElement: Element | null = null;
  attributes = new Map<string, string>();
  dataset: Record<string, string> = {};
  style: Record<string, string> = {};
  className = "";
  id = "";
  textContent = "";
  value = "";
  hidden = false;
  disabled = false;
  open = false;
  type = "";
  get classList() { return { add: (name: string) => { this.className += ` ${name}`; } }; }
  constructor(readonly ownerDocument: Document, readonly tagName: string) { super(); }
  setAttribute(name: string, value: string) {
    this.attributes.set(name, value);
    if (name === "class") this.className = value;
    if (name === "id") this.id = value;
    if (name === "hidden") this.hidden = true;
    if (name === "disabled") this.disabled = true;
    if (name.startsWith("data-")) this.dataset[name.slice(5).replace(/-([a-z])/g, (_, letter) => letter.toUpperCase())] = value;
  }
  getAttribute(name: string) { return this.attributes.get(name) ?? null; }
  removeAttribute(name: string) { this.attributes.delete(name); }
  append(...children: Element[]) {
    for (const child of children) { child.parentElement = this; this.children.push(child); }
  }
  remove() {
    if (this.parentElement) this.parentElement.children = this.parentElement.children.filter((child) => child !== this);
    this.parentElement = null;
  }
  replaceChildren(...children: Element[]) { for (const child of this.children) child.parentElement = null; this.children = []; this.append(...children); }
  focus() { this.ownerDocument.activeElement = this; }
  showModal() { this.open = true; }
  close() { if (this.open) { this.open = false; this.dispatchEvent(new Event("close")); } }
  matches(selector: string) {
    if (selector.startsWith("#")) return this.id === selector.slice(1);
    if (selector.startsWith(".")) return this.className.split(/\s+/).includes(selector.slice(1));
    if (selector.startsWith("[")) return this.attributes.has(selector.slice(1, -1));
    return this.tagName === selector;
  }
  querySelectorAll(selector: string): Element[] {
    const parts = selector.split(/\s+/), last = parts.pop()!;
    const found: Element[] = [];
    const visit = (node: Element) => {
      for (const child of node.children) {
        if (child.matches(last)) {
          let ancestor = child.parentElement, index = parts.length - 1;
          while (ancestor && index >= 0) { if (ancestor.matches(parts[index])) index--; ancestor = ancestor.parentElement; }
          if (index < 0) found.push(child);
        }
        visit(child);
      }
    };
    visit(this); return found;
  }
  querySelector(selector: string) { return this.querySelectorAll(selector)[0] ?? null; }
  set innerHTML(value: string) {
    this.replaceChildren();
    const stack: Element[] = [this];
    for (const token of value.matchAll(/<\/?[a-z][^>]*>|[^<]+/g)) {
      if (token[0].startsWith("</")) { stack.pop(); continue; }
      if (!token[0].startsWith("<")) { stack.at(-1)!.textContent += token[0].trim(); continue; }
      const tag = /^<([a-z][\w-]*)/.exec(token[0])![1];
      const element = this.ownerDocument.createElement(tag);
      const attributes = token[0].slice(tag.length + 1, -1);
      for (const attr of attributes.matchAll(/([\w-]+)(?:="([^"]*)")?/g)) element.setAttribute(attr[1], attr[2] ?? "");
      stack.at(-1)!.append(element);
      if (!["input", "img", "br", "hr"].includes(tag)) stack.push(element);
    }
  }
}
class Document extends EventTarget {
  activeElement: Element | null = null;
  hidden = false;
  createElement(tag: string) { return new Element(this, tag); }
}

const entry = (id: string): GardenEntry => ({ id, title: `Moment ${id}`, keptAt: "2026-10-15T00:00:00Z", thumbnail: "data:image/jpeg;base64,YQ==", arrangement: createWorkbenchFixture("flowering-branch", 8278, 1) });
function setup() {
  const document = new Document(), root = document.createElement("main"), opener = document.createElement("button");
  root.append(opener);
  const previous = Object.getOwnPropertyDescriptor(globalThis, "document");
  Object.defineProperty(globalThis, "document", { configurable: true, value: document });
  let raw: string | null = null, writes = 0, fail = false, renderFail = false, destroyed = 0;
  let warning: ((message: string) => void) | null = null;
  const snapshots: GardenDisplayEntries[] = [], focus: (number | null)[] = [], copies: GardenEntry[] = [];
  const originals = [entry("a"), entry("b"), entry("c"), entry("d")];
  const store = new GardenDisplayStore("test", { getItem: () => raw, setItem: (_k,v) => { if (fail) throw new Error("quota"); raw = v; writes++; } });
  const ui = new GardenVisitUI(root as unknown as HTMLElement, store, e => copies.push(e), (_canvas, options) => {
    warning = options.onWarning;
    if (renderFail) throw new Error("Graphics unavailable");
    return { setEntries: entries => snapshots.push(structuredClone(entries)), focus: i => focus.push(i), resetView() {}, zoomBy() {}, interrupt() {}, destroy() { destroyed++; } };
  });
  const find = (id: string) => { const el = root.querySelector(`#${id}`); assert.ok(el, `Missing ${id}`); return el; };
  const click = (id: string) => find(id).dispatchEvent(new Event("click"));
  return { ui, originals, snapshots, focus, copies, find, click, raw: () => raw, writes: () => writes, destroyed: () => destroyed,
    warning: () => warning?.("One saved photograph could not be shown."), open: () => ui.open(originals, opener as unknown as HTMLElement), fail: (value: boolean) => { fail = value; }, renderFail: (value: boolean) => { renderFail = value; },
    finish() { ui.destroy(); if (previous) Object.defineProperty(globalThis,"document",previous); else Reflect.deleteProperty(globalThis,"document"); } };
}

test("Visiting, approaching, inspecting a print and closing write nothing and preserve all saved originals", () => {
  const h = setup();
  try {
    const before = JSON.stringify(h.originals); h.open();
    assert.deepEqual(h.snapshots.at(-1)!.map(e => e?.id), ["a","b","c"]);
    h.click("visit-position-1"); h.click("visit-print");
    assert.equal(h.find("visit-print-panel").hidden, false);
    const cancel = new Event("cancel", { cancelable:true }); h.find("garden-visit").dispatchEvent(cancel);
    assert.equal(cancel.defaultPrevented, true); assert.equal(h.find("visit-print-panel").hidden, true);
    h.click("visit-overview"); h.click("visit-close");
    assert.equal(h.writes(),0); assert.equal(JSON.stringify(h.originals),before);
    assert.equal(h.destroyed(),1);
    h.open(); h.click("visit-close"); assert.equal(h.destroyed(),2);
  } finally { h.finish(); }
});

test("Choosing a displayed moment swaps positions, preserves matching covers and persists references only", () => {
  const h=setup();
  try {
    h.open(); h.click("visit-position-0"); h.click("visit-change"); h.click("visit-choice-c");
    assert.equal(h.find("visit-position-0").dataset.entryId,"c");
    assert.equal(h.find("visit-position-2").dataset.entryId,"a");
    assert.equal(h.find("visit-picker").hidden,true);
    assert.deepEqual(JSON.parse(h.raw()!),{displayVersion:1,slots:["c","b","a"]});
    h.click("visit-close"); h.open();
    assert.equal(h.find("visit-position-0").dataset.entryId,"c"); assert.equal(h.writes(),1);
  } finally { h.finish(); }
});

test("Rejected display save keeps visible selection, renderer and previous preference intact", () => {
  const h=setup();
  try {
    h.open(); h.click("visit-position-0"); h.click("visit-change"); h.fail(true);
    const count=h.snapshots.length; h.click("visit-choice-d");
    assert.equal(h.find("visit-position-0").dataset.entryId,"a");
    assert.equal(h.snapshots.length,count); assert.equal(h.raw(),null);
    assert.match(h.find("visit-message").textContent,/could not be saved/);
    assert.equal(h.find("visit-picker").hidden,false);
    h.fail(false); h.click("visit-choice-d"); assert.equal(h.find("visit-position-0").dataset.entryId,"d");
  } finally { h.finish(); }
});

test("Working-copy action passes only the chosen original through the host's explicit replacement boundary", () => {
  const h=setup();
  try {
    h.open(); h.click("visit-position-2"); h.click("visit-copy");
    assert.deepEqual(h.copies,[h.originals[2]]);
    assert.notEqual(h.copies[0],h.originals[2]);
    assert.equal(h.find("garden-visit").open,false); assert.equal(h.destroyed(),1); assert.equal(h.writes(),0);
  } finally { h.finish(); }
});

test("Renderer failure leaves the Garden available, retries cleanly and changes no saved art", () => {
  const h=setup();
  try {
    h.renderFail(true); h.open(); assert.equal(h.find("visit-scene-error").hidden,false);
    assert.equal(h.writes(),0); h.renderFail(false); h.click("visit-retry");
    assert.equal(h.find("visit-scene-error").hidden,true); assert.equal(h.snapshots.length,1);
    h.click("visit-close"); assert.equal(h.destroyed(),1);
  } finally { h.finish(); }
});


test("One unreadable photograph warns without hiding the three valid arrangements", () => {
  const h=setup();
  try {
    h.open(); h.warning();
    assert.match(h.find("visit-message").textContent, /One saved photograph/);
    assert.equal(h.find("visit-scene-error").hidden,true);
    assert.equal(h.snapshots.at(-1)!.filter(Boolean).length,3);
    assert.equal(h.writes(),0);
  } finally { h.finish(); }
});
