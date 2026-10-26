import type { GardenEntry } from "./garden.ts";
import { HomeStore, emptyHomePlacements, initialHomePlacements, placeOfEntry, placementProblem, type HomePlacements } from "./homeStore.ts";
import { HOME_PLACES, homePlace, type HomePlace, type HomePlaceId } from "../presentation/homePlaces.ts";
import { HomeStudio, type HomeEntries, type HomeMarker } from "../presentation/HomeStudio.ts";
import "./homeRoom.css";

export interface HomeView {
  setEntries(entries: HomeEntries): void;
  setMarkers(markers: Partial<Record<HomePlaceId, HomeMarker>> | null): void;
  focus(place: HomePlaceId | null, animate?: boolean): void;
  zoomBy(factor: number): void;
  interrupt(): void;
  destroy(): void;
}
type HomeViewFactory = (canvas: HTMLCanvasElement, options: { onSelect(place: HomePlaceId): void; onError(message: string): void; onWarning(message: string): void; reducedMotion: boolean }) => HomeView;

const untitled = (entry: GardenEntry | null | undefined) => entry ? entry.title || "Untitled arrangement" : "";
const prefersReducedMotion = () => typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;

/**
 * The home: a room of named places for kept arrangements. Everything botanical
 * is read-only here; the only thing this dialog saves is which kept moment
 * stands where. Opening with an entry id starts in placing mode, for the
 * moment just kept.
 */
export class HomeUI {
  private readonly dialog: HTMLDialogElement;
  private readonly abort = new AbortController();
  private view: HomeView | null = null;
  private entries: GardenEntry[] = [];
  private placements: HomePlacements = emptyHomePlacements();
  private selected: HomePlaceId | null = null;
  private placing: GardenEntry | null = null;
  private editable = true;
  private opener: HTMLElement | null = null;
  private closing = false;

  constructor(root: HTMLElement, private readonly store: HomeStore,
    private readonly copy: (entry: GardenEntry) => void,
    private readonly displayRaw: () => string | null = () => null,
    private readonly createView: HomeViewFactory = (canvas, options) => new HomeStudio(canvas, options)) {
    this.dialog = document.createElement("dialog");
    this.dialog.id = "home-room"; this.dialog.className = "home-room";
    this.dialog.setAttribute("aria-labelledby", "home-title");
    this.dialog.innerHTML = `
      <header class="home-heading"><div><p class="eyebrow">Home</p><h1 id="home-title">Your room</h1></div><button id="home-close" type="button">Back to arranging</button></header>
      <div class="home-stage">
        <canvas id="home-canvas" aria-label="A tatami room with your kept arrangements in their places" tabindex="0"></canvas>
        <div id="home-scene-error" class="home-scene-error" hidden><p>The room is unavailable right now. Your saved work is safe.</p><button id="home-retry" type="button">Try again</button></div>
      </div>
      <footer class="home-controls">
        <div id="home-placing" class="home-placing" hidden><p><span class="eyebrow">Just kept</span><strong id="home-placing-title"></strong> Where should it go?</p><button id="home-placing-cancel" type="button">Keep it in the Garden for now</button></div>
        <nav class="home-places" aria-label="Places in the room">
          <button id="home-overview" type="button" aria-pressed="true"><span>Room</span><strong>Whole room</strong></button>
          ${HOME_PLACES.map(place => `<button id="home-place-${place.id}" type="button" data-place="${place.id}" aria-pressed="false"><span>${place.label}</span><strong id="home-label-${place.id}">Empty</strong></button>`).join("")}
        </nav>
        <div class="home-caption">
          <div><p id="home-selected-title">Your room</p><p id="home-help"></p><p id="home-fit" class="home-fit" hidden></p></div>
          <div class="home-zoom"><button id="home-zoom-out" type="button" aria-label="Step back">−</button><button id="home-zoom-in" type="button" aria-label="Move closer">+</button></div>
        </div>
        <div id="home-actions" class="home-actions" hidden>
          <button id="home-place-here" type="button" class="home-primary" hidden>Place it here</button>
          <button id="home-choose" type="button">Choose a piece</button>
          <button id="home-clear" type="button">Return it to the Garden</button>
          <button id="home-print" type="button">View photograph</button>
          <button id="home-copy" type="button">Make a working copy</button>
        </div>
        <p id="home-message" class="home-message" role="status" aria-live="polite"></p>
      </footer>
      <section id="home-picker" class="home-picker" role="dialog" aria-modal="true" hidden aria-labelledby="home-picker-title"><header><div><p class="eyebrow">From your Garden</p><h2 id="home-picker-title">Choose a piece</h2></div><button id="home-picker-close" type="button">Done</button></header><p id="home-picker-message" class="home-message" role="status" aria-live="polite"></p><div id="home-choices" class="home-choices"></div><p class="panel-note">A piece stands in one place at a time; choosing one already out swaps the two. Your kept arrangements are never changed.</p></section>
      <section id="home-print-panel" class="home-print-panel" role="dialog" aria-modal="true" hidden aria-labelledby="home-print-title"><header><h2 id="home-print-title">Kept photograph</h2><button id="home-print-close" type="button">Back to the room</button></header><img id="home-print-image" alt=""/></section>`;
    root.append(this.dialog);
    const on = (id: string, fn: () => void) => this.find(id).addEventListener("click", () => this.run(fn), { signal: this.abort.signal });
    on("home-close", () => this.dialog.close());
    on("home-overview", () => this.select(null));
    for (const place of HOME_PLACES) on(`home-place-${place.id}`, () => this.select(place.id));
    on("home-zoom-in", () => this.view?.zoomBy(.86));
    on("home-zoom-out", () => this.view?.zoomBy(1.16));
    on("home-place-here", () => this.placeHere());
    on("home-placing-cancel", () => this.stopPlacing("Kept in your Garden. You can place it from here any time."));
    on("home-choose", () => this.showPicker());
    on("home-picker-close", () => this.hidePicker());
    on("home-clear", () => this.assign(null));
    on("home-print", () => this.showPrint());
    on("home-print-close", () => this.hidePrint());
    on("home-retry", () => this.buildView());
    on("home-copy", () => {
      const entry = this.currentEntry();
      if (!entry) return;
      this.close(); this.copy(structuredClone(entry));
    });
    this.dialog.addEventListener("cancel", event => {
      if (!this.find("home-picker").hidden) { event.preventDefault(); this.hidePicker(); }
      else if (!this.find("home-print-panel").hidden) { event.preventDefault(); this.hidePrint(); }
    }, { signal: this.abort.signal });
    this.dialog.addEventListener("close", () => { this.releaseView(); this.opener?.focus(); }, { signal: this.abort.signal });
  }

  get isOpen() { return this.dialog.open; }
  private find<T extends HTMLElement = HTMLElement>(id: string): T { return this.dialog.querySelector<T>(`#${id}`)!; }
  private run(fn: () => void) { try { fn(); } catch (error) { this.message(error instanceof Error ? error.message : String(error)); } }
  private message(value: string) {
    this.find("home-message").textContent = value;
    const picker = this.find("home-picker");
    this.find("home-picker-message").textContent = !picker.hidden ? value : "";
  }
  private entry(id: string | null) { return id === null ? null : this.entries.find(entry => entry.id === id) ?? null; }
  /** What would go wrong if `entryId` went to `placeId`, swaps included; null when it can. */
  private problem(placeId: HomePlaceId, entryId: string | null) { return placementProblem(this.placements, placeId, entryId, this.entries); }
  private currentEntry() { return this.selected === null ? null : this.entry(this.placements[this.selected]); }

  open(entries: readonly GardenEntry[], opener: HTMLElement, placingId: string | null = null) {
    this.entries = structuredClone([...entries]);
    this.opener = opener; this.editable = true; this.message("");
    try { this.placements = this.store.load(this.entries, placingId); }
    catch {
      this.editable = false;
      this.placements = initialHomePlacements(this.entries.filter(entry => entry.id !== placingId), this.displayRaw());
      this.message("Your room's saved places could not be read. Showing recent pieces for this visit; nothing was changed.");
    }
    this.placing = placingId && this.editable ? this.entry(placingId) : null;
    this.selected = null;
    this.find("home-picker").hidden = true; this.find("home-print-panel").hidden = true; this.overlay(false);
    if (!this.dialog.open) this.dialog.showModal();
    this.buildView();
    this.refresh();
    (this.placing ? this.find(`home-place-${this.suggestedPlace() ?? "tokonoma"}`) : this.find("home-close")).focus();
  }

  /** The first empty place that fits, so a new keep has an obvious home. */
  private suggestedPlace(): HomePlaceId | null {
    if (!this.placing) return null;
    const placing = this.placing;
    const free = HOME_PLACES.find(place => place.kind === "arrangement" && this.placements[place.id] === null && this.problem(place.id, placing.id) === null);
    return free?.id ?? null;
  }

  private buildView() {
    this.releaseView();
    this.find("home-scene-error").hidden = true;
    try {
      this.view = this.createView(this.find<HTMLCanvasElement>("home-canvas"), {
        onSelect: place => this.run(() => this.select(place)),
        onError: message => { this.message(message); this.find("home-scene-error").hidden = false; },
        onWarning: message => this.message(message),
        reducedMotion: prefersReducedMotion(),
      });
      this.view.setEntries(this.resolved());
      this.view.setMarkers(this.markers());
      this.view.focus(this.selected, false);
    } catch (error) {
      this.releaseView();
      this.find("home-scene-error").hidden = false;
      this.message(error instanceof Error ? error.message : "The room could not be opened.");
    }
  }

  private resolved(): HomeEntries {
    return Object.fromEntries(HOME_PLACES.map(place => [place.id, this.entry(this.placements[place.id])])) as HomeEntries;
  }
  private markers(): Partial<Record<HomePlaceId, HomeMarker>> | null {
    if (!this.placing) return null;
    const placing = this.placing;
    return Object.fromEntries(HOME_PLACES.filter(place => place.kind === "arrangement")
      .map(place => [place.id, this.problem(place.id, placing.id) === null ? "fits" : "blocked"]));
  }

  private select(place: HomePlaceId | null) {
    if (place !== null && !homePlace(place)) return;
    this.selected = place;
    this.find("home-picker").hidden = true; this.find("home-print-panel").hidden = true; this.overlay(false);
    this.view?.focus(place);
    this.refresh();
  }

  private refresh() {
    const placing = this.placing;
    this.find("home-placing").hidden = !placing;
    if (placing) this.find("home-placing-title").textContent = `“${untitled(placing)}”`;
    for (const place of HOME_PLACES) {
      const entry = this.entry(this.placements[place.id]), button = this.find(`home-place-${place.id}`);
      button.setAttribute("aria-pressed", String(this.selected === place.id));
      const label = place.kind === "photograph" ? (entry?.thumbnail ? untitled(entry) : "No photograph") : entry ? untitled(entry) : "Empty";
      this.find(`home-label-${place.id}`).textContent = label;
      button.setAttribute("aria-label", `${place.label}: ${label}`);
      button.dataset.fit = placing && place.kind === "arrangement" ? (this.problem(place.id, placing.id) === null ? "fits" : "blocked") : "";
    }
    this.find("home-overview").setAttribute("aria-pressed", String(this.selected === null));
    const place = this.selected ? homePlace(this.selected)! : null, entry = this.currentEntry();
    this.find("home-selected-title").textContent = place ? (entry && place.kind === "arrangement" ? `${place.label} · ${untitled(entry)}` : place.label) : "Your room";
    this.find("home-help").textContent = place ? `${place.description} ${place.suits ? `Suits: ${place.suits.charAt(0).toLowerCase()}${place.suits.slice(1)}` : ""}`
      : placing ? "Choose a place below, or tap one in the room. Green rings mark where it fits."
        : this.entries.length ? "Tap a place to go closer. Drag to look around." : "Keep an arrangement in your Garden, then give it a place here.";
    const fitLine = this.find("home-fit");
    const problem = placing && place ? this.problem(place.id, placing.id) : undefined;
    const swapping = Boolean(placing && entry && place?.kind === "arrangement" && placeOfEntry(this.placements, placing.id));
    const fitsText = place?.kind === "photograph" ? (placing?.thumbnail ? "Its photograph can hang here." : "This moment has no photograph to hang.")
      : entry && entry.id !== placing?.id ? (swapping ? `It fits here. “${untitled(entry)}” will trade places with it.` : `It fits here. “${untitled(entry)}” will go back to the Garden.`) : "It fits here.";
    fitLine.hidden = problem === undefined; fitLine.textContent = problem === undefined ? "" : problem ?? fitsText;
    fitLine.dataset.fits = String(problem === null);

    this.find("home-actions").hidden = place === null;
    const placeHere = this.find<HTMLButtonElement>("home-place-here");
    placeHere.hidden = !placing || !place;
    placeHere.disabled = problem !== null || !this.editable;
    placeHere.textContent = place?.kind === "photograph" ? "Hang its photograph here" : swapping ? "Swap them" : "Place it here";
    for (const id of ["home-choose", "home-clear", "home-print", "home-copy"]) this.find(id).hidden = Boolean(placing);
    this.find<HTMLButtonElement>("home-choose").disabled = !this.editable;
    this.find("home-choose").textContent = place?.kind === "photograph" ? "Choose a photograph" : "Choose a piece";
    this.find<HTMLButtonElement>("home-clear").disabled = !entry || !this.editable;
    this.find("home-clear").textContent = place?.kind === "photograph" ? "Take the scroll down" : "Return it to the Garden";
    this.find<HTMLButtonElement>("home-print").disabled = !entry?.thumbnail;
    this.find<HTMLButtonElement>("home-copy").disabled = !entry;
    this.find("home-copy").hidden = Boolean(placing) || place?.kind === "photograph";
  }

  private placeHere() {
    if (!this.placing || !this.selected) return;
    const placed = this.placing, place = homePlace(this.selected)!;
    this.assign(placed.id);
    if (this.placements[this.selected] !== placed.id) return;
    // A bare scroll above a new tokonoma piece takes that piece's photograph.
    let hung = false;
    if (place.id === "tokonoma" && this.placements.scroll === null && placed.thumbnail) {
      try { this.placements = this.store.place("scroll", placed.id, this.entries); this.updateView(); hung = true; }
      catch { /* The arrangement is placed; the scroll can be chosen later. */ }
    }
    this.stopPlacing(place.kind === "photograph" ? "Its photograph hangs as the scroll."
      : hung ? "Placed in the tokonoma, with its photograph as the scroll." : `Placed in the ${place.label.toLowerCase()}.`);
  }

  private stopPlacing(note: string) {
    this.placing = null;
    this.view?.setMarkers(null);
    this.refresh(); this.message(note);
  }

  private assign(id: string | null) {
    if (!this.selected) return;
    const place = homePlace(this.selected)!;
    // The store refuses (and writes nothing) if this, or the swap it causes, cannot fit.
    this.placements = this.store.place(this.selected, id, this.entries);
    this.updateView();
    this.hidePicker(false);
    this.refresh();
    if (!this.placing) this.message(id === null ? (place.kind === "photograph" ? "The scroll is down." : "Returned to your Garden. Nothing was deleted.") : "Placed. Your room remembers this on this device.");
  }

  private updateView() {
    if (!this.view) { this.buildView(); return; }
    try { this.view.setEntries(this.resolved()); this.view.setMarkers(this.markers()); this.view.focus(this.selected); }
    catch (error) { this.releaseView(); this.find("home-scene-error").hidden = false; this.message(error instanceof Error ? error.message : "The room could not be rebuilt."); }
  }

  private showPicker() {
    if (!this.selected || !this.editable) return;
    const place = homePlace(this.selected)!;
    this.view?.interrupt();
    this.find("home-picker-message").textContent = "";
    this.find("home-picker-title").textContent = place.label;
    const choices = this.find("home-choices"); choices.replaceChildren();
    for (const entry of this.entries) choices.append(this.choiceButton(place, entry));
    if (!this.entries.length) { const empty = document.createElement("p"); empty.textContent = "Your kept arrangements will appear here."; choices.append(empty); }
    this.find("home-picker").hidden = false; this.overlay(true);
    this.find("home-picker-close").focus();
  }
  private choiceButton(place: HomePlace, entry: GardenEntry) {
    const button = document.createElement("button");
    button.type = "button"; button.id = `home-choice-${entry.id}`;
    button.setAttribute("aria-pressed", String(this.placements[place.id] === entry.id));
    if (entry.thumbnail) { const image = document.createElement("img"); image.src = entry.thumbnail; image.alt = ""; button.append(image); }
    const label = document.createElement("span"); label.textContent = untitled(entry); button.append(label);
    const note = document.createElement("small");
    const problem = this.problem(place.id, entry.id);
    const where = placeOfEntry(this.placements, entry.id);
    note.textContent = problem ?? (where && place.kind === "arrangement" && where !== place.id ? `Now in the ${homePlace(where)!.label.toLowerCase()} · will swap` : this.placements[place.id] === entry.id ? "Here now" : "");
    if (note.textContent) button.append(note);
    button.disabled = problem !== null;
    button.addEventListener("click", () => this.run(() => this.assign(entry.id)));
    return button;
  }
  private overlay(active: boolean) {
    for (const selector of [".home-stage", ".home-controls", ".home-heading"]) this.dialog.querySelector<HTMLElement>(selector)!.inert = active;
  }
  private hidePicker(focus = true) { this.find("home-picker").hidden = true; this.overlay(false); if (focus && this.selected) this.find("home-choose").focus(); }
  private showPrint() {
    const entry = this.currentEntry(); if (!entry?.thumbnail) return;
    this.view?.interrupt();
    this.find("home-print-title").textContent = untitled(entry);
    const image = this.find<HTMLImageElement>("home-print-image"); image.src = entry.thumbnail; image.alt = untitled(entry);
    this.find("home-print-panel").hidden = false; this.overlay(true); this.find("home-print-close").focus();
  }
  private hidePrint() { this.find("home-print-panel").hidden = true; this.overlay(false); this.find("home-print").focus(); }
  private releaseView() { const view = this.view; this.view = null; view?.destroy(); }
  close() {
    if (this.closing) return;
    this.closing = true;
    try { this.dialog.close(); this.releaseView(); } finally { this.closing = false; }
  }
  destroy() { this.close(); this.abort.abort(); this.dialog.remove(); }
}
