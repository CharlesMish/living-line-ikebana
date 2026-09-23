/**
 * Offline stills for the nodding-flower substitution study.
 * Uses production graph, organ, and tube geometry. It is not a WebGL capture:
 * no shadow map, antialiasing, or browser lighting. See the review for limits.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { deflateSync } from "node:zlib";
import * as THREE from "three";
import { canonicalCameraPose } from "../src/app/camera.ts";
import {
  aimBranch, bendBranch, createNoddingFlower, createSingleFlower,
  sampleBranch, sampleMaterialFrame,
} from "../src/core/index.ts";
import { add, dot, normalize, scale, subtract, vec3 } from "../src/core/math.ts";
import type { PlantGraph } from "../src/core/types.ts";
import { createVesselGeometry } from "../src/presentation/vessel.ts";
import { updateTubeGeometry } from "../src/presentation/geometry.ts";
import { getMaterialAppearance } from "../src/presentation/materialAppearance.ts";
import { STUDIO_VERTICAL_FOV, ThreeStudio } from "../src/presentation/ThreeStudio.ts";

const OUT = "docs/development/reports/nodding-flower-v1";
const BASE = { x: 0, y: 0.55, z: 0 };
const WIDTH = 880;
const HEIGHT = 680;

interface Triangle {
  readonly p: [THREE.Vector3, THREE.Vector3, THREE.Vector3];
  readonly n: THREE.Vector3;
  readonly color: [number, number, number];
}

const studio = Object.assign(Object.create(ThreeStudio.prototype), {
  options: { debugHitTargets: false },
});

function hexToRgb(hex: number): [number, number, number] {
  return [((hex >> 16) & 255) / 255, ((hex >> 8) & 255) / 255, (hex & 255) / 255];
}

function pushGeometry(
  triangles: Triangle[],
  geometry: THREE.BufferGeometry,
  matrix: THREE.Matrix4,
  tint: [number, number, number],
  normalMatrix: THREE.Matrix3,
) {
  const position = geometry.getAttribute("position");
  const normal = geometry.getAttribute("normal");
  const color = geometry.getAttribute("color");
  const index = geometry.getIndex();
  if (!position || !index) return;
  const vertex = new THREE.Vector3();
  const transformedNormal = new THREE.Vector3();
  const read = (slot: number) => {
    vertex.fromBufferAttribute(position, slot).applyMatrix4(matrix);
    const point = vertex.clone();
    if (normal) transformedNormal.fromBufferAttribute(normal, slot).applyMatrix3(normalMatrix).normalize();
    const shade = color
      ? [color.getX(slot), color.getY(slot), color.getZ(slot)]
      : [1, 1, 1];
    return {
      point,
      normal: transformedNormal.clone(),
      shade: [
        tint[0] * shade[0],
        tint[1] * shade[1],
        tint[2] * shade[2],
      ] as [number, number, number],
    };
  };
  for (let face = 0; face < index.count; face += 3) {
    const a = read(index.getX(face));
    const b = read(index.getX(face + 1));
    const c = read(index.getX(face + 2));
    const faceNormal = b.point.clone().sub(a.point).cross(c.point.clone().sub(a.point));
    if (faceNormal.lengthSq() < 1e-12) continue;
    const chosen = a.normal.lengthSq() > 0 ? a.normal : faceNormal.normalize();
    triangles.push({
      p: [a.point, b.point, c.point],
      n: chosen,
      color: [
        (a.shade[0] + b.shade[0] + c.shade[0]) / 3,
        (a.shade[1] + b.shade[1] + c.shade[1]) / 3,
        (a.shade[2] + b.shade[2] + c.shade[2]) / 3,
      ],
    });
  }
}

function collectPlant(graph: PlantGraph): Triangle[] {
  const triangles: Triangle[] = [];
  const appearance = getMaterialAppearance(graph.generatorVersion);
  for (const branch of graph.branches.values()) {
    if (!branch.active || branch.points.length < 2) continue;
    const geometry = new THREE.BufferGeometry();
    updateTubeGeometry(geometry, branch.points, branch.radius, branch.referenceNormal, 10, true);
    pushGeometry(
      triangles,
      geometry,
      new THREE.Matrix4(),
      hexToRgb(appearance.branchColors[branch.kind]),
      new THREE.Matrix3(),
    );
    geometry.dispose();
  }
  for (const organ of graph.organs.values()) {
    if (!organ.active) continue;
    const branch = graph.branches.get(organ.branchId);
    if (!branch?.active) continue;
    const visual = studio.createOrganVisual(graph, organ, false);
    const frame = sampleMaterialFrame(branch, Math.min(organ.distance, branch.activeLength));
    visual.group.position.set(frame.position.x, frame.position.y, frame.position.z);
    const basis = new THREE.Matrix4().makeBasis(
      new THREE.Vector3(frame.binormal.x, frame.binormal.y, frame.binormal.z),
      new THREE.Vector3(frame.tangent.x, frame.tangent.y, frame.tangent.z),
      new THREE.Vector3(frame.normal.x, frame.normal.y, frame.normal.z),
    );
    visual.group.quaternion.setFromRotationMatrix(basis);
    visual.group.rotateY(organ.spin);
    visual.group.scale.setScalar(organ.scale);
    visual.group.updateMatrixWorld(true);
    visual.group.traverse((node: THREE.Object3D) => {
      if (!(node instanceof THREE.Mesh) || node === visual.hit) return;
      const material = node.material as THREE.MeshStandardMaterial;
      const tint = hexToRgb(material.color.getHex());
      const count = node instanceof THREE.InstancedMesh ? node.count : 1;
      for (let instance = 0; instance < count; instance += 1) {
        const matrix = node.matrixWorld.clone();
        if (node instanceof THREE.InstancedMesh) {
          const instanceMatrix = new THREE.Matrix4();
          node.getMatrixAt(instance, instanceMatrix);
          matrix.multiply(instanceMatrix);
        }
        const normalMatrix = new THREE.Matrix3().getNormalMatrix(matrix);
        pushGeometry(triangles, node.geometry, matrix, tint, normalMatrix);
      }
    });
  }
  return triangles;
}

function collectScene(graph: PlantGraph): Triangle[] {
  const triangles = collectPlant(graph);
  const vessel = createVesselGeometry();
  pushGeometry(triangles, vessel, new THREE.Matrix4(), hexToRgb(0xbcb09b), new THREE.Matrix3());
  vessel.dispose();
  const water = new THREE.CircleGeometry(2.345, 48);
  water.rotateX(-Math.PI / 2);
  water.translate(0, 0.46, 0);
  pushGeometry(triangles, water, new THREE.Matrix4(), hexToRgb(0x497d82), new THREE.Matrix3());
  water.dispose();
  return triangles;
}

const light = new THREE.Vector3(-3, 8, 7).normalize();

function shade(color: [number, number, number], normal: THREE.Vector3): [number, number, number] {
  const diffuse = Math.abs(normal.dot(light));
  const lightWeight = 0.42 + 0.58 * diffuse;
  return [color[0] * lightWeight, color[1] * lightWeight, color[2] * lightWeight];
}

function srgb(channel: number): number {
  const value = Math.min(1, Math.max(0, channel));
  return value <= 0.0031308 ? value * 12.92 : 1.055 * value ** (1 / 2.4) - 0.055;
}

function render(triangles: Triangle[], pose: { position: { x: number; y: number; z: number }; target: { x: number; y: number; z: number }; up: { x: number; y: number; z: number } }, width: number, height: number): Buffer {
  const camera = new THREE.PerspectiveCamera(STUDIO_VERTICAL_FOV, width / height, 0.08, 80);
  camera.position.set(pose.position.x, pose.position.y, pose.position.z);
  camera.up.set(pose.up.x, pose.up.y, pose.up.z);
  camera.lookAt(pose.target.x, pose.target.y, pose.target.z);
  camera.updateMatrixWorld(true);
  camera.updateProjectionMatrix();
  const pixels = Buffer.alloc(width * height * 4);
  const depth = new Float32Array(width * height);
  depth.fill(1);
  for (let index = 0; index < pixels.length; index += 4) {
    pixels[index] = 236;
    pixels[index + 1] = 232;
    pixels[index + 2] = 224;
    pixels[index + 3] = 255;
  }
  const projected: THREE.Vector3[] = [new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3()];
  for (const triangle of triangles) {
    let behind = false;
    for (let corner = 0; corner < 3; corner += 1) {
      projected[corner].copy(triangle.p[corner]).project(camera);
      if (projected[corner].z < -1 || projected[corner].z > 1) behind = true;
    }
    if (behind) continue;
    const screen = projected.map((point) => ({
      x: (point.x * 0.5 + 0.5) * width,
      y: (1 - (point.y * 0.5 + 0.5)) * height,
      z: point.z,
    }));
    const minX = Math.max(0, Math.floor(Math.min(screen[0].x, screen[1].x, screen[2].x)));
    const maxX = Math.min(width - 1, Math.ceil(Math.max(screen[0].x, screen[1].x, screen[2].x)));
    const minY = Math.max(0, Math.floor(Math.min(screen[0].y, screen[1].y, screen[2].y)));
    const maxY = Math.min(height - 1, Math.ceil(Math.max(screen[0].y, screen[1].y, screen[2].y)));
    const area = (screen[1].x - screen[0].x) * (screen[2].y - screen[0].y)
      - (screen[2].x - screen[0].x) * (screen[1].y - screen[0].y);
    if (Math.abs(area) < 0.01) continue;
    const rgb = shade(triangle.color, triangle.n);
    for (let y = minY; y <= maxY; y += 1) {
      for (let x = minX; x <= maxX; x += 1) {
        const px = x + 0.5;
        const py = y + 0.5;
        const w0 = ((screen[1].x - px) * (screen[2].y - py) - (screen[2].x - px) * (screen[1].y - py)) / area;
        const w1 = ((screen[2].x - px) * (screen[0].y - py) - (screen[0].x - px) * (screen[2].y - py)) / area;
        const w2 = 1 - w0 - w1;
        if (w0 < 0 || w1 < 0 || w2 < 0) continue;
        const z = w0 * screen[0].z + w1 * screen[1].z + w2 * screen[2].z;
        const offset = y * width + x;
        if (z >= depth[offset]) continue;
        depth[offset] = z;
        const pixel = offset * 4;
        pixels[pixel] = Math.round(srgb(rgb[0]) * 255);
        pixels[pixel + 1] = Math.round(srgb(rgb[1]) * 255);
        pixels[pixel + 2] = Math.round(srgb(rgb[2]) * 255);
      }
    }
  }
  return pixels;
}

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let index = 0; index < 256; index += 1) {
    let value = index;
    for (let bit = 0; bit < 8; bit += 1) value = (value & 1) ? (0xedb88320 ^ (value >>> 1)) : (value >>> 1);
    table[index] = value >>> 0;
  }
  return table;
})();

function crc32(buffer: Buffer): number {
  let crc = 0xffffffff;
  for (const byte of buffer) crc = CRC_TABLE[(crc ^ byte) & 255] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

function pngChunk(type: string, data: Buffer): Buffer {
  const typeBuffer = Buffer.from(type);
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([typeBuffer, data])));
  return Buffer.concat([length, typeBuffer, data, crc]);
}

function writePng(file: string, width: number, height: number, rgba: Buffer) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  const raw = Buffer.alloc(height * (1 + width * 4));
  for (let y = 0; y < height; y += 1) {
    const row = y * (1 + width * 4);
    raw[row] = 0;
    rgba.copy(raw, row + 1, y * width * 4, (y + 1) * width * 4);
  }
  const png = Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    pngChunk("IHDR", ihdr),
    pngChunk("IDAT", deflateSync(raw)),
    pngChunk("IEND", Buffer.alloc(0)),
  ]);
  writeFileSync(file, png);
}

function sideBySide(left: Buffer, right: Buffer, width: number, height: number): Buffer {
  const gap = 16;
  const combined = Buffer.alloc((width * 2 + gap) * height * 4);
  for (let index = 0; index < combined.length; index += 4) {
    combined[index] = 214;
    combined[index + 1] = 210;
    combined[index + 2] = 202;
    combined[index + 3] = 255;
  }
  const totalWidth = width * 2 + gap;
  for (let y = 0; y < height; y += 1) {
    left.copy(combined, (y * totalWidth) * 4, y * width * 4, (y + 1) * width * 4);
    right.copy(combined, (y * totalWidth + width + gap) * 4, y * width * 4, (y + 1) * width * 4);
  }
  return combined;
}

function turning(points: { x: number; y: number; z: number }[]): number {
  let total = 0;
  let previous = normalize(subtract(points[1], points[0]));
  for (let index = 1; index < points.length - 1; index += 1) {
    const next = normalize(subtract(points[index + 1], points[index]));
    total += Math.acos(Math.min(1, Math.max(-1, dot(previous, next))));
    previous = next;
  }
  return total;
}

function mouthOf(graph: PlantGraph) {
  const bloom = graph.organs.get("plant-1:bloom")!;
  const stalk = graph.branches.get(bloom.branchId)!;
  const frame = sampleMaterialFrame(stalk, bloom.distance);
  const cosine = Math.cos(bloom.spin);
  const sine = Math.sin(bloom.spin);
  return {
    mouthY: frame.normal.y * cosine + frame.binormal.y * sine,
    tangentY: frame.tangent.y,
    alignment: dot(
      {
        x: frame.normal.x * cosine + frame.binormal.x * sine,
        y: frame.normal.y * cosine + frame.binormal.y * sine,
        z: frame.normal.z * cosine + frame.binormal.z * sine,
      },
      frame.tangent,
    ),
    stalkTurn: turning(stalk.points),
  };
}

function substitutionPose(seed: number): PlantGraph {
  let graph = createSingleFlower("plant-1", seed, BASE);
  const stemId = graph.rootBranchId;
  const anchor = graph.branches.get(stemId)!.points[0];
  const tip = graph.branches.get(stemId)!.points.at(-1)!;
  graph = aimBranch(graph, stemId, tip, add(anchor, vec3(0.15, 0.08, 6)));
  for (let pass = 0; pass < 4; pass += 1) {
    const stem = graph.branches.get(stemId)!;
    const fraction = pass % 2 === 0 ? 0.74 : 0.52;
    const station = stem.activeLength * fraction;
    const at = sampleBranch(stem, station).position;
    graph = bendBranch(graph, {
      branchId: stemId,
      stationDistance: station,
      target: add(at, vec3(0.15, -4, 1.6)),
    });
  }
  const pedicel = graph.branches.get("plant-1:pedicel")!;
  const pedicelAnchor = pedicel.points[0];
  const grab = pedicel.points[pedicel.points.length - 1];
  let best = graph;
  let bestScore = mouthOf(graph).mouthY;
  for (let step = 0; step < 12; step += 1) {
    for (let band = 0; band < 5; band += 1) {
      const theta = (step / 12) * Math.PI * 2;
      const phi = ((band + 0.35) / 5) * Math.PI;
      const direction = vec3(
        Math.sin(phi) * Math.cos(theta),
        Math.cos(phi),
        Math.sin(phi) * Math.sin(theta),
      );
      const aimed = aimBranch(graph, pedicel.id, grab, add(pedicelAnchor, scale(direction, 1.3)));
      const score = mouthOf(aimed).mouthY;
      if (score < bestScore) {
        best = aimed;
        bestScore = score;
      }
    }
  }
  return best;
}

mkdirSync(OUT, { recursive: true });
const views = ["front", "three-quarter", "above"] as const;
const nodding = createNoddingFlower("plant-1", 8278, BASE);
const substituted = substitutionPose(8278);
const noddingScene = collectScene(nodding);
const substitutedScene = collectScene(substituted);

for (const view of views) {
  const pose = canonicalCameraPose(view);
  const left = render(substitutedScene, pose, WIDTH, HEIGHT);
  const right = render(noddingScene, pose, WIDTH, HEIGHT);
  const name = view === "three-quarter" ? "three-quarter" : view;
  writePng(`${OUT}/compare-${name}.png`, WIDTH * 2 + 16, HEIGHT, sideBySide(left, right, WIDTH, HEIGHT));
  writePng(`${OUT}/nodding-${name}.png`, WIDTH, HEIGHT, right);
}

for (const seed of [9255, 10232] as const) {
  const scene = collectScene(createNoddingFlower("plant-1", seed, BASE));
  writePng(`${OUT}/nodding-seed${seed}-front.png`, WIDTH, HEIGHT, render(scene, canonicalCameraPose("front"), WIDTH, HEIGHT));
}

const restSingle = createSingleFlower("plant-1", 8278, BASE);
writePng(
  `${OUT}/single-flower-rest-front.png`,
  WIDTH,
  HEIGHT,
  render(collectScene(restSingle), canonicalCameraPose("front"), WIDTH, HEIGHT),
);

const metrics = {
  method: "Offline projection of production tube and organ meshes through canonical cameras. Not a WebGL or phone capture.",
  width: WIDTH,
  height: HEIGHT,
  fov: STUDIO_VERTICAL_FOV,
  light: [-3, 8, 7],
  singleFlowerRest: mouthOf(restSingle),
  singleFlowerSubstituted: {
    ...mouthOf(substituted),
    stemTurn: turning(substituted.branches.get(substituted.rootBranchId)!.points),
  },
  nodding: (() => {
    const bloom = nodding.organs.get("plant-1:bloom")!;
    const neck = nodding.branches.get(bloom.branchId)!;
    const tip = sampleMaterialFrame(neck, bloom.distance);
    return {
      tangent: tip.tangent,
      bloomPosition: tip.position,
      neckTurn: turning(neck.points),
      neckLength: neck.activeLength,
      stemLength: nodding.branches.get(nodding.rootBranchId)!.activeLength,
      branches: nodding.branches.size,
      organs: nodding.organs.size,
    };
  })(),
};
writeFileSync(`${OUT}/substitution-metrics.json`, `${JSON.stringify(metrics, null, 2)}\n`);
console.log(JSON.stringify(metrics, null, 2));
