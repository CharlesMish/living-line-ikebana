import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { parseHTML } from "linkedom";
import type { ArrangementSnapshot } from "../../src/app/garden.ts";
import { GardenUI } from "../../src/app/gardenUI.ts";
import { mountInvitationCard } from "../../src/app/invitationCard.ts";
import { CLOSED_INVITATION, reduceInvitation } from "../../src/app/invitations.ts";
import { SceneGardenStore } from "../../src/app/scenePersistence.ts";
import { createWorkbenchFixture } from "../../src/app/workbench.ts";

function installDom() {
  const { window, document } = parseHTML("<!doctype html><html><body><main id=\"app\"></main></body></html>");
  const previous = {
    window: Object.getOwnPropertyDescriptor(globalThis, "window"),
    document: Object.getOwnPropertyDescriptor(globalThis, "document"),
    ResizeObserver: Object.getOwnPropertyDescriptor(globalThis, "ResizeObserver"),
  };
  Object.assign(globalThis, {
    window,
    document,
    ResizeObserver: class {
      observe() {}
      unobserve() {}
      disconnect() {}
    },
  });
  window.matchMedia = () => ({ matches: false, addEventListener() {}, removeEventListener() {} });
  const focus = () => {};
  if (typeof window.HTMLElement.prototype.focus !== "function") window.HTMLElement.prototype.focus = focus;
  return {
    window,
    document,
    restore() {
      for (const [key, descriptor] of Object.entries(previous) as [keyof typeof previous, PropertyDescriptor | undefined][]) {
        if (descriptor) Object.defineProperty(globalThis, key, descriptor);
        else Reflect.deleteProperty(globalThis, key);
      }
    },
  };
}

function armDialog(dialog: HTMLElement & { open?: boolean; showModal?: () => void; close?: () => void }, window: Window) {
  dialog.open = false;
  dialog.showModal = () => { dialog.open = true; };
  dialog.close = () => {
    if (!dialog.open) return;
    dialog.open = false;
    dialog.dispatchEvent(new window.Event("close"));
  };
}

test("Begin after Keep uses the fresh-bowl safeguard and Cancel leaves the bowl and Garden", () => {
  const dom = installDom();
  try {
    const root = dom.document.querySelector("#app")!;
    root.innerHTML = `<button id="garden-open" type="button"></button><button id="more-toggle" type="button"></button><p id="status"></p>`;
    const items = new Map<string, string>();
    const writes: string[] = [];
    const storage = {
      getItem: (key: string) => items.get(key) ?? null,
      setItem: (key: string, value: string) => { writes.push(key); items.set(key, value); },
    };
    const store = new SceneGardenStore("ikebana-web-alpha:garden-v2", "ikebana-web-alpha:garden-v1", storage);
    const bowl = createWorkbenchFixture("reed", 8278, 1);
    const replacements: Array<ArrangementSnapshot | null> = [];
    let declined = 0;
    let kept = 0;
    const ui = new GardenUI(root, store, {
      pause() {},
      snapshot: () => bowl,
      thumbnail: () => null,
      isViewing: () => false,
      view() {},
      returnToWork() {},
      replace(snapshot) { replacements.push(snapshot); },
      beginComparison() { throw new Error("not used"); },
      syncComparison(session) { return session; },
      endComparison() {},
    });
    ui.onKept = () => { kept += 1; };
    ui.onFreshBowlDeclined = () => { declined += 1; };
    armDialog(root.querySelector("#garden-dialog") as HTMLElement, dom.window);
    armDialog(root.querySelector("#garden-compare-dialog") as HTMLElement, dom.window);

    assert.equal(ui.entryCount(), 0);
    assert.deepEqual(writes, []);
    ui.open();
    const form = root.querySelector("#garden-keep-form")!;
    form.dispatchEvent(new dom.window.Event("submit", { bubbles: true, cancelable: true }));
    assert.equal(kept, 1);
    assert.equal(ui.entryCount(), 1);
    const gardenAfterKeep = store.exportRaw();
    const bowlAfterKeep = JSON.stringify(bowl);
    assert.match(gardenAfterKeep, /"gardenVersion":2/);
    assert.equal(replacements.length, 0);

    ui.startFreshBowl();
    const choice = root.querySelector<HTMLElement>("#garden-choice")!;
    assert.equal(choice.hidden, false);
    assert.equal(root.querySelector("#garden-choice-title")!.textContent, "What about your current bowl?");
    assert.equal(root.querySelector("#garden-replace")!.textContent, "Replace without keeping");
    assert.equal(replacements.length, 0);
    root.querySelector<HTMLButtonElement>("#garden-cancel-choice")!.click();
    assert.equal(declined, 1);
    assert.equal(choice.hidden, true);
    assert.equal(replacements.length, 0);
    assert.equal(store.exportRaw(), gardenAfterKeep);
    assert.equal(JSON.stringify(bowl), bowlAfterKeep);
    assert.equal(ui.entryCount(), 1);

    root.querySelector<HTMLButtonElement>("#garden-new")!.click();
    assert.equal(root.querySelector("#garden-choice-title")!.textContent, "What about your current bowl?");
    assert.equal(choice.hidden, false);
    root.querySelector<HTMLButtonElement>("#garden-cancel-choice")!.click();
    assert.equal(replacements.length, 0);
    assert.equal(store.exportRaw(), gardenAfterKeep);
    assert.equal(JSON.stringify(bowl), bowlAfterKeep);

    const source = readFileSync("src/app/gardenUI.ts", "utf8");
    assert.match(source, /on\("#garden-new", \(\) => this\.offerReplacement\(null\)\)/);
    assert.match(source, /startFreshBowl\(\): void \{\s*this\.run\(\(\) => this\.offerReplacement\(null\)\);/);
  } finally {
    dom.restore();
  }
});

test("the shared card is the same heading, sentence slot, and buttons for both flags", () => {
  const dom = installDom();
  try {
    const root = dom.document.querySelector("#app")!;
    root.innerHTML = `<p id="status"></p><div class="garden-tools"></div>`;
    let begins = 0;
    let anothers = 0;
    let dismisses = 0;
    const card = mountInvitationCard({
      onBegin: () => { begins += 1; },
      onAnother: () => { anothers += 1; },
      onNotNow: () => { dismisses += 1; },
    });
    const material = reduceInvitation(CLOSED_INVITATION, { type: "show-empty-bowl", gardenEntryCount: 2 }, "material");
    card.show(material.session, "material", "studio", {
      studio: root.querySelector("#status")!,
      garden: root.querySelector(".garden-tools"),
    });
    const element = root.querySelector<HTMLElement>("[data-invite-mode]")!;
    assert.equal(element.dataset.inviteMode, "material");
    assert.equal(element.dataset.inviteId, "arching-trailer");
    assert.equal(element.querySelector("h2")!.textContent, "An invitation");
    assert.equal(element.querySelector("p")!.textContent, "Something that falls instead of rises. Where does it land?");
    assert.deepEqual([...element.querySelectorAll("button")].map((button) => button.textContent), ["Begin", "Another", "Not now"]);
    const studioClass = element.className;
    element.querySelector<HTMLButtonElement>("[data-invite-action='another']")!.click();
    assert.equal(anothers, 1);

    const occasion = reduceInvitation(CLOSED_INVITATION, { type: "show-after-keep", gardenEntryCount: 2 }, "occasion");
    card.show(occasion.session, "occasion", "garden", {
      studio: root.querySelector("#status")!,
      garden: root.querySelector(".garden-tools"),
    });
    assert.equal(element.dataset.inviteMode, "occasion");
    assert.equal(element.dataset.inviteId, "quiet-reading-corner");
    assert.equal(element.querySelector("h2")!.textContent, "An invitation");
    assert.deepEqual([...element.querySelectorAll("button")].map((button) => button.textContent), ["Begin", "Another", "Not now"]);
    assert.equal(element.classList.contains("invitation-card"), true);
    assert.equal(studioClass.includes("invitation-card"), true);
    assert.equal(element.parentElement, root.querySelector(".garden-tools")!.parentElement);
    assert.equal(element.nextElementSibling, root.querySelector(".garden-tools"));
    element.querySelector<HTMLButtonElement>("[data-invite-action='begin']")!.click();
    element.querySelector<HTMLButtonElement>("[data-invite-action='not-now']")!.click();
    assert.equal(begins, 1);
    assert.equal(dismisses, 1);
    card.hide();
    assert.equal(root.querySelector("[data-invite-mode]"), null);
  } finally {
    dom.restore();
  }
});
