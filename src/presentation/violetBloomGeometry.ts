import * as THREE from "three";

/** Small authored surfaces used only by the two October violet cuttings. All
 * geometry is derived from a stable organ seed; no graph or camera dependence. */
function geometry(name: string, positions: number[], colors: number[], indices: number[]) {
  const result = new THREE.BufferGeometry();
  result.name = name;
  result.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  result.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
  result.setIndex(indices);
  result.computeVertexNormals();
  result.computeBoundingSphere();
  return result;
}
const noise = (seed: number, salt: number) => {
  let n = (seed ^ Math.imul(salt + 1, 0x9e3779b1)) >>> 0;
  n = Math.imul(n ^ n >>> 16, 0x85ebca6b) >>> 0;
  return (n >>> 0) / 4294967296;
};

/** Five lightly veined, notched saucer petals. Thin closed surfaces give the
 * reverse a real profile without a large opaque flower-head mass. */
export function createVioletFloretGeometry(seed: number): THREE.BufferGeometry {
  const positions: number[] = [], colors: number[] = [], indices: number[] = [];
  const rows = 8, columns = 6, sheet = (rows + 1) * (columns + 1);
  for (let petal = 0; petal < 5; petal++) {
    const start = positions.length / 3;
    const angle = petal * Math.PI * 2 / 5 + (noise(seed, petal) - 0.5) * 0.05;
    for (let face = 0; face < 2; face++) for (let row = 0; row <= rows; row++) for (let column = 0; column <= columns; column++) {
      const t = row / rows, a = column / columns * 2 - 1;
      const width = 0.139 * Math.pow(Math.max(0, Math.sin(Math.PI * (0.04 + 0.92 * t))), 0.60);
      const notch = 0.013 * Math.pow(t, 7) * Math.exp(-a * a * 10);
      const radial = 0.034 + t * (0.267 + noise(seed, petal + 10) * 0.012) - notch;
      const lateral = a * width;
      const cup = 0.015 + 0.045 * t * t + 0.018 * a * a * Math.sin(Math.PI * t);
      positions.push(radial * Math.cos(angle) - lateral * Math.sin(angle), radial * Math.sin(angle) + lateral * Math.cos(angle), cup + (face ? -0.007 : 0));
      const vein = Math.exp(-a * a * 70) * Math.sin(Math.PI * t);
      const light = (face ? 0.78 : 0.88) + 0.09 * t - vein * 0.11;
      colors.push(light, light * (0.95 + t * 0.035), Math.min(1, light * 1.07));
    }
    for (let face = 0; face < 2; face++) for (let row = 0; row < rows; row++) for (let column = 0; column < columns; column++) {
      const a = start + face * sheet + row * (columns + 1) + column, b = a + 1, c = a + columns + 1, d = c + 1;
      if (face) indices.push(a, c, b, b, c, d); else indices.push(a, b, c, b, d, c);
    }
    const boundary = [
      ...Array.from({ length: columns + 1 }, (_, i) => i),
      ...Array.from({ length: rows }, (_, i) => (i + 1) * (columns + 1) + columns),
      ...Array.from({ length: columns }, (_, i) => rows * (columns + 1) + columns - i - 1),
      ...Array.from({ length: rows - 1 }, (_, i) => (rows - i - 1) * (columns + 1)),
    ];
    for (let i = 0; i < boundary.length; i++) {
      const a = start + boundary[i]!, b = start + boundary[(i + 1) % boundary.length]!;
      indices.push(a, a + sheet, b, b, a + sheet, b + sheet);
    }
  }
  // The grid advances laterally before radially, so reverse its winding for
  // outward +Z front / −Z reverse normals, including the stitched rim.
  for (let i = 0; i < indices.length; i += 3) [indices[i + 1], indices[i + 2]] = [indices[i + 2]!, indices[i + 1]!];
  return geometry("living-line/violet-floret", positions, colors, indices);
}

/** One small tubular, two-lipped flower, opening along the stalk's local +Y.
 * The extended lower lip has three shallow lobes; the upper hood has two.
 * An inner surface, rim and root annulus keep the reverse and cut attachment
 * legible. The form is salvia-inspired, not a cultivar reconstruction. */
export function createIndigoFloretGeometry(seed: number): THREE.BufferGeometry {
  const positions: number[] = [], colors: number[] = [], indices: number[] = [];
  const rows = 10, sides = 24, shell = (rows + 1) * sides;
  for (let inner = 0; inner < 2; inner++) for (let row = 0; row <= rows; row++) for (let side = 0; side < sides; side++) {
    const t = row / rows, angle = side / sides * Math.PI * 2;
    const front = Math.max(0, -Math.sin(angle));
    const flare = Math.pow(t, 2.6);
    const lobe = 1 + 0.065 * Math.cos(angle * 5 + 0.4) * Math.pow(t, 5);
    const rx = (0.045 + 0.117 * flare) * lobe - inner * 0.005;
    const rz = (0.044 + 0.071 * flare) * lobe - inner * 0.005;
    const extension = 0.12 * Math.pow(front, 1.5) * Math.pow(t, 5);
    const y = -0.014 + 0.29 * t + extension + (noise(seed, 2) - 0.5) * 0.008 * flare;
    positions.push(Math.cos(angle) * rx, y, Math.sin(angle) * rz);
    const light = (inner ? 0.64 : 0.86) + 0.10 * t;
    // The inner throat is darker while the lip stays lighter under any tone.
    colors.push(light * 0.94, light * 0.94, Math.min(1, light * 1.08));
  }
  for (let inner = 0; inner < 2; inner++) for (let row = 0; row < rows; row++) for (let side = 0; side < sides; side++) {
    const a = inner * shell + row * sides + side, b = inner * shell + row * sides + (side + 1) % sides;
    const c = a + sides, d = b + sides;
    if (inner) indices.push(a, b, c, b, d, c); else indices.push(a, c, b, b, c, d);
  }
  for (const row of [0, rows]) for (let side = 0; side < sides; side++) {
    const a = row * sides + side, b = row * sides + (side + 1) % sides;
    if (row) indices.push(a, a + shell, b, b, a + shell, b + shell);
    else indices.push(a, b, a + shell, b, b + shell, a + shell);
  }
  return geometry("living-line/indigo-floret", positions, colors, indices);
}
