import * as THREE from "three";

/** Presentation-only v2 corolla. Five joined lobes form one thin bell, with a
 * rounded throat and shallow longitudinal folds. Local +Y is the existing
 * stalk tangent; neither the attachment nor the acquisition sphere changes.
 * The legacy v1 shell remains in botanicalGeometry.ts.
 */
export function createPetalBellGeometry(seed: number, palette: { petal: number; collar: number }): THREE.BufferGeometry {
  const rings = 12, columns = 40, tau = Math.PI * 2;
  // Identity noise only rotates the folds and softly varies their reach. No
  // camera, active-length, inventory-order or time dependency enters the skin.
  let value = Math.imul((seed ^ 0x84b8a751) >>> 0, 0x85ebca6b);
  value = Math.imul(value ^ (value >>> 13), 0xc2b2ae35);
  const phase = ((value ^ (value >>> 16)) >>> 0) / 4294967296 * tau;
  const positions: number[] = [], colors: number[] = [], indices: number[] = [];
  const petal = new THREE.Color(palette.petal), collar = new THREE.Color(palette.collar);
  const smooth = (t: number) => { const x = THREE.MathUtils.clamp(t, 0, 1); return x * x * (3 - 2 * x); };
  const push = (x: number, y: number, z: number, shade: number) => {
    positions.push(x, y, z);
    // Same collar transition as createBellToneUpdater: alternate tones change
    // the petal contribution and retain both the green neck and local shading.
    const tint = collar.clone().lerp(petal, smooth((y - .01) / .09));
    colors.push(tint.r * shade, tint.g * shade, tint.b * shade);
    return positions.length / 3 - 1;
  };
  const outer: number[][] = [], inner: number[][] = [];
  for (let ring = 0; ring <= rings; ring++) {
    const t = ring / rings;
    const body = Math.max(0, (t - .14) / .86);
    outer[ring] = []; inner[ring] = [];
    for (let column = 0; column < columns; column++) {
      const theta = column / columns * tau;
      const fold = Math.cos(5 * theta + phase);
      const tip = Math.pow(.5 + .5 * fold, .8);
      let radius: number, y: number;
      if (t <= .14) {
        const u = t / .14;
        radius = .017 + .017 * u * u;
        y = -.052 * (1 - u);
      } else {
        // The throat fills out before the mouth, avoiding a straight cone.
        // At the rim, five shallow clefts separate the rounded petal ends.
        const flare = smooth((body - .72) / .28);
        const folds = .009 * fold * Math.sin(Math.PI * body);
        radius = .034 + .205 * Math.sin(Math.min(body / .65, 1) * Math.PI / 2)
          + flare * (.028 + .048 * tip) + folds;
        y = .6 * body + Math.pow(body, 7) * (-.068 + .092 * tip)
          + .003 * Math.sin(theta * 2 + phase) * body * body;
      }
      // A quiet ridge highlights petal direction even when the opening faces
      // away. Fine lines vary the color buffer, without textures or meshes.
      const vein = Math.pow(.5 + .5 * Math.cos(10 * theta + phase * 2), 8) * Math.sin(Math.PI * body) * .025;
      const shade = .84 + .12 * body + .035 * fold * Math.sin(Math.PI * body) - vein;
      const cosine = Math.cos(theta), sine = Math.sin(theta);
      outer[ring][column] = push(cosine * radius, y, sine * radius, shade);
      const innerRadius = Math.max(.008, radius - (t <= .14 ? .004 : .005));
      inner[ring][column] = push(cosine * innerRadius, y + .0015, sine * innerRadius,
        shade * (.68 + .27 * body));
    }
  }
  const quad = (a: number, b: number, c: number, d: number) => indices.push(a, b, c, a, c, d);
  for (let ring = 0; ring < rings; ring++) for (let column = 0; column < columns; column++) {
    const next = (column + 1) % columns;
    quad(outer[ring][column], outer[ring + 1][column], outer[ring + 1][next], outer[ring][next]);
    quad(inner[ring][column], inner[ring][next], inner[ring + 1][next], inner[ring + 1][column]);
  }
  for (let column = 0; column < columns; column++) {
    const next = (column + 1) % columns;
    quad(outer[rings][column], outer[rings][next], inner[rings][next], inner[rings][column]);
  }
  const back = push(0, -.052, 0, .74);
  for (let column = 0; column < columns; column++) indices.push(back, outer[0][column], outer[0][(column + 1) % columns]);
  const geometry = new THREE.BufferGeometry();
  geometry.name = "living-line/bell";
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals(); geometry.computeBoundingBox(); geometry.computeBoundingSphere();
  return geometry;
}
