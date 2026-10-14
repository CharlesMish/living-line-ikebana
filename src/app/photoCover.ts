/** Garden's existing JPEG limit, with native photograph proportions and a
 * bounded display resolution. PNG delivery remains the full-sized original. */
export function photoCoverSize(width: number, height: number) {
  if (!Number.isFinite(width) || !Number.isFinite(height) || width < 1 || height < 1) throw new Error("Invalid photograph size.");
  const scale = Math.min(1, 640 / Math.max(width, height));
  return { width: Math.max(1, Math.round(width * scale)), height: Math.max(1, Math.round(height * scale)) };
}

export function makePhotoCover(frame: HTMLCanvasElement): string {
  const cover = document.createElement("canvas");
  const size = photoCoverSize(frame.width, frame.height);
  cover.width = size.width; cover.height = size.height;
  const context = cover.getContext("2d");
  if (!context) throw new Error("This browser cannot prepare a cover.");
  // JPEG has no alpha. Cutouts receive the same quiet paper matte as before.
  context.fillStyle = "#eee9dd"; context.fillRect(0, 0, cover.width, cover.height);
  context.drawImage(frame, 0, 0, cover.width, cover.height);
  for (const quality of [.82, .72, .6, .45]) {
    const data = cover.toDataURL("image/jpeg", quality);
    if (data.startsWith("data:image/jpeg;base64,") && data.length <= 80_000) return data;
  }
  throw new Error("This cover is too large. Try a simpler frame.");
}
