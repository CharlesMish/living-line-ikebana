import type { GardenEntry } from "./garden.ts";

/** A read-only display of kept pixels. Never regenerates or rewrites a moment. */
export class GardenWall {
  private readonly dialog: HTMLDialogElement;
  private readonly abort = new AbortController();
  private entries: readonly GardenEntry[] = [];
  private selected: GardenEntry | null = null;
  private opener: HTMLElement | null = null;

  constructor(root: HTMLElement, private readonly view: (entry: GardenEntry) => void) {
    this.dialog = document.createElement("dialog");
    this.dialog.id = "garden-wall";
    this.dialog.className = "garden-dialog garden-wall";
    this.dialog.dataset.finish = "oak";
    this.dialog.setAttribute("aria-labelledby", "garden-wall-title");
    this.dialog.innerHTML = `
      <header class="wall-heading">
        <div><p class="eyebrow">Your Garden · photographs</p><h1 id="garden-wall-title">A wall of moments</h1></div>
        <button id="wall-close" type="button" aria-label="Return to Garden">Back to Garden</button>
      </header>
      <div class="wall-toolbar"><p id="wall-count"></p><div class="wall-finishes" role="group" aria-label="Display style">
        <button id="wall-oak" type="button" aria-pressed="true">Oak frames</button>
        <button id="wall-paper" type="button" aria-pressed="false">Paper prints</button>
      </div></div>
      <div id="wall-collection" class="wall-collection" aria-label="Kept photographs"></div>
      <section id="wall-detail" class="wall-detail" hidden aria-labelledby="wall-detail-title">
        <button id="wall-back" type="button">All moments</button>
        <figure><div class="wall-mat"><img id="wall-detail-image" alt=""/></div>
          <figcaption><h2 id="wall-detail-title"></h2><p id="wall-detail-date"></p></figcaption>
        </figure>
        <button id="wall-view" type="button">Open arrangement in 3D</button>
      </section>
      <p class="wall-note">Keep a photograph from Photograph → Save to hang it here. Your original arrangement stays with each moment.</p>`;
    root.append(this.dialog);
    const on = (id: string, action: () => void) => this.find(id).addEventListener("click", action, { signal: this.abort.signal });
    on("wall-close", () => this.dialog.close());
    on("wall-oak", () => this.setFinish("oak"));
    on("wall-paper", () => this.setFinish("paper"));
    on("wall-back", () => this.showCollection(true));
    on("wall-view", () => {
      if (!this.selected) return;
      const entry = this.selected;
      this.dialog.close();
      this.view(entry);
    });
    this.dialog.addEventListener("close", () => { this.showCollection(false); this.opener?.focus(); }, { signal: this.abort.signal });
    this.dialog.addEventListener("cancel", (event) => {
      if (this.selected) { event.preventDefault(); this.showCollection(true); }
    }, { signal: this.abort.signal });
  }

  private find<T extends HTMLElement = HTMLElement>(id: string): T { return this.dialog.querySelector<T>(`#${id}`)!; }

  open(entries: readonly GardenEntry[], opener: HTMLElement) {
    this.entries = entries.filter((entry) => entry.thumbnail !== null);
    this.opener = opener;
    this.showCollection(false);
    this.find("wall-count").textContent = `${this.entries.length} kept view${this.entries.length === 1 ? "" : "s"}`;
    const collection = this.find("wall-collection");
    collection.replaceChildren();
    if (!this.entries.length) {
      const empty = document.createElement("p"); empty.className = "wall-empty";
      empty.textContent = "Your wall is waiting. Frame an arrangement in Photograph, then choose Keep photo in Garden. Moments kept without a picture are still in Garden.";
      collection.append(empty);
    }
    for (const entry of this.entries) {
      const button = document.createElement("button");
      button.type = "button"; button.className = "wall-print"; button.dataset.entryId = entry.id;
      button.setAttribute("aria-label", `Look at ${entry.title || "Untitled arrangement"}`);
      const mat = document.createElement("span"); mat.className = "wall-mat";
      const img = document.createElement("img"); img.src = entry.thumbnail!; img.alt = ""; img.loading = "lazy";
      mat.append(img);
      const label = document.createElement("span"); label.className = "wall-caption";
      const title = document.createElement("strong"); title.textContent = entry.title || "Untitled arrangement";
      const date = document.createElement("span"); date.textContent = this.date(entry);
      label.append(title, date); button.append(mat, label);
      button.addEventListener("click", () => this.showDetail(entry));
      collection.append(button);
    }
    if (!this.dialog.open) this.dialog.showModal();
    this.find("wall-close").focus();
  }

  private date(entry: GardenEntry) { return new Date(entry.keptAt).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" }); }
  private setFinish(finish: "oak" | "paper") {
    this.dialog.dataset.finish = finish;
    this.find("wall-oak").setAttribute("aria-pressed", String(finish === "oak"));
    this.find("wall-paper").setAttribute("aria-pressed", String(finish === "paper"));
  }
  private showDetail(entry: GardenEntry) {
    this.selected = entry;
    this.find("wall-collection").hidden = true;
    this.find("wall-detail").hidden = false;
    const image = this.find<HTMLImageElement>("wall-detail-image");
    image.src = entry.thumbnail!; image.alt = entry.title || "Untitled arrangement";
    this.find("wall-detail-title").textContent = entry.title || "Untitled arrangement";
    this.find("wall-detail-date").textContent = this.date(entry);
    this.find("wall-back").focus();
  }
  private showCollection(focus: boolean) {
    const id = this.selected?.id;
    this.selected = null;
    this.find("wall-collection").hidden = false;
    this.find("wall-detail").hidden = true;
    // Release the duplicate reference; kept cover pixels remain in Garden only.
    this.find<HTMLImageElement>("wall-detail-image").removeAttribute("src");
    if (focus) [...this.dialog.querySelectorAll<HTMLButtonElement>(".wall-print")].find((button) => button.dataset.entryId === id)?.focus();
  }
  destroy() { this.abort.abort(); this.dialog.remove(); }
}
