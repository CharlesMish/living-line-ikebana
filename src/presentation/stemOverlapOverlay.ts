import * as THREE from "three";
import { findStemOverlaps, structuralStems, type StemOverlap } from "../core/stemOverlaps.ts";
import type { PlantGraph } from "../core/types.ts";

export const MAX_OVERLAP_MARKS = 32;

function brackets(inner: number, outer: number) {
  const vertices: number[] = [];
  for (let quadrant = 0; quadrant < 4; quadrant++) for (let step = 0; step < 6; step++) {
    const a = quadrant * Math.PI / 2 + .18 + step * .2;
    const b = a + .2;
    const at = (r: number, angle: number) => [r * Math.cos(angle), r * Math.sin(angle), 0];
    vertices.push(...at(inner, a), ...at(outer, a), ...at(outer, b), ...at(inner, a), ...at(outer, b), ...at(inner, b));
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(vertices, 3));
  return geometry;
}

/** Camera-facing broken amber rings: inspection marks, deliberately not pick targets. */
export class StemOverlapOverlay {
  readonly group = new THREE.Group();
  private readonly outline = this.layer(0xfaf5e8, .65, 1.18, 40);
  private readonly ink = this.layer(0x93602c, .81, 1.03, 41);
  private signature: string | null = null;
  private contacts: StemOverlap[] = [];

  constructor() { this.group.name = "stem-overlap-inspection"; this.group.add(this.outline, this.ink); }

  private layer(color: number, inner: number, outer: number, order: number) {
    const mesh = new THREE.InstancedMesh(brackets(inner, outer), new THREE.MeshBasicMaterial({
      color, transparent: true, opacity: .9, depthTest: false, depthWrite: false, fog: false, side: THREE.DoubleSide,
      forceSinglePass: true,
    }), MAX_OVERLAP_MARKS);
    mesh.count = 0; mesh.renderOrder = order; mesh.frustumCulled = false;
    mesh.raycast = () => {}; // Neither the scene raycaster nor generic picking can acquire a mark.
    return mesh;
  }

  setGraphs(graphs: Iterable<PlantGraph> | null): number {
    if (graphs === null) {
      this.group.visible = false; this.contacts = []; this.signature = null;
      this.outline.count = this.ink.count = 0;
      return 0;
    }
    const list = [...graphs];
    const signature = JSON.stringify(structuralStems(list).map(({ plant, branch }) => [plant, branch.id, branch.radius, branch.points]));
    if (signature !== this.signature) { this.contacts = findStemOverlaps(list); this.signature = signature; }
    this.group.visible = true;
    return this.contacts.length;
  }

  update(camera: THREE.PerspectiveCamera, height: number) {
    if (!this.group.visible) return;
    camera.updateMatrixWorld(true);
    const matrix = new THREE.Matrix4(), scale = new THREE.Vector3();
    let count = 0;
    for (const contact of this.contacts) {
      const p = new THREE.Vector3(contact.position.x, contact.position.y, contact.position.z);
      const local = p.clone().applyMatrix4(camera.matrixWorldInverse), ndc = p.clone().project(camera);
      if (local.z >= 0 || Math.abs(ndc.x) > 1 || Math.abs(ndc.y) > 1 || Math.abs(ndc.z) > 1) continue;
      // Nine CSS pixels radius, independent of devicePixelRatio, zoom and lens.
      const radius = -local.z * 2 / camera.projectionMatrix.elements[5] / Math.max(1, height) * 9;
      matrix.compose(p, camera.quaternion, scale.setScalar(radius));
      this.outline.setMatrixAt(count, matrix); this.ink.setMatrixAt(count, matrix);
      if (++count === MAX_OVERLAP_MARKS) break;
    }
    this.outline.count = this.ink.count = count;
    this.outline.instanceMatrix.needsUpdate = this.ink.instanceMatrix.needsUpdate = true;
  }

  dispose() {
    for (const mesh of [this.outline, this.ink]) { mesh.geometry.dispose(); mesh.material.dispose(); mesh.dispose(); }
    this.group.removeFromParent();
  }
}
