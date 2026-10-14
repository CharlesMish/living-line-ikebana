import * as THREE from "three";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";

type Axis = "x" | "y" | "z";

/** Eased timber edges and face-aware grain; no face inherits arbitrary box UVs. */
export function timberGeometry(width: number, height: number, depth: number, axis: Axis, offset = 0, endgrain = false): THREE.BufferGeometry {
  const geometry = new RoundedBoxGeometry(width, height, depth, endgrain ? 2 : 1, endgrain ? .035 : .014);
  const position = geometry.getAttribute("position"), uv = geometry.getAttribute("uv");
  const faceAxes: Axis[] = ["x", "x", "y", "y", "z", "z"];
  const sample = (index: number, direction: Axis) => direction === "x" ? position.getX(index) : direction === "y" ? position.getY(index) : position.getZ(index);
  for (const group of geometry.groups) {
    const faceAxis = faceAxes[group.materialIndex!]!;
    const crossAxis = (["x", "y", "z"] as const).find(candidate => candidate !== faceAxis && candidate !== axis) ?? "z";
    const endAxes = (["x", "y", "z"] as const).filter(candidate => candidate !== axis);
    for (let index = group.start; index < group.start + group.count; index++) {
      if (endgrain && faceAxis === axis) {
        // End grain uses a crop rather than a repeat across the thin edge.
        uv.setXY(index, sample(index, endAxes[0]!) / Math.max(height, .4) + .5, sample(index, endAxes[1]!) / Math.max(depth, .4) + .5);
      } else {
        uv.setXY(index, sample(index, axis) / 6 + offset, sample(index, crossAxis) / 1.6 + offset * .37);
      }
    }
    group.materialIndex = endgrain && faceAxis === axis ? 1 : 0;
  }
  // A single material needs no groups. For the top, adjacent non-indexed face
  // blocks are merged into two draws (cut ends then the remaining faces).
  if (!endgrain) geometry.clearGroups();
  else {
    const count = position.count / 6;
    geometry.clearGroups();
    geometry.addGroup(0, count * 2, 1); // top boards run along X
    geometry.addGroup(count * 2, count * 4, 0);
  }
  geometry.userData.grainAxis = axis;
  return geometry;
}

/** Honed slab with a flat bearing surface, softened rim and quiet natural edge. */
export function honedStoneGeometry(radius: number, height: number): THREE.BufferGeometry {
  const outline = [
    [0, -height / 2], [radius - .08, -height / 2], [radius - .015, -height / 2 + .025],
    [radius + .01, -height / 2 + .06], [radius + .005, height / 2 - .055],
    [radius - .018, height / 2 - .018], [radius - .06, height / 2], [0, height / 2],
  ];
  const geometry = new THREE.LatheGeometry(outline.map(([x, y]) => new THREE.Vector2(x, y)), 72);
  const position = geometry.getAttribute("position"), uv = geometry.getAttribute("uv");
  for (let index = 0; index < position.count; index++) {
    const x = position.getX(index), z = position.getZ(index), angle = Math.atan2(z, x);
    const variation = 1 + .009 * Math.sin(angle * 3 + .7) + .004 * Math.sin(angle * 7);
    position.setXYZ(index, x * variation, position.getY(index), z * variation);
    uv.setXY(index, x * variation / 3, z * variation / 3 + position.getY(index) * .25);
  }
  geometry.computeVertexNormals();
  return geometry;
}

export function plasterGeometry(width: number, height: number, depth: number): THREE.BufferGeometry {
  const geometry = new RoundedBoxGeometry(width, height, depth, 2, .055);
  const position = geometry.getAttribute("position"), uv = geometry.getAttribute("uv");
  for (const group of geometry.groups) {
    const face = group.materialIndex!;
    for (let index = group.start; index < group.start + group.count; index++) {
      const x = position.getX(index), y = position.getY(index), z = position.getZ(index);
      uv.setXY(index, (face < 2 ? z : x) / 2, (face === 2 || face === 3 ? z : y) / 2);
    }
  }
  geometry.clearGroups();
  return geometry;
}
