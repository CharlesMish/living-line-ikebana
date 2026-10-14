import assert from "node:assert/strict";
import test from "node:test";
import { GardenUI } from "../../src/app/gardenUI.ts";
import { GardenStore, type ArrangementSnapshot, type GardenEntry } from "../../src/app/garden.ts";
import { createWorkbenchFixture } from "../../src/app/workbench.ts";

// A small DOM adapter for the production UI's event paths. It does not implement
// layout or paint; browser/phone checks are still needed for the CSS presentation.
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

const kept = (id: string, title: string): GardenEntry => ({
  id, title, keptAt: "2026-10-12T00:00:00.000Z", thumbnail: null,
  arrangement: createWorkbenchFixture("mixed", 8278, 2),
});

function setup(entries: GardenEntry[] = [kept("a", "First"), kept("b", "Second")]) {
  const document = new Document(), root = document.createElement("main");
  for (const id of ["garden-open", "more-toggle"]) { const button = document.createElement("button"); button.id = id; root.append(button); }
  const originals = new Map(["document", "window", "ResizeObserver", "requestAnimationFrame"].map((key) => [key, Object.getOwnPropertyDescriptor(globalThis, key)]));
  const window = Object.assign(new EventTarget(), { matchMedia: () => Object.assign(new EventTarget(), { matches: false }) });
  Object.defineProperties(globalThis, {
    document: { configurable: true, value: document }, window: { configurable: true, value: window },
    ResizeObserver: { configurable: true, value: class { observe() {} disconnect() {} } },
    requestAnimationFrame: { configurable: true, value: () => 1 },
  });
  let raw: string | null = null, writes = 0, fail = false;
  const store = new GardenStore("test", { getItem: () => raw, setItem: (_key, value) => { if (fail) throw new Error("quota"); raw = value; writes++; } });
  store.load(); for (const entry of entries.toReversed()) store.keep(entry);
  writes = 0;
  let working = createWorkbenchFixture("leafy-shoot", 9255, 1), viewing = false, pauses = 0;
  const replacements: (ArrangementSnapshot | null)[] = [], views: string[] = [];
  const ui = new GardenUI(root as unknown as HTMLElement, store, {
    pause() { pauses++; }, snapshot() { return structuredClone(working); }, thumbnail: () => null,
    isViewing: () => viewing, view(entry) { viewing = true; views.push(entry.id); }, returnToWork() { viewing = false; },
    replace(snapshot) { replacements.push(snapshot); working = snapshot ? structuredClone(snapshot) : { ...working, plants: [] }; },
    beginComparison() { throw new Error("This test does not render comparison canvases."); },
    syncComparison: (session) => session, endComparison() {},
  });
  const find = (selector: string) => { const element = root.querySelector(selector); assert.ok(element, `Missing ${selector}`); return element; };
  return {
    ui, root, document, find, store, replacements, views,
    get writes() { return writes; }, get pauses() { return pauses; }, set fail(value: boolean) { fail = value; },
    emptyWorking() { working = { ...working, plants: [] }; },
    corruptGarden() { raw = '{"gardenVersion":999,"keep":"recoverable"}'; },
    close() {
      ui.destroy();
      for (const [key, descriptor] of originals) { if (descriptor) Object.defineProperty(globalThis, key, descriptor); else Reflect.deleteProperty(globalThis, key); }
    },
  };
}

function click(element: Element) { element.dispatchEvent(new Event("click", { cancelable: true })); }

test("Garden card copy uses replacement safeguards and never changes its saved original", () => {
  const h = setup();
  try {
    h.ui.open(); const before = h.store.exportRaw();
    click(h.find(".garden-card-copy"));
    assert.equal(h.find("#garden-choice").hidden, false);
    assert.equal(h.replacements.length, 0);
    click(h.find("#garden-cancel-choice"));
    assert.equal(h.find("#garden-choice").hidden, true);
    assert.equal(h.replacements.length, 0);
    click(h.find(".garden-card-copy")); click(h.find("#garden-replace"));
    assert.deepEqual(h.replacements, [JSON.parse(before).entries[0].arrangement]);
    assert.equal(h.store.exportRaw(), before);
    assert.equal(h.writes, 0);
  } finally { h.close(); }
});

test("failed Keep-first on a card copy keeps the working bowl available and does not replace it", () => {
  const h = setup();
  try {
    h.ui.open(); click(h.find(".garden-card-copy")); h.fail = true;
    click(h.find("#garden-keep-first"));
    assert.equal(h.replacements.length, 0);
    assert.equal(h.find("#garden-choice").hidden, false);
    assert.match(h.find("#garden-error").textContent, /could not be saved/);
    assert.equal(h.writes, 0);
  } finally { h.close(); }
});

test("Keep shows and focuses the new moment without replacing the working bowl", () => {
  const h = setup();
  try {
    h.ui.open(); h.find("#garden-name").value = "Room to breathe";
    h.find("#garden-keep-form").dispatchEvent(new Event("submit", { cancelable: true }));
    const card = h.find(".garden-card-just-kept");
    assert.equal(card.querySelector("strong")!.textContent, "Room to breathe");
    assert.equal(h.document.activeElement, card.querySelector(".garden-card-view"));
    assert.equal(h.store.load().entries[0].title, "Room to breathe");
    assert.equal(h.writes, 1);
    assert.equal(h.replacements.length, 0);
    assert.match(h.find("#garden-error").textContent, /^Kept\./);
  } finally { h.close(); }
});

test("Compare selection keeps focus on the chosen card and makes the next choice explicit", () => {
  const h = setup();
  try {
    h.ui.open(); const raw = h.store.exportRaw();
    click(h.find(".garden-compare-toggle"));
    assert.equal(h.find("#garden-compare-status").textContent, "One selected. Choose one more moment.");
    assert.equal(h.document.activeElement, h.find(".garden-compare-toggle"));
    click(h.root.querySelectorAll(".garden-compare-toggle")[1]);
    assert.equal(h.find("#garden-compare-go").disabled, false);
    assert.equal(h.document.activeElement, h.root.querySelectorAll(".garden-compare-toggle")[1]);
    assert.equal(h.store.exportRaw(), raw);
    assert.equal(h.writes, 0);
  } finally { h.close(); }
});

test("an empty working bowl puts saved moments first; view stays read-only and Remove stays confirmed", () => {
  const h = setup();
  try {
    h.emptyWorking(); h.ui.open();
    assert.equal(h.find("#garden-keep-form").hidden, true);
    click(h.find(".garden-card-view"));
    assert.deepEqual(h.views, ["a"]);
    assert.equal(h.root.dataset.gardenViewing, "true");
    assert.equal(h.writes, 0);
    h.ui.open(); click(h.find(".garden-remove"));
    assert.equal(h.store.load().entries.length, 2);
    click(h.find("#garden-cancel-choice"));
    assert.equal(h.writes, 0);
    click(h.find(".garden-remove")); click(h.find("#garden-replace"));
    assert.equal(h.store.load().entries.length, 1);
    assert.equal(h.writes, 1);
  } finally { h.close(); }
});

test("unreadable Garden opens backup recovery and leaves the stored bytes untouched", () => {
  const h = setup();
  try {
    h.corruptGarden(); const raw = h.store.exportRaw(); h.ui.open();
    assert.equal(h.find("#garden-backups").open, true);
    assert.equal(h.find("#garden-export").disabled, false);
    assert.equal(h.find("#garden-import").disabled, true);
    assert.equal(h.find("#garden-keep").disabled, true);
    assert.match(h.find("#garden-error").textContent, /stored data is untouched/);
    assert.equal(h.store.exportRaw(), raw);
    assert.equal(h.writes, 0);
  } finally { h.close(); }
});

test("Print wall displays kept pixels, switches finishes and opens the saved original without writes", () => {
  const first = { ...kept("a", "Autumn <b>light</b>"), thumbnail: "data:image/jpeg;base64,QUJD" };
  const h = setup([first, kept("b", "No cover")]);
  try {
    h.ui.open(); const before = h.store.exportRaw();
    click(h.find("#garden-wall-open"));
    assert.equal(h.find("#garden-wall").open, true);
    assert.equal(h.root.querySelectorAll(".wall-print").length, 1);
    assert.equal(h.find(".wall-caption strong").textContent, first.title);
    assert.equal(h.find("#wall-count").textContent, "1 kept view");
    click(h.find("#wall-paper"));
    assert.equal(h.find("#garden-wall").dataset.finish, "paper");
    assert.equal(h.find("#wall-paper").getAttribute("aria-pressed"), "true");
    click(h.find(".wall-print"));
    assert.equal(h.find("#wall-collection").hidden, true);
    assert.equal(h.find("#wall-detail").hidden, false);
    assert.equal(h.find("#wall-detail-title").textContent, first.title);
    const cancel = new Event("cancel", { cancelable: true }); h.find("#garden-wall").dispatchEvent(cancel);
    assert.equal(cancel.defaultPrevented, true);
    assert.equal(h.find("#wall-detail").hidden, true);
    assert.equal(h.document.activeElement, h.find(".wall-print"));
    click(h.find(".wall-print")); click(h.find("#wall-view"));
    assert.deepEqual(h.views, ["a"]);
    assert.equal(h.find("#garden-wall").open, false);
    assert.equal(h.find("#garden-dialog").open, false);
    assert.equal(h.store.exportRaw(), before);
    assert.equal(h.writes, 0);
    assert.equal(h.replacements.length, 0);
  } finally { h.close(); }
});

test("empty print wall gives a keep path; closing restores focus and preserves the bowl", () => {
  const h = setup([]);
  try {
    h.ui.open(); click(h.find("#garden-wall-open"));
    assert.match(h.find(".wall-empty").textContent, /Keep photo in Garden/);
    click(h.find("#wall-close"));
    assert.equal(h.document.activeElement, h.find("#garden-wall-open"));
    assert.equal(h.find("#garden-dialog").open, true);
    assert.equal(h.writes, 0);
    assert.equal(h.views.length, 0);
  } finally { h.close(); }
});
