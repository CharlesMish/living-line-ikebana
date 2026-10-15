import * as THREE from "three";

/** Complete authored head facing local +Z. Ten thin, closed, veined bracts
 * surround 21 tiny lobed florets on a shallow receptacle. Parts join at their
 * bases; bract angular sectors do not cross. One buffer and draw per head. */
export function createStarryHeadGeometry(seed: number): THREE.BufferGeometry {
  const positions: number[] = [], colors: number[] = [], indices: number[] = [];
  const noise = (salt: number) => {
    let n = (seed ^ Math.imul(salt + 1, 0x9e3779b1)) >>> 0;
    n = Math.imul(n ^ n >>> 16, 0x85ebca6b) >>> 0;
    return n / 4294967296;
  };
  const vertex = (x: number, y: number, z: number, color: readonly number[]) => {
    const index = positions.length / 3; positions.push(x, y, z); colors.push(...color); return index;
  };
  const rows = 7, columns = 4, sheet = (rows + 1) * (columns + 1);
  for (let bract = 0; bract < 10; bract++) {
    const start = positions.length / 3;
    const angle = bract * Math.PI * 2 / 10 + (noise(bract) - .5) * .015;
    const reach = .245 + noise(bract + 10) * .016;
    for (let face = 0; face < 2; face++) for (let row = 0; row <= rows; row++) for (let column = 0; column <= columns; column++) {
      const t = row / rows, across = column / columns * 2 - 1;
      const width = .003 + .048 * Math.pow(Math.sin(Math.PI * t), 1.15);
      const radial = .058 + reach * t;
      const z = .009 + .043 * t * t + .01 * (1 - across * across) * Math.sin(Math.PI * t) - face * .005;
      const vein = Math.exp(-across * across * 45) * Math.sin(Math.PI * t);
      const reverse = face ? .12 : 0;
      vertex(radial * Math.cos(angle) - across * width * Math.sin(angle),
        radial * Math.sin(angle) + across * width * Math.cos(angle), z,
        [.94 - vein * .27 - reverse, .97 - vein * .14 - reverse, .84 - vein * .31 - reverse]);
    }
    for (let face = 0; face < 2; face++) for (let row = 0; row < rows; row++) for (let column = 0; column < columns; column++) {
      const a = start + face * sheet + row * (columns + 1) + column, b = a + 1, c = a + columns + 1, d = c + 1;
      if (face) indices.push(a, b, c, b, d, c); else indices.push(a, c, b, b, c, d);
    }
    const boundary = [
      ...Array.from({ length: columns + 1 }, (_, i) => i),
      ...Array.from({ length: rows }, (_, i) => (i + 1) * (columns + 1) + columns),
      ...Array.from({ length: columns }, (_, i) => rows * (columns + 1) + columns - i - 1),
      ...Array.from({ length: rows - 1 }, (_, i) => (rows - i - 1) * (columns + 1)),
    ];
    for (let i = 0; i < boundary.length; i++) {
      const a = start + boundary[i]!, b = start + boundary[(i + 1) % boundary.length]!;
      indices.push(a, b, a + sheet, b, b + sheet, a + sheet);
    }
  }
  // Indexed closed ellipsoids with unique poles avoid degenerate cap triangles.
  function lobedEllipsoid(x: number, y: number, z: number, radius: number, depth: number,
    lobes: number, color: readonly number[], phase = 0) {
    const sides = 10, rings = 4;
    const bottom = vertex(x, y, z - depth, color);
    const ringStart = positions.length / 3;
    for (let ring = 1; ring <= rings; ring++) for (let side = 0; side < sides; side++) {
      const latitude = -Math.PI / 2 + ring / (rings + 1) * Math.PI;
      const angle = side / sides * Math.PI * 2;
      const scallop = lobes ? 1 + .16 * Math.cos(angle * lobes + phase) : 1;
      vertex(x + Math.cos(angle) * Math.cos(latitude) * radius * scallop,
        y + Math.sin(angle) * Math.cos(latitude) * radius * scallop, z + Math.sin(latitude) * depth,
        color.map(c => c * (.83 + .16 * (ring / rings))));
    }
    const top = vertex(x, y, z + depth, color);
    for (let side = 0; side < sides; side++) {
      const next = (side + 1) % sides;
      indices.push(bottom, ringStart + next, ringStart + side);
      for (let ring = 0; ring < rings - 1; ring++) {
        const a = ringStart + ring * sides + side, b = ringStart + ring * sides + next, c = a + sides, d = b + sides;
        indices.push(a, b, c, b, d, c);
      }
      indices.push(ringStart + (rings - 1) * sides + side, ringStart + (rings - 1) * sides + next, top);
    }
  }
  lobedEllipsoid(0, 0, .018, .134, .037, 0, [.58, .69, .46]);
  let floret = 0;
  for (const [count, ringRadius] of [[1, 0], [7, .05], [13, .106]]) for (let i = 0; i < count; i++) {
    const angle = i / count * Math.PI * 2 + (count === 13 ? .19 : 0);
    const x = Math.cos(angle) * ringRadius, y = Math.sin(angle) * ringRadius;
    const z = .043 + .023 * (1 - ringRadius / .13);
    const variation = .95 + noise(100 + floret) * .08;
    lobedEllipsoid(x, y, z, .020 * variation, .034, 5, [.96, .98, .91], floret * .72);
    floret++;
  }
  const geometry = new THREE.BufferGeometry();
  geometry.name = "living-line/starry-pincushion-head";
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals(); geometry.computeBoundingSphere();
  return geometry;
}
