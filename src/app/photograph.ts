import { fromCanonicalPlantGraph } from "../core/index.ts";
import { ThreeStudio, type CanonicalView, type StudioCameraPose } from "../presentation/ThreeStudio.ts";
import { framePhotoCamera, PHOTO_SIZES, type PhotoBackdrop, type PhotoPerch, type PhotoFormat } from "../presentation/photoStage.ts";
import { validateArrangement, type ArrangementSnapshot } from "./garden.ts";

interface PhotoActions {
  pause(): void;
  snapshot(): ArrangementSnapshot;
  canKeep(): boolean;
  keep(snapshot: ArrangementSnapshot, thumbnail: string | null, title: string): string;
}

/** Disposable presentation of a committed copy. Closing never touches the working coordinator. */
export class Photograph {
  private readonly dialog: HTMLDialogElement;
  private readonly opener: HTMLButtonElement;
  private studio: ThreeStudio | null = null;
  private snapshot: ArrangementSnapshot | null = null;
  private pose: StudioCameraPose | null = null;
  private session = 0;
  private busy = false;
  private readonly abort = new AbortController();
  constructor(private readonly root: HTMLElement, private readonly actions: PhotoActions) {
    this.opener = document.createElement("button"); this.opener.id = "photo-open"; this.opener.type = "button";
    this.opener.textContent = "Photograph"; this.opener.setAttribute("aria-haspopup", "dialog");
    root.querySelector("#more-options")!.append(this.opener);
    this.dialog = document.createElement("dialog"); this.dialog.id = "photo-dialog"; this.dialog.className = "photo-dialog";
    this.dialog.setAttribute("aria-labelledby", "photo-title");
    this.dialog.innerHTML = `
      <div class="panel-heading"><div><p class="eyebrow">A moment to keep · local study</p><h1 id="photo-title">Photograph</h1></div><button id="photo-close" type="button" aria-label="Close Photograph">×</button></div>
      <div class="photo-layout"><div class="photo-preview"><div class="photo-frame"><canvas id="photo-canvas" aria-label="Photograph preview"></canvas></div><p id="photo-size" class="panel-note"></p></div>
      <div class="photo-controls">
        <label>Backdrop <select id="photo-backdrop"><option value="paper">Warm paper</option><option value="sage">Sage wall</option><option value="dusk">Dusk wall</option><option value="transparent">Transparent cutout</option></select></label>
        <label>Perch <select id="photo-perch"><option value="ground">Ground</option><option value="stone">Low stone</option><option value="bench">Small bench</option></select></label>
        <label>Frame <select id="photo-format"><option value="landscape">Landscape · 4:3</option><option value="portrait">Portrait · 3:4</option><option value="square">Square · 1:1</option></select></label>
        <label>View <select id="photo-view"><option value="current">My current view</option><option value="front">Front</option><option value="three-quarter">Three-quarter</option><option value="above">Above</option></select></label>
        <label>Closer <input id="photo-zoom" type="range" min="0.8" max="1.8" step="0.01" value="1"></label>
        <label>Across <input id="photo-horizontal" type="range" min="-2" max="2" step="0.02" value="0"></label>
        <label>Height <input id="photo-vertical" type="range" min="-2" max="2" step="0.02" value="0"></label>
        <label class="photo-check"><input id="photo-fibers" type="checkbox"> Subtle stem fibers (study)</label>
        <button id="photo-reset" type="button">Reset framing</button>
        <button id="photo-export" type="button">Download PNG</button>
        <label>Garden title <input id="photo-name" type="text" maxlength="80" placeholder="A quiet afternoon"></label>
        <button id="photo-keep" type="button">Keep photo in Garden</button>
        <p class="panel-note">The cover keeps this photograph. Opening it returns to the saved arrangement and view; scene dressing stays in this photo session.</p>
        <p id="photo-message" role="status" aria-live="polite"></p>
      </div></div>`;
    root.append(this.dialog);
    const signal = this.abort.signal;
    this.opener.addEventListener("click", () => this.open(), { signal });
    this.find("photo-close").addEventListener("click", () => this.dialog.close(), { signal });
    this.dialog.addEventListener("close", () => this.release(), { signal });
    this.find("photo-backdrop").addEventListener("change", () => this.stage(), { signal });
    this.find("photo-perch").addEventListener("change", () => this.stage(), { signal });
    this.find("photo-format").addEventListener("change", () => this.format(), { signal });
    this.find("photo-view").addEventListener("change", () => {
      const view = this.value("photo-view");
      if (view === "current") this.pose = this.snapshot?.camera ?? null;
      else { this.studio?.setCanonicalView(view as CanonicalView, false); this.pose = this.studio?.getCameraPose() ?? null; }
      this.reset();
    }, { signal });
    for (const id of ["photo-zoom", "photo-horizontal", "photo-vertical"]) this.find(id).addEventListener("input", () => this.frame(), { signal });
    this.find<HTMLInputElement>("photo-fibers").addEventListener("change", () => this.studio?.setStemFibers(this.find<HTMLInputElement>("photo-fibers").checked), { signal });
    this.find("photo-reset").addEventListener("click", () => this.reset(), { signal });
    this.find("photo-export").addEventListener("click", () => { void this.export(); }, { signal });
    this.find("photo-keep").addEventListener("click", () => this.keep(), { signal });
    this.find<HTMLCanvasElement>("photo-canvas").addEventListener("webglcontextlost", (event) => {
      event.preventDefault(); this.message("Graphics paused. Close Photograph and reopen it before capturing.");
    }, { signal });
  }
  private find<T extends HTMLElement = HTMLElement>(id: string): T { return this.dialog.querySelector<T>(`#${id}`)!; }
  private value(id: string) { return this.find<HTMLInputElement | HTMLSelectElement>(id).value; }
  private message(value: string) { this.find("photo-message").textContent = value; }
  private open() {
    if (this.dialog.open) return;
    this.actions.pause(); this.snapshot = validateArrangement(this.actions.snapshot());
    this.root.querySelector<HTMLElement>("#more-options")!.hidden = true;
    this.dialog.showModal(); this.session++;
    try {
      this.studio = new ThreeStudio(this.find<HTMLCanvasElement>("photo-canvas"), { photography: true, maxPixelRatio: 1.5 });
      for (const graph of this.snapshot.plants) this.studio.upsertGraph(fromCanonicalPlantGraph(graph));
      this.pose = this.snapshot.camera; this.find<HTMLSelectElement>("photo-view").value = "current";
      this.find<HTMLInputElement>("photo-fibers").checked = false;
      this.find<HTMLButtonElement>("photo-keep").disabled = !this.snapshot.plants.length || !this.actions.canKeep();
      this.find<HTMLButtonElement>("photo-export").disabled = false;
      this.busy = false; this.stage(); this.format(); this.reset();
      this.message("Choose a setting and frame. Your bowl stays as you left it.");
    } catch (error) { this.studio?.dispose(); this.studio = null; this.message(String(error)); }
    this.find<HTMLButtonElement>("photo-close").focus();
  }
  private stage() {
    const backdrop = this.value("photo-backdrop") as PhotoBackdrop;
    this.find<HTMLSelectElement>("photo-perch").disabled = backdrop === "transparent";
    this.studio?.setPhotoStage(backdrop, this.value("photo-perch") as PhotoPerch);
    this.find("photo-size").textContent = this.sizeLabel();
  }
  private sizeLabel() {
    const size = PHOTO_SIZES[this.value("photo-format") as PhotoFormat];
    return `${size.width} × ${size.height} PNG · ${this.value("photo-backdrop") === "transparent" ? "transparent background; perches omitted" : "opaque background"}`;
  }
  private format() {
    const size = PHOTO_SIZES[this.value("photo-format") as PhotoFormat];
    this.find("photo-canvas").parentElement!.style.aspectRatio = `${size.width} / ${size.height}`;
    this.find("photo-size").textContent = this.sizeLabel();
    this.frame();
  }
  private reset() {
    this.find<HTMLInputElement>("photo-zoom").value = "1";
    this.find<HTMLInputElement>("photo-horizontal").value = "0";
    this.find<HTMLInputElement>("photo-vertical").value = "0"; this.frame();
  }
  private frame() {
    if (this.pose) this.studio?.setCameraPose(framePhotoCamera(this.pose, Number(this.value("photo-zoom")), Number(this.value("photo-horizontal")), Number(this.value("photo-vertical"))), "free", false);
  }
  private capture() {
    if (!this.studio) throw new Error("Close Photograph and reopen it before capturing.");
    const size = PHOTO_SIZES[this.value("photo-format") as PhotoFormat];
    return this.studio.capturePhotoFrame(size.width, size.height);
  }
  private async export() {
    if (this.busy) return;
    this.busy = true; const session = this.session;
    this.find<HTMLButtonElement>("photo-export").disabled = true;
    try {
      const canvas = this.capture();
      const blob = await new Promise<Blob>((resolve, reject) => canvas.toBlob((value) => value ? resolve(value) : reject(new Error("This browser could not create the PNG.")), "image/png"));
      if (session !== this.session || !this.dialog.open) return;
      const url = URL.createObjectURL(blob); const link = document.createElement("a");
      link.href = url; link.download = `living-line-${canvas.width}x${canvas.height}.png`; document.body.append(link);
      try { link.click(); } finally { link.remove(); setTimeout(() => URL.revokeObjectURL(url), 30_000); }
      this.message(`PNG prepared: ${canvas.width} × ${canvas.height}. Check your browser’s downloads.`);
    } catch (error) { if (session === this.session) this.message(error instanceof Error ? error.message : String(error)); }
    finally { if (session === this.session) { this.busy = false; this.find<HTMLButtonElement>("photo-export").disabled = false; } }
  }
  private keep() {
    if (!this.snapshot?.plants.length || !this.actions.canKeep() || !this.studio) return;
    try {
      const frame = this.capture(); const cover = document.createElement("canvas"); cover.width = 360; cover.height = 270;
      const context = cover.getContext("2d"); if (!context) throw new Error("This browser cannot prepare a cover.");
      // JPEG is the existing Garden format. Transparent cutouts receive a paper matte.
      context.fillStyle = "#eee9dd"; context.fillRect(0, 0, 360, 270);
      const scale = Math.min(360 / frame.width, 270 / frame.height);
      context.drawImage(frame, (360 - frame.width * scale) / 2, (270 - frame.height * scale) / 2, frame.width * scale, frame.height * scale);
      const thumbnail = cover.toDataURL("image/jpeg", 0.78);
      if (thumbnail.length > 80_000) throw new Error("This cover is too large. Try a simpler frame.");
      const snapshot = validateArrangement({ ...this.snapshot, camera: this.studio.getCameraPose() });
      const id = this.actions.keep(snapshot, thumbnail, this.value("photo-name"));
      this.dialog.dataset.keptId = id;
      this.message("Photo kept in Garden. Your working bowl is unchanged.");
    } catch (error) { this.message(error instanceof Error ? error.message : String(error)); }
  }
  private release() {
    this.session++; this.studio?.dispose(); this.studio = null; this.snapshot = null; this.pose = null; this.busy = false;
    this.root.querySelector<HTMLButtonElement>("#more-toggle")?.focus();
  }
  destroy() { this.abort.abort(); this.release(); this.dialog.remove(); this.opener.remove(); }
}
