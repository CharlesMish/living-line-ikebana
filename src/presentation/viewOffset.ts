export interface CameraViewOffset {
  fullWidth: number;
  fullHeight: number;
  offsetX: number;
  offsetY: number;
  width: number;
  height: number;
}

/**
 * Map the canonical frustum onto the canvas region below the occupied top
 * chrome. Canonical poses stay unchanged; only the projection window moves.
 * `occupiedTopInsetPx` is a live measured inset, not a magic band height.
 */
export function cameraViewOffsetForOccupiedTop(
  canvasWidth: number,
  canvasHeight: number,
  occupiedTopInsetPx: number,
): CameraViewOffset | null {
  const width = Math.max(1, Math.round(canvasWidth));
  const height = Math.max(1, Math.round(canvasHeight));
  const inset = Math.max(0, Math.min(Math.round(occupiedTopInsetPx), height - 1));
  if (inset <= 0) return null;
  return {
    fullWidth: width,
    fullHeight: height - inset,
    offsetX: 0,
    offsetY: -inset,
    width,
    height,
  };
}
