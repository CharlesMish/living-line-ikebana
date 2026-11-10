import * as THREE from "three";

/**
 * Closed 5-ribbed inflated lantern-bell geometry oriented along local +Y (the
 * downward-hanging pedicel tangent). A single watertight manifold shell rises
 * from the pedicel attachment at y = 0 through five longitudinal ribs to a
 * scalloped five-lobed mouth at y ≈ 0.41 and recesses into an inner throat cap.
 */
export function createLanternBellGeometry(seed: number): THREE.BufferGeometry {
  const positions: number[] = [];
  const colors: number[] = [];
  const indices: number[] = [];

  const noise = (salt: number) => {
    let n = (seed ^ Math.imul(salt + 1, 0x9e3779b1)) >>> 0;
    n = Math.imul(n ^ (n >>> 16), 0x85ebca6b) >>> 0;
    return n / 4294967296;
  };

  const vertex = (x: number, y: number, z: number, shade: readonly [number, number, number]) => {
    const idx = positions.length / 3;
    positions.push(x, y, z);
    colors.push(shade[0], shade[1], shade[2]);
    return idx;
  };

  const phase = (noise(1) - 0.5) * 0.24;
  const swell = 0.97 + noise(2) * 0.06;
  const lengthScale = 0.97 + noise(3) * 0.06;
  const sides = 25;

  const profile: ReadonlyArray<{
    y: number;
    r: number;
    ribAmp: number;
    scallopY: number;
    shade: number;
  }> = [
    { y: 0.024, r: 0.056, ribAmp: 0.08, scallopY: 0.0, shade: 0.88 },
    { y: 0.088, r: 0.142, ribAmp: 0.16, scallopY: 0.004, shade: 0.95 },
    { y: 0.175, r: 0.176, ribAmp: 0.20, scallopY: 0.006, shade: 1.0 },
    { y: 0.268, r: 0.154, ribAmp: 0.18, scallopY: 0.008, shade: 0.97 },
    { y: 0.345, r: 0.106, ribAmp: 0.14, scallopY: 0.012, shade: 0.92 },
    { y: 0.412, r: 0.118, ribAmp: 0.15, scallopY: 0.018, shade: 0.98 },
    { y: 0.388, r: 0.084, ribAmp: 0.08, scallopY: 0.010, shade: 0.78 },
    { y: 0.320, r: 0.044, ribAmp: 0.04, scallopY: 0.0, shade: 0.70 },
  ];

  const bottom = vertex(0, 0, 0, [0.84, 0.86, 0.80]);
  const ringStart = positions.length / 3;
  const rings = profile.length;

  for (let ring = 0; ring < rings; ring += 1) {
    const row = profile[ring]!;
    for (let side = 0; side < sides; side += 1) {
      const angle = (side / sides) * Math.PI * 2;
      const rib5 = Math.cos(angle * 5 + phase);
      const rib10 = Math.cos(angle * 10 + phase * 2);
      const radialFactor = 1 + row.ribAmp * rib5 + row.ribAmp * 0.22 * rib10;
      const r = row.r * swell * radialFactor;
      const y = (row.y + row.scallopY * rib5) * lengthScale;
      const fluteShade = Math.min(1, Math.max(0.74, row.shade * (0.91 + 0.09 * rib5)));
      vertex(
        Math.cos(angle) * r,
        y,
        Math.sin(angle) * r,
        [fluteShade, fluteShade * 0.99, fluteShade * 0.95],
      );
    }
  }

  const top = vertex(0, 0.265 * lengthScale, 0, [0.72, 0.71, 0.68]);

  for (let side = 0; side < sides; side += 1) {
    const next = (side + 1) % sides;
    indices.push(bottom, ringStart + side, ringStart + next);
    for (let ring = 0; ring < rings - 1; ring += 1) {
      const a = ringStart + ring * sides + side;
      const b = ringStart + ring * sides + next;
      const c = a + sides;
      const d = b + sides;
      indices.push(a, c, b, b, c, d);
    }
    const lastRing = ringStart + (rings - 1) * sides;
    indices.push(lastRing + side, top, lastRing + next);
  }

  const geometry = new THREE.BufferGeometry();
  geometry.name = "living-line/lantern-bell";
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();
  return geometry;
}
