import * as THREE from "three";

export type PerchSurface = "wood" | "endgrain" | "stone" | "plaster";

// Frozen, tileable value noise: all variation belongs to this renderer, never
// the botanical seed or saved scene. Texture bytes are reproducible offline.
function noise(x: number, y: number, periodX: number, periodY: number, seed: number): number {
  const lattice = (ix: number, iy: number) => {
    ix = ((ix % periodX) + periodX) % periodX;
    iy = ((iy % periodY) + periodY) % periodY;
    let n = Math.imul(ix + seed, 374761393) ^ Math.imul(iy + 17, 668265263);
    n = Math.imul(n ^ (n >>> 13), 1274126177);
    return ((n ^ (n >>> 16)) >>> 0) / 4294967295;
  };
  const ix = Math.floor(x), iy = Math.floor(y);
  const tx = x - ix, ty = y - iy, sx = tx * tx * (3 - 2 * tx), sy = ty * ty * (3 - 2 * ty);
  const a = lattice(ix, iy) * (1 - sx) + lattice(ix + 1, iy) * sx;
  const b = lattice(ix, iy + 1) * (1 - sx) + lattice(ix + 1, iy + 1) * sx;
  return a * (1 - sy) + b * sy;
}

/** Small CPU-authored maps; no canvas, image decoding, network or random state. */
export function createPerchSurface(kind: PerchSurface, tint?: readonly [number, number, number]): THREE.MeshStandardMaterial {
  const width = kind === "wood" ? 256 : 128, height = 128;
  const rgb = new Uint8Array(width * height * 4), relief = new Uint8Array(width * height);
  // An optional base colour reuses the same frozen relief for other rooms
  // (the home's hinoki, juraku plaster); existing perches pass none.
  const base = tint ?? (kind === "wood" || kind === "endgrain" ? [137, 108, 79]
    : kind === "stone" ? [158, 157, 146] : [215, 207, 189]);
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    const u = x / width, v = y / height;
    const fine = noise(u * 64, v * 64, 64, 64, 91) - .5;
    const cloud = noise(u * 5, v * 5, 5, 5, 37) - .5;
    let tone: number, bump: number;
    if (kind === "wood") {
      // Fibres run horizontally; slow lateral wander avoids a striped print.
      const wander = (noise(u * 3, v * 4, 3, 4, 31) - .5) * .055
        + Math.sin(u * Math.PI * 2) * .024 + Math.sin((u * 2 + v) * Math.PI * 2) * .013;
      const phase = (v + wander) * Math.PI * 2;
      const grain = Math.sin(phase * 12) * .5 + Math.sin(phase * 31) * .18;
      const broad = noise(u * 2, v * 18, 2, 18, 72) - .5;
      tone = grain * 7 + broad * 17 + fine * 2;
      bump = grain * 28 + fine * 8;
    } else if (kind === "endgrain") {
      // A close crop through growth rings on the cut ends, subdued in colour.
      const radius = Math.hypot((u - .32) * 1.2, (v + .4) * .9);
      const rings = Math.sin(radius * 85 + cloud * 2);
      tone = rings * 4 + fine * 3 - 3;
      bump = rings * 20 + fine * 8;
    } else {
      tone = cloud * (kind === "stone" ? 10 : 4) + fine * (kind === "stone" ? 9 : 3);
      bump = fine * (kind === "stone" ? 70 : 35) + cloud * 10;
    }
    const index = y * width + x;
    for (let channel = 0; channel < 3; channel++) rgb[index * 4 + channel] = Math.round(base[channel]! + tone);
    rgb[index * 4 + 3] = 255;
    relief[index] = Math.round(128 + bump);
  }
  const map = new THREE.DataTexture(rgb, width, height, THREE.RGBAFormat);
  const bumpMap = new THREE.DataTexture(relief, width, height, THREE.RedFormat);
  map.colorSpace = THREE.SRGBColorSpace;
  for (const texture of [map, bumpMap]) {
    texture.name = `perch-${kind}-${texture === map ? "color" : "relief"}`;
    texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
    texture.magFilter = THREE.LinearFilter;
    texture.minFilter = THREE.LinearMipmapLinearFilter;
    texture.generateMipmaps = true;
    texture.needsUpdate = true;
  }
  const material = new THREE.MeshStandardMaterial({
    map, bumpMap, metalness: 0, roughness: kind === "wood" || kind === "endgrain" ? .76 : .96,
    bumpScale: kind === "stone" ? .012 : kind === "plaster" ? .006 : .008,
  });
  material.name = `perch-${kind}`;
  return material;
}

/** Each photo perch owns its maps. Shared parts release each resource once. */
export function disposePhotoPerch(group: THREE.Group): void {
  if (group.userData.perchDisposed) return;
  group.userData.perchDisposed = true;
  const geometries = new Set<THREE.BufferGeometry>();
  const materials = new Set<THREE.Material>();
  const textures = new Set<THREE.Texture>();
  group.traverse(object => {
    if (!(object instanceof THREE.Mesh)) return;
    geometries.add(object.geometry);
    for (const material of Array.isArray(object.material) ? object.material : [object.material]) {
      materials.add(material);
      for (const value of Object.values(material)) if (value instanceof THREE.Texture) textures.add(value);
    }
  });
  textures.forEach(texture => texture.dispose());
  materials.forEach(material => material.dispose());
  geometries.forEach(geometry => geometry.dispose());
}
