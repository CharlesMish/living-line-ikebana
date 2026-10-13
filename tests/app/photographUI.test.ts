import assert from "node:assert/strict";
import test from "node:test";
import { Photograph } from "../../src/app/photograph.ts";
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

function setup() {
  const document = new Document(), root = document.createElement("main");
  for (const id of ["more-options", "more-toggle"]) { const node = document.createElement("div"); node.id = id; root.append(node); }
  const keys = ["document", "navigator", "URL"];
  const originals = new Map(keys.map((key) => [key, Object.getOwnPropertyDescriptor(globalThis, key)]));
  const created: string[] = [], revoked: string[] = [], shares: ShareData[] = [];
  let shareResult: () => Promise<void> = async () => {};
  Object.defineProperties(globalThis, {
    document: { configurable: true, value: document },
    navigator: { configurable: true, value: { canShare: () => true, share: (data: ShareData) => { shares.push(data); return shareResult(); } } },
    URL: { configurable: true, value: { createObjectURL: () => { const url = `blob:image-${created.length}`; created.push(url); return url; }, revokeObjectURL: (url: string) => revoked.push(url) } },
  });
  const snapshot = createWorkbenchFixture("mixed", 8278, 2), original = JSON.stringify(snapshot);
  let pauses = 0, saves = 0, disposed = 0;
  const encoders: BlobCallback[] = [];
  const ui = new Photograph(root as unknown as HTMLElement, {
    pause: () => { pauses++; }, snapshot: () => structuredClone(snapshot), canKeep: () => true,
    keep: () => { saves++; return "saved"; },
  }, () => ({
    upsertGraph() {}, setPhotoStage() {}, setStemFibers() {}, setCanonicalView() {},
    getCameraPose: () => snapshot.camera, setCameraPose() {}, dispose: () => { disposed++; },
    capturePhotoFrame: (width, height) => ({ width, height, toBlob: (callback: BlobCallback) => encoders.push(callback) }) as HTMLCanvasElement,
  }));
  const find = (id: string) => { const node = root.querySelector(`#${id}`); assert.ok(node, id); return node; };
  const click = (id: string) => find(id).dispatchEvent(new Event("click", { cancelable: true }));
  click("photo-open");
  return {
    ui, find, click, encoders, created, revoked, shares, document,
    get saves() { return saves; }, get pauses() { return pauses; }, get disposed() { return disposed; },
    set shareResult(value: () => Promise<void>) { shareResult = value; },
    async finishEncode(index = encoders.length - 1, blob: Blob | null = new Blob(["PNG"], { type: "image/png" })) {
      encoders[index](blob); await new Promise((resolve) => setImmediate(resolve));
    },
    close() {
      assert.equal(JSON.stringify(snapshot), original, "photography cannot mutate the working snapshot");
      ui.destroy();
      for (const [key, descriptor] of originals) { if (descriptor) Object.defineProperty(globalThis, key, descriptor); else Reflect.deleteProperty(globalThis, key); }
    },
  };
}

test("production Photograph prepares a retained image, with explicit honest download and open actions", async () => {
  const h = setup();
  try {
    h.click("photo-export"); assert.equal(h.find("photo-export").disabled, true); await h.finishEncode();
    assert.equal(h.find("photo-result").hidden, false);
    assert.equal((h.find("photo-result-image") as unknown as HTMLImageElement).src, "blob:image-0");
    assert.equal((h.find("photo-download") as unknown as HTMLAnchorElement).download, "living-line-1600x1200.png");
    assert.match(h.find("photo-delivery-message").textContent, /not been saved/);
    assert.equal(h.document.activeElement, h.find("photo-download"));
    h.click("photo-download"); assert.match(h.find("photo-delivery-message").textContent, /Download requested/);
    assert.equal(h.find("photo-result").hidden, false); assert.deepEqual(h.revoked, []);
    h.find("photo-zoom").value = "1.2"; h.find("photo-zoom").dispatchEvent(new Event("input"));
    assert.match(h.find("photo-result-note").textContent, /earlier frame/);
    h.click("photo-open-image"); assert.match(h.find("photo-delivery-message").textContent, /Open requested/);
    h.click("photo-close"); assert.deepEqual(h.revoked, [], "an explicitly opened tab must keep its URL");
    assert.equal(h.saves, 0);
  } finally { h.close(); }
});

test("production Photograph cancels stale capture across close/reopen and frame changes", async () => {
  const h = setup();
  try {
    h.click("photo-export"); h.click("photo-close"); h.click("photo-open");
    await h.finishEncode(0); assert.equal(h.find("photo-result").hidden, true); assert.deepEqual(h.created, []);
    h.click("photo-export"); h.find("photo-horizontal").value = ".2"; h.find("photo-horizontal").dispatchEvent(new Event("input"));
    await h.finishEncode(1); assert.equal(h.find("photo-result").hidden, true); assert.deepEqual(h.created, []);
    assert.equal(h.find("photo-export").disabled, false); assert.match(h.find("photo-message").textContent, /Frame changed/);
    h.click("photo-export"); await h.finishEncode(2); assert.equal(h.find("photo-result").hidden, false);
    assert.equal(h.saves, 0);
  } finally { h.close(); }
});

test("context loss cancels encoding and blocks capture while retaining an earlier prepared PNG", async () => {
  const h = setup();
  try {
    h.click("photo-export"); await h.finishEncode(); h.click("photo-export");
    h.find("photo-canvas").dispatchEvent(new Event("webglcontextlost", { cancelable: true })); await h.finishEncode();
    assert.deepEqual(h.created, ["blob:image-0"]); assert.equal(h.find("photo-export").disabled, true);
    assert.equal(h.find("photo-keep").disabled, true); assert.equal(h.find("photo-result").hidden, false);
    assert.match(h.find("photo-message").textContent, /Graphics paused/);
    h.click("photo-close"); assert.deepEqual(h.revoked, ["blob:image-0"]);
  } finally { h.close(); }
});

test("share dismissal does not download, and a stale share result cannot write into a reopened dialog", async () => {
  const h = setup();
  try {
    h.click("photo-export"); await h.finishEncode();
    assert.equal(h.find("photo-share").hidden, false);
    h.shareResult = () => Promise.reject({ name: "AbortError" }); h.click("photo-share");
    await new Promise((resolve) => setImmediate(resolve));
    assert.match(h.find("photo-delivery-message").textContent, /Share cancelled/); assert.equal(h.find("photo-result").hidden, false);
    let done!: () => void; h.shareResult = () => new Promise((resolve) => { done = resolve; }); h.click("photo-share");
    assert.equal(h.shares.length, 2, "share is called inside the original click");
    h.click("photo-close"); h.click("photo-open"); done(); await new Promise((resolve) => setImmediate(resolve));
    assert.equal(h.find("photo-delivery-message").textContent, ""); assert.equal(h.find("photo-result").hidden, true);
    assert.equal(h.saves, 0);
  } finally { h.close(); }
});
