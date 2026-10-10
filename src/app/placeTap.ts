/**
 * Movement that separates a source-card tap from a drag.
 *
 * 8 CSS pixels sits in the 6–10px band. A slip of about 6px — finger tremor
 * or an unsteady click — still counts as a tap. An intentional drag crosses
 * 8px before the cutting has travelled a meaningful distance on screen.
 * The comparison is strict greater-than, so travel of exactly 8px stays a tap
 * and does not start a drag or a placement.
 */
export const PLACE_TAP_THRESHOLD_PX = 8;

export function placePointerTravel(startX: number, startY: number, x: number, y: number): number {
  return Math.hypot(x - startX, y - startY);
}

export function placePointerKind(travelPx: number, threshold = PLACE_TAP_THRESHOLD_PX): "tap" | "drag" {
  return travelPx > threshold ? "drag" : "tap";
}
