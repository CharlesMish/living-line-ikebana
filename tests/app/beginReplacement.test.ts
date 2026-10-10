import assert from "node:assert/strict";
import test from "node:test";
import { beginLineSnapshot } from "../../src/app/beginLines.ts";
import { canonicalCameraPose } from "../../src/app/camera.ts";
import { GardenUI, type GardenActions } from "../../src/app/gardenUI.ts";

class El extends EventTarget {
  id = "";
  className = "";
  hidden = false;
  disabled = false;
  open = false;
  textContent = "";
  value = "";
  dataset: Record<string, string> = {};
  children: El[] = [];
  constructor(readonly tag = "div") { super(); }
  set innerHTML(html: string) {
    this.children = [];
    for (const match of html.matchAll(/<([a-z0-9]+)([^>]*?)>/gi)) {
      const attrs = match[2] ?? "";
      const child = new El(match[1].toLowerCase());
      child.id = attrs.match(/\bid="([^"]+)"/)?.[1] ?? "";
      child.className = attrs.match(/\bclass="([^"]+)"/)?.[1] ?? "";
      if (/(?:^|\s)hidden(?:\s|=|>|$)/.test(attrs) || /\shidden(?:\s|>|$)/.test(attrs) || attrs.trim() === "hidden") child.hidden = true;
      this.children.push(child);
    }
  }
  get innerHTML() { return ""; }
  append(...nodes: El[]) { this.children.push(...nodes); }
  replaceChildren(...nodes: El[]) { this.children = nodes; }
  focus() {}
  showModal() { this.open = true; }
  close() {
    this.open = false;
    queueMicrotask(() => this.dispatchEvent(new Event("close")));
  }
  setAttribute(name: string, value: string) {
    if (name === "id") this.id = value;
    if (name === "class") this.className = value;
  }
  querySelector(selector: string): El | null {
    if (selector === "#garden-choice p") {
      const choice = this.querySelector("#garden-choice");
      if (!choice) return null;
      let paragraph = choice.children.find((child) => child.tag === "p") ?? null;
      if (!paragraph) {
        paragraph = new El("p");
        choice.children.push(paragraph);
      }
      return paragraph;
    }
    const walk = (node: El): El | null => {
      const hit = selector.startsWith("#")
        ? node.id === selector.slice(1)
        : selector.startsWith(".")
          ? node.className.split(/\s+/).includes(selector.slice(1))
          : false;
      if (hit) return node;
      for (const child of node.children) {
        const found = walk(child);
        if (found) return found;
      }
      return null;
    };
    return walk(this);
  }
  querySelectorAll() { return []; }
}

test("a non-empty bowl asks before replacement and an async close still settles once", async () => {
  const previousWindow = globalThis.window;
  const previousDocument = globalThis.document;
  const previousObserver = globalThis.ResizeObserver;
  const root = new El("main");
  root.dataset = {};
  const toggle = new El("button");
  toggle.id = "more-toggle";
  const opener = new El("button");
  opener.id = "garden-open";
  root.append(toggle, opener);
  const replaced: unknown[] = [];
  const settled: boolean[] = [];
  const kept: string[] = [];
  const flush = () => new Promise((resolve) => setTimeout(resolve, 0));
  const working = {
    plants: [{ id: "plant-9" }],
    successfulPlantOrdinal: 3,
    camera: canonicalCameraPose("front"),
  };
  globalThis.ResizeObserver = class {
    observe() {}
    disconnect() {}
    unobserve() {}
  } as unknown as typeof ResizeObserver;
  globalThis.window = {
    matchMedia: () => ({ matches: false, addEventListener() {}, removeEventListener() {} }),
    addEventListener() {},
    removeEventListener() {},
  } as unknown as Window & typeof globalThis;
  globalThis.document = {
    createElement: (tag: string) => new El(tag),
    addEventListener() {},
    removeEventListener() {},
  } as unknown as Document;
  try {
    const actions: GardenActions = {
      pause() {},
      snapshot: () => working as unknown as ReturnType<GardenActions["snapshot"]>,
      thumbnail: () => null,
      isViewing: () => false,
      view() {},
      returnToWork() {},
      replace: (snapshot) => { replaced.push(snapshot); },
      replacementSettled: (applied) => { settled.push(applied); },
      beginComparison: () => { throw new Error("not used"); },
      syncComparison: (value) => value,
      endComparison() {},
    };
    const garden = new GardenUI(root as unknown as HTMLElement, {
      load: () => ({ entries: [] }),
      exportRaw: () => "{}",
      keep(entry) { kept.push(entry.title); },
      remove() {},
      importBackup: () => 0,
    }, actions);
    assert.ok(root.querySelector(".looking-study"));
    const incoming = beginLineSnapshot("lean-left");
    garden.offerBowlReplacement(incoming);
    const choice = root.querySelector("#garden-choice");
    assert.ok(choice);
    assert.equal(choice.hidden, false);
    assert.equal(root.querySelector("#garden-choice-title")?.textContent, "What about your current bowl?");
    assert.equal(replaced.length, 0);
    assert.equal(working.plants[0].id, "plant-9");
    root.querySelector("#garden-cancel-choice")?.dispatchEvent(new Event("click"));
    await flush();
    assert.equal(replaced.length, 0);
    assert.equal(choice.hidden, true);
    assert.deepEqual(settled, [false]);
    assert.equal(working.plants[0].id, "plant-9");

    garden.offerBowlReplacement(incoming);
    root.querySelector("#garden-replace")?.dispatchEvent(new Event("click"));
    await flush();
    assert.equal(replaced.length, 1);
    assert.equal((replaced[0] as { plants: { id: string }[] }).plants[0].id, "plant-1");
    assert.deepEqual(settled, [false, true]);

    garden.offerBowlReplacement(incoming);
    root.querySelector("#garden-keep-first")?.dispatchEvent(new Event("click"));
    await flush();
    assert.equal(kept.length, 1);
    assert.equal(replaced.length, 2);
    assert.deepEqual(settled, [false, true, true]);

    const empty = { ...working, plants: [] as { id: string }[] };
    actions.snapshot = () => empty as unknown as ReturnType<GardenActions["snapshot"]>;
    garden.offerBowlReplacement(incoming);
    await flush();
    assert.equal(replaced.length, 3);
    assert.equal((replaced[2] as { plants: { id: string }[] }).plants[0].id, "plant-1");
    assert.deepEqual(settled, [false, true, true, true]);
    assert.equal(empty.plants.length, 0);
    assert.equal(settled.filter((applied) => applied === false).length, 1);

    const quiet = new El("main");
    quiet.dataset = {};
    const quietToggle = new El("button");
    quietToggle.id = "more-toggle";
    const quietOpener = new El("button");
    quietOpener.id = "garden-open";
    quiet.append(quietToggle, quietOpener);
    new GardenUI(quiet as unknown as HTMLElement, {
      load: () => ({ entries: [] }),
      exportRaw: () => "{}",
      keep() {},
      remove() {},
      importBackup: () => 0,
    }, actions, false, true);
    assert.equal(quiet.querySelector(".looking-study"), null);
    assert.equal(quiet.textContent.includes("study"), false);
  } finally {
    globalThis.window = previousWindow;
    globalThis.document = previousDocument;
    globalThis.ResizeObserver = previousObserver;
  }
});
