import type { Posture } from "./ui.ts";

export interface ChromeRect {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

export interface Point2 {
  x: number;
  y: number;
}

export function contextualChromeVisibility(posture: Posture) {
  const arrange = posture === "arrange";
  return {
    tools: arrange,
    views: !arrange,
    tray: arrange,
  } as const;
}

export function setChromeRowAvailability(row: HTMLElement, available: boolean): void {
  row.hidden = !available;
  row.inert = !available;
  row.setAttribute("aria-hidden", String(!available));
  for (const button of row.querySelectorAll<HTMLButtonElement>("button")) {
    if (available) button.removeAttribute("tabindex");
    else button.tabIndex = -1;
  }
}

export function rectsIntersect(left: ChromeRect, right: ChromeRect, epsilon = 0.5): boolean {
  return (
    left.left < right.right - epsilon
    && left.right > right.left + epsilon
    && left.top < right.bottom - epsilon
    && left.bottom > right.top + epsilon
  );
}

/**
 * Practical portrait insertion path: a vertical band from the tray card
 * center up to the usable pin-field / kenzan center.
 */
export function dragCorridorRect(from: Point2, to: Point2, halfWidth: number): ChromeRect {
  return {
    left: Math.min(from.x, to.x) - halfWidth,
    right: Math.max(from.x, to.x) + halfWidth,
    top: Math.min(from.y, to.y),
    bottom: Math.max(from.y, to.y),
  };
}

export function clientRectToChromeRect(rect: Pick<DOMRect, "left" | "top" | "right" | "bottom">): ChromeRect {
  return {
    left: rect.left,
    top: rect.top,
    right: rect.right,
    bottom: rect.bottom,
  };
}
