import { BOTANICAL_FAMILIES, validateBotanicalTones, type BotanicalFamilyId, type BotanicalTones } from "../presentation/botanicalTones.ts";
import { botanicalToneInventory, botanicalToneSample } from "./botanicalTonePreview.ts";
import "./botanicalTones.css";

interface MaterialCard {
  element: HTMLElement;
  count: HTMLElement;
  version: string;
  choices: Map<string, HTMLButtonElement>;
}

/** Scene command controls: the owner cancels first and saves before applying. */
export class BotanicalTonesUI {
  private readonly button = document.createElement("button");
  private readonly dialog = document.createElement("dialog");
  private readonly abort = new AbortController();
  private readonly cards = new Map<BotanicalFamilyId, MaterialCard>();
  private current: BotanicalTones | undefined;
  private editable = true;

  constructor(private readonly root: HTMLElement, current: BotanicalTones | undefined,
    beforeOpen: () => void, change: (tones: BotanicalTones | undefined) => void,
    private readonly inBowl: () => readonly string[] = () => []) {
    this.button.type = "button"; this.button.id = "botanical-tones-open";
    this.button.setAttribute("aria-haspopup", "dialog");
    this.button.innerHTML = "Botanical tones<span>Flowers, leaves and bark</span>";
    root.querySelector("#more-options")!.append(this.button);
    this.dialog.className = "garden-dialog botanical-tones-dialog";
    this.dialog.id = "botanical-tones-dialog";
    this.dialog.setAttribute("aria-labelledby", "botanical-tones-title");
    this.dialog.innerHTML = `<div class="panel-heading"><div><p class="eyebrow">Color in the bowl</p><h1 id="botanical-tones-title">Botanical tones</h1></div>
      <button type="button" id="botanical-tones-close">Done</button></div>
      <p id="botanical-tones-help">Choose a look for each material. It colors every cutting of that kind in this bowl, including ones you add later.</p>
      <section aria-labelledby="botanical-tones-current-title"><h2 id="botanical-tones-current-title">In your bowl</h2>
        <p id="botanical-tones-empty" class="panel-note">No color choices in this bowl yet. Explore other cuttings below to choose their colors before you place them.</p>
        <div class="botanical-tones-grid" id="botanical-tones-current"></div></section>
      <details class="botanical-tones-other"><summary id="botanical-tones-more-title">Other cuttings</summary>
        <p class="panel-note">These materials are not in your bowl. Their colors will be ready when you add them.</p>
        <div class="botanical-tones-grid" id="botanical-tones-more"></div></details>
      <p class="panel-note">Small samples show the material colors; light and Photograph finish affect the final look. Reed and arching trailer keep their original greens.</p>
      <button type="button" id="botanical-tones-reset">Reset all to Natural</button>`;
    const options = { signal: this.abort.signal };
    for (const family of BOTANICAL_FAMILIES) {
      const element = document.createElement("section");
      element.className = "botanical-tone-card";
      element.setAttribute("aria-labelledby", `botanical-tone-title-${family.id}`);
      element.dataset.family = family.id;
      const heading = document.createElement("div"); heading.className = "botanical-tone-heading";
      const title = document.createElement("h3"); title.id = `botanical-tone-title-${family.id}`; title.textContent = family.label;
      const count = document.createElement("span"); count.className = "botanical-tone-count";
      heading.append(title, count); element.append(heading);
      const row = document.createElement("div"); row.className = "botanical-tone-choices";
      row.setAttribute("role", "group"); row.setAttribute("aria-labelledby", title.id);
      const card: MaterialCard = { element, count, version: family.versions.at(-1)!, choices: new Map() };
      for (const item of family.tones) {
        const button = document.createElement("button"); button.type = "button";
        button.id = `botanical-tone-${family.id}-${item.id}`;
        button.className = "botanical-tone-choice";
        button.setAttribute("aria-label", `${family.label}: ${item.label}`);
        button.setAttribute("aria-pressed", "false");
        button.addEventListener("click", () => {
          if (this.editable && item.id !== (this.current?.[family.id] ?? "natural")) {
            change(validateBotanicalTones({ ...this.current, [family.id]: item.id }));
          }
        }, options);
        card.choices.set(item.id, button); row.append(button);
      }
      element.append(row); this.cards.set(family.id, card);
      this.drawSamples(family.id, card);
    }
    root.append(this.dialog);
    this.button.addEventListener("click", () => {
      if (!this.editable) return;
      beforeOpen(); this.orderCards(); this.dialog.showModal();
    }, options);
    this.dialog.querySelector("#botanical-tones-close")!.addEventListener("click", () => this.dialog.close(), options);
    this.dialog.querySelector("#botanical-tones-reset")!.addEventListener("click", () => { if (this.editable && this.current) change(undefined); }, options);
    this.dialog.addEventListener("close", () => root.querySelector<HTMLButtonElement>("#more-toggle")?.focus(), options);
    this.orderCards(); this.update(current, true);
  }

  private drawSamples(familyId: BotanicalFamilyId, card: MaterialCard) {
    const family = BOTANICAL_FAMILIES.find(item => item.id === familyId)!;
    for (const tone of family.tones) {
      const sample = botanicalToneSample(familyId, tone.id, card.version);
      card.choices.get(tone.id)!.innerHTML = `${sample.svg}<span class="botanical-tone-swatches" aria-hidden="true">${sample.parts.map(part => `<span style="--sample-color:${part.color}" title="${part.label}"></span>`).join("")}</span><span class="botanical-tone-name">${tone.label}</span><span class="botanical-tone-selected" aria-hidden="true">✓ Selected</span>`;
    }
  }

  private orderCards() {
    const inventory = new Map(botanicalToneInventory(this.inBowl()).map(item => [item.familyId, item]));
    const current = this.dialog.querySelector("#botanical-tones-current")!;
    const more = this.dialog.querySelector("#botanical-tones-more")!;
    for (const family of BOTANICAL_FAMILIES) {
      const card = this.cards.get(family.id)!, item = inventory.get(family.id);
      const version = item?.generatorVersion ?? family.versions.at(-1)!;
      if (version !== card.version) { card.version = version; this.drawSamples(family.id, card); }
      card.count.textContent = item ? `${item.count} in bowl` : "";
      (item ? current : more).append(card.element);
    }
    this.dialog.querySelector<HTMLElement>("#botanical-tones-empty")!.hidden = inventory.size !== 0;
    const remaining = BOTANICAL_FAMILIES.length - inventory.size;
    this.dialog.querySelector<HTMLElement>(".botanical-tones-other")!.hidden = remaining === 0;
    this.dialog.querySelector("#botanical-tones-more-title")!.textContent = `Other cuttings (${remaining})`;
  }

  update(current: BotanicalTones | undefined, editable: boolean) {
    this.current = current ? { ...current } : undefined; this.editable = editable;
    this.button.disabled = !editable;
    this.dialog.querySelector<HTMLButtonElement>("#botanical-tones-reset")!.disabled = !editable || !current;
    for (const family of BOTANICAL_FAMILIES) for (const [id, button] of this.cards.get(family.id)!.choices) {
      button.setAttribute("aria-pressed", String(id === (current?.[family.id] ?? "natural")));
      button.disabled = !editable;
    }
  }
  destroy() { this.abort.abort(); this.dialog.remove(); this.button.remove(); }
}
