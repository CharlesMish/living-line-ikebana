import assert from "node:assert/strict";
import test from "node:test";
import { BackdropPicker } from "../../src/app/backdropPicker.ts";
import { WorkingBackdropUI } from "../../src/app/workingBackdropUI.ts";
import { atmosphericBackdropPixel } from "../../src/presentation/atmosphericBackdrops.ts";
import { PHOTO_BACKDROPS, PHOTO_COLORS, type PhotoBackdrop } from "../../src/presentation/photoStage.ts";

// A small DOM adapter for the production UI's event paths. It does not implement
// layout or paint; browser/phone checks are still needed for the CSS presentation.
class Element extends EventTarget {
  children: Element[] = [];
  parentElement: Element | null = null;
  attributes = new Map<string, string>();
  dataset: Record<string, string> = {};
  style: Record<string, unknown> & { setProperty(name: string, value: string): void } = { setProperty(name, value) { this[name] = value; } };
  scrollTop = 0;
  className = "";
  id = "";
  textContent = "";
  value = "";
  hidden = false;
  disabled = false;
  open = false;
  type = "";
  rect = { left: 10, top: 20, width: 800, height: 600 };
  getBoundingClientRect() { return { ...this.rect, right: this.rect.left + this.rect.width, bottom: this.rect.top + this.rect.height }; }
  get classList() { return { add: (name: string) => { this.className += ` ${name}`; } }; }
  constructor(readonly ownerDocument: Document, readonly tagName: string) { super(); }
  setAttribute(name: string, value: string) {
    this.attributes.set(name, value);
    if (name === "value") this.value = value;
    if (name === "class") this.className = value;
    if (name === "id") this.id = value;
    if (name === "hidden") this.hidden = true;
    if (name === "disabled") this.disabled = true;
    if (name.startsWith("data-")) this.dataset[name.slice(5).replace(/-([a-z])/g, (_, letter) => letter.toUpperCase())] = value;
  }
  removeAttribute(name: string) { this.attributes.delete(name); Reflect.deleteProperty(this, name); }
  getAttribute(name: string) { return this.attributes.get(name) ?? null; }
  append(...children: Element[]) {
    for (const child of children) { child.parentElement = this; this.children.push(child); if (this.tagName === "select" && this.children.length === 1) this.value = child.value; }
  }
  remove() {
    if (this.parentElement) this.parentElement.children = this.parentElement.children.filter((child) => child !== this);
    this.parentElement = null;
  }
  replaceChildren(...children: Element[]) { for (const child of this.children) child.parentElement = null; this.children = []; this.append(...children); }
  focus() { this.ownerDocument.activeElement = this; }
  getContext() { return {fillStyle:"",fillRect(){},drawImage(){}}; }
  toDataURL() { return "data:image/jpeg;base64," + "A".repeat(80); }
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


function harness() {
  const document = new Document(), root = document.createElement("main");
  for (const id of ["more-options", "more-toggle"]) { const node = document.createElement("div"); node.id = id; root.append(node); }
  const previous = Object.getOwnPropertyDescriptor(globalThis, "document");
  Object.defineProperty(globalThis, "document", { configurable: true, value: document });
  return { document, root, done() { if (previous) Object.defineProperty(globalThis, "document", previous); else Reflect.deleteProperty(globalThis, "document"); } };
}

test("backdrop tiles offer labeled scene colors, true scenic samples, and Photograph-only transparency", () => {
  const h = harness();
  const chosen: PhotoBackdrop[] = [];
  const working = new BackdropPicker("working", "paper", false, id => chosen.push(id));
  const photo = new BackdropPicker("photo", "paper", true, id => chosen.push(id));
  try {
    assert.equal(working.element.children.length, 8); assert.equal(photo.element.children.length, 9);
    assert.equal(working.element.querySelector("#working-choice-transparent"), null);
    assert.ok(photo.element.querySelector("#photo-choice-transparent"));
    for (const item of PHOTO_BACKDROPS.filter(item => item.id !== "transparent")) {
      const button = working.element.querySelector(`#working-choice-${item.id}`)!;
      assert.equal(button.getAttribute("aria-label"), item.label);
      assert.equal(button.getAttribute("aria-pressed"), String(item.id === "paper"));
      assert.equal(button.type, "button");
      const sample = button.querySelector(".backdrop-sample") as unknown as Element;
      assert.match(String(sample.style.background), new RegExp(PHOTO_COLORS[item.id].wall.toString(16)));
      if (item.id === "hills" || item.id === "garden") assert.ok(sample.querySelector("canvas"));
    }
    working.element.querySelector("#working-choice-paper")!.dispatchEvent(new Event("click"));
    assert.deepEqual(chosen, [], "already selected backdrop does not save again");
    working.element.querySelector("#working-choice-sage")!.dispatchEvent(new Event("click"));
    assert.deepEqual(chosen, ["sage"]);
    assert.equal(working.element.querySelector("#working-choice-paper")!.getAttribute("aria-pressed"), "true", "a requested choice is not accepted until its owner confirms it");
    working.update("sage");
    assert.equal(working.element.querySelector("#working-choice-sage")!.getAttribute("aria-pressed"), "true");
    working.update("sage", false);
    working.element.querySelector("#working-choice-clay")!.dispatchEvent(new Event("click"));
    assert.deepEqual(chosen, ["sage"]);
    assert.equal((working.element.querySelector("#working-choice-clay") as HTMLButtonElement).disabled, true);
  } finally { working.destroy(); photo.destroy(); h.done(); }
});

test("scenic swatches sample the renderer's procedural image using its centred cover crop", async () => {
  const { paintScenicBackdrop } = await import("../../src/app/backdropPicker.ts");
  for (const id of ["hills", "garden"] as const) {
    const painted: { color: string; x: number; y: number }[] = [];
    const context = { fillStyle: "", fillRect(x: number, y: number, w: number, h: number) { assert.equal(w, 1); assert.equal(h, 1); painted.push({color: this.fillStyle, x, y}); } };
    const canvas = { width: 0, height: 0, getContext: () => context };
    paintScenicBackdrop(canvas as unknown as HTMLCanvasElement, id);
    assert.equal(painted.length, 80 * 50);
    for (const index of [0, 37, 1984, 3999]) {
      const pixel = painted[index];
      const expected = atmosphericBackdropPixel(id, pixel.x / 79, .1875 + pixel.y / 49 * .625).map(Math.round);
      assert.equal(pixel.color, `rgb(${expected.join(",")})`);
    }
  }
});

test("working backdrop opens after cancellation, retains failed selection, closes without reverting, and disables in Garden viewing", () => {
  const h = harness(), changes: PhotoBackdrop[] = [], sequence: string[] = [];
  let current: PhotoBackdrop = "paper", accept = true;
  const ui = new WorkingBackdropUI(h.root as unknown as HTMLElement, current, () => {
    assert.equal(h.root.querySelector("#working-backdrop-dialog")!.open, false); sequence.push("cancel");
  }, id => {
    changes.push(id); if (accept) current = id;
    ui.update(current, true); ui.message(accept ? "Saved" : "Could not save");
  });
  const find = (id: string) => h.root.querySelector(`#${id}`)!;
  const click = (id: string) => find(id).dispatchEvent(new Event("click"));
  try {
    click("working-backdrop-open"); assert.deepEqual(sequence, ["cancel"]); assert.equal(find("working-backdrop-dialog").open, true);
    assert.deepEqual(changes, []);
    click("working-backdrop-choice-sage"); assert.equal(current, "sage");
    accept = false; click("working-backdrop-choice-dusk");
    assert.equal(find("working-backdrop-choice-sage").getAttribute("aria-pressed"), "true");
    assert.equal(find("working-backdrop-choice-dusk").getAttribute("aria-pressed"), "false");
    assert.equal(find("working-backdrop-message").textContent, "Could not save");
    click("working-backdrop-close"); assert.equal(current, "sage"); assert.equal(h.document.activeElement, find("more-toggle"));
    ui.update("sage", false); assert.equal(find("working-backdrop-open").disabled, true);
    click("working-backdrop-open"); click("working-backdrop-choice-ink");
    assert.equal(find("working-backdrop-dialog").open, false); assert.deepEqual(changes, ["sage", "dusk"]);
  } finally { ui.destroy(); assert.equal(h.root.querySelector("#working-backdrop-dialog"), null); h.done(); }
});
