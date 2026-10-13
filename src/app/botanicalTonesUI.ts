import { BOTANICAL_FAMILIES, validateBotanicalTones, type BotanicalTones } from "../presentation/botanicalTones.ts";
import "./botanicalTones.css";

/** Scene command controls: the owner cancels first and saves before applying. */
export class BotanicalTonesUI {
  private readonly button = document.createElement("button");
  private readonly dialog = document.createElement("dialog");
  private readonly abort = new AbortController();
  constructor(private readonly root: HTMLElement, current: BotanicalTones | undefined,
    beforeOpen: () => void, change: (tones: BotanicalTones | undefined) => void) {
    this.button.type = "button"; this.button.id = "botanical-tones-open";
    this.button.setAttribute("aria-haspopup", "dialog");
    this.button.innerHTML = "Botanical tones<span>Flowers, leaves and bark</span>";
    root.querySelector("#more-options")!.append(this.button);
    this.dialog.className = "garden-dialog botanical-tones-dialog";
    this.dialog.id = "botanical-tones-dialog";
    this.dialog.setAttribute("aria-labelledby", "botanical-tones-title");
    this.dialog.innerHTML = `<div class="panel-heading"><div><p class="eyebrow">Color in the bowl</p><h1 id="botanical-tones-title">Botanical tones</h1></div>
      <button type="button" id="botanical-tones-close">Done</button></div>
      <p>Each choice colors every cutting of that material in this bowl, including ones you add later. Shape and pruning stay the same.</p>
      <div class="botanical-tones-grid" id="botanical-tones-current"></div>
      <details><summary>More cuttings</summary><div class="botanical-tones-grid" id="botanical-tones-more"></div></details>
      <p class="panel-note">Reed and arching trailer keep their original greens. Your Garden remembers these tones with the arrangement.</p>
      <button type="button" id="botanical-tones-reset">All natural</button>`;
    const options = { signal: this.abort.signal };
    for (const family of BOTANICAL_FAMILIES) {
      const label = document.createElement("label"); label.textContent = family.label;
      const select = document.createElement("select"); select.dataset.family = family.id; select.id = `botanical-tone-${family.id}`;
      for (const item of family.tones) select.add(new Option(item.label, item.id));
      label.append(select);
      this.dialog.querySelector("more" in family && family.more ? "#botanical-tones-more" : "#botanical-tones-current")!.append(label);
      select.addEventListener("change", () => {
        const values: Record<string, string> = {};
        for (const control of this.dialog.querySelectorAll<HTMLSelectElement>("select[data-family]")) values[control.dataset.family!] = control.value;
        change(validateBotanicalTones(values));
      }, options);
    }
    root.append(this.dialog);
    this.button.addEventListener("click", () => { beforeOpen(); this.dialog.showModal(); }, options);
    this.dialog.querySelector("#botanical-tones-close")!.addEventListener("click", () => this.dialog.close(), options);
    this.dialog.querySelector("#botanical-tones-reset")!.addEventListener("click", () => change(undefined), options);
    this.dialog.addEventListener("close", () => root.querySelector<HTMLButtonElement>("#more-toggle")?.focus(), options);
    this.update(current, true);
  }
  update(current: BotanicalTones | undefined, editable: boolean) {
    this.button.disabled = !editable;
    for (const family of BOTANICAL_FAMILIES) this.dialog.querySelector<HTMLSelectElement>(`#botanical-tone-${family.id}`)!.value = current?.[family.id] ?? "natural";
  }
  destroy() { this.abort.abort(); this.dialog.remove(); this.button.remove(); }
}
