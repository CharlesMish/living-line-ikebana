import * as THREE from "three";
import { findStemOverlaps, structuralStems, type StemOverlap } from "../core/stemOverlaps.ts";
import type { PlantGraph } from "../core/types.ts";

export const MAX_OVERLAP_MARKS = 32;

function brackets(halfSize: number, stroke: number) {
  const vertices: number[] = [];
  // Four square corners leave the contact itself visible. Unlike the round
  // bend bead, this glyph has no disc, closed ring, or draggable centre.
  for (const sx of [-1, 1]) for (const sy of [-1, 1]) {
    const rectangle = (x0: number, y0: number, x1: number, y1: number) => {
      const at = (x: number, y: number) => [sx * x, sy * y, 0];
      vertices.push(...at(x0, y0), ...at(x1, y0), ...at(x1, y1), ...at(x0, y0), ...at(x1, y1), ...at(x0, y1));
    };
    rectangle(.35, halfSize - stroke, halfSize, halfSize);
    rectangle(halfSize - stroke, .35, halfSize, halfSize - stroke);
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(vertices, 3));
  return geometry;
}

/** Camera-facing angular contact brackets, deliberately not pick targets. */
export class StemOverlapOverlay {
  readonly group = new THREE.Group();
  private readonly outline = this.layer(0xfffbee, 1.17, .46, 40);
  private readonly ink = this.layer(0x593919, 1, .22, 41);
  private signature: string | null = null;
  private contacts: StemOverlap[] = [];
  private barriers: StemOverlap[] = [];

  constructor() { this.group.name = "stem-overlap-inspection"; this.group.add(this.outline, this.ink); }

  private layer(color: number, halfSize: number, stroke: number, order: number) {
    const mesh = new THREE.InstancedMesh(brackets(halfSize, stroke), new THREE.MeshBasicMaterial({
      color, transparent: true, opacity: 1, toneMapped: false, depthTest: false, depthWrite: false, fog: false, side: THREE.DoubleSide,
      forceSinglePass: true,
    }), MAX_OVERLAP_MARKS);
    mesh.count = 0; mesh.renderOrder = order; mesh.frustumCulled = false;
    mesh.raycast = () => {}; // Neither the scene raycaster nor generic picking can acquire a mark.
    return mesh;
  }

  setGraphs(graphs: Iterable<PlantGraph> | null, barriers: StemOverlap[] = []): number {
    this.barriers = barriers;
    if (graphs === null) {
      this.group.visible = barriers.length > 0; this.contacts = []; this.signature = null;
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
    for (const contact of [...this.barriers, ...this.contacts]) {
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
