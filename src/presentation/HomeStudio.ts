import * as THREE from "three";
import { createKeptGardenDisplay, visibleGardenBounds, type GardenVisitEntry } from "./GardenVisitStudio.ts";
import { HOME_PLACES, HOME_ROOM as R, homePlace, type HomePlaceId } from "./homePlaces.ts";
import { buildHomeRoom, type HomeRoomParts } from "./homeRoom.ts";
import { mergeStaticMeshes, type StaticMerge } from "./staticMerge.ts";

// Vessel geometry begins .04 above its botanical datum (see GardenVisitStudio).
const DATUM_OFFSET = .04;
const UP = new THREE.Vector3(0, 1, 0);

export type HomeEntries = Readonly<Partial<Record<HomePlaceId, GardenVisitEntry | null>>>;
export type HomeMarker = "fits" | "blocked" | null;
export interface HomeStudioOptions {
  onSelect?: (place: HomePlaceId) => void;
  onError?: (message: string) => void;
  onWarning?: (message: string) => void;
  reducedMotion?: boolean;
}

type Pose = { theta: number; phi: number; radius: number; target: THREE.Vector3 };
type Gesture = { pointers: Map<number, THREE.Vector2>; first: THREE.Vector2; moved: boolean; pinchDistance: number | null; pose: Pose };
type Piece = { entryId: string; display: ReturnType<typeof createKeptGardenDisplay>; merge: StaticMerge; root: THREE.Group };

/** How the camera frames each place: a facing angle and a framing box size. */
const VIEWS: Record<HomePlaceId, { theta: number; phi: number; frame: [number, number] }> = {
  tokonoma: { theta: .12, phi: 1.45, frame: [16, 20] },
  scroll: { theta: .05, phi: 1.5, frame: [10, 13] },
  table: { theta: .25, phi: 1.12, frame: [14, 10] },
  shoin: { theta: 1.05, phi: 1.36, frame: [14, 15] },
  "shelf-low": { theta: -.12, phi: 1.42, frame: [12, 11] },
  "shelf-high": { theta: -.2, phi: 1.47, frame: [12, 10] },
};

/** Points the whole-room view must include: each arrangement place's surface
 * and a typical piece above it, and the scroll. */
const OVERVIEW_POINTS: readonly THREE.Vector3[] = HOME_PLACES.flatMap(place => place.kind === "photograph"
  ? [new THREE.Vector3(place.x, R.alcoveCeiling - .6, place.z), new THREE.Vector3(place.x, 8.2, place.z)]
  : [new THREE.Vector3(place.x - 2.6, place.y, place.z), new THREE.Vector3(place.x + 2.6, place.y, place.z), new THREE.Vector3(place.x, place.y + 5.5, place.z)]);
const OVERVIEW_NARROW = { theta: .24, phi: 1.0, target: new THREE.Vector3(-3, 6.5, -5) };

/** A quiet washitsu holding kept arrangements in named places. One WebGL
 * context, rendering on demand; nothing animates while the visitor is idle. */
export class HomeStudio {
  readonly canvas: HTMLCanvasElement;
  private readonly scene = new THREE.Scene();
  private readonly camera = new THREE.PerspectiveCamera(40, 1, .1, 500);
  private readonly renderer: THREE.WebGLRenderer;
  private readonly raycaster = new THREE.Raycaster();
  private readonly abort = new AbortController();
  private readonly room: HomeRoomParts;
  private readonly roomMerge: StaticMerge;
  private readonly roofMerge: StaticMerge;
  private readonly pieces = new Map<HomePlaceId, Piece>();
  private readonly pickers = new Map<HomePlaceId, THREE.Mesh>();
  private readonly markers = new Map<HomePlaceId, THREE.Mesh>();
  private readonly markerMaterials: Record<"fits" | "blocked", THREE.MeshBasicMaterial>;
  private photoEntryId: string | null = null;
  private photoImage: HTMLImageElement | null = null;
  private photoTexture: THREE.Texture | null = null;
  private focusPlace: HomePlaceId | null = null;
  private pose: Pose = { theta: 0, phi: 1.42, radius: 60, target: new THREE.Vector3(0, 11, -6) };
  private baseRadius = 60;
  private baseTheta = 0;
  private tween: { from: Pose; to: Pose; start: number; duration: number } | null = null;
  private observer: ResizeObserver | null = null;
  private frameId: number | null = null;
  private gesture: Gesture | null = null;
  private disposed = false;
  private graphicsLost = false;
  private generation = 0;
  private size = { width: 1, height: 1 };
  private readonly options: HomeStudioOptions;

  constructor(canvas: HTMLCanvasElement, options: HomeStudioOptions = {}) {
    this.canvas = canvas; this.options = options;
    canvas.style.touchAction = "none"; canvas.tabIndex = 0;
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false, powerPreference: "high-performance" });
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.0;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.scene.background = new THREE.Color(0xd9d2c2);
    this.scene.fog = new THREE.Fog(0xd9d2c2, 160, 320);
    this.buildLights();
    this.room = buildHomeRoom();
    this.scene.add(this.room.group);
    this.roomMerge = mergeStaticMeshes(this.room.group, new Set([this.room.scroll.group, this.room.roof]));
    this.roofMerge = mergeStaticMeshes(this.room.roof);
    this.markerMaterials = {
      fits: new THREE.MeshBasicMaterial({ color: 0x6d8f5c, transparent: true, opacity: .85, depthWrite: false, name: "home-marker-fits" }),
      blocked: new THREE.MeshBasicMaterial({ color: 0xa99c86, transparent: true, opacity: .55, depthWrite: false, name: "home-marker-blocked" }),
    };
    for (const place of HOME_PLACES) {
      const picker = place.kind === "photograph"
        ? new THREE.Mesh(new THREE.BoxGeometry(this.room.scroll.mountWidth, R.alcoveCeiling - 7, .6), new THREE.MeshBasicMaterial({ visible: false }))
        : new THREE.Mesh(new THREE.BoxGeometry(Math.min(place.surfaceHalfX * 2, 9), Math.min(place.clearance, 9), Math.min(place.surfaceHalfZ * 2, 8)), new THREE.MeshBasicMaterial({ visible: false }));
      picker.name = `home-pick:${place.id}`; picker.userData.homePlace = place.id;
      if (place.kind === "photograph") picker.position.set(place.x, (R.alcoveCeiling + 7) / 2, place.z + .3);
      else picker.position.set(place.x, place.y + Math.min(place.clearance, 9) / 2, place.z);
      this.scene.add(picker); this.pickers.set(place.id, picker);
      if (place.kind === "arrangement") {
        const ring = new THREE.Mesh(new THREE.RingGeometry(2.9, 3.25, 64), this.markerMaterials.fits);
        ring.name = `home-marker:${place.id}`; ring.rotation.x = -Math.PI / 2; ring.position.set(place.x, place.y + .03, place.z);
        ring.visible = false; ring.renderOrder = 2; this.scene.add(ring); this.markers.set(place.id, ring);
      }
    }
    const signal = this.abort.signal;
    canvas.addEventListener("pointerdown", this.pointerDown, { signal });
    canvas.addEventListener("pointermove", this.pointerMove, { signal });
    canvas.addEventListener("pointerup", this.pointerUp, { signal });
    canvas.addEventListener("pointercancel", this.cancelGesture, { signal });
    canvas.addEventListener("lostpointercapture", event => { if (this.gesture?.pointers.has(event.pointerId)) this.cancelGesture(); }, { signal });
    canvas.addEventListener("wheel", this.wheel, { signal, passive: false });
    canvas.addEventListener("keydown", this.keyDown, { signal });
    canvas.addEventListener("contextmenu", event => event.preventDefault(), { signal });
    canvas.addEventListener("webglcontextlost", event => {
      event.preventDefault(); this.cancelGesture(); this.graphicsLost = true;
      this.options.onError?.("Your home lost graphics. Close it and come back. Your saved arrangements are unchanged.");
    }, { signal });
    canvas.addEventListener("webglcontextrestored", () => { this.graphicsLost = false; this.requestRender(); }, { signal });
    window.addEventListener("blur", this.cancelGesture, { signal });
    window.addEventListener("pagehide", this.cancelGesture, { signal });
    window.addEventListener("resize", this.resize, { signal });
    document.addEventListener("visibilitychange", () => { if (document.hidden) this.cancelGesture(); }, { signal });
    if (typeof ResizeObserver !== "undefined") { this.observer = new ResizeObserver(this.resize); this.observer.observe(canvas); }
    this.resize();
  }

  private buildLights() {
    this.scene.add(new THREE.HemisphereLight(0xfff4e2, 0x6a5b45, 1.55));
    // Afternoon light through the shoji on the left, low and warm.
    const sun = new THREE.DirectionalLight(0xffecd0, 2.5);
    sun.position.set(-60, 34, 6); sun.target.position.set(-2, 4, -6);
    sun.castShadow = true; sun.shadow.mapSize.set(2048, 2048); sun.shadow.bias = -.0005; sun.shadow.normalBias = .03;
    Object.assign(sun.shadow.camera, { left: -40, right: 40, top: 34, bottom: -34, near: 1, far: 160 });
    sun.shadow.camera.updateProjectionMatrix();
    // Soft fill from the open front, cool, without shadows.
    const fill = new THREE.DirectionalLight(0xdfe7ea, .85);
    fill.position.set(10, 22, 60); fill.target.position.set(0, 8, -10);
    // A gentle lift inside the alcove so the tokonoma piece reads.
    const alcove = new THREE.PointLight(0xfff1dc, 70, 26, 1.6);
    alcove.position.set(-10, R.lintel - 1.5, R.back - 1);
    this.scene.add(sun, sun.target, fill, fill.target, alcove);
  }

  /** Builds every displayed piece before replacing the previous ones. */
  setEntries(entries: HomeEntries) {
    if (this.disposed) return;
    this.cancelGesture();
    const next = new Map<HomePlaceId, Piece>();
    try {
      for (const place of HOME_PLACES) {
        if (place.kind !== "arrangement") continue;
        const entry = entries[place.id];
        if (!entry) continue;
        const existing = this.pieces.get(place.id);
        if (existing && existing.entryId === entry.id) { next.set(place.id, existing); continue; }
        const display = createKeptGardenDisplay(entry);
        const root = new THREE.Group(); root.name = `home-piece:${place.id}`; root.userData.homePlace = place.id;
        root.position.set(place.x, place.y - DATUM_OFFSET, place.z);
        root.add(display.group);
        display.group.traverse(object => { if (object instanceof THREE.Mesh) { object.castShadow = true; object.receiveShadow = true; } });
        const merge = mergeStaticMeshes(display.group);
        next.set(place.id, { entryId: entry.id, display, merge, root });
      }
    } catch (error) {
      for (const [id, piece] of next) if (this.pieces.get(id) !== piece) this.disposePiece(piece);
      throw error;
    }
    for (const [id, piece] of this.pieces) if (next.get(id) !== piece) this.disposePiece(piece);
    this.pieces.clear();
    for (const [id, piece] of next) { this.pieces.set(id, piece); if (!piece.root.parent) this.scene.add(piece.root); }
    this.setScrollPhoto(entries.scroll ?? null);
    if (this.focusPlace) this.focus(this.focusPlace, false); else this.requestRender();
  }

  private setScrollPhoto(entry: GardenVisitEntry | null) {
    const source = entry?.thumbnail ?? null;
    if ((entry?.id ?? null) === this.photoEntryId && (this.photoTexture || this.photoImage)) return;
    this.photoEntryId = entry?.id ?? null;
    this.generation++;
    if (this.photoImage) { this.photoImage.onload = this.photoImage.onerror = null; this.photoImage = null; }
    const photo = this.room.scroll.photo, material = photo.material as THREE.MeshBasicMaterial;
    material.map = null; material.color.setHex(0xf2ecdf); material.needsUpdate = true;
    photo.scale.set(this.room.scroll.maxPhoto.width, this.room.scroll.maxPhoto.height, 1);
    this.photoTexture?.dispose(); this.photoTexture = null;
    this.requestRender();
    if (!source || !/^data:image\/jpeg;base64,[A-Za-z0-9+/=]+$/.test(source)) return;
    const image = new Image(), generation = this.generation; this.photoImage = image;
    image.onload = () => {
      if (this.disposed || generation !== this.generation) return;
      const { width, height } = this.room.scroll.maxPhoto;
      const ratio = image.naturalWidth > 0 && image.naturalHeight > 0 ? image.naturalWidth / image.naturalHeight : 4 / 3;
      // Letterbox inside the mount: never crop, stretch or regrade the kept image.
      const size = ratio >= width / height ? { w: width, h: width / ratio } : { w: height * ratio, h: height };
      photo.scale.set(size.w, size.h, 1);
      const texture = new THREE.Texture(image); texture.colorSpace = THREE.SRGBColorSpace; texture.needsUpdate = true;
      this.photoTexture = texture; material.map = texture; material.color.setHex(0xffffff); material.needsUpdate = true;
      image.onload = image.onerror = null; this.photoImage = null; this.requestRender();
    };
    image.onerror = () => {
      if (!this.disposed && generation === this.generation) this.options.onWarning?.("The scroll's photograph could not be shown. Its arrangement is still kept.");
      image.onload = image.onerror = null; this.photoImage = null;
    };
    image.src = source;
  }

  /** Placing mode: show which surfaces can take the piece being placed. */
  setMarkers(markers: Partial<Record<HomePlaceId, HomeMarker>> | null) {
    for (const [id, ring] of this.markers) {
      const state = markers?.[id] ?? null;
      ring.visible = state !== null;
      if (state) ring.material = this.markerMaterials[state];
    }
    this.requestRender();
  }

  focus(place: HomePlaceId | null, animate = true) {
    if (this.disposed) return;
    this.cancelGesture();
    this.focusPlace = place && homePlace(place) ? place : null;
    const goal = this.framePose(this.focusPlace);
    this.baseRadius = goal.radius; this.baseTheta = goal.theta;
    if (!animate || this.options.reducedMotion || this.size.width <= 1) { this.tween = null; this.pose = goal; this.applyPose(); return; }
    this.tween = { from: this.clonePose(), to: goal, start: performance.now(), duration: 650 };
    this.requestRender();
  }
  resetView() { this.focus(this.focusPlace, true); }
  interrupt() { this.cancelGesture(); }

  private framePose(place: HomePlaceId | null): Pose {
    const halfFov = THREE.MathUtils.degToRad(this.camera.fov) / 2, aspect = Math.max(.3, this.camera.aspect);
    const fit = (width: number, height: number) => Math.max(height / 2 / Math.tan(halfFov), width / 2 / (Math.tan(halfFov) * aspect));
    if (!place) {
      // Wide screens stand at the open front and look in. Narrow ones look
      // down from above with the roof lifted, like opening a dollhouse, so
      // every place fits a phone. Either way, step back until all are framed.
      const wide = aspect >= 1.3;
      const base: Pose = wide
        ? { theta: .1, phi: 1.31, radius: 43, target: new THREE.Vector3(-1.5, 10.5, -6) }
        : { theta: OVERVIEW_NARROW.theta, phi: OVERVIEW_NARROW.phi, radius: 30, target: OVERVIEW_NARROW.target.clone() };
      return { ...base, radius: this.radiusToShow(OVERVIEW_POINTS, base) };
    }
    const info = homePlace(place)!, view = VIEWS[place];
    const piece = this.pieces.get(place);
    let target: THREE.Vector3, [width, height] = view.frame;
    if (piece) {
      const bounds = visibleGardenBounds(piece.root);
      // The tokonoma is read with its scroll: frame both together.
      if (place === "tokonoma") bounds.union(new THREE.Box3().setFromObject(this.room.scroll.group));
      const size = bounds.getSize(new THREE.Vector3());
      target = bounds.getCenter(new THREE.Vector3());
      width = Math.max(width * .7, size.x + 3, size.z + 3); height = Math.max(height * .7, size.y + 3);
    } else if (info.kind === "photograph") target = new THREE.Vector3(info.x, info.y, info.z);
    else { target = new THREE.Vector3(info.x, info.y + Math.min(info.clearance, 7) * .38, info.z); height *= .8; }
    return { theta: view.theta, phi: view.phi, radius: fit(width, height) * 1.1, target };
  }

  /** Smallest distance, from `start.radius` outward, that keeps every point inside the frame. */
  private radiusToShow(points: readonly THREE.Vector3[], start: Pose, margin = .9): number {
    const probe = this.camera.clone();
    const inFrame = (radius: number) => {
      const offset = new THREE.Vector3().setFromSpherical(new THREE.Spherical(radius, start.phi, start.theta));
      probe.position.copy(start.target).add(offset); probe.up.copy(UP); probe.lookAt(start.target);
      probe.updateMatrixWorld(true); probe.updateProjectionMatrix();
      return points.every(point => {
        const ndc = point.clone().project(probe);
        return ndc.z < 1 && Math.abs(ndc.x) <= margin && Math.abs(ndc.y) <= margin;
      });
    };
    let radius = start.radius;
    while (!inFrame(radius) && radius < 200) radius *= 1.04;
    return radius;
  }

  zoomBy(factor: number) {
    if (!Number.isFinite(factor) || factor <= 0 || this.disposed) return;
    this.cancelGesture(); this.tween = null;
    this.pose.radius = THREE.MathUtils.clamp(this.pose.radius * factor, this.baseRadius * .5, this.baseRadius * 1.5); this.applyPose();
  }
  orbitBy(horizontal: number, vertical = 0) {
    if (![horizontal, vertical].every(Number.isFinite) || this.disposed) return;
    this.cancelGesture(); this.tween = null;
    this.pose.theta = THREE.MathUtils.clamp(this.pose.theta + horizontal, this.baseTheta - .6, this.baseTheta + .6);
    this.pose.phi = THREE.MathUtils.clamp(this.pose.phi + vertical, .8, 1.55); this.applyPose();
  }

  /** Lift the roof off while the camera looks down from above it. */
  private syncRoof() { this.room.roof.visible = this.camera.position.y < R.ceiling - .5; }
  private applyPose() {
    const offset = new THREE.Vector3().setFromSpherical(new THREE.Spherical(this.pose.radius, this.pose.phi, this.pose.theta));
    this.camera.position.copy(this.pose.target).add(offset); this.camera.up.copy(UP); this.camera.lookAt(this.pose.target);
    this.syncRoof();
    this.camera.near = .2; this.camera.far = Math.max(300, this.pose.radius * 4); this.camera.updateProjectionMatrix(); this.camera.updateMatrixWorld(true);
    this.requestRender();
  }
  private requestRender() {
    if (this.disposed || this.graphicsLost || this.frameId !== null) return;
    this.frameId = requestAnimationFrame(now => { this.frameId = null; this.step(now); });
  }
  private step(now: number) {
    if (this.tween) {
      const t = Math.min(1, (now - this.tween.start) / this.tween.duration), e = t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
      const { from, to } = this.tween;
      this.pose = { theta: from.theta + (to.theta - from.theta) * e, phi: from.phi + (to.phi - from.phi) * e,
        radius: from.radius + (to.radius - from.radius) * e, target: from.target.clone().lerp(to.target, e) };
      if (t >= 1) this.tween = null;
      const offset = new THREE.Vector3().setFromSpherical(new THREE.Spherical(this.pose.radius, this.pose.phi, this.pose.theta));
      this.camera.position.copy(this.pose.target).add(offset); this.camera.lookAt(this.pose.target); this.camera.updateMatrixWorld(true);
      this.syncRoof();
      if (this.tween) this.requestRender();
    }
    this.renderNow();
  }
  renderNow() {
    if (!this.disposed && !this.graphicsLost) this.renderer.render(this.scene, this.camera);
    this.canvas.dataset.homeStats = JSON.stringify(this.snapshotStats());
  }
  private resize = () => {
    if (this.disposed) return;
    const rect = this.canvas.getBoundingClientRect();
    const width = Math.max(1, Math.round(rect.width)), height = Math.max(1, Math.round(rect.height));
    if (width === this.size.width && height === this.size.height) return;
    this.cancelGesture(); this.size = { width, height };
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
    this.renderer.setSize(width, height, false); this.camera.aspect = width / height; this.camera.updateProjectionMatrix();
    this.focus(this.focusPlace, false);
  };
  private clonePose(): Pose { return { ...this.pose, target: this.pose.target.clone() }; }
  private pointerDown = (event: PointerEvent) => {
    if (this.disposed || this.graphicsLost || (event.pointerType === "mouse" && event.button !== 0)) return;
    event.preventDefault(); this.tween = null;
    const point = new THREE.Vector2(event.clientX, event.clientY);
    if (!this.gesture) this.gesture = { pointers: new Map(), first: point.clone(), moved: false, pinchDistance: null, pose: this.clonePose() };
    if (this.gesture.pointers.size >= 2) return;
    this.gesture.pointers.set(event.pointerId, point);
    if (this.gesture.pointers.size === 2) { const [a, b] = [...this.gesture.pointers.values()]; this.gesture.pinchDistance = a.distanceTo(b); this.gesture.moved = true; }
    try { this.canvas.setPointerCapture(event.pointerId); } catch { this.cancelGesture(); }
  };
  private pointerMove = (event: PointerEvent) => {
    const gesture = this.gesture, previous = gesture?.pointers.get(event.pointerId);
    if (!gesture || !previous) return;
    event.preventDefault(); const next = new THREE.Vector2(event.clientX, event.clientY);
    const delta = next.clone().sub(previous); gesture.pointers.set(event.pointerId, next);
    if (gesture.pointers.size === 2) {
      const [a, b] = [...gesture.pointers.values()], distance = a.distanceTo(b);
      if (gesture.pinchDistance && distance > 2) this.pose.radius = THREE.MathUtils.clamp(this.pose.radius * gesture.pinchDistance / distance, this.baseRadius * .5, this.baseRadius * 1.5);
      gesture.pinchDistance = distance;
    } else {
      if (next.distanceTo(gesture.first) > 5) gesture.moved = true;
      if (gesture.moved) {
        this.pose.theta = THREE.MathUtils.clamp(this.pose.theta - delta.x * .0035, this.baseTheta - .6, this.baseTheta + .6);
        this.pose.phi = THREE.MathUtils.clamp(this.pose.phi - delta.y * .0028, .8, 1.55);
      }
    }
    this.applyPose();
  };
  private pointerUp = (event: PointerEvent) => {
    const gesture = this.gesture;
    if (!gesture?.pointers.has(event.pointerId)) return;
    const rect = this.canvas.getBoundingClientRect();
    if (Math.round(rect.width) !== this.size.width || Math.round(rect.height) !== this.size.height) { this.cancelGesture(); this.resize(); return; }
    const select = !gesture.moved && gesture.pointers.size === 1 && gesture.first.distanceTo(new THREE.Vector2(event.clientX, event.clientY)) <= 5;
    gesture.pointers.delete(event.pointerId); gesture.pinchDistance = null;
    if (!gesture.pointers.size) this.gesture = null; else gesture.moved = true;
    try { if (this.canvas.hasPointerCapture(event.pointerId)) this.canvas.releasePointerCapture(event.pointerId); } catch { /* released */ }
    if (select && event.clientX >= rect.left && event.clientX <= rect.right && event.clientY >= rect.top && event.clientY <= rect.bottom) this.pick(event.clientX, event.clientY);
  };
  private cancelGesture = () => {
    const gesture = this.gesture; if (!gesture) return;
    this.gesture = null; this.pose = gesture.pose; this.applyPose();
    for (const id of gesture.pointers.keys()) try { if (this.canvas.hasPointerCapture(id)) this.canvas.releasePointerCapture(id); } catch { /* released */ }
  };
  private keyDown = (event: KeyboardEvent) => {
    if (event.altKey || event.ctrlKey || event.metaKey) return;
    if (event.key === "Escape") { if (this.gesture) { event.preventDefault(); event.stopPropagation(); this.cancelGesture(); } return; }
    const actions: Record<string, () => void> = {
      ArrowLeft: () => this.orbitBy(-.08), ArrowRight: () => this.orbitBy(.08), ArrowUp: () => this.orbitBy(0, -.05), ArrowDown: () => this.orbitBy(0, .05),
      "+": () => this.zoomBy(.9), "=": () => this.zoomBy(.9), "-": () => this.zoomBy(1.1), Home: () => this.resetView(),
    };
    const action = actions[event.key];
    if (action) { event.preventDefault(); event.stopPropagation(); action(); }
  };
  private wheel = (event: WheelEvent) => { event.preventDefault(); this.zoomBy(Math.exp(THREE.MathUtils.clamp(event.deltaY, -120, 120) * .002)); };

  /** Pieces win over the empty-place volumes behind them. */
  private pick(clientX: number, clientY: number) {
    const rect = this.canvas.getBoundingClientRect();
    this.raycaster.setFromCamera(new THREE.Vector2((clientX - rect.left) / rect.width * 2 - 1, -(clientY - rect.top) / rect.height * 2 + 1), this.camera);
    const targets: THREE.Object3D[] = [...this.pickers.values()];
    for (const piece of this.pieces.values()) piece.merge.group.traverse(object => { if (object instanceof THREE.Mesh) targets.push(object); });
    const hit = this.raycaster.intersectObjects(targets, false)[0];
    let object: THREE.Object3D | null = hit?.object ?? null;
    while (object && typeof object.userData.homePlace !== "string") object = object.parent;
    if (object) this.options.onSelect?.(object.userData.homePlace as HomePlaceId);
  }

  private disposePiece(piece: Piece) {
    piece.merge.dispose(); piece.display.dispose(); piece.root.removeFromParent(); piece.root.clear();
  }
  private snapshotStats() {
    const info = this.renderer.info;
    return {
      places: Object.fromEntries([...this.pieces].map(([id, piece]) => [id, piece.entryId])),
      scroll: this.photoEntryId, scrollLoaded: Boolean(this.photoTexture), focus: this.focusPlace,
      roomBatches: this.roomMerge.batches, roomMerged: this.roomMerge.merged,
      pieceBatches: Object.fromEntries([...this.pieces].map(([id, piece]) => [id, { merged: piece.merge.merged, batches: piece.merge.batches }])),
      calls: info.render.calls, triangles: info.render.triangles, geometries: info.memory.geometries, textures: info.memory.textures,
      disposed: this.disposed, graphicsLost: this.graphicsLost, pixelRatio: this.renderer.getPixelRatio(),
      camera: { position: this.camera.position.toArray(), target: this.pose.target.toArray() },
      note: "Resource counts only; not physical-phone frame time.",
    };
  }
  getStats() { this.renderNow(); return this.snapshotStats(); }
  destroy() {
    if (this.disposed) return;
    this.cancelGesture(); this.disposed = true; this.generation++;
    this.abort.abort(); this.observer?.disconnect(); this.observer = null;
    if (this.frameId !== null) cancelAnimationFrame(this.frameId); this.frameId = null;
    if (this.photoImage) { this.photoImage.onload = this.photoImage.onerror = null; this.photoImage.src = ""; this.photoImage = null; }
    this.photoTexture?.dispose(); this.photoTexture = null;
    for (const piece of this.pieces.values()) this.disposePiece(piece);
    this.pieces.clear();
    this.roofMerge.dispose(); this.roomMerge.dispose(); this.room.dispose();
    for (const mesh of [...this.pickers.values(), ...this.markers.values()]) { mesh.geometry.dispose(); if (!Array.isArray(mesh.material)) mesh.material.dispose(); }
    Object.values(this.markerMaterials).forEach(material => material.dispose());
    this.scene.traverse(object => { if (object instanceof THREE.DirectionalLight) { object.shadow.map?.dispose(); } });
    this.scene.clear(); this.renderer.dispose();
    this.canvas.dataset.homeStats = JSON.stringify(this.snapshotStats());
  }
}
