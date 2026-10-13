import { NEUTRAL_PHOTO_ADJUSTMENTS, PHOTO_ADJUSTMENT_CONTROLS, neutralPhotoAdjustments, validatePhotoAdjustments, type PhotoAdjustments } from "../presentation/photoAdjustments.ts";
import { DEFAULT_SCENE, sceneProfile, validateScene, withPhotoAdjustments, type SceneSettings } from "./scene.ts";
import { fromCanonicalPlantGraph } from "../core/index.ts";
import { ThreeStudio, type CanonicalView, type StudioCameraPose } from "../presentation/ThreeStudio.ts";
import { framePhotoCamera, PHOTO_SIZES, PHOTO_BACKDROPS, PHOTO_PERCHES, type PhotoBackdrop, type PhotoPerch, type PhotoFormat } from "../presentation/photoStage.ts";
import { validateArrangement, type ArrangementSnapshot } from "./garden.ts";
import { PhotoExport, photoShareData, sharePhoto, type PreparedPhoto } from "./photoExport.ts";

interface PhotoActions {
  pause(): void;
  snapshot(): ArrangementSnapshot;
  canKeep(): boolean;
  keep(snapshot: ArrangementSnapshot, thumbnail: string | null, title: string): string;
}
type PhotoStudio = Pick<ThreeStudio, "upsertGraph" | "setPhotoAdjustments" | "setPhotoStage" | "setStemFibers" | "setCanonicalView" | "getCameraPose" | "setCameraPose" | "capturePhotoFrame" | "dispose">;
type PhotoStudioFactory = (canvas: HTMLCanvasElement, scene: SceneSettings) => PhotoStudio;
const createPhotoStudio: PhotoStudioFactory = (canvas, scene) => new ThreeStudio(canvas, { photography: true, maxPixelRatio: 1.5, vesselProfile: sceneProfile(scene), vesselAppearance: scene, photoAdjustments: scene.photoAdjustments, botanicalTones: scene.botanicalTones });

/** Disposable presentation of a committed copy. Closing never touches the working coordinator. */
export class Photograph {
  private readonly dialog: HTMLDialogElement;
  private readonly opener: HTMLButtonElement;
  private studio: PhotoStudio | null = null;
  private snapshot: ArrangementSnapshot | null = null;
  private pose: StudioCameraPose | null = null;
  private session = 0;
  private frameRevision = 0;
  private busy = false;
  private graphicsReady = false;
  private sharing = false;
  private showingOriginal = false;
  private readonly imageExport = new PhotoExport();
  private shareData: ShareData | null = null;
  private readonly abort = new AbortController();
  constructor(private readonly root: HTMLElement, private readonly actions: PhotoActions, private readonly createStudio: PhotoStudioFactory = createPhotoStudio) {
    this.opener = document.createElement("button"); this.opener.id = "photo-open"; this.opener.type = "button";
    this.opener.textContent = "Photograph"; this.opener.setAttribute("aria-haspopup", "dialog");
    root.querySelector("#more-options")!.append(this.opener);
    this.dialog = document.createElement("dialog"); this.dialog.id = "photo-dialog"; this.dialog.className = "photo-dialog";
    this.dialog.setAttribute("aria-labelledby", "photo-title");
    this.dialog.innerHTML = `
      <div class="panel-heading"><div><p class="eyebrow">A moment to keep</p><h1 id="photo-title">Photograph</h1></div><button id="photo-close" type="button" aria-label="Close Photograph">×</button></div>
      <p class="photo-intro">Choose a setting, compose the frame, and keep the moment. Your working bowl stays as you left it.</p>
      <div class="photo-layout"><div class="photo-preview">
        <div class="photo-mat"><div class="photo-frame"><canvas id="photo-canvas" aria-label="Live photograph preview"></canvas><div id="photo-grid" class="photo-grid" hidden aria-hidden="true"></div></div></div>
        <div class="photo-preview-footer"><p id="photo-size" class="panel-note"></p><label class="photo-check"><input id="photo-grid-toggle" type="checkbox"> Composition grid</label></div>
        <section id="photo-result" class="photo-result" hidden aria-labelledby="photo-result-title">
          <div class="photo-result-heading"><div><p class="eyebrow">Your PNG</p><h2 id="photo-result-title">Ready to save</h2></div><span id="photo-result-size"></span></div>
          <p id="photo-result-note">This is the prepared image. Save it using one of the options below.</p>
          <img id="photo-result-image" alt="Prepared Living Line photograph" draggable="true">
          <div class="photo-save-actions"><a id="photo-download" class="photo-primary">Download PNG</a><button id="photo-share" type="button" hidden>Share image…</button><a id="photo-open-image" target="_blank" rel="noopener">Open image</a></div>
          <p class="panel-note">If a download does not appear, try Share image or Open image. You can also press and hold the image to see your browser’s saving options.</p>
          <p id="photo-delivery-message" role="status" aria-live="polite"></p>
        </section>
      </div>
      <div class="photo-controls">
        <fieldset><legend>Scene</legend>
        <label>Backdrop <select id="photo-backdrop"></select></label>
        <label>Perch <select id="photo-perch"></select></label>
        <label class="photo-check"><input id="photo-fibers" type="checkbox"> Subtle stem fibers</label>
        </fieldset>
        <fieldset><legend>Frame</legend>
        <label>Frame <select id="photo-format"><option value="landscape">Landscape · 4:3</option><option value="portrait">Portrait · 3:4</option><option value="square">Square · 1:1</option></select></label>
        <label>View <select id="photo-view"><option value="current">My current view</option><option value="front">Front</option><option value="three-quarter">Three-quarter</option><option value="above">Above</option></select></label>
        <label><span class="photo-range-label">Closer <output id="photo-zoom-value" for="photo-zoom">1.00×</output></span><input id="photo-zoom" type="range" min="0.8" max="1.8" step="0.01" value="1"></label>
        <label><span class="photo-range-label">Across <output id="photo-horizontal-value" for="photo-horizontal">Centre</output></span><input id="photo-horizontal" type="range" min="-2" max="2" step="0.02" value="0"></label>
        <label><span class="photo-range-label">Height <output id="photo-vertical-value" for="photo-vertical">Centre</output></span><input id="photo-vertical" type="range" min="-2" max="2" step="0.02" value="0"></label>
        <button id="photo-reset" type="button">Reset framing</button>
        </fieldset>
        <fieldset class="photo-finish"><legend>Finish</legend>
        <p class="panel-note">A little light and colour, just for this photograph.</p>
        ${PHOTO_ADJUSTMENT_CONTROLS.map(({ id, label, min, max, step }) => `<label><span class="photo-range-label">${label} <output id="photo-${id}-value" for="photo-${id}">0</output></span><input id="photo-${id}" type="range" min="${min}" max="${max}" step="${step}" value="0"></label>`).join("")}
        <div class="photo-finish-actions"><button id="photo-before" type="button" aria-pressed="false">Show original</button><button id="photo-reset-finish" type="button">Reset finish</button></div>
        </fieldset>
        <fieldset><legend>Save</legend>
        <button id="photo-export" class="photo-primary" type="button">Prepare PNG</button>
        <p class="panel-note">Makes a full-size image you can save or share.</p>
        <label>Garden title <input id="photo-name" type="text" maxlength="80" placeholder="A quiet afternoon"></label>
        <button id="photo-keep" type="button">Keep photo in Garden</button>
        <p class="panel-note">Garden keeps the scene and view with a small cover image.</p>
        </fieldset>
        <p id="photo-message" role="status" aria-live="polite"></p>
      </div></div>`;
    root.append(this.dialog);
    for (const [id, options] of [["photo-backdrop", PHOTO_BACKDROPS], ["photo-perch", PHOTO_PERCHES]] as const) {
      for (const { id: value, label } of options) {
        const option = document.createElement("option"); option.value = value; option.textContent = label;
        this.find<HTMLSelectElement>(id).append(option);
      }
    }
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
    this.find<HTMLInputElement>("photo-fibers").addEventListener("change", () => { this.changedFrame(); this.studio?.setStemFibers(this.find<HTMLInputElement>("photo-fibers").checked); }, { signal });
    this.find<HTMLInputElement>("photo-grid-toggle").addEventListener("change", () => { this.find("photo-grid").hidden = !this.find<HTMLInputElement>("photo-grid-toggle").checked; }, { signal });
    for (const { id } of PHOTO_ADJUSTMENT_CONTROLS) this.find(`photo-${id}`).addEventListener("input", () => this.finish(), { signal });
    this.find("photo-reset-finish").addEventListener("click", () => {
      this.loadFinish(NEUTRAL_PHOTO_ADJUSTMENTS); this.finish();
    }, { signal });
    this.find("photo-before").addEventListener("click", () => {
      this.showingOriginal = !this.showingOriginal; this.finish(false);
    }, { signal });
    this.find("photo-reset").addEventListener("click", () => this.reset(), { signal });
    this.find("photo-export").addEventListener("click", () => { void this.export(); }, { signal });
    this.find("photo-share").addEventListener("click", () => { void this.share(); }, { signal });
    this.find("photo-download").addEventListener("click", () => this.deliveryMessage("Download requested. If no file appears, try Share image or Open image."), { signal });
    this.find("photo-open-image").addEventListener("click", () => { this.imageExport.preserveOpenedImage(); this.deliveryMessage("Open requested. If your browser opens a new image tab, use its save or share options."); }, { signal });
    this.find("photo-keep").addEventListener("click", () => this.keep(), { signal });
    this.find<HTMLCanvasElement>("photo-canvas").addEventListener("webglcontextlost", (event) => {
      event.preventDefault(); this.graphicsReady = false; this.changedFrame();
      this.find<HTMLButtonElement>("photo-keep").disabled = true;
      this.message(`Graphics paused. Close Photograph and reopen it before capturing.${this.imageExport.current ? " Your prepared image is still available below the preview." : ""}`);
    }, { signal });
  }
  private find<T extends HTMLElement = HTMLElement>(id: string): T { return this.dialog.querySelector<T>(`#${id}`)!; }
  private value(id: string) { return this.find<HTMLInputElement | HTMLSelectElement>(id).value; }
  private message(value: string) { this.find("photo-message").textContent = value; }
  private deliveryMessage(value: string) { this.find("photo-delivery-message").textContent = value; }
  private open() {
    if (this.dialog.open) return;
    this.actions.pause(); this.snapshot = validateArrangement(this.actions.snapshot(), Infinity);
    this.root.querySelector<HTMLElement>("#more-options")!.hidden = true;
    this.dialog.showModal(); this.session++;
    this.graphicsReady = false;
    this.find<HTMLButtonElement>("photo-export").disabled = true;
    this.find<HTMLButtonElement>("photo-keep").disabled = true;
    delete this.dialog.dataset.keptId;
    try {
      const scene = this.snapshot.scene ?? DEFAULT_SCENE;
      this.studio = this.createStudio(this.find<HTMLCanvasElement>("photo-canvas"), scene);
      for (const [id, value] of [["photo-backdrop", scene.backdropId], ["photo-perch", scene.perchId], ["photo-format", scene.photoFormat]]) this.find<HTMLSelectElement>(id).value = value;
      for (const graph of this.snapshot.plants) this.studio.upsertGraph(fromCanonicalPlantGraph(graph));
      this.pose = this.snapshot.camera; this.find<HTMLSelectElement>("photo-view").value = "current";
      this.find<HTMLInputElement>("photo-fibers").checked = scene.stemFibers; this.studio.setStemFibers(scene.stemFibers);
      this.find<HTMLButtonElement>("photo-keep").disabled = !this.snapshot.plants.length || !this.actions.canKeep();
      this.graphicsReady = true;
      this.loadFinish(scene.photoAdjustments ?? NEUTRAL_PHOTO_ADJUSTMENTS); this.finish();
      this.busy = false; this.stage(); this.format(); this.reset();
      this.message("Ready to frame.");
    } catch (error) {
      this.graphicsReady = false; this.imageExport.invalidate(); this.busy = false;
      this.find<HTMLButtonElement>("photo-export").disabled = true;
      this.find<HTMLButtonElement>("photo-keep").disabled = true;
      this.studio?.dispose(); this.studio = null; this.message(String(error));
    }
    this.find<HTMLButtonElement>("photo-close").focus();
  }
  private stage() {
    this.changedFrame();
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
    this.changedFrame();
    for (const id of ["photo-zoom", "photo-horizontal", "photo-vertical"]) {
      const value = Number(this.value(id));
      const text = id === "photo-zoom" ? `${value.toFixed(2)}×` : value === 0 ? "Centre" : `${value > 0 ? "+" : ""}${value.toFixed(2)}`;
      this.find(`${id}-value`).textContent = text;
      this.find(id).setAttribute("aria-valuetext", text);
    }
    if (this.pose) this.studio?.setCameraPose(framePhotoCamera(this.pose, Number(this.value("photo-zoom")), Number(this.value("photo-horizontal")), Number(this.value("photo-vertical"))), "free", false);
  }
  private loadFinish(recipe: Readonly<PhotoAdjustments>) {
    for (const { id } of PHOTO_ADJUSTMENT_CONTROLS) this.find<HTMLInputElement>(`photo-${id}`).value = String(recipe[id]);
  }
  private currentFinish(): PhotoAdjustments {
    return validatePhotoAdjustments({ version: 1, ...Object.fromEntries(PHOTO_ADJUSTMENT_CONTROLS.map(({ id }) => [id, Number(this.value(`photo-${id}`))])) });
  }
  private finish(resetComparison = true) {
    if (resetComparison) this.showingOriginal = false;
    this.changedFrame();
    const recipe = this.currentFinish();
    for (const { id } of PHOTO_ADJUSTMENT_CONTROLS) {
      const n = recipe[id], text = id === "exposure" ? `${n > 0 ? "+" : ""}${n.toFixed(2)} EV` : `${n > 0 ? "+" : ""}${Math.round(n * 100)}`;
      this.find(`photo-${id}-value`).textContent = text; this.find(`photo-${id}`).setAttribute("aria-valuetext", text);
    }
    const before = this.find<HTMLButtonElement>("photo-before");
    before.textContent = this.showingOriginal ? "Show finish" : "Show original";
    before.setAttribute("aria-pressed", String(this.showingOriginal));
    before.disabled = neutralPhotoAdjustments(recipe);
    this.studio?.setPhotoAdjustments(this.showingOriginal ? undefined : recipe);
    this.find("photo-canvas").setAttribute("aria-label", this.showingOriginal ? "Original photograph preview, without finish" : "Live photograph preview");
    this.message(this.showingOriginal ? "Showing the original. PNG and Garden will use this view without the finish." : "Finish applied to the preview, PNG and Garden photo.");
  }
  private changedFrame() {
    const wasPreparing = this.busy;
    this.frameRevision++; this.imageExport.invalidate(); this.busy = false;
    this.find<HTMLButtonElement>("photo-export").disabled = !this.graphicsReady;
    this.find("photo-export").textContent = this.imageExport.current ? "Prepare new PNG" : "Prepare PNG";
    if (this.imageExport.current) this.find("photo-result-note").textContent = "This image uses your earlier frame. Prepare a new PNG to include the changes above.";
    if (wasPreparing) this.message("Frame changed. Prepare a new PNG when you are ready.");
  }
  private capture() {
    if (!this.studio || !this.graphicsReady) throw new Error("Close Photograph and reopen it before capturing.");
    const size = PHOTO_SIZES[this.value("photo-format") as PhotoFormat];
    return this.studio.capturePhotoFrame(size.width, size.height);
  }
  private async export() {
    if (this.busy || !this.graphicsReady) return;
    this.busy = true; const session = this.session, revision = this.frameRevision;
    this.find<HTMLButtonElement>("photo-export").disabled = true;
    this.find("photo-export").textContent = "Preparing…";
    this.message("Preparing the full-size PNG…");
    try {
      const photo = await this.imageExport.prepare(this.capture());
      if (!photo || session !== this.session || revision !== this.frameRevision || !this.dialog.open) return;
      this.showPrepared(photo);
      this.message("PNG ready below the preview. Choose Download, Share image, or Open image.");
    } catch (error) { if (session === this.session && revision === this.frameRevision) this.message(error instanceof Error ? error.message : String(error)); }
    finally {
      if (session === this.session && revision === this.frameRevision) {
        this.busy = false; this.find<HTMLButtonElement>("photo-export").disabled = !this.graphicsReady;
        this.find("photo-export").textContent = this.imageExport.current ? "Prepare new PNG" : "Prepare PNG";
      }
    }
  }
  private showPrepared(photo: PreparedPhoto) {
    this.find("photo-result").hidden = false;
    this.find<HTMLImageElement>("photo-result-image").src = photo.url;
    this.find("photo-result-size").textContent = `${photo.width} × ${photo.height}`;
    this.find("photo-result-note").textContent = "This is the prepared image. Save it using one of the options below.";
    const download = this.find<HTMLAnchorElement>("photo-download"); download.href = photo.url; download.download = photo.name;
    this.find<HTMLAnchorElement>("photo-open-image").href = photo.url;
    this.shareData = photoShareData(photo, navigator);
    this.find<HTMLButtonElement>("photo-share").hidden = !this.shareData;
    this.find<HTMLButtonElement>("photo-share").disabled = this.sharing;
    this.deliveryMessage("The PNG is ready here. It has not been saved to your device yet.");
    download.focus();
  }
  private async share() {
    const photo = this.imageExport.current, data = this.shareData, session = this.session;
    if (!photo || !data || this.sharing) return;
    this.sharing = true; this.find<HTMLButtonElement>("photo-share").disabled = true;
    try {
      // No encode or other asynchronous work may precede sharePhoto: the click
      // supplies the transient activation required by browser file sharing.
      const result = await sharePhoto(data, navigator);
      if (session === this.session && this.imageExport.current === photo) this.deliveryMessage(result === "cancelled" ? "Share cancelled. Your image is still available here." : "Image shared. Your prepared PNG is still available here.");
    } catch {
      if (session === this.session && this.imageExport.current === photo) this.deliveryMessage("This browser could not share the image. Try Download PNG or Open image; the PNG is still here.");
    } finally {
      if (session === this.session) { this.sharing = false; this.find<HTMLButtonElement>("photo-share").disabled = false; }
    }
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
      const scene = validateScene(withPhotoAdjustments({ ...(this.snapshot.scene ?? DEFAULT_SCENE),
        backdropId: this.value("photo-backdrop") as PhotoBackdrop, perchId: this.value("photo-perch") as PhotoPerch, photoFormat: this.value("photo-format") as PhotoFormat, stemFibers: this.find<HTMLInputElement>("photo-fibers").checked }, this.showingOriginal ? { ...NEUTRAL_PHOTO_ADJUSTMENTS } : this.currentFinish()));
      const snapshot = validateArrangement({ ...this.snapshot, scene, camera: this.studio.getCameraPose() }, Infinity);
      const id = this.actions.keep(snapshot, thumbnail, this.value("photo-name"));
      this.dialog.dataset.keptId = id;
      this.message("Photo kept in Garden. Your working bowl is unchanged.");
    } catch (error) { this.message(error instanceof Error ? error.message : String(error)); }
  }
  private release() {
    this.session++; this.imageExport.clear(); this.shareData = null; this.sharing = false;
    this.find("photo-result").hidden = true;
    for (const id of ["photo-result-image", "photo-download", "photo-open-image"]) this.find(id).removeAttribute(id === "photo-result-image" ? "src" : "href");
    this.deliveryMessage(""); this.studio?.dispose(); this.studio = null; this.snapshot = null; this.pose = null; this.busy = false; this.graphicsReady = false;
    this.root.querySelector<HTMLButtonElement>("#more-toggle")?.focus();
  }
  destroy() { this.abort.abort(); this.release(); this.dialog.remove(); this.opener.remove(); }
}
