import assert from "node:assert/strict";
import test from "node:test";
import { BotanicalTonesUI } from "../../src/app/botanicalTonesUI.ts";
import type { BotanicalTones } from "../../src/presentation/botanicalTones.ts";

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
    for (const child of children) { child.remove(); child.parentElement = this; this.children.push(child); if (this.tagName === "select" && this.children.length === 1) this.value = child.value; }
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
      if (!token[0].endsWith("/>") && !["input", "img", "br", "hr"].includes(tag)) stack.push(element);
    }
  }
}
class Document extends EventTarget {
  activeElement: Element | null = null;
  hidden = false;
  createElement(tag: string) { return new Element(this, tag); }
}

function setup() {
  const document = new Document(), root = document.createElement("main");
  for (const id of ["more-options", "more-toggle"]) { const el = document.createElement("div"); el.id = id; root.append(el); }
  const original = Object.getOwnPropertyDescriptor(globalThis, "document");
  Object.defineProperty(globalThis, "document", { configurable: true, value: document });
  let versions = ["lobed-leaf-v1", "lobed-leaf-v1", "compact-flower-v1", "reed-v1"];
  let value: BotanicalTones | undefined, accept = true, pauses = 0;
  const changes: (BotanicalTones | undefined)[] = [];
  const ui = new BotanicalTonesUI(root as unknown as HTMLElement, value, () => { pauses++; }, (next) => {
    changes.push(next);
    if (accept) value = next;
    ui.update(value, true);
  }, () => versions);
  const find = (id: string) => { const el = root.querySelector(`#${id}`); assert.ok(el, id); return el; };
  const click = (id: string) => find(id).dispatchEvent(new Event("click", { cancelable: true }));
  const families = (id: string) => find(id).children.map(el => el.dataset.family);
  return {
    ui, find, click, families, changes, document,
    get pauses() { return pauses; }, get value() { return value; },
    set versions(next: string[]) { versions = next; }, set accept(next: boolean) { accept = next; },
    close() { ui.destroy(); if (original) Object.defineProperty(globalThis, "document", original); else Reflect.deleteProperty(globalThis, "document"); },
  };
}

test("production tones chooser presents current materials first and all three visual choices", () => {
  const h = setup();
  try {
    h.click("botanical-tones-open");
    assert.equal(h.pauses, 1); assert.equal(h.find("botanical-tones-dialog").open, true);
    assert.deepEqual(h.families("botanical-tones-current"), ["compact-flower", "lobed-leaf"]);
    assert.equal(h.families("botanical-tones-more").length, 13);
    assert.equal(h.find("botanical-tones-empty").hidden, true);
    assert.equal(h.find("botanical-tones-current").querySelector(".botanical-tone-count")!.textContent, "1 in bowl");
    for (const id of ["natural", "ochre", "russet"]) {
      const button = h.find(`botanical-tone-lobed-leaf-${id}`);
      assert.ok(button.querySelector("svg"));
      assert.equal(button.querySelectorAll(".botanical-tone-swatches").length, 1);
      assert.equal(button.getAttribute("aria-pressed"), String(id === "natural"));
      assert.ok(button.getAttribute("aria-label")!.includes("Lobed-leaf branch"));
    }
    h.click("botanical-tone-lobed-leaf-natural");
    assert.equal(h.changes.length, 0, "selected choice does not cause a redundant save");
    h.click("botanical-tones-close");
    assert.equal(h.document.activeElement, h.find("more-toggle"));
    h.versions = ["berry-twig-v1"];
    h.click("botanical-tones-open");
    assert.deepEqual(h.families("botanical-tones-current"), ["berry-twig"]);
    assert.equal(h.families("botanical-tones-more").length, 14);
  } finally { h.close(); }
});

test("tone buttons preserve other families, reset Natural correctly and respect a failed save", () => {
  const h = setup();
  try {
    h.click("botanical-tone-lobed-leaf-russet");
    h.click("botanical-tone-compact-flower-ivory");
    assert.deepEqual(h.value, { "lobed-leaf": "russet", "compact-flower": "ivory" });
    assert.equal(h.find("botanical-tone-lobed-leaf-russet").getAttribute("aria-pressed"), "true");
    h.accept = false;
    h.click("botanical-tone-lobed-leaf-ochre");
    assert.equal(h.find("botanical-tone-lobed-leaf-ochre").getAttribute("aria-pressed"), "false");
    assert.equal(h.find("botanical-tone-lobed-leaf-russet").getAttribute("aria-pressed"), "true");
    h.accept = true;
    h.click("botanical-tone-lobed-leaf-natural");
    assert.deepEqual(h.value, { "compact-flower": "ivory" });
    h.click("botanical-tones-reset");
    assert.equal(h.value, undefined);
    assert.equal(h.find("botanical-tones-reset").disabled, true);
    assert.equal(h.find("botanical-tone-compact-flower-natural").getAttribute("aria-pressed"), "true");
  } finally { h.close(); }
});

test("empty bowls disclose the other choices; read-only state cannot change tones", () => {
  const h = setup();
  try {
    h.versions = ["reed-v1", "arching-trailer-v1"];
    h.click("botanical-tones-open");
    assert.deepEqual(h.families("botanical-tones-current"), []);
    assert.equal(h.find("botanical-tones-empty").hidden, false);
    h.click("botanical-tones-close");
    h.ui.update({ "lobed-leaf": "ochre" }, false);
    assert.equal(h.find("botanical-tones-open").disabled, true);
    assert.equal(h.find("botanical-tone-lobed-leaf-russet").disabled, true);
    h.click("botanical-tones-open"); h.click("botanical-tone-lobed-leaf-russet"); h.click("botanical-tones-reset");
    assert.equal(h.changes.length, 0); assert.equal(h.pauses, 1);
  } finally { h.close(); }
});
