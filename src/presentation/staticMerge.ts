import * as THREE from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";

export interface StaticMerge {
  /** Holds the merged meshes, positioned at the root's origin. */
  group: THREE.Group;
  /** Original meshes now drawn through `group`. */
  merged: number;
  /** Draw groups after merging (one per material and attribute layout). */
  batches: number;
  /** Releases only the merged geometries. Materials stay with their owner. */
  dispose(): void;
}

/**
 * Display builders clone a material per branch or organ so each can be tinted
 * while editing. On a frozen display those clones are identical; batch by what
 * the material renders (its serialised parameters, maps by identity, and its
 * shader customisation), not by object identity.
 */
const signatures = new WeakMap<THREE.Material, string>();
export function materialSignature(material: THREE.Material): string {
  let signature = signatures.get(material);
  if (signature !== undefined) return signature;
  const parts: string[] = [];
  for (const [key, value] of Object.entries(material).sort(([a], [b]) => a.localeCompare(b))) {
    if (["uuid", "name", "id", "version", "userData", "_listeners"].includes(key) || typeof value === "function") continue;
    if (value instanceof THREE.Texture) parts.push(`${key}=tex:${value.uuid}`);
    else if (value instanceof THREE.Color) parts.push(`${key}=${value.getHexString()}`);
    else if (value instanceof THREE.Vector2 || value instanceof THREE.Vector3) parts.push(`${key}=${value.toArray().join(",")}`);
    else if (value === null || ["number", "string", "boolean", "undefined"].includes(typeof value)) parts.push(`${key}=${String(value)}`);
    else if (Array.isArray(value)) parts.push(`${key}=[${value.length}]:${material.uuid}`); // e.g. clipping planes: never shared
    else if (value instanceof THREE.Euler) parts.push(`${key}=${value.toArray().join(",")}`);
    else if (Object.getPrototypeOf(value) === Object.prototype) {
      try { parts.push(`${key}=${JSON.stringify(value)}`); } catch { parts.push(`${key}=obj:${material.uuid}`); }
    } else parts.push(`${key}=obj:${material.uuid}`); // unknown structure: keep this material on its own
  }
  signature = `${material.type}|${material.customProgramCacheKey()}|${parts.join(";")}`;
  signatures.set(material, signature);
  return signature;
}

const attributeKey = (geometry: THREE.BufferGeometry) =>
  Object.keys(geometry.attributes).sort().map(name => `${name}:${geometry.attributes[name]!.itemSize}`).join(",");

/**
 * Bakes the visible, single-material meshes under `root` into one geometry per
 * material, for scenery that will not move again (a kept arrangement on
 * display, the room around it). Originals are hidden, never removed or
 * disposed, so whoever built them still finds and releases them.
 *
 * Instanced meshes, multi-material meshes, invisible materials (acquisition
 * proxies) and anything under `exclude` keep drawing on their own.
 */
export function mergeStaticMeshes(root: THREE.Object3D, exclude: ReadonlySet<THREE.Object3D> = new Set()): StaticMerge {
  root.updateMatrixWorld(true);
  const toRoot = new THREE.Matrix4().copy(root.matrixWorld).invert();
  const buckets = new Map<string, { material: THREE.Material; castShadow: boolean; receiveShadow: boolean; renderOrder: number; parts: THREE.BufferGeometry[]; sources: THREE.Mesh[] }>();
  const skipped = (object: THREE.Object3D) => {
    for (let node: THREE.Object3D | null = object; node && node !== root; node = node.parent) if (exclude.has(node)) return true;
    return false;
  };
  root.traverseVisible(object => {
    if (!(object instanceof THREE.Mesh) || object instanceof THREE.InstancedMesh || Array.isArray(object.material)) return;
    const material = object.material as THREE.Material;
    if (!material.visible || !material.colorWrite || material.opacity === 0 || skipped(object)) return;
    if (Object.keys(object.geometry.morphAttributes).length) return;
    const key = `${materialSignature(material)}|${attributeKey(object.geometry)}|${object.castShadow}|${object.receiveShadow}|${object.renderOrder}`;
    let bucket = buckets.get(key);
    if (!bucket) buckets.set(key, bucket = { material, castShadow: object.castShadow, receiveShadow: object.receiveShadow, renderOrder: object.renderOrder, parts: [], sources: [] });
    const part = object.geometry.clone();
    const matrix = new THREE.Matrix4().multiplyMatrices(toRoot, object.matrixWorld);
    part.applyMatrix4(matrix);
    if (!part.index) {
      const count = part.attributes.position!.count;
      part.setIndex(Array.from({ length: count }, (_, i) => i));
    }
    // A mirrored transform flips winding; restore front faces.
    if (matrix.determinant() < 0) {
      const index = part.index!;
      for (let i = 0; i + 2 < index.count; i += 3) { const a = index.getX(i + 1); index.setX(i + 1, index.getX(i + 2)); index.setX(i + 2, a); }
    }
    part.clearGroups();
    bucket.parts.push(part); bucket.sources.push(object);
  });
  const group = new THREE.Group(); group.name = "static-merge";
  const geometries: THREE.BufferGeometry[] = [];
  let merged = 0;
  for (const bucket of buckets.values()) {
    if (bucket.parts.length < 2) { bucket.parts.forEach(part => part.dispose()); continue; }
    const geometry = mergeGeometries(bucket.parts, false);
    bucket.parts.forEach(part => part.dispose());
    if (!geometry) continue;
    geometry.computeBoundingBox(); geometry.computeBoundingSphere();
    const mesh = new THREE.Mesh(geometry, bucket.material);
    mesh.name = `merged:${bucket.material.name || bucket.material.type}`;
    mesh.castShadow = bucket.castShadow; mesh.receiveShadow = bucket.receiveShadow; mesh.renderOrder = bucket.renderOrder;
    group.add(mesh); geometries.push(geometry);
    for (const source of bucket.sources) source.visible = false;
    merged += bucket.sources.length;
  }
  root.add(group);
  let disposed = false;
  return {
    group, merged, batches: geometries.length,
    dispose() {
      if (disposed) return; disposed = true;
      group.removeFromParent(); geometries.forEach(geometry => geometry.dispose()); group.clear();
    },
  };
}
