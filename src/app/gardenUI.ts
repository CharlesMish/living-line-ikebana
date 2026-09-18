import { getMaterialDefinitions } from "../core/index.ts";
import { GardenStore, GARDEN_LIMIT, createGardenEntryId, type ArrangementSnapshot, type GardenEntry } from "./garden.ts";
import { createWorkbenchFixture, WORKBENCH_SEEDS } from "./workbench.ts";

export interface GardenActions {
  pause(): void;
  snapshot(): ArrangementSnapshot;
  thumbnail(): string | null;
  isViewing(): boolean;
  view(entry: GardenEntry): void;
  returnToWork(): void;
  replace(snapshot: ArrangementSnapshot | null): void;
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
  private readonly viewer: HTMLElement;
  private readonly error: HTMLElement;
  private entries: GardenEntry[] = [];
  private pending: (() => void) | null = null;
  private viewedEntry: GardenEntry | null = null;
  private loaded = false;
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
        <div id="garden-grid" class="garden-grid"></div>
      </dialog>
      <dialog id="workbench-dialog" class="garden-dialog workbench-dialog" aria-labelledby="workbench-title">
        <div class="panel-heading"><div><p class="eyebrow">Development only · separate saved bowl</p><h1 id="workbench-title">Material workbench</h1></div><button id="workbench-close" class="icon-button" type="button" aria-label="Close workbench">×</button></div>
        <p>Use the normal Shape, Prune and camera controls. Loading a fixture replaces only this workbench bowl. Your player bowl and Garden are separate.</p>
        <form id="workbench-form" class="workbench-fields">
          <label>Material<select id="workbench-material"></select></label>
          <label>Starting seed<input id="workbench-seed" type="number" min="0" max="4294967295" step="1" required value="8278" list="workbench-seeds"/></label>
          <datalist id="workbench-seeds"></datalist>
          <label>Cuttings<select id="workbench-count"><option>1</option><option>2</option><option>6</option><option>12</option></select></label>
          <button type="submit">Load fixture</button>
        </form>
        <p class="panel-note">Mixed cycles through the registered materials. Later cuttings use seed + 977 × index. Reset by loading the same fixture. Twelve is a stress case, not a lesson target.</p>
        <div class="garden-actions"><button id="workbench-report" type="button">Download current report</button><a id="workbench-leave">Return to player studio</a></div>
        <p id="workbench-error" role="status" aria-live="polite"></p>
      </dialog>`;
    root.append(host);
    this.dialog = this.find<HTMLDialogElement>("#garden-dialog");
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
    this.dialog.addEventListener("close", () => { this.clearChoice(); this.find<HTMLButtonElement>("#garden-open").focus(); }, { signal: this.controller.signal });
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
      card.append(view, remove); grid.append(card);
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
    for (const id of [...getMaterialDefinitions().map((item) => item.materialId), "mixed"]) {
      const option = document.createElement("option"); option.value = id; option.textContent = id.replaceAll("-", " "); select.append(option);
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
  destroy() { this.controller.abort(); this.root.querySelector(".garden-host")?.remove(); }
}
