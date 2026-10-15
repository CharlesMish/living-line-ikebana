import { atmosphericBackdropPixel, isAtmosphericBackdrop } from "../presentation/atmosphericBackdrops.ts";
import { PHOTO_BACKDROPS, PHOTO_COLORS, type PhotoBackdrop } from "../presentation/photoStage.ts";
import "./backdropPicker.css";

export type WorkingBackdrop = Exclude<PhotoBackdrop, "transparent">;
const hex = (value: number) => `#${value.toString(16).padStart(6, "0")}`;

/** Use the scene's authored pixels, with the same centre-cover crop. This is a
 * small, static 2D sample; choosing a backdrop never starts another renderer. */
export function paintScenicBackdrop(canvas: HTMLCanvasElement, backdrop: "hills" | "garden"): void {
  const width = 80, height = 50;
  canvas.width = width; canvas.height = height;
  const context = canvas.getContext("2d");
  if (!context) return;
  const crop = height / width, offset = (1 - crop) / 2;
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    const color = atmosphericBackdropPixel(backdrop, x / (width - 1), offset + y / (height - 1) * crop);
    context.fillStyle = `rgb(${color.map(channel => Math.round(channel)).join(",")})`;
    context.fillRect(x, y, 1, 1);
  }
}

/** Controlled presentation: only the owner can accept a choice with update().
 * A rejected save therefore leaves the selected tile and scene in agreement. */
export class BackdropPicker {
  readonly element = document.createElement("div");
  private readonly abort = new AbortController();
  private readonly buttons = new Map<PhotoBackdrop, HTMLButtonElement>();
  private selected: PhotoBackdrop;
  private editable = true;

  constructor(prefix: string, current: PhotoBackdrop, includeTransparent: boolean, choose: (id: PhotoBackdrop) => void) {
    this.selected = current;
    this.element.id = `${prefix}-choices`; this.element.className = "backdrop-choices";
    this.element.setAttribute("role", "group"); this.element.setAttribute("aria-label", "Backdrop");
    for (const item of PHOTO_BACKDROPS) {
      if (item.id === "transparent" && !includeTransparent) continue;
      const button = document.createElement("button"); button.type = "button";
      button.id = `${prefix}-choice-${item.id}`; button.className = "backdrop-choice";
      button.setAttribute("aria-label", item.label);
      const sample = document.createElement("span"); sample.className = "backdrop-sample"; sample.setAttribute("aria-hidden", "true");
      if (item.id === "transparent") sample.className += " backdrop-transparent";
      else {
        const colors = PHOTO_COLORS[item.id];
        sample.style.background = `linear-gradient(to bottom, ${hex(colors.wall)} 72%, ${hex(colors.floor)} 72%)`;
        if (isAtmosphericBackdrop(item.id)) {
          const canvas = document.createElement("canvas");
          canvas.setAttribute("aria-hidden", "true"); paintScenicBackdrop(canvas, item.id); sample.append(canvas);
        }
      }
      const label = document.createElement("span"); label.className = "backdrop-name"; label.textContent = item.label;
      const check = document.createElement("span"); check.className = "backdrop-check"; check.textContent = "✓"; check.setAttribute("aria-hidden", "true");
      button.append(sample, label, check);
      button.addEventListener("click", () => {
        if (this.editable && this.selected !== item.id) choose(item.id);
      }, { signal: this.abort.signal });
      this.buttons.set(item.id, button); this.element.append(button);
    }
    this.update(current);
  }

  update(current: PhotoBackdrop, editable = true): void {
    this.selected = current; this.editable = editable;
    for (const [id, button] of this.buttons) {
      button.disabled = !editable; button.setAttribute("aria-pressed", String(id === current));
    }
  }
  destroy(): void { this.abort.abort(); this.element.remove(); }
}
