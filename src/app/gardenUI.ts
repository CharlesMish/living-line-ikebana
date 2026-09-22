import { cloneCameraPose, type CameraPose } from "./camera.ts";
import { GardenStore, GARDEN_LIMIT, createGardenEntryId, type ArrangementSnapshot, type GardenEntry } from "./garden.ts";
import {
  dollyComparison,
  orbitComparison,
  panComparison,
  presetComparison,
  TABLE_TALK_STUDY_NOTE,
  TABLE_TALK_STUDY_PROMPT,
  toggleComparisonChoice,
  type GardenComparison,
} from "./gardenCompare.ts";
import type { CanonicalView } from "../input/index.ts";
import { createWorkbenchFixture, listWorkbenchFixtureOptions, WORKBENCH_SEEDS } from "./workbench.ts";

export interface GardenActions {
  pause(): void;
  snapshot(): ArrangementSnapshot;
  thumbnail(): string | null;
  isViewing(): boolean;
  view(entry: GardenEntry): void;
  returnToWork(): void;
  replace(snapshot: ArrangementSnapshot | null): void;
  beginComparison(left: GardenEntry, right: GardenEntry, canvases: { left: HTMLCanvasElement; right: HTMLCanvasElement }): GardenComparison;
  syncComparison(session: GardenComparison): GardenComparison;
  endComparison(): void;
  report?(): unknown;
}
export function downloadJSON(filename: string, value: string) {
  const url = URL.createObjectURL(new Blob([value], { type: "application/json" }));
  const link = document.createElement("a");
  link.href = url; link.download = filename; document.body.append(link); link.click(); link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 30_000);
}

/** Garden UI owns no botanical state. All transitions go through app boundaries. */
export class GardenUI {
  private readonly controller = new AbortController();
  private readonly dialog: HTMLDialogElement;
  private readonly compareDialog: HTMLDialogElement;
  private readonly viewer: HTMLElement;
  private readonly error: HTMLElement;
  private entries: GardenEntry[] = [];
  private pending: (() => void) | null = null;
  private viewedEntry: GardenEntry | null = null;
  private loaded = false;
  private compareIds: string[] = [];
  private comparing = false;
  private comparison: GardenComparison | null = null;
  private compareMode: "orbit" | "move" = "orbit";
  private compareDrag: { pointerId: number; startX: number; startY: number; startCamera: CameraPose; height: number } | null = null;
  constructor(private readonly root: HTMLElement, private readonly store: GardenStore, private readonly actions: GardenActions, workbench = false) {
    const host = document.createElement("div");
    host.className = "garden-host";
    host.innerHTML = `
      <div class="garden-viewer" hidden aria-label="Kept arrangement">
        <p><span class="eyebrow">Kept in your Garden</span><strong id="kept-title"></strong></p>
        <button type="button" id="garden-copy">Make a working copy</button>
        <button type="button" id="garden-return">Return to my bowl</button>
      </div>
      <dialog id="garden-dialog" class="garden-dialog" aria-labelledby="garden-title">
        <div class="panel-heading"><div><p class="eyebrow">A place for enough</p><h1 id="garden-title">Your Garden</h1></div>
          <button id="garden-close" class="icon-button" type="button" aria-label="Close Garden">×</button></div>
        <p class="garden-intro">Keep a moment you want to return to. No score, no required finish.</p>
        <details class="looking-study garden-study">
          <summary>Optional study · Across the table</summary>
          <p class="looking-prompt">${TABLE_TALK_STUDY_PROMPT}</p>
          <p class="panel-note">${TABLE_TALK_STUDY_NOTE}</p>
          <p class="panel-note">Keep a bowl, make a working copy, revise it, and keep the revision. Then compare the two. They share one view and one scale. Neither kept moment changes.</p>
        </details>
        <p class="panel-note">Saved in this browser on this device. Download a backup to keep your collection elsewhere.</p>
        <p id="garden-error" class="garden-message" role="status" aria-live="polite"></p>
        <section id="garden-choice" class="garden-choice" hidden aria-labelledby="garden-choice-title">
          <h2 id="garden-choice-title">What about your current bowl?</h2>
          <p>Keep it first, or replace it. Your existing Garden entries will stay as they are.</p>
          <div class="garden-actions"><button type="button" id="garden-keep-first">Keep it, then continue</button><button type="button" id="garden-replace">Replace without keeping</button><button type="button" id="garden-cancel-choice">Cancel</button></div>
        </section>
        <form id="garden-keep-form" class="garden-keep-form">
          <label for="garden-name">A name for this moment <span>(optional)</span></label>
          <div class="garden-actions"><input id="garden-name" maxlength="80" placeholder="Untitled arrangement" autocomplete="off"/><button id="garden-keep" type="submit">Keep this bowl</button></div>
          <p class="panel-note">Keeps the arrangement and this view. Your working bowl stays open.</p>
        </form>
        <div class="garden-actions garden-tools"><button type="button" id="garden-new">Start a fresh bowl</button><button type="button" id="garden-export">Download backup</button><button type="button" id="garden-import">Import backup</button><input id="garden-file" type="file" accept="application/json,.json" hidden/></div>
        <p id="garden-count" class="eyebrow"></p>
        <section id="garden-compare-bar" class="garden-compare-bar" hidden>
          <p id="garden-compare-status">Choose Compare on two moments. They will share one view and one scale.</p>
          <button type="button" id="garden-compare-go" disabled>Look at both</button>
        </section>
        <div id="garden-grid" class="garden-grid"></div>
      </dialog>
      <dialog id="garden-compare-dialog" class="garden-dialog garden-compare" aria-labelledby="garden-compare-title">
        <div class="panel-heading"><div><p class="eyebrow">Same view and scale</p><h1 id="garden-compare-title">Compare two moments</h1></div>
          <button id="garden-compare-leave" class="icon-button" type="button" aria-label="Leave comparison">×</button></div>
        <p class="garden-compare-note">Both use one camera and the same scale, starting from Front rather than either saved framing. Nothing is saved. The optional study is yours to judge.</p>
        <p class="panel-note garden-compare-brief">If you are using the optional study — “${TABLE_TALK_STUDY_PROMPT}” — decide for yourself. ${TABLE_TALK_STUDY_NOTE}</p>
        <div class="garden-compare-stage">
          <figure><figcaption id="garden-compare-left-title"></figcaption><canvas id="garden-compare-left"></canvas></figure>
          <figure><figcaption id="garden-compare-right-title"></figcaption><canvas id="garden-compare-right"></canvas></figure>
        </div>
        <div class="garden-actions garden-compare-controls" aria-label="Shared view">
          <button type="button" data-compare-view="front" aria-pressed="true">Front</button>
          <button type="button" data-compare-view="three-quarter" aria-pressed="false" aria-label="Three-quarter view">¾</button>
          <button type="button" data-compare-view="above" aria-pressed="false">Above</button>
          <button type="button" data-compare-mode="orbit" aria-pressed="true">Orbit</button>
          <button type="button" data-compare-mode="move" aria-pressed="false">Pan</button>
          <button type="button" id="garden-compare-zoom-in">Zoom in</button>
          <button type="button" id="garden-compare-zoom-out">Zoom out</button>
        </div>
        <p class="panel-note garden-compare-help">Drag either arrangement. Both stay matched. Leave comparison to return to your Garden. Neither kept moment or your working bowl changes.</p>
      </dialog>
      <dialog id="workbench-dialog" class="garden-dialog workbench-dialog" aria-labelledby="workbench-title">
        <div class="panel-heading"><div><p class="eyebrow">Development only · separate saved bowl</p><h1 id="workbench-title">Material workbench</h1></div><button id="workbench-close" class="icon-button" type="button" aria-label="Close workbench">×</button></div>
        <p>Use the normal Shape, Prune and camera controls. Loading a fixture replaces only this workbench bowl. Your player bowl and Garden are separate.</p>
        <form id="workbench-form" class="workbench-fields">
          <label>Fixture<select id="workbench-material"></select></label>
          <label>Starting seed<input id="workbench-seed" type="number" min="0" max="4294967295" step="1" required value="8278" list="workbench-seeds"/></label>
          <datalist id="workbench-seeds"></datalist>
          <label>Cuttings<select id="workbench-count"><option>1</option><option>2</option><option>6</option><option>12</option></select></label>
          <button type="submit">Load fixture</button>
        </form>
        <p class="panel-note">Registered materials and named comparison profiles. Unavailable options stay listed and disabled. <code>reference-pair</code> is flowering + leafy only. <code>mixed</code> is a programmatic alias of that pair, not a picker row. Later cuttings use seed + 977 × index. Reset by loading the same fixture. Twelve is a stress case, not a lesson target.</p>
        <div class="garden-actions"><button id="workbench-report" type="button">Download current report</button><a id="workbench-leave">Return to player studio</a></div>
        <p id="workbench-error" role="status" aria-live="polite"></p>
      </dialog>`;
    root.append(host);
    this.dialog = this.find<HTMLDialogElement>("#garden-dialog");
    this.compareDialog = this.find<HTMLDialogElement>("#garden-compare-dialog");
    this.viewer = this.find(".garden-viewer");
    this.error = this.find("#garden-error");
    const on = (selector: string, action: () => void) => this.find(selector).addEventListener("click", () => this.run(action), { signal: this.controller.signal });
    on("#garden-open", () => this.open());
    on("#garden-close", () => this.dialog.close());
    on("#garden-return", () => this.returnToWork());
    on("#garden-copy", () => { if (this.viewedEntry) this.offerReplacement(this.viewedEntry.arrangement); });
    on("#garden-new", () => this.offerReplacement(null));
    on("#garden-cancel-choice", () => this.clearChoice());
    on("#garden-replace", () => this.finishReplacement());
    on("#garden-keep-first", () => { this.keep(); this.finishReplacement(); });
    on("#garden-export", () => downloadJSON("living-line-garden.json", this.store.exportRaw()));
    on("#garden-import", () => this.find<HTMLInputElement>("#garden-file").click());
    this.find("#garden-file").addEventListener("change", async () => {
      const input = this.find<HTMLInputElement>("#garden-file");
      const file = input.files?.[0];
      if (!file) return;
      try {
        if (file.size > 3_600_000) throw new Error("This backup is too large.");
        const count = this.store.importBackup(await file.text());
        this.reload(); this.message(`Imported ${count} arrangement${count === 1 ? "" : "s"}.`);
      } catch (error) { this.message(error); }
      input.value = "";
    }, { signal: this.controller.signal });
    this.find("#garden-keep-form").addEventListener("submit", (event) => {
      event.preventDefault(); this.run(() => { this.keep(); this.message("Kept. You can leave it here, or keep working."); });
    }, { signal: this.controller.signal });
    this.dialog.addEventListener("close", () => {
      this.clearChoice();
      if (!this.comparing) this.find<HTMLButtonElement>("#garden-open").focus();
    }, { signal: this.controller.signal });
    on("#garden-compare-go", () => this.startComparison());
    on("#garden-compare-leave", () => this.leaveComparison());
    this.compareDialog.addEventListener("close", () => {
      if (this.comparing) this.leaveComparison();
    }, { signal: this.controller.signal });
    this.bindComparisonGestures();
    if (workbench) this.setupWorkbench(on);
  }
  private find<T extends HTMLElement = HTMLElement>(selector: string): T { return this.root.querySelector<T>(selector)!; }
  private message(value: unknown) { this.error.textContent = value instanceof Error ? value.message : String(value); }
  private run(action: () => void) { try { action(); } catch (error) { this.message(error); } }
  open() {
    this.actions.pause(); this.clearChoice(); this.message(""); this.reload();
    if (!this.dialog.open) this.dialog.showModal();
  }
  private reload() {
    this.loaded = false;
    try { this.entries = this.store.load().entries; this.loaded = true; }
    catch { this.entries = []; this.message("This Garden could not be opened. Its stored data is untouched. Download a backup for recovery; keeping and importing are disabled."); }
    const grid = this.find("#garden-grid"); grid.replaceChildren();
    this.find("#garden-count").textContent = this.loaded ? `${this.entries.length} / ${GARDEN_LIMIT} moments kept` : "Garden unavailable";
    this.find<HTMLButtonElement>("#garden-import").disabled = !this.loaded;
    this.find<HTMLButtonElement>("#garden-keep").disabled = !this.loaded || this.actions.isViewing() || !this.actions.snapshot().plants.length;
    this.find("#garden-keep-form").hidden = this.actions.isViewing();
    const available = new Set(this.entries.map((entry) => entry.id));
    this.compareIds = this.compareIds.filter((id) => available.has(id));
    const compareBar = this.find("#garden-compare-bar");
    compareBar.hidden = !this.loaded || this.entries.length < 2;
    this.find<HTMLButtonElement>("#garden-compare-go").disabled = this.compareIds.length !== 2;
    this.find("#garden-compare-status").textContent = this.compareIds.length === 2
      ? "Two selected. The first is on the left. Both use one shared view and scale."
      : "Choose Compare on two moments. They will share one view and one scale.";
    if (this.loaded && !this.entries.length) {
      const empty = document.createElement("p"); empty.className = "garden-empty";
      empty.textContent = "Your Garden starts with something you choose to keep. Arrange a cutting, step back, and decide whether this is a moment to save."; grid.append(empty);
    }
    for (const entry of this.entries) {
      const card = document.createElement("article"); card.className = "garden-card";
      const view = document.createElement("button"); view.type = "button"; view.className = "garden-card-view";
      if (entry.thumbnail) { const image = document.createElement("img"); image.src = entry.thumbnail; image.alt = ""; image.loading = "lazy"; view.append(image); }
      else { const placeholder = document.createElement("span"); placeholder.className = "garden-placeholder"; placeholder.textContent = "Open arrangement"; view.append(placeholder); }
      const title = document.createElement("strong"); title.textContent = entry.title || "Untitled arrangement"; view.append(title);
      const date = document.createElement("span"); date.textContent = `${new Date(entry.keptAt).toLocaleDateString()} · ${entry.arrangement.plants.length} cutting${entry.arrangement.plants.length === 1 ? "" : "s"}`; view.append(date);
      view.addEventListener("click", () => this.run(() => this.view(entry)));
      const remove = document.createElement("button"); remove.type = "button"; remove.className = "garden-remove"; remove.textContent = "Remove";
      remove.setAttribute("aria-label", `Remove ${entry.title || "untitled arrangement"}`);
      remove.addEventListener("click", () => {
        this.pending = () => { this.store.remove(entry.id); if (this.viewedEntry?.id === entry.id) this.returnToWork(); this.reload(); };
        this.find("#garden-choice-title").textContent = "Remove this kept arrangement?";
        this.find("#garden-choice p").textContent = "This removes the Garden entry. A working copy, if you made one, stays in your bowl. Download a backup first if you want to keep it elsewhere.";
        this.find("#garden-keep-first").hidden = true;
        this.find("#garden-replace").textContent = "Remove from Garden";
        this.find("#garden-choice").hidden = false;
        this.find<HTMLButtonElement>("#garden-cancel-choice").focus();
      });
      const actions = document.createElement("div");
      actions.className = "garden-card-actions";
      if (this.entries.length >= 2) {
        const compare = document.createElement("button");
        compare.type = "button";
        compare.className = "garden-compare-toggle";
        const selected = this.compareIds.includes(entry.id);
        compare.textContent = selected ? "Selected" : "Compare";
        compare.setAttribute("aria-pressed", String(selected));
        compare.setAttribute("aria-label", `${selected ? "Remove from comparison" : "Compare"} ${entry.title || "untitled arrangement"}`);
        compare.disabled = !selected && this.compareIds.length >= 2;
        compare.addEventListener("click", () => {
          this.compareIds = toggleComparisonChoice(this.compareIds, entry.id);
          this.reload();
        });
        actions.append(compare);
      }
      actions.append(remove);
      card.append(view, actions); grid.append(card);
    }
  }
  private keep() {
    if (this.actions.isViewing()) throw new Error("Make a working copy before keeping another version.");
    const entry: GardenEntry = {
      id: createGardenEntryId(), title: this.find<HTMLInputElement>("#garden-name").value.trim(),
      keptAt: new Date().toISOString(), thumbnail: this.actions.thumbnail(), arrangement: this.actions.snapshot(),
    };
    this.store.keep(entry);
    this.find<HTMLInputElement>("#garden-name").value = ""; this.reload();
  }
  private view(entry: GardenEntry) {
    this.actions.view(entry); this.viewedEntry = entry;
    this.find("#kept-title").textContent = entry.title || "Untitled arrangement";
    this.viewer.hidden = false; this.root.dataset.gardenViewing = "true";
    this.dialog.close(); this.find<HTMLButtonElement>("#garden-return").focus();
  }
  private returnToWork() {
    this.actions.returnToWork(); this.viewedEntry = null; this.viewer.hidden = true;
    delete this.root.dataset.gardenViewing;
    this.find<HTMLButtonElement>("#garden-open").focus();
  }
  private offerReplacement(snapshot: ArrangementSnapshot | null) {
    this.returnToWork(); this.open();
    this.pending = () => { this.actions.replace(snapshot); this.dialog.close(); };
    if (!this.actions.snapshot().plants.length) { this.finishReplacement(); return; }
    this.find("#garden-choice-title").textContent = "What about your current bowl?";
    this.find("#garden-choice p").textContent = "Keep it first, or replace it. Your existing Garden entries will stay as they are.";
    this.find("#garden-keep-first").hidden = false;
    this.find<HTMLButtonElement>("#garden-keep-first").disabled = !this.loaded;
    this.find("#garden-replace").textContent = "Replace without keeping";
    this.find("#garden-choice").hidden = false;
    this.find<HTMLButtonElement>("#garden-cancel-choice").focus();
  }
  private finishReplacement() { const action = this.pending; action?.(); this.clearChoice(); }
  private clearChoice() { this.pending = null; this.find("#garden-choice").hidden = true; }
  private setupWorkbench(on: (selector: string, action: () => void) => void) {
    const dialog = this.find<HTMLDialogElement>("#workbench-dialog");
    this.find("#workbench-open").hidden = false; this.root.dataset.workbench = "true";
    const select = this.find<HTMLSelectElement>("#workbench-material");
    for (const option of listWorkbenchFixtureOptions()) {
      const element = document.createElement("option");
      element.value = option.id;
      element.textContent = option.label;
      element.disabled = !option.available;
      if (!option.available && option.missingMaterialIds.length) {
        element.title = `Requires ${option.missingMaterialIds.join(", ")}`;
      }
      select.append(element);
    }
    for (const seed of WORKBENCH_SEEDS) { const option = document.createElement("option"); option.value = String(seed); this.find("#workbench-seeds").append(option); }
    const leave = new URL(location.href); leave.searchParams.delete("workbench"); leave.searchParams.delete("fresh"); leave.searchParams.delete("clearStudyData");
    this.find<HTMLAnchorElement>("#workbench-leave").href = leave.href;
    on("#workbench-open", () => { this.actions.pause(); dialog.showModal(); });
    on("#workbench-close", () => dialog.close());
    on("#workbench-report", () => downloadJSON("living-line-material-report.json", JSON.stringify(this.actions.report?.(), null, 2)));
    this.find("#workbench-form").addEventListener("submit", (event) => {
      event.preventDefault();
      try {
        const snapshot = createWorkbenchFixture(select.value, Number(this.find<HTMLInputElement>("#workbench-seed").value), Number(this.find<HTMLSelectElement>("#workbench-count").value));
        this.returnToWork(); this.actions.replace(snapshot); dialog.close();
        this.find("#workbench-error").textContent = "";
      } catch (error) { this.find("#workbench-error").textContent = error instanceof Error ? error.message : String(error); }
    }, { signal: this.controller.signal });
  }
  private bindComparisonGestures() {
    const signal = this.controller.signal;
    const stage = this.find(".garden-compare-stage");
    const apply = (session: GardenComparison, preset: CanonicalView | "free") => {
      this.comparison = this.actions.syncComparison(session);
      this.markComparePreset(preset);
    };
    for (const button of this.root.querySelectorAll<HTMLButtonElement>("[data-compare-view]")) {
      button.addEventListener("click", () => {
        if (!this.comparison) return;
        const view = button.dataset.compareView as CanonicalView;
        this.run(() => apply(presetComparison(this.comparison!, view), view));
      }, { signal });
    }
    for (const button of this.root.querySelectorAll<HTMLButtonElement>("[data-compare-mode]")) {
      button.addEventListener("click", () => {
        this.compareMode = button.dataset.compareMode === "move" ? "move" : "orbit";
        this.markCompareMode();
      }, { signal });
    }
    this.find("#garden-compare-zoom-in").addEventListener("click", () => {
      if (!this.comparison) return;
      this.run(() => apply(dollyComparison(this.comparison!, 0.9), "free"));
    }, { signal });
    this.find("#garden-compare-zoom-out").addEventListener("click", () => {
      if (!this.comparison) return;
      this.run(() => apply(dollyComparison(this.comparison!, 1.1), "free"));
    }, { signal });
    stage.addEventListener("pointerdown", (event) => {
      if (!this.comparison || event.button !== 0) return;
      const canvas = event.target instanceof HTMLCanvasElement ? event.target : null;
      if (!canvas) return;
      event.preventDefault();
      canvas.setPointerCapture?.(event.pointerId);
      this.compareDrag = {
        pointerId: event.pointerId,
        startX: event.clientX,
        startY: event.clientY,
        startCamera: cloneCameraPose(this.comparison.camera),
        height: canvas.clientHeight,
      };
    }, { signal });
    stage.addEventListener("pointermove", (event) => {
      const drag = this.compareDrag;
      if (!drag || !this.comparison || event.pointerId !== drag.pointerId) return;
      event.preventDefault();
      const dx = event.clientX - drag.startX;
      const dy = event.clientY - drag.startY;
      const basis = { ...this.comparison, camera: drag.startCamera };
      const next = this.compareMode === "move"
        ? panComparison(basis, dx, dy, drag.height)
        : orbitComparison(basis, dx, dy);
      this.run(() => apply(next, "free"));
    }, { signal });
    const endDrag = (event: PointerEvent) => {
      if (!this.compareDrag || event.pointerId !== this.compareDrag.pointerId) return;
      this.compareDrag = null;
    };
    stage.addEventListener("pointerup", endDrag, { signal });
    stage.addEventListener("pointercancel", endDrag, { signal });
    stage.addEventListener("wheel", (event) => {
      if (!this.comparison) return;
      event.preventDefault();
      this.run(() => apply(dollyComparison(this.comparison!, Math.exp(event.deltaY * 0.0011)), "free"));
    }, { signal, passive: false });
  }
  private markComparePreset(preset: CanonicalView | "free") {
    for (const button of this.root.querySelectorAll<HTMLButtonElement>("[data-compare-view]")) {
      button.setAttribute("aria-pressed", String(button.dataset.compareView === preset));
    }
  }
  private markCompareMode() {
    for (const button of this.root.querySelectorAll<HTMLButtonElement>("[data-compare-mode]")) {
      button.setAttribute("aria-pressed", String(button.dataset.compareMode === this.compareMode));
    }
  }
  private startComparison() {
    if (this.compareIds.length !== 2) return;
    const left = this.entries.find((entry) => entry.id === this.compareIds[0]);
    const right = this.entries.find((entry) => entry.id === this.compareIds[1]);
    if (!left || !right) return;
    const leftTitle = left.title || "Untitled arrangement";
    const rightTitle = right.title || "Untitled arrangement";
    this.find("#garden-compare-left-title").textContent = leftTitle;
    this.find("#garden-compare-right-title").textContent = rightTitle;
    this.find("#garden-compare-left").setAttribute("aria-label", `${leftTitle}. Same view as the other arrangement.`);
    this.find("#garden-compare-right").setAttribute("aria-label", `${rightTitle}. Same view as the other arrangement.`);
    this.compareMode = "orbit";
    this.markCompareMode();
    this.markComparePreset("front");
    this.comparing = true;
    this.dialog.close();
    if (!this.compareDialog.open) this.compareDialog.showModal();
    this.find<HTMLButtonElement>("#garden-compare-leave").focus();
    requestAnimationFrame(() => {
      if (!this.comparing || !this.compareDialog.isConnected) return;
      try {
        this.comparison = this.actions.beginComparison(left, right, {
          left: this.find<HTMLCanvasElement>("#garden-compare-left"),
          right: this.find<HTMLCanvasElement>("#garden-compare-right"),
        });
      } catch (error) {
        this.comparison = null;
        this.comparing = false;
        this.actions.endComparison();
        if (this.compareDialog.open) this.compareDialog.close();
        this.open();
        this.message(error);
      }
    });
  }
  private leaveComparison() {
    if (!this.comparing && !this.comparison) {
      if (this.compareDialog.open) this.compareDialog.close();
      return;
    }
    this.compareDrag = null;
    this.comparison = null;
    this.comparing = false;
    this.actions.endComparison();
    const reopen = () => {
      if (!this.root.querySelector("#garden-dialog")) return;
      this.open();
      const opener = this.find<HTMLButtonElement>("#garden-compare-go");
      if (!opener.disabled) opener.focus();
    };
    if (this.compareDialog.open) {
      this.compareDialog.close();
      reopen();
    } else {
      requestAnimationFrame(reopen);
    }
  }
  destroy() {
    this.controller.abort();
    this.comparing = false;
    this.comparison = null;
    this.compareDrag = null;
    try { this.actions.endComparison(); } catch { /* The host may already have released the view. */ }
    this.root.querySelector(".garden-host")?.remove();
  }
}
