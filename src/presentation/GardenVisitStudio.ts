import * as THREE from "three";
import { fromCanonicalPlantGraph, type CanonicalPlantGraph } from "../core/index.ts";
import { VESSEL_PROFILES, ORIGINAL_VESSEL } from "../study/vesselProfiles.ts";
import { ThreeStudio } from "./ThreeStudio.ts";
import { createPerchSurface, disposePhotoPerch } from "./perchSurfaces.ts";
import type { BotanicalTones } from "./botanicalTones.ts";

/** Structural subset of a kept entry. The display never receives a store,
 * coordinator, generator, working camera or mutation callback. */
export interface GardenVisitEntry {
  id: string;
  title: string;
  thumbnail: string | null;
  arrangement: {
    plants: readonly CanonicalPlantGraph[];
    scene?: { layoutId: string; colorId: string; finishId: string;
      botanicalTones?: BotanicalTones; stemFibers: boolean };
  };
}
export type GardenVisitEntries = readonly [GardenVisitEntry | null, GardenVisitEntry | null, GardenVisitEntry | null];
export interface GardenVisitOptions {
  onSelect?: (slot: number) => void;
  onError?: (message: string) => void;
  onWarning?: (message: string) => void;
}
export interface GardenVisitLayout {
  centers: number[];
  widths: number[];
  depth: number;
  back: number;
  top: number;
  span: number;
}
const BENCH_TOP = 1.1;
// Vessel geometry begins at .04 above its canonical botanical datum.
export const GARDEN_ARRANGEMENT_Y = BENCH_TOP - .04;
const PRINT_WIDTH = 4.4;
const PRINT_HEIGHT = 3.3;
const SLOT_GAP = 1.5;
const UP = new THREE.Vector3(0, 1, 0);

/** Hidden hit proxies, inactive records and gesture decorations cannot inflate
 * the footprint. Geometry is read in place, never transformed in the graph. */
export function visibleGardenBounds(group: THREE.Object3D): THREE.Box3 {
  group.updateMatrixWorld(true);
  const bounds = new THREE.Box3();
  group.traverseVisible(object => {
    if (!(object instanceof THREE.Mesh)) return;
    const materials = Array.isArray(object.material) ? object.material : [object.material];
    if (materials.every(material => !material.visible || !material.colorWrite || material.opacity === 0)) return;
    if (object instanceof THREE.InstancedMesh) {
      object.computeBoundingBox();
      if (object.boundingBox) bounds.union(object.boundingBox.clone().applyMatrix4(object.matrixWorld));
    } else {
      object.geometry.computeBoundingBox();
      if (object.geometry.boundingBox) bounds.union(object.geometry.boundingBox.clone().applyMatrix4(object.matrixWorld));
    }
  });
  return bounds;
}

/** Preserve all world dimensions. Broad or leaning stock earns room rather
 * than being silently shrunk to a standard thumbnail-sized bowl. */
export function gardenVisitLayout(bounds: readonly THREE.Box3[]): GardenVisitLayout {
  const widths = Array.from({ length: 3 }, (_, i) => {
    const b = bounds[i];
    return b && !b.isEmpty() ? Math.max(6, 2 * Math.max(Math.abs(b.min.x), Math.abs(b.max.x)) + .7) : 6;
  });
  const span = widths.reduce((sum, width) => sum + width, 0) + SLOT_GAP * 2;
  let left = -span / 2;
  const centers = widths.map(width => { const center = left + width / 2; left += width + SLOT_GAP; return center; });
  const populated = bounds.filter(b => !b.isEmpty());
  const back = Math.min(-3.2, ...populated.map(b => b.min.z - 1));
  const front = Math.max(3.1, ...populated.map(b => b.max.z + .7));
  const top = Math.max(6, ...populated.map(b => b.max.y + GARDEN_ARRANGEMENT_Y));
  return { centers, widths, span, back, depth: front - back, top };
}

/** CPU-only retained display. Testable without browser globals or a WebGL
 * renderer. Same plant IDs in separate entries remain separate scene groups. */
export function createKeptGardenDisplay(entry: GardenVisitEntry) {
  const scene = entry.arrangement.scene;
  const display = ThreeStudio.createDisplayGroup(entry.arrangement.plants.map(fromCanonicalPlantGraph), {
    vesselProfile: VESSEL_PROFILES.find(profile => profile.id === scene?.layoutId) ?? ORIGINAL_VESSEL,
    vesselAppearance: scene ? { colorId: scene.colorId, finishId: scene.finishId } : undefined,
    botanicalTones: scene?.botanicalTones,
    stemFibers: scene?.stemFibers ?? false,
  });
  display.group.name = `garden-entry:${entry.id}`;
  return display;
}

/** Keep the saved image intact: letterbox in the physical mount, never crop,
 * stretch, grade, relight or regenerate it from the saved botanical graphs. */
export function gardenPrintSize(width: number, height: number) {
  const ratio = width > 0 && height > 0 ? width / height : 4 / 3;
  return ratio >= PRINT_WIDTH / PRINT_HEIGHT
    ? { width: PRINT_WIDTH, height: PRINT_WIDTH / ratio }
    : { width: PRINT_HEIGHT * ratio, height: PRINT_HEIGHT };
}

type Display = ReturnType<typeof createKeptGardenDisplay>;
type Slot = { entry: GardenVisitEntry | null; display: Display | null; root: THREE.Group; bounds: THREE.Box3; frame: THREE.Mesh; image?: HTMLImageElement; texture?: THREE.Texture };
type Pose = { theta: number; phi: number; radius: number; target: THREE.Vector3 };
type Gesture = { pointers: Map<number, THREE.Vector2>; first: THREE.Vector2; moved: boolean; pinchDistance: number | null; pose: Pose };

/** One disposable scene and one WebGL context for the complete visit. Rendering
 * is on demand; no animation loop continues while a visitor is idle. */
export class GardenVisitStudio {
  readonly canvas: HTMLCanvasElement;
  private readonly scene = new THREE.Scene();
  private readonly camera = new THREE.PerspectiveCamera(42, 1, .1, 1000);
  private readonly renderer: THREE.WebGLRenderer;
  private readonly raycaster = new THREE.Raycaster();
  private readonly abort = new AbortController();
  private readonly key: THREE.DirectionalLight;
  private room = new THREE.Group();
  private slots: Slot[] = [];
  private readonly overallBounds = new THREE.Box3();
  private focusSlot: number | null = null;
  private pose: Pose = { theta: 0, phi: 1.32, radius: 25, target: new THREE.Vector3(0, 4, 0) };
  private baseRadius = 25;
  private observer: ResizeObserver | null = null;
  private frameId: number | null = null;
  private gesture: Gesture | null = null;
  private disposed = false;
  private graphicsLost = false;
  private generation = 0;
  private size = { width: 1, height: 1 };
  private readonly options: GardenVisitOptions;

  constructor(canvas: HTMLCanvasElement, options: GardenVisitOptions = {}) {
    this.canvas = canvas; this.options = options;
    canvas.style.touchAction = "none"; canvas.tabIndex = 0;
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false, powerPreference: "high-performance" });
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.04;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.scene.background = new THREE.Color(0xe9e5da);
    this.scene.add(new THREE.HemisphereLight(0xfffaec, 0x657064, 1.95));
    this.key = new THREE.DirectionalLight(0xfff3d8, 3);
    this.key.position.set(-8, 20, 13); this.key.castShadow = true;
    this.key.shadow.mapSize.set(1024, 1024); this.key.shadow.bias = -.0004; this.key.shadow.normalBias = .02;
    this.scene.add(this.key, this.key.target);
    const fill = new THREE.DirectionalLight(0xcddce0, .8);
    fill.position.set(9, 7, -4); this.scene.add(fill);
    const signal = this.abort.signal;
    canvas.addEventListener("pointerdown", this.pointerDown, { signal });
    canvas.addEventListener("pointermove", this.pointerMove, { signal });
    canvas.addEventListener("pointerup", this.pointerUp, { signal });
    canvas.addEventListener("pointercancel", this.cancelGesture, { signal });
    canvas.addEventListener("lostpointercapture", event => {
      if (this.gesture?.pointers.has(event.pointerId)) this.cancelGesture();
    }, { signal });
    canvas.addEventListener("wheel", this.wheel, { signal, passive: false });
    canvas.addEventListener("keydown", this.keyDown, { signal });
    canvas.addEventListener("contextmenu", event => event.preventDefault(), { signal });
    canvas.addEventListener("webglcontextlost", event => {
      event.preventDefault(); this.cancelGesture(); this.graphicsLost = true;
      this.options.onError?.("The Garden view lost graphics. Close it and visit again. Your saved arrangements are unchanged.");
    }, { signal });
    canvas.addEventListener("webglcontextrestored", () => { this.graphicsLost = false; this.requestRender(); }, { signal });
    window.addEventListener("blur", this.cancelGesture, { signal });
    window.addEventListener("pagehide", this.cancelGesture, { signal });
    window.addEventListener("resize", this.resize, { signal });
    document.addEventListener("visibilitychange", () => { if (document.hidden) this.cancelGesture(); }, { signal });
    if (typeof ResizeObserver !== "undefined") {
      this.observer = new ResizeObserver(this.resize); this.observer.observe(canvas);
    }
    this.resize();
  }

  setEntries(entries: GardenVisitEntries) {
    if (this.disposed) return;
    this.cancelGesture();
    // Construct before replacing the previous scene, so one malformed display
    // cannot leave half the old Garden combined with half the new one.
    const next: Slot[] = [];
    try {
      for (let index = 0; index < 3; index++) {
        const entry = entries[index];
        const display = entry ? createKeptGardenDisplay(entry) : null;
        const root = new THREE.Group(); root.name = `garden-slot:${index}`; root.userData.gardenSlot = index;
        if (display) root.add(display.group);
        const bounds = display ? visibleGardenBounds(display.group) : new THREE.Box3(new THREE.Vector3(-2.6, 0, -2.6), new THREE.Vector3(2.6, .7, 2.6));
        const frame = new THREE.Mesh(new THREE.PlaneGeometry(PRINT_WIDTH, PRINT_HEIGHT), new THREE.MeshBasicMaterial({ color: 0xe7e1d4, toneMapped: false }));
        next.push({ entry, display, root, bounds, frame });
      }
    } catch (error) { next.forEach(slot => this.disposeSlot(slot)); throw error; }
    this.generation++;
    this.slots.forEach(slot => this.disposeSlot(slot)); this.slots = next;
    this.scene.remove(this.room); disposePhotoPerch(this.room);
    const layout = gardenVisitLayout(next.map(slot => slot.bounds));
    this.room = this.buildRoom(layout); this.scene.add(this.room);
    this.overallBounds.makeEmpty();
    for (let index = 0; index < 3; index++) {
      const slot = next[index];
      slot.root.position.set(layout.centers[index], GARDEN_ARRANGEMENT_Y, 0);
      this.scene.add(slot.root);
      const frameBottom = Math.max(3.8, slot.bounds.max.y + .55);
      const frameCenter = frameBottom + PRINT_HEIGHT / 2;
      // Uniform physical mounts; saved image pixels keep their original aspect.
      const mount = new THREE.Mesh(new THREE.BoxGeometry(PRINT_WIDTH + .38, PRINT_HEIGHT + .38, .12), new THREE.MeshStandardMaterial({ color: 0xf1ebdf, roughness: .92 }));
      mount.name = `garden-mount:${index}`; mount.position.set(0, frameCenter, layout.back + .2); mount.castShadow = true;
      slot.root.add(mount);
      const trim = new THREE.Mesh(new THREE.BoxGeometry(PRINT_WIDTH + .56, PRINT_HEIGHT + .56, .1), new THREE.MeshStandardMaterial({ color: 0x605345, roughness: .8 }));
      trim.position.set(0, frameCenter, layout.back + .11); trim.castShadow = true; slot.root.add(trim);
      slot.frame.position.set(0, frameCenter, layout.back + .267); slot.frame.name = `garden-print:${index}`;
      slot.root.add(slot.frame);
      if (!slot.entry?.thumbnail) {
        // Blank mount stays an honest absence, not a freshly generated picture.
        const line = new THREE.Mesh(new THREE.BoxGeometry(1.25, .018, .008), new THREE.MeshBasicMaterial({ color: 0xc5beae }));
        line.position.set(0, frameCenter, layout.back + .275); slot.root.add(line);
      }
      const bounds = visibleGardenBounds(slot.root);
      this.overallBounds.union(bounds);
      if (slot.entry?.thumbnail) this.loadPrint(slot, this.generation);
    }
    const shadowSpan = Math.max(layout.span / 2 + 3, layout.depth + 2, layout.top + 3);
    Object.assign(this.key.shadow.camera, { left: -shadowSpan, right: shadowSpan, top: shadowSpan, bottom: -shadowSpan, near: .1, far: shadowSpan * 6 });
    this.key.position.set(-layout.span * .35, layout.top + 16, layout.depth * .7 + 10);
    this.key.target.position.set(0, layout.top * .35, 0); this.key.shadow.camera.updateProjectionMatrix();
    this.focus(this.focusSlot);
  }

  private buildRoom(layout: GardenVisitLayout) {
    const room = new THREE.Group(); room.name = "garden-alcove";
    const wood = createPerchSurface("wood"), plaster = createPerchSurface("plaster"), stone = createPerchSurface("stone");
    const box = (name: string, w: number, h: number, d: number, x: number, y: number, z: number, material: THREE.Material) => {
      const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material);
      mesh.name = name; mesh.position.set(x, y, z); mesh.castShadow = true; mesh.receiveShadow = true; room.add(mesh); return mesh;
    };
    const floorY = -1.25, wallTop = layout.top + PRINT_HEIGHT + 2.2;
    box("garden-floor", layout.span + 12, .2, layout.depth + 15, 0, floorY - .1, 1, stone);
    box("garden-plaster-wall", layout.span + 8, wallTop - floorY, .3, 0, (wallTop + floorY) / 2, layout.back - .05, plaster);
    // Shallow returns make a sheltered place without closing off the front.
    for (const sign of [-1, 1]) box("garden-wall-return", .28, wallTop - floorY, 2.3, sign * (layout.span / 2 + 4), (wallTop + floorY) / 2, layout.back + 1, plaster);
    const front = layout.back + layout.depth;
    for (let plank = 0; plank < 3; plank++) {
      const depth = layout.depth / 3;
      box("garden-timber-top", layout.span + .8, .24, depth - .025, 0, BENCH_TOP - .12, layout.back + depth * (plank + .5), wood);
    }
    for (let index = 0; index < 3; index++) {
      const center = layout.centers[index];
      for (const z of [layout.back + .6, front - .6]) box("garden-bench-leg", .34, BENCH_TOP - floorY - .24, .34,
        center, (BENCH_TOP + floorY - .24) / 2, z, wood);
      box("garden-bench-stretcher", .22, .20, layout.depth - .6, center, floorY + .47, (layout.back + front) / 2, wood);
    }
    // A quiet stone threshold gives the collection a visible edge, not props
    // competing with the user's plant silhouettes.
    box("garden-threshold", layout.span + 5, .12, .45, 0, floorY + .06, front + 2, stone);
    return room;
  }

  private loadPrint(slot: Slot, generation: number) {
    const source = slot.entry?.thumbnail;
    if (!source || !/^data:image\/jpeg;base64,[A-Za-z0-9+/=]+$/.test(source)) return;
    const image = new Image(); slot.image = image;
    image.onload = () => {
      if (this.disposed || generation !== this.generation || slot.image !== image) return;
      const size = gardenPrintSize(image.naturalWidth, image.naturalHeight);
      slot.frame.scale.set(size.width / PRINT_WIDTH, size.height / PRINT_HEIGHT, 1);
      const texture = new THREE.Texture(image); texture.colorSpace = THREE.SRGBColorSpace;
      texture.needsUpdate = true; slot.texture = texture;
      const material = slot.frame.material as THREE.MeshBasicMaterial;
      material.map = texture; material.color.setHex(0xffffff); material.needsUpdate = true;
      image.onload = image.onerror = null; this.requestRender();
    };
    image.onerror = () => {
      if (!this.disposed && generation === this.generation) this.options.onWarning?.("One saved photograph could not be shown. Its arrangement is still here.");
      image.onload = image.onerror = null;
    };
    image.src = source;
  }

  focus(slot: number | null) {
    if (this.disposed) return;
    this.cancelGesture();
    this.focusSlot = slot !== null && Number.isInteger(slot) && slot >= 0 && slot < 3 ? slot : null;
    this.fitView();
  }
  resetView() { this.cancelGesture(); this.fitView(); }
  /** Pause camera input before a picker or saved-print overlay opens. */
  interrupt() { this.cancelGesture(); }
  zoomBy(factor: number) {
    if (!Number.isFinite(factor) || factor <= 0 || this.disposed) return;
    this.cancelGesture(); this.pose.radius = THREE.MathUtils.clamp(this.pose.radius * factor, this.baseRadius * .55, this.baseRadius * 1.6); this.applyPose();
  }
  /** Radians, deliberately bounded so the wall never traps the camera. */
  orbitBy(horizontal: number, vertical = 0) {
    if (![horizontal, vertical].every(Number.isFinite) || this.disposed) return;
    this.cancelGesture(); this.pose.theta = THREE.MathUtils.clamp(this.pose.theta + horizontal, -.62, .62);
    this.pose.phi = THREE.MathUtils.clamp(this.pose.phi + vertical, .95, 1.47); this.applyPose();
  }
  private fitView() {
    const bounds = this.focusSlot === null ? this.overallBounds.clone()
      : this.slots[this.focusSlot] ? visibleGardenBounds(this.slots[this.focusSlot].root) : this.overallBounds.clone();
    if (bounds.isEmpty()) bounds.set(new THREE.Vector3(-10, 0, -3), new THREE.Vector3(10, 10, 3));
    const size = bounds.getSize(new THREE.Vector3()), target = bounds.getCenter(new THREE.Vector3());
    const halfFov = THREE.MathUtils.degToRad(this.camera.fov) / 2;
    const verticalRadius = size.y / 2 / Math.tan(halfFov);
    const horizontalRadius = size.x / 2 / (Math.tan(halfFov) * this.camera.aspect);
    this.baseRadius = Math.max(verticalRadius, horizontalRadius) * 1.18 + size.z * .6;
    this.pose = { theta: 0, phi: 1.36, radius: this.baseRadius, target };
    this.applyPose();
  }
  private applyPose() {
    const offset = new THREE.Vector3().setFromSpherical(new THREE.Spherical(this.pose.radius, this.pose.phi, this.pose.theta));
    this.camera.position.copy(this.pose.target).add(offset); this.camera.up.copy(UP); this.camera.lookAt(this.pose.target);
    this.camera.near = .1; this.camera.far = Math.max(200, this.pose.radius * 4); this.camera.updateProjectionMatrix(); this.camera.updateMatrixWorld(true);
    this.requestRender();
  }
  private requestRender() {
    if (this.disposed || this.graphicsLost || this.frameId !== null) return;
    this.frameId = requestAnimationFrame(() => { this.frameId = null; this.renderNow(); });
  }
  renderNow() {
    if (!this.disposed && !this.graphicsLost) this.renderer.render(this.scene, this.camera);
    this.canvas.dataset.gardenVisitStats = JSON.stringify(this.snapshotStats());
  }
  private resize = () => {
    if (this.disposed) return;
    const rect = this.canvas.getBoundingClientRect();
    const width = Math.max(1, Math.round(rect.width)), height = Math.max(1, Math.round(rect.height));
    if (width === this.size.width && height === this.size.height) return;
    this.cancelGesture(); this.size = { width, height };
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
    this.renderer.setSize(width, height, false); this.camera.aspect = width / height; this.camera.updateProjectionMatrix(); this.fitView();
  };
  private clonePose(): Pose { return { ...this.pose, target: this.pose.target.clone() }; }
  private pointerDown = (event: PointerEvent) => {
    if (this.disposed || this.graphicsLost || (event.pointerType === "mouse" && event.button !== 0)) return;
    event.preventDefault();
    const point = new THREE.Vector2(event.clientX, event.clientY);
    if (!this.gesture) this.gesture = { pointers: new Map(), first: point.clone(), moved: false, pinchDistance: null, pose: this.clonePose() };
    if (this.gesture.pointers.size >= 2) return;
    this.gesture.pointers.set(event.pointerId, point);
    if (this.gesture.pointers.size === 2) {
      const [a, b] = [...this.gesture.pointers.values()]; this.gesture.pinchDistance = a.distanceTo(b); this.gesture.moved = true;
    }
    try { this.canvas.setPointerCapture(event.pointerId); } catch { this.cancelGesture(); }
  };
  private pointerMove = (event: PointerEvent) => {
    const gesture = this.gesture, previous = gesture?.pointers.get(event.pointerId);
    if (!gesture || !previous) return;
    event.preventDefault(); const next = new THREE.Vector2(event.clientX, event.clientY);
    const delta = next.clone().sub(previous); gesture.pointers.set(event.pointerId, next);
    if (gesture.pointers.size === 2) {
      const [a, b] = [...gesture.pointers.values()], distance = a.distanceTo(b);
      if (gesture.pinchDistance && distance > 2) this.pose.radius = THREE.MathUtils.clamp(this.pose.radius * gesture.pinchDistance / distance, this.baseRadius * .55, this.baseRadius * 1.6);
      gesture.pinchDistance = distance;
    } else {
      if (next.distanceTo(gesture.first) > 5) gesture.moved = true;
      if (gesture.moved) {
        this.pose.theta = THREE.MathUtils.clamp(this.pose.theta - delta.x * .0035, -.62, .62);
        this.pose.phi = THREE.MathUtils.clamp(this.pose.phi - delta.y * .0028, .95, 1.47);
      }
    }
    this.applyPose();
  };
  private pointerUp = (event: PointerEvent) => {
    const gesture = this.gesture;
    if (!gesture?.pointers.has(event.pointerId)) return;
    const rect = this.canvas.getBoundingClientRect();
    if (Math.round(rect.width) !== this.size.width || Math.round(rect.height) !== this.size.height) { this.cancelGesture(); this.resize(); return; }
    const select = !gesture.moved && gesture.pointers.size === 1
      && gesture.first.distanceTo(new THREE.Vector2(event.clientX, event.clientY)) <= 5;
    gesture.pointers.delete(event.pointerId); gesture.pinchDistance = null;
    if (!gesture.pointers.size) this.gesture = null;
    else gesture.moved = true;
    try { if (this.canvas.hasPointerCapture(event.pointerId)) this.canvas.releasePointerCapture(event.pointerId); } catch { /* no held capture */ }
    if (select && event.clientX >= rect.left && event.clientX <= rect.right && event.clientY >= rect.top && event.clientY <= rect.bottom) this.pick(event.clientX, event.clientY);
  };
  private cancelGesture = () => {
    const gesture = this.gesture; if (!gesture) return;
    this.gesture = null; this.pose = gesture.pose; this.applyPose();
    for (const id of gesture.pointers.keys()) try { if (this.canvas.hasPointerCapture(id)) this.canvas.releasePointerCapture(id); } catch { /* already released */ }
  };
  private keyDown = (event: KeyboardEvent) => {
    if (event.altKey || event.ctrlKey || event.metaKey) return;
    if (event.key === "Escape") {
      if (this.gesture) { event.preventDefault(); event.stopPropagation(); this.cancelGesture(); }
      return;
    }
    const actions: Record<string, () => void> = {
      ArrowLeft: () => this.orbitBy(-.08), ArrowRight: () => this.orbitBy(.08),
      ArrowUp: () => this.orbitBy(0, -.06), ArrowDown: () => this.orbitBy(0, .06),
      "+": () => this.zoomBy(.9), "=": () => this.zoomBy(.9), "-": () => this.zoomBy(1.1),
      Home: () => this.resetView(),
    };
    const action = actions[event.key];
    if (action) { event.preventDefault(); event.stopPropagation(); action(); }
  };
  private wheel = (event: WheelEvent) => { event.preventDefault(); this.zoomBy(Math.exp(THREE.MathUtils.clamp(event.deltaY, -120, 120) * .002)); };
  private pick(clientX: number, clientY: number) {
    const rect = this.canvas.getBoundingClientRect();
    this.raycaster.setFromCamera(new THREE.Vector2((clientX - rect.left) / rect.width * 2 - 1, -(clientY - rect.top) / rect.height * 2 + 1), this.camera);
    const visible: THREE.Object3D[] = [];
    for (const slot of this.slots) slot.root.traverseVisible(object => {
      if (!(object instanceof THREE.Mesh)) return;
      const materials = Array.isArray(object.material) ? object.material : [object.material];
      if (materials.some(material => material.visible && material.colorWrite && material.opacity > 0)) visible.push(object);
    });
    const hit = this.raycaster.intersectObjects(visible, false)[0];
    let object: THREE.Object3D | null = hit?.object ?? null;
    while (object && !Number.isInteger(object.userData.gardenSlot)) object = object.parent;
    if (object) this.options.onSelect?.(object.userData.gardenSlot);
  }
  private disposeSlot(slot: Slot) {
    if (slot.image) { slot.image.onload = slot.image.onerror = null; slot.image.src = ""; slot.image = undefined; }
    slot.texture?.dispose(); slot.texture = undefined;
    slot.display?.dispose(); slot.root.removeFromParent();
    // Arrangement materials/maps are released only by their builder. The mount
    // meshes and print material belong to this slot and contain no other maps.
    slot.root.traverse(object => {
      if (!(object instanceof THREE.Mesh)) return;
      object.geometry.dispose();
      for (const material of Array.isArray(object.material) ? object.material : [object.material]) material.dispose();
    });
    slot.root.clear();
  }
  private snapshotStats() {
    const info = this.renderer.info;
    const slots = this.slots.map(slot => {
      let plantGroups = 0, vesselMeshes = 0;
      slot.root.traverseVisible(object => {
        if (object.name.startsWith("plant:")) plantGroups++;
        if (object.name.startsWith("vessel:")) vesselMeshes++;
      });
      return { entryId: slot.entry?.id ?? null, plantGroups, vesselMeshes, printLoaded: Boolean(slot.texture) };
    });
    return { slots, focusSlot: this.focusSlot, disposed: this.disposed, graphicsLost: this.graphicsLost,
      rendererContexts: this.disposed ? 0 : 1, calls: info.render.calls, triangles: info.render.triangles,
      geometries: info.memory.geometries, textures: info.memory.textures,
      pixelRatio: this.renderer.getPixelRatio(), pendingFrame: this.frameId !== null,
      camera: { position: this.camera.position.toArray(), target: this.pose.target.toArray() },
      note: "Resource counts only; not physical-phone frame time." };
  }
  getStats() { this.renderNow(); return this.snapshotStats(); }
  destroy() {
    if (this.disposed) return;
    this.cancelGesture(); this.disposed = true; this.generation++;
    this.abort.abort(); this.observer?.disconnect(); this.observer = null;
    if (this.frameId !== null) cancelAnimationFrame(this.frameId); this.frameId = null;
    this.slots.forEach(slot => this.disposeSlot(slot)); this.slots = [];
    disposePhotoPerch(this.room); this.key.shadow.map?.dispose(); this.key.shadow.mapPass?.dispose();
    this.scene.clear(); this.renderer.dispose();
    this.canvas.dataset.gardenVisitStats = JSON.stringify(this.snapshotStats());
  }
}
