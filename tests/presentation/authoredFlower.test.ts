import assert from "node:assert/strict";
import test from "node:test";
import { createHash } from "node:crypto";
import * as THREE from "three";
import { createAuthoredFlowerCorollaGeometry, createAuthoredFlowerCalyxGeometry } from "../../src/presentation/authoredFlowerGeometry.ts";
import { createTuftedPetalGeometry, tuftInstancePose } from "../../src/presentation/botanicalGeometry.ts";

const FORMS = ["compact-cup", "spray-cup"] as const;
const SEEDS = [0, 8278, 9255, 10232, 0xffffffff, ...Array.from({ length: 30 }, (_, i) => (i * 2654435761) >>> 0)];

type TriangleRecord = { a: THREE.Vector3; b: THREE.Vector3; c: THREE.Vector3; box: THREE.Box3 };
function triangles(geometry: THREE.BufferGeometry, transform = new THREE.Matrix4()): TriangleRecord[] {
  const p = geometry.getAttribute("position"), indices = geometry.index!;
  const result: TriangleRecord[] = [];
  for (let i = 0; i < indices.count; i += 3) {
    const vertices = [0, 1, 2].map(offset => new THREE.Vector3().fromBufferAttribute(p, indices.getX(i + offset)).applyMatrix4(transform));
    result.push({ a: vertices[0], b: vertices[1], c: vertices[2], box: new THREE.Box3().setFromPoints(vertices) });
  }
  return result;
}

/** An independent segment/triangle surface probe. Only a strict crossing of a
 * face interior counts; touching an edge is not reported as piercing a petal. */
function pierces(a: TriangleRecord, b: TriangleRecord): boolean {
  if (!a.box.intersectsBox(b.box)) return false;
  const ray = new THREE.Ray(), hit = new THREE.Vector3(), barycentric = new THREE.Vector3();
  const crosses = (edge: TriangleRecord, face: TriangleRecord) => {
    const points = [edge.a, edge.b, edge.c];
    for (let i = 0; i < 3; i++) {
      const start = points[i], end = points[(i + 1) % 3], length = start.distanceTo(end);
      ray.set(start, end.clone().sub(start).normalize());
      if (!ray.intersectTriangle(face.a, face.b, face.c, false, hit)) continue;
      const distance = hit.distanceTo(start);
      if (distance <= 1e-7 || distance >= length - 1e-7) continue;
      THREE.Triangle.getBarycoord(hit, face.a, face.b, face.c, barycentric);
      if (Math.min(barycentric.x, barycentric.y, barycentric.z) > 1e-6) return true;
    }
    return false;
  };
  return crosses(a, b) || crosses(b, a);
}

function hasPiercing(parts: TriangleRecord[][]): boolean {
  for (let a = 0; a < parts.length; a++) for (let b = a + 1; b < parts.length; b++) {
    for (const t1 of parts[a]) for (const t2 of parts[b]) if (pierces(t1, t2)) return true;
  }
  return false;
}

/** Infer petal components from triangle connectivity, without relying on the
 * generator's row counts or ranges. A closed petal must be one component. */
function components(geometry: THREE.BufferGeometry): number[][] {
  const positions = geometry.getAttribute("position"), index = geometry.index!;
  const neighbours = Array.from({ length: positions.count }, () => new Set<number>());
  for (let i = 0; i < index.count; i += 3) {
    const ids = [index.getX(i), index.getX(i + 1), index.getX(i + 2)];
    for (const a of ids) for (const b of ids) neighbours[a].add(b);
  }
  const seen = new Set<number>(), result: number[][] = [];
  for (let v = 0; v < positions.count; v++) {
    if (seen.has(v)) continue;
    const todo = [v], part: number[] = []; seen.add(v);
    while (todo.length) {
      const a = todo.pop()!; part.push(a);
      for (const b of neighbours[a]) if (!seen.has(b)) { seen.add(b); todo.push(b); }
    }
    result.push(part);
  }
  return result;
}

function radius(geometry: THREE.BufferGeometry): number {
  const p = geometry.getAttribute("position"); let peak = 0;
  for (let i = 0; i < p.count; i++) peak = Math.max(peak, Math.hypot(p.getX(i), p.getY(i)));
  return peak;
}

test("every authored petal is closed and stays in a disjoint convex sector, including its reverse", () => {
  for (const form of FORMS) for (const seed of SEEDS) {
    const geometry = createAuthoredFlowerCorollaGeometry(seed, form);
    try {
      const p = geometry.getAttribute("position"), normals = geometry.getAttribute("normal"), index = geometry.index!;
      const parts = components(geometry), count = form === "compact-cup" ? 8 : 6;
      assert.equal(parts.length, count);
      const petalForVertex = new Map<number, number>();
      for (let petal = 0; petal < parts.length; petal++) {
        const centre = petal * Math.PI * 2 / count;
        for (const v of parts[petal]) {
          petalForVertex.set(v, petal);
          const theta = Math.atan2(p.getY(v), p.getX(v));
          const delta = Math.atan2(Math.sin(theta - centre), Math.cos(theta - centre));
          // Every triangle is a convex combination of its vertices. These
          // separate convex wedges are therefore a proof of no cross-petal
          // intersection, rather than sparse sampled triangle/pixel guesses.
          assert.ok(Math.abs(delta) < Math.PI / count - 0.0005, `${form} seed ${seed}: petal crossed its neighbour's sector`);
          assert.ok(Math.hypot(p.getX(v), p.getY(v), p.getZ(v)) < 0.53, "margin inside unchanged .56 acquisition sphere");
          assert.ok(Math.abs(Math.hypot(normals.getX(v), normals.getY(v), normals.getZ(v)) - 1) < 1e-5);
        }
      }
      const edges = new Map<string, number>(), volumes = Array(count).fill(0);
      const frontZ = new Map<string, number>(), backZ = new Map<string, number>();
      for (let i = 0; i < p.count; i++) {
        const key = `${p.getX(i)},${p.getY(i)}`;
        frontZ.set(key, Math.max(frontZ.get(key) ?? -Infinity, p.getZ(i)));
        backZ.set(key, Math.min(backZ.get(key) ?? Infinity, p.getZ(i)));
      }
      const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3();
      for (let i = 0; i < index.count; i += 3) {
        const ids = [index.getX(i), index.getX(i + 1), index.getX(i + 2)];
        a.fromBufferAttribute(p, ids[0]); b.fromBufferAttribute(p, ids[1]); c.fromBufferAttribute(p, ids[2]);
        const area = b.clone().sub(a).cross(c.clone().sub(a));
        assert.ok(area.lengthSq() > 1e-16, "no collapsed faces or rims");
        const isFront = [a, b, c].every(v => frontZ.get(`${v.x},${v.y}`) === v.z);
        const isBack = [a, b, c].every(v => backZ.get(`${v.x},${v.y}`) === v.z);
        if (isFront) assert.ok(area.z > 0, "front surface has outward +Z winding");
        if (isBack) assert.ok(area.z < 0, "reverse surface has outward -Z winding");
        const petal = petalForVertex.get(ids[0])!;
        assert.ok(ids.every(v => petalForVertex.get(v) === petal), "no bridge triangle between distinct petals");
        volumes[petal] += a.dot(b.clone().cross(c)) / 6;
        for (let e = 0; e < 3; e++) {
          const u = ids[e], v = ids[(e + 1) % 3], key = `${Math.min(u, v)}:${Math.max(u, v)}`;
          edges.set(key, (edges.get(key) ?? 0) + 1);
        }
      }
      assert.ok([...edges.values()].every(n => n === 2), "closed, two-sided petal shells");
      assert.ok(volumes.every(volume => volume > 0), "outward winding on every closed petal");
    } finally { geometry.dispose(); }
  }
});

test("independent triangle probes find the old petal piercing and none in either authored corolla", () => {
  for (const seed of [8278, 9255, 10232]) {
    for (const scatter of [{ azimuth: 0.16, scale: 0.065, tilt: 0.06 }, { azimuth: 0.22, scale: 0.09, tilt: 0.08 }]) {
      const old = createTuftedPetalGeometry(seed);
      const oldPetals = Array.from({ length: 8 }, (_, i) => {
        const pose = tuftInstancePose(seed, i, 8, scatter);
        return triangles(old, new THREE.Matrix4().makeRotationZ(pose.azimuth)
          .multiply(new THREE.Matrix4().makeRotationX(pose.tilt)).scale(new THREE.Vector3(pose.scale, pose.scale, pose.scale)));
      });
      assert.equal(hasPiercing(oldPetals), true, `old seed ${seed} must expose actual triangle piercing`);
      old.dispose();
    }
    for (const form of FORMS) {
      const geometry = createAuthoredFlowerCorollaGeometry(seed, form), index = geometry.index!;
      const partForVertex = new Map<number, number>();
      const parts = components(geometry).map((vertices, part) => {
        vertices.forEach(v => partForVertex.set(v, part)); return [] as TriangleRecord[];
      });
      triangles(geometry).forEach((t, i) => parts[partForVertex.get(index.getX(i * 3))!].push(t));
      assert.equal(hasPiercing(parts), false, `${form} seed ${seed}: no cross-petal surface piercing`);
      geometry.dispose();
    }
  }
});

test("the previous independently tilted eight-petal draw fails the sector guard", () => {
  const geometry = createTuftedPetalGeometry(8278), p = geometry.getAttribute("position");
  const pose = tuftInstancePose(8278, 0, 8, { azimuth: 0.22, scale: 0.09, tilt: 0.08 });
  const matrix = new THREE.Matrix4().makeRotationZ(pose.azimuth).multiply(new THREE.Matrix4().makeRotationX(pose.tilt));
  const point = new THREE.Vector3(); let crossings = 0;
  for (let i = 0; i < p.count; i++) {
    point.fromBufferAttribute(p, i).applyMatrix4(matrix);
    if (Math.abs(Math.atan2(point.y, point.x)) >= Math.PI / 8) crossings++;
  }
  assert.ok(crossings > 10, "the regression witness must expose the earlier broad, independently tilted petals");
  geometry.dispose();
});

test("Compact has a wider, deeper cup while spray remains open, with deterministic matching reverses", () => {
  for (const seed of [8278, 9255, 10232]) {
    const compact = createAuthoredFlowerCorollaGeometry(seed, "compact-cup");
    const spray = createAuthoredFlowerCorollaGeometry(seed, "spray-cup");
    try {
      assert.ok(radius(compact) / radius(spray) > 1.10 && radius(compact) / radius(spray) < 1.15);
      assert.ok(compact.boundingBox!.max.z > spray.boundingBox!.max.z * 1.7);
      assert.ok(compact.boundingBox!.max.z < 0.22, "cupped flower, not a tall stacked head");
      for (const form of FORMS) {
        const repeat = createAuthoredFlowerCorollaGeometry(seed, form), actual = form === "compact-cup" ? compact : spray;
        for (const attribute of ["position", "normal", "color"]) assert.deepEqual(repeat.getAttribute(attribute).array, actual.getAttribute(attribute).array);
        repeat.dispose();
        const calyx = createAuthoredFlowerCalyxGeometry(seed, form);
        assert.ok(calyx.boundingBox!.containsPoint(new THREE.Vector3()), "receptacle surrounds the actual attachment");
        assert.ok(calyx.boundingBox!.max.z < 0.03, "green sepals remain behind the corolla");
        calyx.dispose();
      }
    } finally { compact.dispose(); spray.dispose(); }
  }
});

test("the archived flower-volume tuft retains its exact position, normals, color and index arrays", () => {
  const hashes = new Map([
    [8278, "7edce8e0f57eeea60489bce589dc56bfb74e076d098b3c35990b37c9bc9c5931"],
    [9255, "011274bf897a6bfaf4a58ef41f794c8e2fa191a83bade9ecb0b27783ae564bd2"],
    [10232, "122e9a16688adc3ce98271b363d87436cc8ae7b5533bfd746375b3f246d89a82"],
  ]);
  for (const [seed, expected] of hashes) {
    const geometry = createTuftedPetalGeometry(seed), hash = createHash("sha256");
    for (const attr of ["position", "normal", "color"]) hash.update(Buffer.from(geometry.getAttribute(attr).array.buffer));
    hash.update(Buffer.from(geometry.index!.array.buffer));
    assert.equal(hash.digest("hex"), expected);
    geometry.dispose();
  }
});
