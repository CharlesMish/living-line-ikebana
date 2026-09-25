/**
 * Narrow-screen stage lens: a projection derived only from the canvas size and
 * the height the top controls cover. It never reads plant geometry, so the
 * camera cannot chase an edit; it changes only when the viewport or rail size
 * changes (resize, rotation, browser chrome), which already cancels any live
 * gesture. Camera poses, saved coordinates and botanical scale are unchanged.
 *
 * Reference: desktop framing, where the rail covers about 16% of the canvas and
 * a 44° vertical field spans the whole canvas. That framing is reproduced
 * exactly whenever the stage is at least as roomy as the reference.
 */
export const LENS_REFERENCE_INSET_FRACTION = 0.16;
/**
 * The preset shows a horizontal extent of at least this fraction of the
 * reference vertical extent (a 0.6-aspect screen's width).
 */
export const LENS_MIN_HORIZONTAL_FRACTION = 0.6;
/** At maximum zoom-out, the horizontal extent reaches this fraction of the reference vertical extent at the base limit. */
export const LENS_ZOOM_OUT_HORIZONTAL_FRACTION = 0.9;
/** The inset never claims more than this share of the canvas. */
const MAX_INSET_FRACTION = 0.6;

export interface StageLensInput {
  /** Canvas CSS size. */
  width: number;
  height: number;
  /** CSS pixels at the top of the canvas covered by persistent controls. */
  topInset: number;
  baseVerticalFov: number;
  baseMaxRadius: number;
}

export interface StageLens {
  /** Downward shift of the optical centre, CSS px (half the excess inset). */
  shift: number;
  /** Unobstructed stage height used for fitting, CSS px. */
  stageHeight: number;
  /** Magnification of the field relative to the reference (>= 1 zooms out). */
  zoom: number;
  /** Height of the virtual frame whose top `height` rows the canvas shows. */
  virtualHeight: number;
  /** Vertical field of the virtual frame, degrees. */
  verticalFov: number;
  /** Largest orbit/dolly radius allowed on this stage. */
  maxRadius: number;
}

export function computeStageLens(input: StageLensInput): StageLens {
  const width = Math.max(1, input.width);
  const height = Math.max(1, input.height);
  const inset = Math.min(Math.max(0, input.topInset || 0), height * MAX_INSET_FRACTION);
  // Only the part of the rail beyond the desktop reference needs compensating.
  const excess = Math.max(0, inset - height * LENS_REFERENCE_INSET_FRACTION);
  const shift = excess / 2;
  const stageHeight = height - excess;
  // Horizontal extent relative to the reference vertical extent, before zoom.
  const widthFraction = width / height;
  // Keep the stage's vertical extent at the reference, and the horizontal
  // extent at least LENS_MIN_HORIZONTAL_FRACTION of it.
  const zoom = Math.max(1, height / stageHeight, LENS_MIN_HORIZONTAL_FRACTION / widthFraction);
  const virtualHeight = height + 2 * shift;
  const baseTan = Math.tan((input.baseVerticalFov * Math.PI) / 360);
  // Units per CSS pixel at unit depth = zoom * reference, over the virtual frame.
  const tanHalf = zoom * baseTan * (virtualHeight / height);
  const verticalFov = (2 * Math.atan(tanHalf) * 180) / Math.PI;
  const maxRadius = input.baseMaxRadius * Math.max(1, LENS_ZOOM_OUT_HORIZONTAL_FRACTION / (zoom * widthFraction));
  return { shift, stageHeight, zoom, virtualHeight, verticalFov, maxRadius };
}

/**
 * Fog follows the camera only beyond the base zoom limit, so reference views
 * keep their exact haze and a narrow screen's extra zoom-out stays legible.
 */
export function fogRangeForDistance(distance: number, baseMaxRadius: number, near = 13, far = 27) {
  const extra = Math.max(0, distance - baseMaxRadius);
  return { near: near + extra, far: far + extra };
}
