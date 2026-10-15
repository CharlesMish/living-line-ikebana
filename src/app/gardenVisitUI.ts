import type { GardenEntry } from "./garden.ts";
import { GardenDisplayStore, recentGardenDisplay, resolveGardenDisplay, type GardenDisplayEntries, type GardenDisplaySlots } from "./gardenDisplay.ts";
import { GardenVisitStudio } from "../presentation/GardenVisitStudio.ts";
import "./gardenVisit.css";

export interface GardenVisitView {
  setEntries(entries: GardenDisplayEntries): void;
  focus(index: number | null): void;
  resetView(): void;
  zoomBy(factor: number): void;
  interrupt(): void;
  destroy(): void;
}
type VisitFactory = (canvas: HTMLCanvasElement, options: { onSelect(index: number): void; onError(message: string): void; onWarning(message: string): void }) => GardenVisitView;
const POSITIONS = ["Left", "Centre", "Right"];

/** Disposable gallery: all botany is read-only, only display references can save. */
export class GardenVisitUI {
  private readonly dialog: HTMLDialogElement;
  private readonly abort = new AbortController();
  private view: GardenVisitView | null = null;
  private entries: GardenEntry[] = [];
  private slots: GardenDisplaySlots = [null, null, null];
  private selected: number | null = null;
  private editable = true;
  private opener: HTMLElement | null = null;
  private closing = false;

  constructor(root: HTMLElement, private readonly store: GardenDisplayStore,
    private readonly copy: (entry: GardenEntry) => void,
    private readonly createView: VisitFactory = (canvas, options) => new GardenVisitStudio(canvas, options)) {
    this.dialog = document.createElement("dialog");
    this.dialog.id = "garden-visit";
    this.dialog.className = "garden-visit";
    this.dialog.setAttribute("aria-labelledby", "visit-title");
    this.dialog.innerHTML = `
      <header class="visit-heading"><div><p class="eyebrow">Your work, together</p><h1 id="visit-title">Visit your Garden</h1></div><button id="visit-close" type="button">Back to Garden</button></header>
      <div class="visit-stage">
        <canvas id="garden-visit-canvas" aria-label="Three saved arrangements and their framed photographs" tabindex="0"></canvas>
        <div id="visit-scene-error" class="visit-scene-error" hidden><p>The garden view is unavailable. Your saved work is safe.</p><button id="visit-retry" type="button">Try the view again</button></div>
        <section id="visit-print-panel" class="visit-print-panel" role="dialog" aria-modal="true" hidden aria-labelledby="visit-print-title"><header><h2 id="visit-print-title">Kept photograph</h2><button id="visit-print-close" type="button">Back to the garden</button></header><img id="visit-print-image" alt=""/><p>Your kept photograph. The arrangement beside it lives in the garden’s shared light.</p></section>
        <section id="visit-picker" class="visit-picker" role="dialog" aria-modal="true" hidden aria-labelledby="visit-picker-title"><header><div><p class="eyebrow">Choose a kept moment</p><h2 id="visit-picker-title">On display</h2></div><button id="visit-picker-close" type="button">Done</button></header><p id="visit-picker-message" class="visit-message" role="status" aria-live="polite"></p><div id="visit-choices" class="visit-choices"></div><button id="visit-empty" type="button">Leave this position empty</button><p class="panel-note">Choosing a moment already on display swaps its position. Your saved arrangements stay untouched.</p></section>
      </div>
      <footer class="visit-controls">
        <nav class="visit-positions" aria-label="Garden positions"><button id="visit-overview" type="button" aria-pressed="true">Overview</button>${POSITIONS.map((name, index) => `<button id="visit-position-${index}" type="button" aria-pressed="false"><span>${name}</span><strong id="visit-label-${index}">Empty position</strong></button>`).join("")}</nav>
        <div class="visit-caption"><div><p id="visit-selected-title">A place for your kept moments</p><p id="visit-help">Tap a piece to approach it. Drag to look around.</p></div><div class="visit-zoom"><button id="visit-zoom-out" type="button" aria-label="Move farther away">−</button><button id="visit-zoom-in" type="button" aria-label="Move closer">+</button></div></div>
        <div id="visit-piece-actions" class="visit-piece-actions" hidden><button id="visit-change" type="button">Choose moment</button><button id="visit-print" type="button">View photograph</button><button id="visit-copy" type="button">Make a working copy</button></div>
        <p id="visit-message" class="visit-message" role="status" aria-live="polite"></p>
      </footer>`;
    root.append(this.dialog);
    const on = (id: string, fn: () => void) => this.find(id).addEventListener("click", () => this.run(fn), { signal: this.abort.signal });
    on("visit-close", () => this.dialog.close());
    on("visit-overview", () => this.select(null));
    POSITIONS.forEach((_, index) => on(`visit-position-${index}`, () => this.select(index)));
    on("visit-zoom-in", () => this.view?.zoomBy(.88));
    on("visit-zoom-out", () => this.view?.zoomBy(1.14));
    on("visit-change", () => this.showPicker());
    on("visit-picker-close", () => this.hidePicker());
    on("visit-empty", () => this.choose(null));
    on("visit-print", () => this.showPrint());
    on("visit-print-close", () => this.hidePrint());
    on("visit-retry", () => this.buildView());
    on("visit-copy", () => {
      const entry = this.currentEntry();
      if (!entry) return;
      this.close();
      this.copy(structuredClone(entry));
    });
    this.dialog.addEventListener("cancel", event => {
      if (!this.find("visit-picker").hidden) { event.preventDefault(); this.hidePicker(); }
      else if (!this.find("visit-print-panel").hidden) { event.preventDefault(); this.hidePrint(); }
    }, { signal: this.abort.signal });
    this.dialog.addEventListener("keydown", event => {
      if (event.key !== "Tab") return;
      const panel = !this.find("visit-picker").hidden ? this.find("visit-picker") : !this.find("visit-print-panel").hidden ? this.find("visit-print-panel") : null;
      if (!panel) return;
      const buttons = [...panel.querySelectorAll<HTMLButtonElement>("button:not(:disabled)")];
      const first = buttons[0], last = buttons.at(-1);
      if (event.shiftKey && this.dialog.ownerDocument.activeElement === first) { event.preventDefault(); last?.focus(); }
      else if (!event.shiftKey && this.dialog.ownerDocument.activeElement === last) { event.preventDefault(); first?.focus(); }
    }, { signal: this.abort.signal });
    this.dialog.addEventListener("close", () => {
      this.releaseView();
      this.opener?.focus();
    }, { signal: this.abort.signal });
  }

  private find<T extends HTMLElement = HTMLElement>(id: string): T { return this.dialog.querySelector<T>(`#${id}`)!; }
  private run(fn: () => void) { try { fn(); } catch (error) { this.message(error instanceof Error ? error.message : String(error)); } }
  private message(value: string) {
    this.find("visit-message").textContent = value;
    // The footer is inert while this picker is open, so its failure message
    // must also be available inside the active panel's accessibility tree.
    this.find("visit-picker-message").textContent = !this.find("visit-picker").hidden ? value : "";
  }
  private currentEntry() { return this.selected === null ? null : resolveGardenDisplay(this.slots, this.entries)[this.selected]; }

  open(entries: readonly GardenEntry[], opener: HTMLElement) {
    this.entries = structuredClone([...entries]);
    this.opener = opener;
    this.editable = true;
    this.message("");
    try { this.slots = this.store.load(this.entries); }
    catch {
      this.editable = false;
      this.slots = recentGardenDisplay(this.entries);
      this.message("Your saved display choices could not be read. Showing recent moments for this visit; existing choices are untouched.");
    }
    this.selected = null;
    this.find("visit-picker").hidden = true;
    this.find("visit-print-panel").hidden = true;
    this.overlay(false);
    this.dialog.showModal();
    this.updateLabels();
    this.buildView();
    this.find("visit-close").focus();
  }

  private buildView() {
    this.releaseView();
    this.find("visit-scene-error").hidden = true;
    try {
      this.view = this.createView(this.find<HTMLCanvasElement>("garden-visit-canvas"), {
        onSelect: index => this.run(() => this.select(index)),
        onError: message => {
          this.message(message);
          this.find("visit-scene-error").hidden = false;
        },
        onWarning: message => this.message(message),
      });
      this.view.setEntries(resolveGardenDisplay(this.slots, this.entries));
      this.view.focus(this.selected);
    } catch (error) {
      this.releaseView();
      this.find("visit-scene-error").hidden = false;
      this.message(error instanceof Error ? error.message : "The Garden view could not be opened.");
    }
  }

  private select(index: number | null) {
    if (index !== null && (!Number.isInteger(index) || index < 0 || index > 2)) return;
    this.selected = index;
    this.find("visit-picker").hidden = true;
    this.find("visit-print-panel").hidden = true;
    this.overlay(false);
    this.view?.focus(index);
    this.updateLabels();
  }

  private updateLabels() {
    const displayed = resolveGardenDisplay(this.slots, this.entries);
    POSITIONS.forEach((position, index) => {
      const entry = displayed[index], button = this.find(`visit-position-${index}`);
      button.dataset.entryId = entry?.id ?? "";
      button.setAttribute("aria-pressed", String(this.selected === index));
      button.setAttribute("aria-label", `${position}: ${entry?.title || (entry ? "Untitled arrangement" : "Empty position")}`);
      this.find(`visit-label-${index}`).textContent = entry?.title || (entry ? "Untitled arrangement" : "Empty position");
    });
    this.find("visit-overview").setAttribute("aria-pressed", String(this.selected === null));
    const entry = this.currentEntry();
    this.find("visit-selected-title").textContent = this.selected === null ? (this.entries.length ? "Your arrangements, in one place" : "A place for your first kept arrangement") : entry?.title || (entry ? "Untitled arrangement" : `${POSITIONS[this.selected]} position`);
    this.find("visit-help").textContent = this.selected === null
      ? (this.entries.length ? "Tap a piece to approach it. Drag to look around." : "Keep an arrangement in Garden, then choose a position for it here.")
      : entry ? "Saved original · drag to look around; + and − move closer or farther." : "Choose one of your kept moments to place here.";
    this.find("visit-piece-actions").hidden = this.selected === null;
    this.find<HTMLButtonElement>("visit-change").disabled = !this.editable;
    this.find<HTMLButtonElement>("visit-print").disabled = !entry?.thumbnail;
    this.find<HTMLButtonElement>("visit-copy").disabled = !entry;
    this.find("visit-print").textContent = entry && !entry.thumbnail ? "No photograph kept" : "View photograph";
  }

  private showPicker() {
    if (this.selected === null || !this.editable) return;
    this.view?.interrupt();
    this.find("visit-picker-message").textContent = "";
    this.find("visit-picker-title").textContent = `${POSITIONS[this.selected]} position`;
    const choices = this.find("visit-choices"); choices.replaceChildren();
    for (const entry of this.entries) {
      const button = document.createElement("button");
      button.id = `visit-choice-${entry.id}`; button.type = "button";
      button.setAttribute("aria-pressed", String(entry.id === this.slots[this.selected]));
      if (entry.thumbnail) { const image = document.createElement("img"); image.src = entry.thumbnail; image.alt = ""; button.append(image); }
      const label = document.createElement("span"); label.textContent = entry.title || "Untitled arrangement"; button.append(label);
      const position = this.slots.indexOf(entry.id);
      if (position >= 0) { const note = document.createElement("small"); note.textContent = `On display · ${POSITIONS[position].toLowerCase()}`; button.append(note); }
      button.addEventListener("click", () => this.run(() => this.choose(entry.id)));
      choices.append(button);
    }
    if (!this.entries.length) { const empty = document.createElement("p"); empty.textContent = "Your kept moments will appear here."; choices.append(empty); }
    this.find("visit-picker").hidden = false;
    this.overlay(true);
    this.find("visit-picker-close").focus();
  }

  private choose(id: string | null) {
    if (this.selected === null) return;
    const next = this.store.choose(this.selected, id, this.entries);
    this.slots = next;
    this.updateLabels();
    // A failed renderer cannot turn a successful display-preference save into
    // a claimed lost arrangement; Retry can rebuild from the retained references.
    if (this.view) {
      try { this.view.setEntries(resolveGardenDisplay(this.slots, this.entries)); this.view.focus(this.selected); }
      catch (error) { this.releaseView(); this.find("visit-scene-error").hidden = false; this.message(error instanceof Error ? error.message : "The Garden view could not be rebuilt."); }
    } else this.buildView();
    this.hidePicker();
    if (this.find("visit-scene-error").hidden) this.message("Display remembered on this device. Your saved arrangements are unchanged.");
  }

  private overlay(active: boolean) {
    this.find("garden-visit-canvas").inert = active;
    this.dialog.querySelector<HTMLElement>(".visit-controls")!.inert = active;
    this.dialog.querySelector<HTMLElement>(".visit-heading")!.inert = active;
  }
  private hidePicker() { this.find("visit-picker").hidden = true; this.overlay(false); this.find("visit-change").focus(); }
  private showPrint() {
    const entry = this.currentEntry(); if (!entry?.thumbnail) return;
    this.view?.interrupt();
    this.find("visit-print-title").textContent = entry.title || "Kept photograph";
    const image = this.find<HTMLImageElement>("visit-print-image"); image.src = entry.thumbnail; image.alt = entry.title || "Kept arrangement photograph";
    this.find("visit-print-panel").hidden = false;
    this.overlay(true);
    this.find("visit-print-close").focus();
  }
  private hidePrint() { this.find("visit-print-panel").hidden = true; this.overlay(false); this.find("visit-print").focus(); }
  private releaseView() { const view = this.view; this.view = null; view?.destroy(); }
  close() {
    // Explicit cleanup also works when a host destroys the modal before its
    // browser 'close' event is delivered.
    if (this.closing) return;
    this.closing = true;
    try { this.dialog.close(); this.releaseView(); } finally { this.closing = false; }
  }
  destroy() { this.close(); this.abort.abort(); this.dialog.remove(); }
}
