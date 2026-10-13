import * as THREE from "three";

/** Quiet painted scenery, not a simulated outdoor environment. */
export type AtmosphericBackdrop = "hills" | "garden";
export const ATMOSPHERIC_BACKDROPS: readonly AtmosphericBackdrop[] = ["hills", "garden"];
export function isAtmosphericBackdrop(value: string): value is AtmosphericBackdrop {
  return value === "hills" || value === "garden";
}

type RGB = readonly [number, number, number];
const HILL_LAYERS: readonly { height: number; wave: number; seed: number; color: RGB; opacity: number }[] = [
  { height: .38, wave: .065, seed: 37, color: [163, 186, 189], opacity: .64 },
  { height: .455, wave: .047, seed: 71, color: [149, 175, 171], opacity: .58 },
  { height: .535, wave: .038, seed: 109, color: [150, 175, 157], opacity: .55 },
];
const blend = (a: RGB, b: RGB, amount: number): RGB => [
  a[0] + (b[0] - a[0]) * amount, a[1] + (b[1] - a[1]) * amount, a[2] + (b[2] - a[2]) * amount,
];
const smooth = (low: number, high: number, value: number) => {
  const t = Math.max(0, Math.min(1, (value - low) / (high - low)));
  return t * t * (3 - 2 * t);
};
function noise(x: number, y: number, seed: number): number {
  const lattice = (ix: number, iy: number) => {
    let n = Math.imul(ix + seed, 374761393) ^ Math.imul(iy + 23, 668265263);
    n = Math.imul(n ^ (n >>> 13), 1274126177);
    return ((n ^ (n >>> 16)) >>> 0) / 4294967295;
  };
  const ix = Math.floor(x), iy = Math.floor(y), sx = smooth(0, 1, x - ix), sy = smooth(0, 1, y - iy);
  const lower = lattice(ix, iy) * (1 - sx) + lattice(ix + 1, iy) * sx;
  const upper = lattice(ix, iy + 1) * (1 - sx) + lattice(ix + 1, iy + 1) * sx;
  return lower * (1 - sy) + upper * sy;
}

/** Pixel coordinates have their origin at the top, as in a photographed backdrop.
 * All noise and contours are frozen. There is no botanical or global RNG use. */
export function atmosphericBackdropPixel(kind: AtmosphericBackdrop, u: number, v: number): RGB {
  const grain = (noise(u * 137, v * 137, 19) - .5) * .65;
  let color: RGB;
  if (kind === "hills") {
    color = blend([193, 209, 208], [218, 224, 214], smooth(0, .53, v));
    // Broad uneven ridgelines recede into a pale valley. No hard horizon crosses
    // the plant, and the quiet middle stays lighter than the edge contours.
    for (const layer of HILL_LAYERS) {
      const ridge = layer.height + Math.sin(u * 7.5 + layer.seed) * layer.wave
        + (noise(u * 5.5, .3, layer.seed) - .5) * .052
        + Math.sin(u * 17.4 + layer.seed * .2) * .012;
      const cover = smooth(ridge - .007, ridge + .01, v);
      const valleyMist = 1 - smooth(ridge + .06, ridge + .21, v);
      color = blend(color, layer.color, cover * valleyMist * layer.opacity);
    }
    color = blend(color, [206, 215, 201], smooth(.64, .84, v));
  } else {
    color = blend([202, 214, 194], [220, 221, 199], smooth(.1, .65, v));
    const canopy = noise(u * 5.4, v * 4.1, 67) * .63 + noise(u * 12.3, v * 10.2, 103) * .37;
    const softLeaves = noise(u * 24, v * 19, 29);
    // Out-of-focus foliage frames a softly lit opening. These are tonal masses,
    // not leaf silhouettes that might be confused with the player's cuttings.
    const opening = Math.exp(-((u - .52) ** 2 / .07 + (v - .43) ** 2 / .1));
    const edge = .27 + .73 * (1 - opening);
    const shadow = smooth(.32, .82, canopy) * edge * (1 - smooth(.65, .91, v));
    color = blend(color, [126, 151, 128], shadow * .62);
    const light = smooth(.59, .85, softLeaves) * edge * (1 - smooth(.58, .81, v));
    color = blend(color, [231, 228, 193], light * .23);
    color = blend(color, [207, 214, 195], smooth(.68, .86, v));
  }
  return [color[0] + grain, color[1] + grain, color[2] + grain];
}

/** One small, fully owned texture per renderer. No canvas or remote asset needed. */
export function createAtmosphericBackdrop(kind: AtmosphericBackdrop): THREE.DataTexture {
  const width = 256, height = 256, data = new Uint8Array(width * height * 4);
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    const color = atmosphericBackdropPixel(kind, x / (width - 1), y / (height - 1));
    // DataTexture rows begin at UV y=0 (bottom). Keep the authored sky at the top.
    const index = ((height - 1 - y) * width + x) * 4;
    for (let channel = 0; channel < 3; channel++) data[index + channel] = Math.round(color[channel]!);
    data[index + 3] = 255;
  }
  const texture = new THREE.DataTexture(data, width, height, THREE.RGBAFormat);
  texture.name = `photo-backdrop-${kind}`;
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.magFilter = THREE.LinearFilter; texture.minFilter = THREE.LinearFilter;
  texture.generateMipmaps = false; texture.needsUpdate = true;
  return texture;
}

/** Cover rather than stretch. The same camera aspect is used at preview/export. */
export function fitAtmosphericBackdrop(texture: THREE.Texture, aspect: number): void {
  if (!Number.isFinite(aspect) || aspect <= 0) return;
  const x = Math.min(1, aspect), y = Math.min(1, 1 / aspect);
  texture.repeat.set(x, y); texture.offset.set((1 - x) / 2, (1 - y) / 2);
  texture.updateMatrix();
}
