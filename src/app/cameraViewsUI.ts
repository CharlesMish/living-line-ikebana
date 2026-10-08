import { CAMERA_SLOTS, type CameraSlot, type CameraViews } from "./cameraViews.ts";
import type { CameraPose } from "./camera.ts";
import "./cameraViews.css";

/** Lives in the existing Angles disclosure; no gesture ownership or persistence. */
export class CameraViewsUI {
  private readonly panel: HTMLElement;
  private readonly abort = new AbortController();
  constructor(root: HTMLElement, actions: { store(slot: CameraSlot): void; recall(slot: CameraSlot): void }) {
    this.panel = document.createElement("section");
    this.panel.id = "camera-views";
    this.panel.setAttribute("aria-labelledby", "camera-views-title");
    this.panel.innerHTML = `<p id="camera-views-title" class="studio-menu-heading">Camera A / B</p>
      <p class="studio-menu-note" id="camera-views-note">Frame in Step Back, then Store. Angle, focus and zoom for this bowl, until reload.</p>
      <div class="camera-view-slots">${CAMERA_SLOTS.map(slot => `<div>
        <button id="camera-recall-${slot}" type="button" aria-describedby="camera-views-note">Camera ${slot} · empty</button>
        <button id="camera-store-${slot}" type="button">Store ${slot}</button>
      </div>`).join("")}</div>
      <p id="camera-views-unavailable" class="studio-menu-note" hidden>Return to your working bowl to use its cameras.</p>`;
    const menu = root.querySelector<HTMLElement>("#view-options")!;
    // The existing menu grouping is installed after app construction.
    menu.insertBefore(this.panel, root.querySelector("#stem-overlaps-toggle"));
    root.dataset.cameraViews = "true";
    for (const slot of CAMERA_SLOTS) {
      this.button("store", slot).addEventListener("click", () => actions.store(slot), { signal: this.abort.signal });
      this.button("recall", slot).addEventListener("click", () => actions.recall(slot), { signal: this.abort.signal });
    }
  }
  private button(action: string, slot: CameraSlot) { return this.panel.querySelector<HTMLButtonElement>(`#camera-${action}-${slot}`)!; }
  render(views: CameraViews, camera: CameraPose, available: boolean) {
    for (const slot of CAMERA_SLOTS) {
      const stored = views.recall(slot) !== null;
      const recall = this.button("recall", slot), store = this.button("store", slot);
      recall.disabled = !available || !stored;
      recall.textContent = `Camera ${slot}${stored ? "" : " · empty"}`;
      recall.setAttribute("aria-pressed", String(available && views.matches(slot, camera)));
      store.disabled = !available;
      store.textContent = `${stored ? "Replace" : "Store"} ${slot}`;
      store.setAttribute("aria-label", `${stored ? "Replace" : "Store"} camera ${slot} with the current view`);
    }
    this.panel.querySelector<HTMLElement>("#camera-views-unavailable")!.hidden = available;
  }
  destroy() { this.abort.abort(); this.panel.remove(); }
}
