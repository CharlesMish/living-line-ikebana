import assert from "node:assert/strict";
import test from "node:test";
import { BeginCard } from "../../src/app/beginCard.ts";

class Node0 extends EventTarget {
  id = "";
  hidden = false;
  textContent = "";
  className = "";
  dataset: Record<string, string> = {};
  attrs = new Map<string, string>();
  children: Node0[] = [];
  parentElement: Node0 | null = null;
  constructor(readonly tag = "div") { super(); }
  set innerHTML(html: string) {
    this.children = [];
    for (const match of html.matchAll(/<([a-z0-9]+)([^>]*?)>/gi)) {
      const child = new Node0(match[1].toLowerCase());
      const attrs = match[2] ?? "";
      child.id = attrs.match(/\bid="([^"]+)"/)?.[1] ?? "";
      child.className = attrs.match(/\bclass="([^"]+)"/)?.[1] ?? "";
      child.parentElement = this;
      this.children.push(child);
    }
  }
  get innerHTML() { return ""; }
  setAttribute(name: string, value: string) { this.attrs.set(name, value); }
  getAttribute(name: string) { return this.attrs.get(name) ?? null; }
  append(...nodes: Node0[]) {
    for (const node of nodes) {
      node.parentElement?.remove(node);
      node.parentElement = this;
      this.children.push(node);
    }
  }
  insertBefore(node: Node0, before: Node0) {
    node.parentElement?.remove(node);
    node.parentElement = this;
    const index = this.children.indexOf(before);
    this.children.splice(index < 0 ? this.children.length : index, 0, node);
  }
  remove(node: Node0) {
    this.children = this.children.filter((child) => child !== node);
    node.parentElement = null;
  }
  querySelector(selector: string): Node0 | null {
    const walk = (node: Node0): Node0 | null => {
      const hit = selector.startsWith("#")
        ? node.id === selector.slice(1)
        : selector.startsWith(".") && node.className.split(/\s+/).includes(selector.slice(1));
      if (hit) return node;
      for (const child of node.children) {
        const found = walk(child);
        if (found) return found;
      }
      return null;
    };
    for (const child of this.children) {
      const found = walk(child);
      if (found) return found;
    }
    return null;
  }
}

test("the after-Keep card moves into the Garden and back without changing its controls", () => {
  const previousDocument = globalThis.document;
  globalThis.document = { createElement: (tag: string) => new Node0(tag) } as unknown as Document;
  try {
    const parent = new Node0("main");
    const garden = new Node0("div");
    const calls: string[] = [];
    const card = new BeginCard(parent as unknown as HTMLElement, new AbortController().signal, {
      begin: (surface) => calls.push(`begin:${surface}`),
      another: (surface) => calls.push(`another:${surface}`),
      notNow: (surface) => calls.push(`not-now:${surface}`),
      stop: () => calls.push("stop"),
      toggleNote: () => calls.push("note"),
      presentation: () => calls.push("presentation"),
    });
    const offer = card.offer as unknown as Node0;
    const stack = offer.parentElement!;
    card.showOffer({ surface: "after-keep", text: "Next", accept: "Begin", another: "Another" });
    card.placeIn(garden as unknown as HTMLElement);
    assert.equal(offer.parentElement, garden);
    assert.equal(offer.dataset.place, "garden");
    assert.equal(card.surface(), "after-keep");
    const stopBlock = offer.querySelector(".begin-stop")!;
    assert.equal(stopBlock.hidden, false);
    offer.querySelector("#begin-stop")!.dispatchEvent(new Event("click", { cancelable: true }));
    offer.querySelector("#begin-dismiss")!.dispatchEvent(new Event("click", { cancelable: true }));
    assert.deepEqual(calls, ["stop", "not-now:after-keep"]);
    card.placeIn(null);
    assert.equal(offer.parentElement, stack);
    assert.equal(stack.children[0], offer, "the offer goes back before the note");
    assert.equal(offer.dataset.place, "bowl");
    const visible = [offer.querySelector(".begin-stop p"), offer.querySelector("#begin-stop"), offer.querySelector("#begin-dismiss")];
    for (const element of visible) assert.equal(/study/i.test(element?.textContent ?? ""), false);
  } finally {
    globalThis.document = previousDocument;
  }
});
