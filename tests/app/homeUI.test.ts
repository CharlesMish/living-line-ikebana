import assert from "node:assert/strict";
import test from "node:test";
import { HomeUI } from "../../src/app/homeUI.ts";
import { HomeStore } from "../../src/app/homeStore.ts";
import { createWorkbenchFixture } from "../../src/app/workbench.ts";
import type { GardenEntry } from "../../src/app/garden.ts";
import type { HomeEntries } from "../../src/presentation/HomeStudio.ts";
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


const entry = (id: string, day: number, fixture = "flowering-branch", thumbnail: string | null = "data:image/jpeg;base64,YQ=="): GardenEntry => ({
  id, title: `Moment ${id}`, keptAt: `2026-10-${day}T00:00:00Z`, thumbnail, arrangement: createWorkbenchFixture(fixture, 8278, 1),
});
function setup() {
  const document = new Document(), root = document.createElement("main"), opener = document.createElement("button");
  root.append(opener);
  const previous = Object.getOwnPropertyDescriptor(globalThis, "document");
  Object.defineProperty(globalThis, "document", { configurable: true, value: document });
  const values = new Map<string, string>();
  let writes = 0, fail = false, renderFail = false, destroyed = 0;
  const snapshots: HomeEntries[] = [], focus: (string | null)[] = [], markers: unknown[] = [], copies: GardenEntry[] = [];
  const originals = [entry("a", 12), entry("b", 13), entry("c", 14), entry("v", 15, "violet-sprig", null)];
  const store = new HomeStore("home", null, { getItem: key => values.get(key) ?? null, setItem: (key, value) => { if (fail) throw new Error("quota"); values.set(key, value); writes++; } });
  const ui = new HomeUI(root as unknown as HTMLElement, store, e => copies.push(e), () => null, (_canvas, _options) => {
    if (renderFail) throw new Error("Graphics unavailable");
    return { setEntries: e => snapshots.push(structuredClone(e)), setMarkers: m => markers.push(m), focus: p => focus.push(p), zoomBy() {}, interrupt() {}, destroy() { destroyed++; } };
  });
  const find = (id: string) => { const el = root.querySelector(`#${id}`); assert.ok(el, `Missing ${id}`); return el; };
  const click = (id: string) => find(id).dispatchEvent(new Event("click"));
  const ids = (snapshot: HomeEntries | undefined) => Object.fromEntries(Object.entries(snapshot ?? {}).map(([k, v]) => [k, v?.id ?? null]));
  return { ui, originals, snapshots, focus, markers, copies, find, click, ids, raw: () => values.get("home") ?? null, writes: () => writes, destroyed: () => destroyed,
    open: (placing: string | null = null) => ui.open(originals, opener as unknown as HTMLElement, placing),
    fail: (value: boolean) => { fail = value; }, renderFail: (value: boolean) => { renderFail = value; },
    finish() { ui.destroy(); if (previous) Object.defineProperty(globalThis, "document", previous); else Reflect.deleteProperty(globalThis, "document"); } };
}

test("visiting the room, approaching places and closing write nothing and leave kept art untouched", () => {
  const h = setup();
  try {
    const before = JSON.stringify(h.originals); h.open();
    assert.deepEqual(h.ids(h.snapshots.at(-1)), { tokonoma: "v", table: "c", shoin: "b", "shelf-low": null, "shelf-high": null, scroll: "c" });
    assert.equal(h.find("home-placing").hidden, true);
    h.click("home-place-tokonoma"); assert.equal(h.focus.at(-1), "tokonoma");
    assert.equal(h.find("home-actions").hidden, false);
    h.click("home-overview"); assert.equal(h.focus.at(-1), null);
    h.click("home-close");
    assert.equal(h.writes(), 0); assert.equal(JSON.stringify(h.originals), before); assert.equal(h.destroyed(), 1);
  } finally { h.finish(); }
});

test("a new keep is placed by choice: rings mark fit, a tight place refuses, and only references are saved", () => {
  const h = setup();
  try {
    h.open("a");
    assert.equal(h.find("home-placing").hidden, false);
    assert.equal(Object.values(h.ids(h.snapshots.at(-1))).includes("a"), false, "a first visit does not seed the piece being placed");
    assert.deepEqual(h.markers.at(-1), { tokonoma: "fits", table: "fits", shoin: "fits", "shelf-low": "fits", "shelf-high": "blocked" });
    h.click("home-place-shelf-high");
    assert.equal(h.find("home-place-here").disabled, true);
    assert.match(h.find("home-fit").textContent, /Too tall here/);
    h.click("home-place-shelf-low");
    assert.equal(h.find("home-place-here").disabled, false);
    h.click("home-place-here");
    assert.equal(h.find("home-placing").hidden, true);
    assert.equal(h.ids(h.snapshots.at(-1))["shelf-low"], "a");
    assert.equal(JSON.parse(h.raw()!).places["shelf-low"], "a");
    assert.equal(h.markers.at(-1), null, "rings clear once it is placed");
    assert.match(h.find("home-message").textContent, /lower shelf/);
  } finally { h.finish(); }
});

test("choosing a piece already out swaps places; returning one to the Garden deletes nothing", () => {
  const h = setup();
  try {
    h.open(); h.click("home-place-table"); h.click("home-choose");
    assert.equal(h.find("home-picker").hidden, false);
    assert.match(h.find("home-choice-b").querySelector("small")!.textContent, /will swap/);
    h.click("home-choice-b");
    assert.equal(h.find("home-picker").hidden, true);
    let placed = JSON.parse(h.raw()!).places;
    assert.equal(placed.table, "b"); assert.equal(placed.shoin, "c");
    h.click("home-clear");
    placed = JSON.parse(h.raw()!).places;
    assert.equal(placed.table, null);
    assert.equal(h.originals.length, 4);
    assert.match(h.find("home-message").textContent, /Nothing was deleted/);
  } finally { h.finish(); }
});

test("the scroll only takes moments kept with a photograph", () => {
  const h = setup();
  try {
    h.open(); h.click("home-place-scroll"); h.click("home-choose");
    assert.equal(h.find("home-choice-v").disabled, true);
    assert.match(h.find("home-choice-v").querySelector("small")!.textContent, /without a photograph/);
    h.click("home-choice-a");
    assert.equal(JSON.parse(h.raw()!).places.scroll, "a");
  } finally { h.finish(); }
});

test("a failed save keeps the room as it was; the working-copy path hands over a clone", () => {
  const h = setup();
  try {
    h.open(); h.click("home-place-table"); h.click("home-choose"); h.fail(true);
    const count = h.snapshots.length; h.click("home-choice-a");
    assert.equal(h.snapshots.length, count); assert.equal(h.raw(), null);
    assert.match(h.find("home-picker-message").textContent, /could not be saved/);
    h.fail(false); h.click("home-picker-close"); h.click("home-copy");
    assert.deepEqual(h.copies, [h.originals[2]]); assert.notEqual(h.copies[0], h.originals[2]);
    assert.equal(h.find("home-room").open, false);
  } finally { h.finish(); }
});

test("renderer failure leaves the Garden safe and can be retried", () => {
  const h = setup();
  try {
    h.renderFail(true); h.open(); assert.equal(h.find("home-scene-error").hidden, false);
    h.renderFail(false); h.click("home-retry");
    assert.equal(h.find("home-scene-error").hidden, true); assert.equal(h.writes(), 0);
  } finally { h.finish(); }
});

test("a piece placed in the tokonoma under a bare scroll hangs its own photograph", () => {
  const h = setup();
  try {
    h.open("a");
    h.click("home-place-scroll"); h.click("home-place-tokonoma");
    // First visit seeded the scroll from the newest photograph; take it down to start bare.
    h.ui.close(); h.open();
    h.click("home-place-scroll"); h.click("home-clear");
    h.ui.close(); h.open("a");
    h.click("home-place-tokonoma"); h.click("home-place-here");
    const placed = JSON.parse(h.raw()!).places;
    assert.equal(placed.tokonoma, "a"); assert.equal(placed.scroll, "a");
    assert.match(h.find("home-message").textContent, /photograph as the scroll/);
  } finally { h.finish(); }
});

test("a swap that would push a tall piece onto the upper shelf is refused and nothing is saved", () => {
  const h = setup();
  try {
    h.open();
    h.click("home-place-shelf-high"); h.click("home-choose"); h.click("home-choice-v"); // short violets up top
    h.click("home-place-shelf-low"); h.click("home-choose"); h.click("home-choice-a"); // tall branch below
    const saved = h.raw();
    h.click("home-choose");
    const choice = h.find("home-choice-v");
    assert.equal(choice.disabled, true, "choosing the violets here would move the branch up");
    assert.match(choice.querySelector("small")!.textContent, /would move “Moment a” to the upper shelf/);
    choice.disabled = false; h.click("home-choice-v"); // even if forced, the store refuses
    assert.equal(h.raw(), saved);
    assert.match(h.find("home-picker-message").textContent, /Too tall here/);
  } finally { h.finish(); }
});
