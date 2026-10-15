import assert from "node:assert/strict";
import test from "node:test";
import { DEFAULT_SCENE, withBotanicalTones, type SceneSettings } from "../../src/app/scene.ts";
import { Photograph } from "../../src/app/photograph.ts";
import { createWorkbenchFixture } from "../../src/app/workbench.ts";

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

function setup(scene?: SceneSettings) {
  const document = new Document(), root = document.createElement("main");
  for (const id of ["more-options", "more-toggle"]) { const node = document.createElement("div"); node.id = id; root.append(node); }
  const keys = ["document", "navigator", "URL"];
  const originals = new Map(keys.map((key) => [key, Object.getOwnPropertyDescriptor(globalThis, key)]));
  const created: string[] = [], revoked: string[] = [], shares: ShareData[] = [];
  let shareResult: () => Promise<void> = async () => {};
  let shareAvailable = true, keepError: Error | null = null;
  Object.defineProperties(globalThis, {
    document: { configurable: true, value: document },
    navigator: { configurable: true, value: { canShare: () => shareAvailable, share: (data: ShareData) => { shares.push(data); return shareResult(); } } },
    URL: { configurable: true, value: { createObjectURL: () => { const url = `blob:image-${created.length}`; created.push(url); return url; }, revokeObjectURL: (url: string) => revoked.push(url) } },
  });
  let snapshot = createWorkbenchFixture("mixed", 8278, 2);
  let context: number | null = 0, returns = 0;
  if (scene) snapshot.scene = scene;
  let original = JSON.stringify(snapshot);
  let pauses = 0, saves = 0, disposed = 0;
  const kept: unknown[] = [];
  const encoders: BlobCallback[] = [];
  const finishes: unknown[] = [];
  const lights: unknown[] = [];
  const captures: typeof snapshot.camera[] = [];
  const studios: { scene: SceneSettings; plants: unknown[]; pose: typeof snapshot.camera; disposed: boolean }[] = [];
  const ui = new Photograph(root as unknown as HTMLElement, {
    pause: () => { pauses++; }, snapshot: () => structuredClone(snapshot), context: () => context, returnToArrange: () => { if (context !== null) returns++; }, canKeep: () => context !== null,
    keep: (snapshot) => { if (keepError) throw keepError; saves++; kept.push(snapshot); return "saved"; },
  }, (_canvas, scene) => {
    const studio = { scene: structuredClone(scene), plants: [] as unknown[], pose: structuredClone(snapshot.camera), disposed: false }; studios.push(studio);
    return {
      upsertGraph(graph) { studio.plants.push(graph); }, setPhotoAdjustments(value) { finishes.push(value); }, setPhotoStage() {}, setPhotoLighting(value) { lights.push(value); }, setStemFibers() {}, setCanonicalView() {},
      getCameraPose: () => structuredClone(studio.pose), setCameraPose(pose) { studio.pose = structuredClone(pose); }, dispose: () => { disposed++; studio.disposed = true; },
      capturePhotoFrame: (width, height) => { captures.push(structuredClone(studio.pose)); return { width, height, toBlob: (callback: BlobCallback) => encoders.push(callback) } as HTMLCanvasElement; },
    };
  });
  const find = (id: string) => { const node = root.querySelector(`#${id}`); assert.ok(node, id); return node; };
  const click = (id: string) => find(id).dispatchEvent(new Event("click", { cancelable: true }));
  click("photo-open");
  return {
    ui, find, click, encoders, created, revoked, shares, document, finishes, lights, kept, studios, captures,
    set context(value: number | null) { context = value; },
    set snapshot(value: typeof snapshot) { snapshot = structuredClone(value); original = JSON.stringify(snapshot); },
    get returns() { return returns; },
    get saves() { return saves; }, get pauses() { return pauses; }, get disposed() { return disposed; },
    set shareResult(value: () => Promise<void>) { shareResult = value; },
    set shareAvailable(value: boolean) { shareAvailable = value; },
    set keepError(value: Error | null) { keepError = value; },
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

test("photo saving guidance only names Share image when the prepared file can be shared", async () => {
  const h = setup();
  try {
    for (const available of [false, true, false]) {
      h.shareAvailable = available;
      h.click("photo-export"); await h.finishEncode();
      assert.equal(h.find("photo-share").hidden, !available);
      h.click("photo-download");
      for (const id of ["photo-save-help", "photo-message", "photo-delivery-message"]) {
        const text = h.find(id).textContent;
        assert.equal(text.includes("Share image"), available, `${id} must match the available actions`);
        assert.match(text, /Open image/);
      }
      assert.equal(h.saves, 0); assert.equal(h.shares.length, 0);
    }
  } finally { h.close(); }
});

test("Garden Keep confirms success or failure outside the scrolling controls without moving the preview", () => {
  const h = setup();
  try {
    h.click("photo-tab-save");
    const controls = h.find("photo-controls"), canvas = h.find("photo-canvas"), status = h.find("photo-message");
    assert.equal(controls.querySelector("#photo-message"), null, "confirmation must not sit below the long Save panel");
    assert.equal(status.parentElement, controls.parentElement, "status belongs to the fixed tools area");
    assert.equal(status.getAttribute("role"), "status");
    controls.scrollTop = 120;
    h.find("photo-keep").focus(); h.click("photo-keep");
    assert.match(status.textContent, /Photo kept in Garden/); assert.equal(h.saves, 1);
    assert.equal(controls.scrollTop, 120); assert.equal(h.find("photo-canvas"), canvas);
    assert.equal(h.document.activeElement, h.find("photo-keep"), "confirmation does not steal focus");
    h.keepError = new Error("Garden is full. Download a backup before removing an entry.");
    h.click("photo-keep");
    assert.match(status.textContent, /Garden is full/); assert.doesNotMatch(status.textContent, /Photo kept/);
    assert.equal(h.saves, 1); assert.equal(controls.scrollTop, 120); assert.equal(h.find("photo-canvas"), canvas);
  } finally { h.close(); }
});


test("photo finish controls reach the renderer, invalidate pending PNGs, compare and reset without saving the working bowl", async () => {
  const h=setup();
  try {
    h.click("photo-export");
    h.find("photo-warmth").value=".4";h.find("photo-warmth").dispatchEvent(new Event("input"));
    assert.equal((h.finishes.at(-1) as {warmth:number}).warmth,.4);
    assert.equal(h.find("photo-warmth-value").textContent,"+40");
    await h.finishEncode();assert.equal(h.find("photo-result").hidden,true);
    h.click("photo-before");assert.equal(h.finishes.at(-1),undefined);assert.equal(h.find("photo-before").getAttribute("aria-pressed"),"true");
    h.click("photo-before");assert.equal((h.finishes.at(-1) as {warmth:number}).warmth,.4);
    h.click("photo-export");await h.finishEncode();assert.equal(h.find("photo-result").hidden,false);
    h.click("photo-reset-finish");assert.equal(h.find("photo-warmth").value,"0");assert.equal(h.find("photo-before").disabled,true);
    assert.match(h.find("photo-result-note").textContent,/earlier frame/);assert.equal(h.saves,0);
  } finally {h.close();}
});


test("Garden photo Keep persists the visible finish and a neutral comparison omits the recipe without touching the working bowl", () => {
 const h=setup();
 try {
  h.find("photo-exposure").value=".3";h.find("photo-exposure").dispatchEvent(new Event("input"));h.click("photo-keep");
  assert.equal(h.saves,1);
  const first=h.kept[0] as {scene:{sceneVersion:number;photoAdjustments?:{exposure:number}}};
  assert.equal(first.scene.sceneVersion,2);assert.equal(first.scene.photoAdjustments?.exposure,.3);
  h.click("photo-before");h.click("photo-keep");assert.equal(h.saves,2);
  const second=h.kept[1] as {scene:{sceneVersion:number;photoAdjustments?:unknown}};
  assert.equal(second.scene.sceneVersion,1);assert.equal(second.scene.photoAdjustments,undefined);
 } finally {h.close();}
});


test("Photograph Keep and finish reset preserve the bowl's botanical tone recipe", () => {
  const scene = withBotanicalTones(DEFAULT_SCENE, { "nodding-flower": "violet", "lobed-leaf": "ochre" });
  const h = setup(scene);
  try {
    h.find("photo-exposure").value = ".4"; h.find("photo-exposure").dispatchEvent(new Event("input"));
    h.click("photo-keep");
    const kept = h.kept.at(-1) as { scene: SceneSettings };
    assert.deepEqual(kept.scene.botanicalTones, scene.botanicalTones);
    assert.equal(kept.scene.photoAdjustments?.exposure, .4); assert.equal(kept.scene.sceneVersion, 2);
    h.click("photo-reset-finish"); h.click("photo-keep");
    const reset = h.kept.at(-1) as { scene: SceneSettings };
    assert.deepEqual(reset.scene.botanicalTones, scene.botanicalTones);
    assert.equal(reset.scene.photoAdjustments, undefined);
  } finally { h.close(); }
});

test("return to arranging remembers photo choices but reopens the latest plants, vessel and tones", () => {
  const h = setup();
  try {
    for (const [id, value] of [["photo-backdrop", "sage"], ["photo-perch", "bench"], ["photo-format", "portrait"], ["photo-zoom", "1.4"], ["photo-horizontal", ".6"], ["photo-warmth", ".3"]]) {
      h.find(id).value = value; h.find(id).dispatchEvent(new Event(id === "photo-zoom" || id === "photo-horizontal" || id === "photo-warmth" ? "input" : "change"));
    }
    h.find("photo-name").value = "After pruning";
    const pose = structuredClone(h.studios.at(-1)!.pose);
    h.click("photo-return"); assert.equal(h.returns, 1); assert.equal(h.find("photo-dialog").open, false);
    assert.equal(h.saves, 0); assert.equal(h.studios[0].disposed, true);
    const latest = createWorkbenchFixture("leafy-shoot", 9255, 1);
    latest.scene = withBotanicalTones({ ...DEFAULT_SCENE, colorId: "charcoal" }, { "lobed-leaf": "russet" });
    h.snapshot = latest; h.click("photo-open");
    assert.equal(h.find("photo-backdrop").value, "sage"); assert.equal(h.find("photo-perch").value, "bench");
    assert.equal(h.find("photo-format").value, "portrait"); assert.equal(h.find("photo-zoom").value, "1.4");
    assert.equal(h.find("photo-horizontal").value, "0.6"); assert.equal(h.find("photo-warmth").value, "0.3");
    assert.equal(h.find("photo-name").value, "After pruning"); assert.deepEqual(h.studios.at(-1)!.pose, pose);
    assert.equal(h.studios.at(-1)!.plants.length, 1); assert.deepEqual(h.studios.at(-1)!.scene, latest.scene);
    assert.match(h.find("photo-message").textContent, /latest committed cuttings/);
    h.click("photo-keep");
    const kept = h.kept.at(-1) as { plants: unknown; scene: SceneSettings };
    assert.deepEqual(kept.plants, latest.plants); assert.equal(kept.scene.colorId, "charcoal");
    assert.deepEqual(kept.scene.botanicalTones, latest.scene.botanicalTones); assert.equal(kept.scene.backdropId, "sage");
  } finally { h.close(); }
});

test("visual backdrop choices start with the working scene, preserve a customized draft, and reset explicitly to the latest bowl", () => {
  const h = setup({ ...DEFAULT_SCENE, backdropId: "hills" });
  try {
    assert.equal(h.find("photo-backdrop-choice-hills").getAttribute("aria-pressed"), "true");
    assert.equal(h.find("photo-backdrop").value, "hills");
    h.click("photo-backdrop-choice-clay");
    assert.equal(h.find("photo-backdrop").value, "clay");
    assert.equal(h.find("photo-backdrop-choice-clay").getAttribute("aria-pressed"), "true");
    assert.equal(h.find("photo-backdrop-choice-hills").getAttribute("aria-pressed"), "false");
    h.click("photo-return");
    const latest = createWorkbenchFixture("mixed", 8278, 2); latest.scene = { ...DEFAULT_SCENE, backdropId: "garden" };
    h.snapshot = latest; h.click("photo-open");
    assert.equal(h.find("photo-backdrop").value, "clay", "changing arranging backdrop cannot replace an existing photo setup");
    h.click("photo-reset-setup");
    assert.equal(h.find("photo-backdrop").value, "garden");
    assert.equal(h.find("photo-backdrop-choice-garden").getAttribute("aria-pressed"), "true");
    h.click("photo-backdrop-choice-transparent");
    assert.equal(h.find("photo-perch").disabled, true);
    h.click("photo-return"); h.context = 1; h.click("photo-open");
    assert.equal(h.find("photo-backdrop").value, "garden", "a new working bowl starts from its scene rather than the old draft");
    assert.equal(h.find("photo-perch").disabled, false); assert.equal(h.saves, 0);
  } finally { h.close(); }
});

test("read-only Garden photographs neither receive nor overwrite the working bowl setup", () => {
  const h = setup();
  try {
    h.find("photo-backdrop").value = "sage"; h.find("photo-backdrop").dispatchEvent(new Event("change"));
    h.click("photo-close"); h.context = null;
    const kept = createWorkbenchFixture("leafy-shoot", 9255, 1); kept.scene = { ...DEFAULT_SCENE, backdropId: "dusk" };
    h.snapshot = kept; h.click("photo-open");
    assert.equal(h.find("photo-backdrop").value, "dusk"); assert.equal(h.find("photo-return").textContent, "Return to viewing");
    assert.equal(h.find("photo-keep").disabled, true);
    h.find("photo-backdrop").value = "ink"; h.find("photo-backdrop").dispatchEvent(new Event("change"));
    h.click("photo-reset-setup"); assert.equal(h.find("photo-backdrop").value, "dusk");
    h.click("photo-return"); assert.equal(h.returns, 0);
    h.context = 0; h.snapshot = createWorkbenchFixture("mixed", 8278, 2); h.click("photo-open");
    assert.equal(h.find("photo-backdrop").value, "sage"); assert.equal(h.saves, 0);
  } finally { h.close(); }
});

test("new bowl context and explicit Reset photo setup clear the draft without writing a save", () => {
  const h = setup();
  try {
    h.find("photo-backdrop").value = "sage"; h.find("photo-backdrop").dispatchEvent(new Event("change"));
    h.find("photo-zoom").value = "1.6"; h.find("photo-zoom").dispatchEvent(new Event("input"));
    h.click("photo-close"); h.context = 1;
    const fresh = createWorkbenchFixture("mixed", 8278, 1); fresh.plants = [];
    h.snapshot = fresh; h.click("photo-open");
    assert.equal(h.find("photo-backdrop").value, "paper"); assert.equal(h.find("photo-zoom").value, "1");
    assert.equal(h.studios.at(-1)!.plants.length, 0); assert.equal(h.find("photo-keep").disabled, true);
    h.find("photo-backdrop").value = "ink"; h.find("photo-backdrop").dispatchEvent(new Event("change"));
    h.find("photo-exposure").value = ".8"; h.find("photo-exposure").dispatchEvent(new Event("input"));
    h.click("photo-reset-setup");
    assert.equal(h.find("photo-backdrop").value, "paper"); assert.equal(h.find("photo-exposure").value, "0");
    h.click("photo-close"); h.click("photo-open"); assert.equal(h.find("photo-backdrop").value, "paper");
    assert.equal(h.saves, 0);
  } finally { h.close(); }
});

test("graphics-loss reopen restores setup and original comparison without reviving a stale PNG", async () => {
  const h = setup();
  try {
    h.find("photo-warmth").value = ".5"; h.find("photo-warmth").dispatchEvent(new Event("input"));
    h.click("photo-before"); h.click("photo-export");
    h.find("photo-canvas").dispatchEvent(new Event("webglcontextlost", { cancelable: true }));
    h.click("photo-close"); h.click("photo-open"); await h.finishEncode();
    assert.equal(h.find("photo-warmth").value, "0.5"); assert.equal(h.find("photo-before").getAttribute("aria-pressed"), "true");
    assert.equal(h.finishes.at(-1), undefined); assert.equal(h.find("photo-result").hidden, true); assert.equal(h.find("photo-export").disabled, false);
    assert.equal(h.saves, 0);
  } finally { h.close(); }
});

test("lighting and angle controls invalidate stale images, survive return, and Keep stores the rendered camera once", async () => {
  const h = setup();
  try {
    assert.equal(h.find("photo-lighting").value, "studio");
    assert.equal(h.find("photo-zoom").getAttribute("min"), "0.55");
    assert.equal(h.find("photo-zoom").getAttribute("max"), "4.8");
    h.click("photo-export");
    h.find("photo-lighting").value = "window"; h.find("photo-lighting").dispatchEvent(new Event("change"));
    assert.equal(h.lights.at(-1), "window"); await h.finishEncode();
    assert.equal(h.find("photo-result").hidden, true);
    for (const [id, value] of [["yaw", "24"], ["pitch", "10"], ["roll", "7.5"], ["horizontal", "3.2"], ["zoom", ".7"]]) {
      h.find(`photo-${id}`).value = value; h.find(`photo-${id}`).dispatchEvent(new Event("input"));
    }
    assert.equal(h.find("photo-roll-value").textContent, "+7.5°");
    const pose = structuredClone(h.studios.at(-1)!.pose);
    h.find("photo-roll").dispatchEvent(new Event("input")); assert.deepEqual(h.studios.at(-1)!.pose, pose, "angle changes derive from the immutable reference");
    h.click("photo-return"); h.click("photo-open");
    assert.equal(h.find("photo-lighting").value, "window"); assert.equal(h.find("photo-yaw").value, "24");
    assert.equal(h.find("photo-pitch").value, "10"); assert.equal(h.find("photo-roll").value, "7.5");
    assert.deepEqual(h.studios.at(-1)!.pose, pose);
    h.click("photo-keep");
    const kept = h.kept.at(-1) as { scene: SceneSettings; camera: typeof pose };
    assert.equal(kept.scene.photoLighting, "window"); assert.equal(kept.scene.sceneVersion, 2); assert.deepEqual(kept.camera, pose);
    h.click("photo-close"); h.context = 1;
    const copied = createWorkbenchFixture("mixed", 8278, 2); copied.scene = kept.scene; copied.camera = kept.camera;
    h.snapshot = copied; h.click("photo-open");
    assert.equal(h.find("photo-yaw").value, "0"); assert.equal(h.find("photo-roll").value, "0");
    assert.deepEqual(h.studios.at(-1)!.pose, pose, "saved roll is already in the camera and must not be applied twice");
    assert.equal(h.find("photo-lighting").value, "window");
    h.click("photo-keep"); assert.deepEqual((h.kept.at(-1) as {camera: typeof pose}).camera, pose);
  } finally { h.close(); }
});

test("Reset framing clears all six offsets without resetting lighting or Finish", () => {
  const h = setup();
  try {
    const originalPose = structuredClone(h.studios.at(-1)!.pose);
    h.find("photo-lighting").value = "evening"; h.find("photo-lighting").dispatchEvent(new Event("change"));
    h.find("photo-warmth").value = ".2"; h.find("photo-warmth").dispatchEvent(new Event("input"));
    for (const [id, value] of [["zoom", "1.8"], ["horizontal", "2.4"], ["vertical", "2.2"], ["yaw", "20"], ["pitch", "-6"], ["roll", "-5"]]) {
      h.find(`photo-${id}`).value = value; h.find(`photo-${id}`).dispatchEvent(new Event("input"));
    }
    h.click("photo-reset"); assert.deepEqual(h.studios.at(-1)!.pose, originalPose);
    assert.equal(h.find("photo-zoom").value, "1");
    for (const id of ["horizontal", "vertical", "yaw", "pitch", "roll"]) assert.equal(h.find(`photo-${id}`).value, "0");
    assert.equal(h.find("photo-lighting").value, "evening"); assert.equal(h.find("photo-warmth").value, ".2");
    h.click("photo-reset-setup"); assert.equal(h.find("photo-lighting").value, "studio"); assert.equal(h.find("photo-warmth").value, "0");
    assert.equal(h.saves, 0);
  } finally { h.close(); }
});


test("Photograph tabs isolate scrolling controls from the persistent preview and prepared image", async () => {
  const h = setup();
  try {
    const controls = h.find("photo-controls"), canvas = h.find("photo-canvas");
    assert.equal(controls.querySelector("#photo-canvas"), null);
    assert.equal(h.find("photo-panel-save").querySelector("#photo-result"), h.find("photo-result"));
    assert.equal(h.find("photo-panel-scene").hidden, false);
    h.click("photo-tab-finish");
    assert.equal(h.find("photo-panel-scene").hidden, true); assert.equal(h.find("photo-panel-finish").hidden, false);
    assert.equal(h.find("photo-tab-finish").getAttribute("aria-selected"), "true");
    assert.equal(h.find("photo-tab-finish").getAttribute("tabindex"), "0");
    controls.scrollTop = 600;
    h.find("photo-warmth").value = ".4"; h.find("photo-warmth").dispatchEvent(new Event("input"));
    assert.equal(controls.scrollTop, 600, "editing a slider cannot jump its scroll position");
    assert.equal(h.find("photo-canvas"), canvas, "switching panels keeps the same live renderer");
    h.click("photo-tab-save"); assert.equal(controls.scrollTop, 0);
    h.click("photo-export"); await h.finishEncode();
    assert.equal(h.find("photo-result").hidden, false); assert.equal(h.find("photo-panel-save").hidden, false);
    h.click("photo-tab-finish");
    assert.equal(h.find("photo-panel-save").hidden, true); assert.equal(h.find("photo-canvas"), canvas);
    assert.deepEqual(h.revoked, [], "switching tabs does not discard the prepared PNG");
    assert.equal(h.saves, 0);
  } finally { h.close(); }
});

test("Photograph tabs support keyboard traversal without changing the scene", () => {
  const h = setup();
  try {
    const key = (id: string, value: string) => {
      const event = new Event("keydown", { cancelable: true }); Object.defineProperty(event, "key", { value });
      h.find(id).dispatchEvent(event); assert.equal(event.defaultPrevented, true);
    };
    key("photo-tab-scene", "ArrowLeft"); assert.equal(h.document.activeElement, h.find("photo-tab-save"));
    key("photo-tab-save", "Home"); assert.equal(h.document.activeElement, h.find("photo-tab-scene"));
    key("photo-tab-scene", "ArrowRight"); assert.equal(h.document.activeElement, h.find("photo-tab-frame"));
    key("photo-tab-frame", "End"); assert.equal(h.document.activeElement, h.find("photo-tab-save"));
    assert.equal(h.find("photo-panel-save").hidden, false); assert.equal(h.find("photo-panel-frame").hidden, true);
    assert.equal(h.saves, 0);
  } finally { h.close(); }
});

test("Saturation places neutral in the slider centre while retaining existing recipe limits", () => {
  const h = setup();
  try {
    const control = h.find("photo-saturation");
    assert.equal(control.getAttribute("min"), "-1"); assert.equal(control.getAttribute("max"), "1"); assert.equal(control.value, "0");
    for (const [slider, expected] of [[-1, -1], [-.5, -.5], [0, 0], [.5, .3], [1, .6]]) {
      control.value = String(slider); control.dispatchEvent(new Event("input")); h.click("photo-keep");
      assert.equal((h.kept.at(-1) as {scene: SceneSettings}).scene.photoAdjustments?.saturation ?? 0, expected);
    }
    h.click("photo-reset-finish"); assert.equal(control.value, "0"); h.click("photo-keep");
    assert.equal((h.kept.at(-1) as {scene: SceneSettings}).scene.photoAdjustments, undefined);
  } finally { h.close(); }
});

test("an untouched saved saturation remains exact through other controls, Keep and draft resume", () => {
  const recipe = { version: 1 as const, exposure: 0, contrast: 0, warmth: 0, saturation: .123456789012345, vignette: 0 };
  const h = setup({ ...DEFAULT_SCENE, sceneVersion: 2, photoAdjustments: recipe });
  try {
    assert.equal(Number(h.find("photo-saturation").value), recipe.saturation / .6);
    h.find("photo-warmth").value = ".2"; h.find("photo-warmth").dispatchEvent(new Event("input"));
    h.click("photo-keep"); assert.equal((h.kept.at(-1) as {scene: SceneSettings}).scene.photoAdjustments?.saturation, recipe.saturation);
    h.click("photo-return"); h.click("photo-open"); h.click("photo-keep");
    assert.equal((h.kept.at(-1) as {scene: SceneSettings}).scene.photoAdjustments?.saturation, recipe.saturation);
  } finally { h.close(); }
});

test("Close detail is explicit, prepares and keeps the same camera, resumes, and Whole view restores the reference", async () => {
  const h = setup();
  const pointer = (type: string, x = 490, y = 260, id = 1) => h.find("photo-canvas").dispatchEvent(Object.assign(new Event(type), {pointerId:id,clientX:x,clientY:y,button:0,isPrimary:true}));
  try {
    const initial = structuredClone(h.studios.at(-1)!.pose);
    h.click("photo-tab-frame"); h.click("photo-detail");
    assert.equal(h.find("photo-detail").getAttribute("aria-pressed"), "true");
    assert.deepEqual(h.studios.at(-1)!.pose, initial, "arming alone does not move the camera");
    pointer("pointerdown"); pointer("pointerup");
    const close = structuredClone(h.studios.at(-1)!.pose);
    assert.notDeepEqual(close, initial); assert.equal(h.find("photo-zoom").value, "3.5");
    assert.equal(h.find("photo-detail").getAttribute("aria-pressed"), "false");
    assert.equal(h.saves, 0);
    h.click("photo-export"); await h.finishEncode(); assert.deepEqual(h.captures.at(-1), close);
    h.click("photo-keep"); assert.deepEqual((h.kept.at(-1) as {camera:typeof close}).camera, close);
    h.click("photo-return"); h.click("photo-open");
    assert.deepEqual(h.studios.at(-1)!.pose, close);
    h.click("photo-tab-frame"); h.click("photo-reset");
    assert.deepEqual(h.studios.at(-1)!.pose, initial);
    assert.equal(h.find("photo-zoom").value, "1");
    assert.equal(h.saves, 1, "only explicit Keep writes the Garden");
  } finally { h.close(); }
});

test("detail selection ignores drags, interruptions, another pointer and changing preview dimensions", () => {
  const h = setup();
  const pointer = (type: string, x = 490, y = 260, id = 1) => h.find("photo-canvas").dispatchEvent(Object.assign(new Event(type), {pointerId:id,clientX:x,clientY:y,button:0,isPrimary:true}));
  try {
    const initial = structuredClone(h.studios.at(-1)!.pose);
    h.click("photo-tab-frame"); h.click("photo-detail");
    pointer("pointerdown"); pointer("pointermove",520); pointer("pointerup");
    assert.deepEqual(h.studios.at(-1)!.pose, initial);
    pointer("pointerdown"); pointer("pointercancel"); pointer("pointerup");
    assert.deepEqual(h.studios.at(-1)!.pose, initial);
    pointer("pointerdown"); pointer("pointerup",490,260,2); pointer("pointerup");
    assert.deepEqual(h.studios.at(-1)!.pose, initial);
    pointer("pointerdown"); h.find("photo-canvas").rect.width = 700; pointer("pointerup");
    assert.deepEqual(h.studios.at(-1)!.pose, initial);
    const escape = new Event("cancel", {cancelable:true}); h.find("photo-dialog").dispatchEvent(escape);
    assert.equal(escape.defaultPrevented, true); assert.equal(h.find("photo-dialog").open, true);
    assert.equal(h.find("photo-detail").getAttribute("aria-pressed"), "false");
    h.click("photo-detail"); pointer("pointerdown"); h.click("photo-tab-finish"); pointer("pointerup");
    assert.deepEqual(h.studios.at(-1)!.pose, initial);
    h.click("photo-tab-frame"); h.click("photo-detail"); pointer("pointerdown");
    h.document.hidden = true; h.document.dispatchEvent(new Event("visibilitychange")); pointer("pointerup");
    assert.deepEqual(h.studios.at(-1)!.pose, initial); assert.equal(h.saves, 0);
  } finally { h.close(); }
});
