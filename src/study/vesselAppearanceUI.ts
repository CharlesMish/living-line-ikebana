import { VESSEL_PROFILES } from "./vesselProfiles.ts";
import { resolveVesselAppearance, VESSEL_COLORS, VESSEL_FINISHES, type VesselAppearanceChoice } from "./vesselAppearance.ts";
import "./vesselAppearance.css";

/** Study-only chrome. Opening cancels before any appearance command can run. */
export class VesselAppearanceUI {
  private readonly button = document.createElement("button");
  private readonly dialog = document.createElement("dialog");
  private readonly abort = new AbortController();

  constructor(root: HTMLElement, label: string, current: VesselAppearanceChoice, beforeOpen: () => void,
    change: (choice: VesselAppearanceChoice) => void, layoutId?: string, layoutChange?: (id: string) => void) {
    this.button.type = "button"; this.button.id = "vessel-appearance-open";
    this.button.dataset.testid = "vessel-appearance-open";
    this.button.setAttribute("aria-haspopup", "dialog");
    this.button.append("Vessel");
    const description = document.createElement("span"); description.textContent = label; this.button.append(description);
    root.querySelector("#more-options")!.append(this.button);
    this.dialog.id = "vessel-appearance-dialog";
    this.dialog.className = "garden-dialog vessel-appearance-dialog";
    this.dialog.setAttribute("aria-labelledby", "vessel-appearance-title");
    this.dialog.innerHTML = `<div class="panel-heading"><div><p class="eyebrow">A setting for your lines</p><h1 id="vessel-appearance-title"></h1></div>
      <button type="button" id="vessel-appearance-close" aria-label="Close vessel appearance">Done</button></div>
      <p>Quiet colors, the same light.</p><label>Layout<select id="vessel-layout"></select></label>
      <label>Color<select id="vessel-color" data-testid="vessel-color"></select></label>
      <label>Surface<select id="vessel-finish" data-testid="vessel-finish"></select></label>
      <p class="panel-note">Stoneware adds a fine grain and softer reflections. Planting space and protection stay the same.</p>
      <p class="panel-note">Your Garden remembers the vessel, surface and scene setting.</p>`;
    this.dialog.querySelector("h1")!.textContent = label;
    const layout = this.dialog.querySelector<HTMLSelectElement>("#vessel-layout")!;
    for (const item of VESSEL_PROFILES) layout.add(new Option(item.label, item.id));
    layout.value = layoutId ?? "original"; layout.closest("label")!.hidden = !layoutChange;
    layout.addEventListener("change", event => { event.stopPropagation(); layoutChange?.(layout.value); }, { signal: this.abort.signal });
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

  update(label: string, current: VesselAppearanceChoice, layoutId: string, editable: boolean) {
    this.button.querySelector("span")!.textContent = label; this.button.disabled = !editable;
    this.dialog.querySelector("h1")!.textContent = label;
    this.dialog.querySelector<HTMLSelectElement>("#vessel-layout")!.value = layoutId;
    this.dialog.querySelector<HTMLSelectElement>("#vessel-color")!.value = current.colorId;
    this.dialog.querySelector<HTMLSelectElement>("#vessel-finish")!.value = current.finishId;
  }
  destroy() { this.abort.abort(); this.dialog.remove(); this.button.remove(); }
}
