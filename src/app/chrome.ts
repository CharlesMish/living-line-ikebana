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

export function pointInChromeRect(point: Point2, rect: ChromeRect, epsilon = 0): boolean {
  return (
    point.x >= rect.left - epsilon
    && point.x <= rect.right + epsilon
    && point.y >= rect.top - epsilon
    && point.y <= rect.bottom + epsilon
  );
}

/** True only when the point lands on an actually occupied control rect, not a full-width wrapper. */
export function pointHitsOccupiedChrome(point: Point2, occupiedRects: readonly ChromeRect[]): boolean {
  return occupiedRects.some((rect) => pointInChromeRect(point, rect));
}

function isPointerActiveElement(element: Element | null): element is HTMLElement {
  if (!(element instanceof HTMLElement) || element.hidden) return false;
  const style = getComputedStyle(element);
  if (style.display === "none" || style.visibility === "hidden" || style.pointerEvents === "none") {
    return false;
  }
  const box = element.getBoundingClientRect();
  return box.width > 0 && box.height > 0;
}

/**
 * Visible pointer-active top-chrome controls. The contextual-row wrapper is
 * excluded so empty space beside the pills belongs to the studio.
 */
export function visibleTopChromePointerRects(root: ParentNode): ChromeRect[] {
  const rects: ChromeRect[] = [];
  const push = (element: Element | null) => {
    if (!isPointerActiveElement(element)) return;
    rects.push(clientRectToChromeRect(element.getBoundingClientRect()));
  };
  push(root.querySelector(".posture-control"));
  push(root.querySelector(".chrome-info"));
  for (const control of root.querySelectorAll(".contextual-row > *")) push(control);
  return rects;
}

function elementBottom(root: ParentNode, selector: string): number {
  const element = root.querySelector(selector);
  if (!(element instanceof HTMLElement)) return 0;
  const box = element.getBoundingClientRect();
  return box.width > 0 || box.height > 0 ? box.bottom : 0;
}

/** Lowest viewport Y of the painted top chrome, including `env(safe-area-inset-top)` padding. */
export function occupiedTopChromeBottom(root: ParentNode): number {
  return Math.max(
    elementBottom(root, ".top-chrome"),
    elementBottom(root, ".chrome-stack"),
    elementBottom(root, ".chrome-info"),
  );
}

/** Canvas-local inset so presentation can clear the live occupied top-chrome rectangle. */
export function occupiedTopChromeInsetPx(root: ParentNode, canvas: Element): number {
  const canvasTop = canvas.getBoundingClientRect().top;
  return Math.max(0, occupiedTopChromeBottom(root) - canvasTop);
}
