import { PHOTO_BACKDROPS, type PhotoBackdrop } from "../presentation/photoStage.ts";
import { BackdropPicker, type WorkingBackdrop } from "./backdropPicker.ts";

/** The app owns cancellation and save-before-apply. This compact dialog only
 * requests a setting and reflects the accepted working scene. */
export class WorkingBackdropUI {
  private readonly button = document.createElement("button");
  private readonly dialog = document.createElement("dialog");
  private readonly abort = new AbortController();
  private readonly picker: BackdropPicker;
  private editable = true;

  constructor(private readonly root: HTMLElement, current: PhotoBackdrop, beforeOpen: () => void, choose: (id: WorkingBackdrop) => void) {
    this.button.type = "button"; this.button.id = "working-backdrop-open";
    this.button.setAttribute("aria-haspopup", "dialog");
    this.button.innerHTML = "Backdrop<span></span>";
    root.querySelector("#more-options")!.append(this.button);
    this.dialog.id = "working-backdrop-dialog"; this.dialog.className = "backdrop-dialog";
    this.dialog.setAttribute("aria-labelledby", "working-backdrop-title");
    this.dialog.innerHTML = `<div class="panel-heading"><h1 id="working-backdrop-title">Backdrop</h1><button type="button" id="working-backdrop-close">Done</button></div>
      <div id="working-backdrop-picker"></div><p class="panel-note">Choose a setting for this bowl. Your new photographs begin here; a photo setup you have already made stays as you left it.</p>
      <p id="working-backdrop-message" class="panel-note" role="status" aria-live="polite"></p>`;
    this.picker = new BackdropPicker("working-backdrop", current, false, id => { if (id !== "transparent") choose(id); });
    this.dialog.querySelector("#working-backdrop-picker")!.append(this.picker.element);
    root.append(this.dialog);
    const options = { signal: this.abort.signal };
    this.button.addEventListener("click", () => {
      if (!this.editable) return;
      beforeOpen(); this.message(""); this.dialog.showModal();
    }, options);
    this.dialog.querySelector("#working-backdrop-close")!.addEventListener("click", () => this.dialog.close(), options);
    this.dialog.addEventListener("close", () => root.querySelector<HTMLButtonElement>("#more-toggle")?.focus(), options);
    this.update(current, true);
  }
  update(current: PhotoBackdrop, editable: boolean): void {
    this.editable = editable; this.button.disabled = !editable;
    this.button.querySelector("span")!.textContent = PHOTO_BACKDROPS.find(item => item.id === current)!.label;
    this.picker.update(current, editable);
  }
  message(text: string): void { this.dialog.querySelector("#working-backdrop-message")!.textContent = text; }
  destroy(): void { this.abort.abort(); this.picker.destroy(); this.dialog.remove(); this.button.remove(); }
}
