import { resolveVesselAppearance, VESSEL_COLORS, VESSEL_FINISHES, type VesselAppearanceChoice } from "./vesselAppearance.ts";
import "./vesselAppearance.css";

/** Study-only chrome. Opening cancels before any appearance command can run. */
export class VesselAppearanceUI {
  private readonly button = document.createElement("button");
  private readonly dialog = document.createElement("dialog");
  private readonly abort = new AbortController();

  constructor(root: HTMLElement, label: string, current: VesselAppearanceChoice, beforeOpen: () => void,
    change: (choice: VesselAppearanceChoice) => void) {
    this.button.type = "button"; this.button.id = "vessel-appearance-open";
    this.button.dataset.testid = "vessel-appearance-open";
    this.button.setAttribute("aria-haspopup", "dialog");
    this.button.append("Vessel");
    const description = document.createElement("span"); description.textContent = label; this.button.append(description);
    root.querySelector("#more-options")!.append(this.button);
    this.dialog.id = "vessel-appearance-dialog";
    this.dialog.className = "garden-dialog vessel-appearance-dialog";
    this.dialog.setAttribute("aria-labelledby", "vessel-appearance-title");
    this.dialog.innerHTML = `<div class="panel-heading"><div><p class="eyebrow">Vessel study</p><h1 id="vessel-appearance-title"></h1></div>
      <button type="button" id="vessel-appearance-close" aria-label="Close vessel appearance">Done</button></div>
      <p>Quiet colors, the same light.</p>
      <label>Color<select id="vessel-color" data-testid="vessel-color"></select></label>
      <label>Surface<select id="vessel-finish" data-testid="vessel-finish"></select></label>
      <p class="panel-note">Stoneware adds a fine grain and softer reflections. Planting space and protection stay the same.</p>
      <p class="panel-note">This link remembers your appearance. Garden backups need the same named vessel study and appearance selected when you restore.</p>`;
    this.dialog.querySelector("h1")!.textContent = label;
    const color = this.dialog.querySelector<HTMLSelectElement>("#vessel-color")!;
    const finish = this.dialog.querySelector<HTMLSelectElement>("#vessel-finish")!;
    for (const item of VESSEL_COLORS) color.add(new Option(item.label, item.id));
    for (const item of VESSEL_FINISHES) finish.add(new Option(item.label, item.id));
    const safe = resolveVesselAppearance(current).choice;
    color.value = safe.colorId; finish.value = safe.finishId;
    root.append(this.dialog);
    const options = { signal: this.abort.signal };
    this.button.addEventListener("click", () => { beforeOpen(); this.dialog.showModal(); }, options);
    this.dialog.querySelector("#vessel-appearance-close")!.addEventListener("click", () => this.dialog.close(), options);
    this.dialog.addEventListener("change", () => change(resolveVesselAppearance({ colorId: color.value, finishId: finish.value }).choice), options);
    this.dialog.addEventListener("close", () => root.querySelector<HTMLButtonElement>("#more-toggle")?.focus(), options);
  }

  destroy() { this.abort.abort(); this.dialog.remove(); this.button.remove(); }
}
