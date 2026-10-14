import { NEUTRAL_PHOTO_ADJUSTMENTS, PHOTO_ADJUSTMENT_CONTROLS, neutralPhotoAdjustments, validatePhotoAdjustments, type PhotoAdjustments } from "../presentation/photoAdjustments.ts";
import { DEFAULT_SCENE, sceneProfile, validateScene, withPhotoAdjustments, withPhotoLighting, type SceneSettings } from "./scene.ts";
import { fromCanonicalPlantGraph } from "../core/index.ts";
import { ThreeStudio, type CanonicalView, type StudioCameraPose } from "../presentation/ThreeStudio.ts";
import { PHOTO_FRAMING_CONTROLS } from "../presentation/photoFraming.ts";
import { PHOTO_LIGHTING, validatePhotoLighting, type PhotoLightingId } from "../presentation/photoLighting.ts";
import { framePhotoCamera, PHOTO_SIZES, PHOTO_BACKDROPS, PHOTO_PERCHES, type PhotoBackdrop, type PhotoPerch, type PhotoFormat } from "../presentation/photoStage.ts";
import { validateArrangement, type ArrangementSnapshot } from "./garden.ts";
import { PhotoDraftMemory, type PhotoDraft, type PhotoDraftContext } from "./photoDraft.ts";
import { PhotoExport, photoShareData, sharePhoto, type PreparedPhoto } from "./photoExport.ts";

interface PhotoActions {
  pause(): void;
  snapshot(): ArrangementSnapshot;
  context(): PhotoDraftContext;
  returnToArrange(): void;
  canKeep(): boolean;
  keep(snapshot: ArrangementSnapshot, thumbnail: string | null, title: string): string;
}
type PhotoStudio = Pick<ThreeStudio, "upsertGraph" | "setPhotoLighting" | "setPhotoAdjustments" | "setPhotoStage" | "setStemFibers" | "setCanonicalView" | "getCameraPose" | "setCameraPose" | "capturePhotoFrame" | "dispose">;
type PhotoStudioFactory = (canvas: HTMLCanvasElement, scene: SceneSettings) => PhotoStudio;
const PHOTO_PANELS = ["scene", "frame", "finish", "save"] as const;
type PhotoPanel = typeof PHOTO_PANELS[number];

const createPhotoStudio: PhotoStudioFactory = (canvas, scene) => new ThreeStudio(canvas, { photography: true, maxPixelRatio: 1.5, vesselProfile: sceneProfile(scene), vesselAppearance: scene, photoAdjustments: scene.photoAdjustments, photoLighting: scene.photoLighting, botanicalTones: scene.botanicalTones });

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
  // Keep the exact loaded recipe until the user touches this mapped control.
  private saturation = 0;
  private panel: PhotoPanel = "scene";
  private readonly drafts = new PhotoDraftMemory();
  private draftContext: PhotoDraftContext = null;
  private draftReady = false;
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
      <div class="photo-heading"><h1 id="photo-title">Photograph</h1><button id="photo-return" type="button">Return to arranging</button><button id="photo-close" type="button" aria-label="Close Photograph">×</button></div>
      <div class="photo-layout"><div class="photo-preview" aria-label="Composition">
        <div id="photo-mat" class="photo-mat"><div class="photo-frame"><canvas id="photo-canvas" aria-label="Live photograph preview"></canvas><div id="photo-grid" class="photo-grid" hidden aria-hidden="true"></div></div></div>
      </div>
      <div class="photo-tools">
      <div class="photo-tabs" role="tablist" aria-label="Photograph controls">
        ${PHOTO_PANELS.map((id) => `<button id="photo-tab-${id}" type="button" role="tab" aria-controls="photo-panel-${id}" aria-selected="${id === "scene"}" tabindex="${id === "scene" ? "0" : "-1"}">${id[0].toUpperCase() + id.slice(1)}</button>`).join("")}
      </div>
      <div id="photo-controls" class="photo-controls">
        <section id="photo-panel-scene" class="photo-panel" role="tabpanel" aria-labelledby="photo-tab-scene" tabindex="0">
        <p class="photo-intro">Choose a setting. Your working bowl stays as you left it.</p>
        <fieldset><legend>Scene</legend>
        <label>Backdrop <select id="photo-backdrop"></select></label>
        <label>Perch <select id="photo-perch"></select></label>
        <label>Lighting <select id="photo-lighting"></select></label><p id="photo-lighting-description" class="panel-note"></p>
        <label class="photo-check"><input id="photo-fibers" type="checkbox"> Subtle stem fibers</label>
        </fieldset></section>
        <section id="photo-panel-frame" class="photo-panel" role="tabpanel" aria-labelledby="photo-tab-frame" tabindex="0" hidden>
        <fieldset><legend>Frame</legend>
        <label>Frame <select id="photo-format"><option value="landscape">Landscape · 4:3</option><option value="portrait">Portrait · 3:4</option><option value="square">Square · 1:1</option></select></label>
        <label>View <select id="photo-view"><option value="current">My current view</option><option value="front">Front</option><option value="three-quarter">Three-quarter</option><option value="above">Above</option></select></label>
        ${PHOTO_FRAMING_CONTROLS.slice(0, 3).map(({ id, label, min, max, step, neutral }) => `<label><span class="photo-range-label">${label} <output id="photo-${id}-value" for="photo-${id}"></output></span><input id="photo-${id}" type="range" min="${min}" max="${max}" step="${step}" value="${neutral}"></label>`).join("")}
        <details class="photo-angle-controls"><summary>Turn and tilt</summary>
        ${PHOTO_FRAMING_CONTROLS.slice(3).map(({ id, label, min, max, step, neutral }) => `<label><span class="photo-range-label">${label} <output id="photo-${id}-value" for="photo-${id}"></output></span><input id="photo-${id}" type="range" min="${min}" max="${max}" step="${step}" value="${neutral}"></label>`).join("")}
        <p class="panel-note">Elevation stays above the bowl. Tilt gently rotates the photograph.</p>
        </details>
        <button id="photo-reset" type="button">Reset framing</button>
        <label class="photo-check"><input id="photo-grid-toggle" type="checkbox"> Composition grid</label>
        <p id="photo-size" class="panel-note"></p>
        </fieldset></section>
        <section id="photo-panel-finish" class="photo-panel" role="tabpanel" aria-labelledby="photo-tab-finish" tabindex="0" hidden>
        <fieldset class="photo-finish"><legend>Finish</legend>
        <p class="panel-note">A little light and colour, just for this photograph.</p>
        ${PHOTO_ADJUSTMENT_CONTROLS.map(({ id, label, min, max, step }) => `<label><span class="photo-range-label">${label} <output id="photo-${id}-value" for="photo-${id}">0</output></span><input id="photo-${id}" type="range" min="${min}" max="${id === "saturation" ? 1 : max}" step="${step}" value="0"></label>`).join("")}
        <div class="photo-finish-actions"><button id="photo-before" type="button" aria-pressed="false">Show original</button><button id="photo-reset-finish" type="button">Reset finish</button></div>
        </fieldset></section>
        <section id="photo-panel-save" class="photo-panel" role="tabpanel" aria-labelledby="photo-tab-save" tabindex="0" hidden>
        <fieldset><legend>Save</legend>
        <button id="photo-export" class="photo-primary" type="button">Prepare PNG</button>
        <p class="panel-note">Makes a full-size image you can save or share.</p>
        <label>Garden title <input id="photo-name" type="text" maxlength="80" placeholder="A quiet afternoon"></label>
        <button id="photo-keep" type="button">Keep photo in Garden</button>
        <p class="panel-note">Garden keeps the scene and view with a small cover image.</p>
        </fieldset>
        <section id="photo-result" class="photo-result" hidden aria-labelledby="photo-result-title">
          <div class="photo-result-heading"><div><p class="eyebrow">Your PNG</p><h2 id="photo-result-title">Ready to save</h2></div><span id="photo-result-size"></span></div>
          <p id="photo-result-note">This is the prepared image. Save it using one of the options below.</p>
          <img id="photo-result-image" alt="Prepared Living Line photograph" draggable="true">
          <div class="photo-save-actions"><a id="photo-download" class="photo-primary">Download PNG</a><button id="photo-share" type="button" hidden>Share image…</button><a id="photo-open-image" target="_blank" rel="noopener">Open image</a></div>
          <p id="photo-save-help" class="panel-note"></p>
          <p id="photo-delivery-message" role="status" aria-live="polite"></p>
        </section>
        <details class="photo-setup-note"><summary>About this photo setup</summary><p id="photo-draft-note" class="panel-note"></p><button id="photo-reset-setup" type="button">Reset photo setup</button></details>
        </section>
      </div>
      <p id="photo-message" role="status" aria-live="polite" aria-atomic="true"></p>
      </div></div>`;
    root.append(this.dialog);
    for (const [id, options] of [["photo-backdrop", PHOTO_BACKDROPS], ["photo-perch", PHOTO_PERCHES], ["photo-lighting", PHOTO_LIGHTING]] as const) {
      for (const { id: value, label } of options) {
        const option = document.createElement("option"); option.value = value; option.textContent = label;
        this.find<HTMLSelectElement>(id).append(option);
      }
    }
    const signal = this.abort.signal;
    for (const [index, id] of PHOTO_PANELS.entries()) {
      const tab = this.find(`photo-tab-${id}`);
      tab.addEventListener("click", () => this.showPanel(id), { signal });
      tab.addEventListener("keydown", (event) => {
        const key = (event as KeyboardEvent).key;
        const next = key === "ArrowRight" ? (index + 1) % PHOTO_PANELS.length : key === "ArrowLeft" ? (index + PHOTO_PANELS.length - 1) % PHOTO_PANELS.length : key === "Home" ? 0 : key === "End" ? PHOTO_PANELS.length - 1 : null;
        if (next === null) return;
        event.preventDefault(); this.showPanel(PHOTO_PANELS[next]); this.find(`photo-tab-${PHOTO_PANELS[next]}`).focus();
      }, { signal });
    }
    this.opener.addEventListener("click", () => this.open(), { signal });
    this.find("photo-close").addEventListener("click", () => this.dialog.close(), { signal });
    this.dialog.addEventListener("close", () => this.release(), { signal });
    this.find("photo-return").addEventListener("click", () => { this.dialog.close(); this.actions.returnToArrange(); }, { signal });
    this.find("photo-reset-setup").addEventListener("click", () => {
      this.drafts.forget(this.draftContext); this.loadSetup(null);
      this.message("Photo setup reset to the bowl’s current setting and view.");
    }, { signal });
    this.find("photo-backdrop").addEventListener("change", () => this.stage(), { signal });
    this.find("photo-perch").addEventListener("change", () => this.stage(), { signal });
    this.find("photo-lighting").addEventListener("change", () => this.lighting(), { signal });
    this.find("photo-format").addEventListener("change", () => this.format(), { signal });
    this.find("photo-view").addEventListener("change", () => {
      const view = this.value("photo-view");
      if (view === "current") this.pose = this.snapshot?.camera ?? null;
      else { this.studio?.setCanonicalView(view as CanonicalView, false); this.pose = this.studio?.getCameraPose() ?? null; }
      this.reset();
    }, { signal });
    for (const { id } of PHOTO_FRAMING_CONTROLS) this.find(`photo-${id}`).addEventListener("input", () => this.frame(), { signal });
    this.find<HTMLInputElement>("photo-fibers").addEventListener("change", () => { this.changedFrame(); this.studio?.setStemFibers(this.find<HTMLInputElement>("photo-fibers").checked); }, { signal });
    this.find<HTMLInputElement>("photo-grid-toggle").addEventListener("change", () => { this.find("photo-grid").hidden = !this.find<HTMLInputElement>("photo-grid-toggle").checked; }, { signal });
    for (const { id } of PHOTO_ADJUSTMENT_CONTROLS) this.find(`photo-${id}`).addEventListener("input", () => {
      if (id === "saturation") { const value = Number(this.value("photo-saturation")); this.saturation = value > 0 ? value * .6 : value; }
      this.finish();
    }, { signal });
    this.find("photo-reset-finish").addEventListener("click", () => {
      this.loadFinish(NEUTRAL_PHOTO_ADJUSTMENTS); this.finish();
    }, { signal });
    this.find("photo-before").addEventListener("click", () => {
      this.showingOriginal = !this.showingOriginal; this.finish(false);
    }, { signal });
    this.find("photo-reset").addEventListener("click", () => this.reset(), { signal });
    this.find("photo-export").addEventListener("click", () => { void this.export(); }, { signal });
    this.find("photo-share").addEventListener("click", () => { void this.share(); }, { signal });
    this.find("photo-download").addEventListener("click", () => this.deliveryMessage(`Download requested. If no file appears, try ${this.shareData ? "Share image or " : ""}Open image.`), { signal });
    this.find("photo-open-image").addEventListener("click", () => { this.imageExport.preserveOpenedImage(); this.deliveryMessage("Open requested. If your browser opens a new image tab, use its save or share options."); }, { signal });
    this.find("photo-keep").addEventListener("click", () => this.keep(), { signal });
    this.find<HTMLCanvasElement>("photo-canvas").addEventListener("webglcontextlost", (event) => {
      event.preventDefault(); this.graphicsReady = false; this.changedFrame();
      this.find<HTMLButtonElement>("photo-keep").disabled = true;
      this.message(`Graphics paused. Close Photograph and reopen it before capturing.${this.imageExport.current ? " Your prepared image is still available in Save." : ""}`);
    }, { signal });
  }
  private showPanel(panel: PhotoPanel) {
    this.panel = panel;
    for (const id of PHOTO_PANELS) {
      const active = id === panel, tab = this.find(`photo-tab-${id}`);
      tab.setAttribute("aria-selected", String(active)); tab.setAttribute("tabindex", active ? "0" : "-1");
      this.find(`photo-panel-${id}`).hidden = !active;
    }
    this.find("photo-controls").scrollTop = 0;
  }
  private find<T extends HTMLElement = HTMLElement>(id: string): T { return this.dialog.querySelector<T>(`#${id}`)!; }
  private value(id: string) { return this.find<HTMLInputElement | HTMLSelectElement>(id).value; }
  private message(value: string) { this.find("photo-message").textContent = value; }
  private deliveryMessage(value: string) { this.find("photo-delivery-message").textContent = value; }
  private open() {
    if (this.dialog.open) return;
    this.actions.pause(); this.snapshot = validateArrangement(this.actions.snapshot(), Infinity);
    this.root.querySelector<HTMLElement>("#more-options")!.hidden = true;
    this.dialog.showModal(); this.session++; this.showPanel(this.panel);
    this.graphicsReady = false; this.draftReady = false;
    this.find<HTMLButtonElement>("photo-export").disabled = true;
    this.find<HTMLButtonElement>("photo-keep").disabled = true;
    delete this.dialog.dataset.keptId;
    try {
      const scene = this.snapshot.scene ?? DEFAULT_SCENE;
      this.studio = this.createStudio(this.find<HTMLCanvasElement>("photo-canvas"), scene);
      // Always rebuild from the latest committed plants and scene. A draft has
      // no plants, vessel or botanical tones with which to overwrite that copy.
      for (const graph of this.snapshot.plants) this.studio.upsertGraph(fromCanonicalPlantGraph(graph));
      this.draftContext = this.actions.context();
      const draft = this.drafts.restore(this.draftContext);
      this.find<HTMLButtonElement>("photo-keep").disabled = !this.snapshot.plants.length || !this.actions.canKeep();
      this.graphicsReady = true; this.busy = false;
      this.loadSetup(draft); this.draftReady = true;
      this.find("photo-return").textContent = this.draftContext === null ? "Return to viewing" : "Return to arranging";
      this.message(draft ? "Resumed your photo setup with the latest committed cuttings." : "Ready to frame.");
    } catch (error) {
      this.graphicsReady = false; this.imageExport.invalidate(); this.busy = false;
      this.find<HTMLButtonElement>("photo-export").disabled = true;
      this.find<HTMLButtonElement>("photo-keep").disabled = true;
      this.studio?.dispose(); this.studio = null; this.message(String(error));
    }
    this.find<HTMLButtonElement>("photo-close").focus();
  }
  private loadSetup(draft: PhotoDraft | null) {
    const scene = this.snapshot?.scene ?? DEFAULT_SCENE;
    for (const [id, value] of [["photo-backdrop", draft?.backdrop ?? scene.backdropId], ["photo-perch", draft?.perch ?? scene.perchId], ["photo-format", draft?.format ?? scene.photoFormat]]) this.find<HTMLSelectElement>(id).value = value;
    this.pose = structuredClone(draft?.pose ?? this.snapshot!.camera);
    this.find<HTMLSelectElement>("photo-view").value = draft?.view ?? "current";
    this.find<HTMLInputElement>("photo-fibers").checked = draft?.fibers ?? scene.stemFibers;
    this.studio?.setStemFibers(this.find<HTMLInputElement>("photo-fibers").checked);
    for (const { id, neutral } of PHOTO_FRAMING_CONTROLS) this.find<HTMLInputElement>(`photo-${id}`).value = String(draft?.[id] ?? neutral);
    this.find<HTMLSelectElement>("photo-lighting").value = draft?.lighting ?? validatePhotoLighting(scene.photoLighting);
    this.lighting();
    this.find<HTMLInputElement>("photo-grid-toggle").checked = draft?.grid ?? false;
    this.find("photo-grid").hidden = !(draft?.grid ?? false);
    this.find<HTMLInputElement>("photo-name").value = draft?.title ?? "";
    this.loadFinish(draft?.finish ?? scene.photoAdjustments ?? NEUTRAL_PHOTO_ADJUSTMENTS);
    this.showingOriginal = draft?.showingOriginal ?? false; this.finish(false);
    this.stage(); this.format();
    this.find("photo-draft-note").textContent = this.draftContext === null
      ? "Viewing a kept moment. These temporary photo choices do not replace your working bowl’s setup."
      : "Your photo setup is remembered for this bowl while this page stays open. Return to arranging to adjust a cutting, then reopen Photograph. Reloading or starting a fresh bowl clears the setup.";
  }
  private rememberSetup() {
    if (!this.draftReady || !this.pose || this.actions.context() !== this.draftContext) return;
    this.drafts.remember(this.draftContext, {
      backdrop: this.value("photo-backdrop") as PhotoBackdrop,
      perch: this.value("photo-perch") as PhotoPerch,
      format: this.value("photo-format") as PhotoFormat,
      fibers: this.find<HTMLInputElement>("photo-fibers").checked,
      pose: this.pose, view: this.value("photo-view") as PhotoDraft["view"],
      zoom: Number(this.value("photo-zoom")), horizontal: Number(this.value("photo-horizontal")), vertical: Number(this.value("photo-vertical")),
      yaw: Number(this.value("photo-yaw")), pitch: Number(this.value("photo-pitch")), roll: Number(this.value("photo-roll")),
      lighting: validatePhotoLighting(this.value("photo-lighting")),
      finish: this.currentFinish(), showingOriginal: this.showingOriginal,
      grid: this.find<HTMLInputElement>("photo-grid-toggle").checked,
      title: this.value("photo-name"),
    });
  }
  private lighting() {
    const lighting = validatePhotoLighting(this.value("photo-lighting"));
    this.changedFrame(); this.studio?.setPhotoLighting(lighting);
    this.find("photo-lighting-description").textContent = PHOTO_LIGHTING.find(item => item.id === lighting)!.description;
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
    this.find("photo-mat").style.setProperty("--photo-aspect", String(size.width / size.height));
    this.find("photo-size").textContent = this.sizeLabel();
    this.frame();
  }
  private reset() {
    for (const { id, neutral } of PHOTO_FRAMING_CONTROLS) this.find<HTMLInputElement>(`photo-${id}`).value = String(neutral);
    this.frame();
  }
  private frame() {
    this.changedFrame();
    for (const { id: controlId } of PHOTO_FRAMING_CONTROLS) {
      const id = `photo-${controlId}`, value = Number(this.value(id));
      const angle = controlId === "yaw" || controlId === "pitch" || controlId === "roll";
      const text = angle ? `${value > 0 ? "+" : ""}${value}°` : id === "photo-zoom" ? `${value.toFixed(2)}×` : value === 0 ? "Centre" : `${value > 0 ? "+" : ""}${value.toFixed(2)}`;
      this.find(`${id}-value`).textContent = text;
      this.find(id).setAttribute("aria-valuetext", text);
    }
    if (this.pose) this.studio?.setCameraPose(framePhotoCamera(this.pose, Number(this.value("photo-zoom")), Number(this.value("photo-horizontal")), Number(this.value("photo-vertical")), Number(this.value("photo-yaw")), Number(this.value("photo-pitch")), Number(this.value("photo-roll"))), "free", false);
  }
  private loadFinish(recipe: Readonly<PhotoAdjustments>) {
    this.saturation = recipe.saturation;
    for (const { id } of PHOTO_ADJUSTMENT_CONTROLS) this.find<HTMLInputElement>(`photo-${id}`).value = String(id === "saturation" && recipe[id] > 0 ? recipe[id] / .6 : recipe[id]);
  }
  private currentFinish(): PhotoAdjustments {
    return validatePhotoAdjustments({ version: 1, ...Object.fromEntries(PHOTO_ADJUSTMENT_CONTROLS.map(({ id }) => [id, id === "saturation" ? this.saturation : Number(this.value(`photo-${id}`))])) });
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
      this.message(`PNG ready in Save. Choose ${this.shareData ? "Download PNG, Share image, or Open image" : "Download PNG or Open image"}.`);
    } catch (error) { if (session === this.session && revision === this.frameRevision) this.message(error instanceof Error ? error.message : String(error)); }
    finally {
      if (session === this.session && revision === this.frameRevision) {
        this.busy = false; this.find<HTMLButtonElement>("photo-export").disabled = !this.graphicsReady;
        this.find("photo-export").textContent = this.imageExport.current ? "Prepare new PNG" : "Prepare PNG";
      }
    }
  }
  private showPrepared(photo: PreparedPhoto) {
    this.showPanel("save");
    this.find("photo-result").hidden = false;
    this.find<HTMLImageElement>("photo-result-image").src = photo.url;
    this.find("photo-result-size").textContent = `${photo.width} × ${photo.height}`;
    this.find("photo-result-note").textContent = "This is the prepared image. Save it using one of the options below.";
    const download = this.find<HTMLAnchorElement>("photo-download"); download.href = photo.url; download.download = photo.name;
    this.find<HTMLAnchorElement>("photo-open-image").href = photo.url;
    this.shareData = photoShareData(photo, navigator);
    this.find<HTMLButtonElement>("photo-share").hidden = !this.shareData;
    this.find<HTMLButtonElement>("photo-share").disabled = this.sharing;
    this.find("photo-save-help").textContent = `If a download does not appear, try ${this.shareData ? "Share image or " : ""}Open image. You can also press and hold the image to see your browser’s saving options.`;
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
      const scene = validateScene(withPhotoLighting(withPhotoAdjustments({ ...(this.snapshot.scene ?? DEFAULT_SCENE),
        backdropId: this.value("photo-backdrop") as PhotoBackdrop, perchId: this.value("photo-perch") as PhotoPerch, photoFormat: this.value("photo-format") as PhotoFormat, stemFibers: this.find<HTMLInputElement>("photo-fibers").checked }, this.showingOriginal ? { ...NEUTRAL_PHOTO_ADJUSTMENTS } : this.currentFinish()), this.value("photo-lighting") as PhotoLightingId));
      const snapshot = validateArrangement({ ...this.snapshot, scene, camera: this.studio.getCameraPose() }, Infinity);
      const id = this.actions.keep(snapshot, thumbnail, this.value("photo-name"));
      this.dialog.dataset.keptId = id;
      this.message("Photo kept in Garden. Your working bowl is unchanged.");
    } catch (error) { this.message(error instanceof Error ? error.message : String(error)); }
  }
  private release(remember = true) {
    if (remember) this.rememberSetup();
    this.draftReady = false;
    this.session++; this.imageExport.clear(); this.shareData = null; this.sharing = false;
    this.find("photo-result").hidden = true;
    for (const id of ["photo-result-image", "photo-download", "photo-open-image"]) this.find(id).removeAttribute(id === "photo-result-image" ? "src" : "href");
    this.deliveryMessage(""); this.studio?.dispose(); this.studio = null; this.snapshot = null; this.pose = null; this.busy = false; this.graphicsReady = false;
    this.root.querySelector<HTMLButtonElement>("#more-toggle")?.focus();
  }
  destroy() { this.abort.abort(); this.release(false); this.drafts.clear(); this.dialog.remove(); this.opener.remove(); }
}
