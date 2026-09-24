import { createVesselGeometry } from "./vessel.ts";
import { getMaterialAppearance } from "./materialAppearance.ts";
import * as THREE from "three";

import { bendStationAtFraction, legalBendStation, sampleBranch } from "../core/arcLength.ts";
import { sampleMaterialFrame } from "../core/frames.ts";
import type { Vec3 } from "../core/math.ts";
import type { Branch, CutPlan, Organ, PlantGraph } from "../core/types.ts";
import { bloomSurfaceProfile, botanicalSeed, createBellGeometry, createBerryGeometry, createBloomPetalGeometry, createCalyxGeometry, createLeafGeometry, createLeafVeinGeometry, tuftInstancePose, type FanLeafDraw, type LeafDrawOptions, type PinnateDraw } from "./botanicalGeometry.ts";
import {
  disposeObject,
  splitBranchAtMaterialDistance,
  toThree,
  toVec3,
  updateLineGeometry,
  updateTubeGeometry,
} from "./geometry.ts";

export type CanonicalView = "front" | "three-quarter" | "above";
export type StudioView = CanonicalView | "orbit" | "free";
export type BendVariant = "bead" | "touch";
export const STUDIO_VERTICAL_FOV = 44;

export interface PlantSelection {
  plantId: string;
  branchId: string;
}

export interface ShapeAffordanceState {
  /** Caller owns posture/tool state. False hides all shaping chrome. */
  visible: boolean;
  bendVariant: BendVariant;
  /** Idle handles disappear after any edit transaction acquires. */
  transactionActive: boolean;
  /** Exact frozen arc station for the touch-located variant while acquired. */
  touchCueDistance?: number | null;
  /**
   * Omitted: production bead at 54% of the active rest arc.
   * A number places the single bead at that already chosen distance.
   * Null hides the bead.
   */
  beadStationDistance?: number | null;
  showSelection?: boolean;
}

export interface PendingPresentation {
  visible?: boolean;
  valid: boolean | null;
}

export interface CutPreviewPresentation {
  plantId: string;
  plan: CutPlan;
}

export interface SpatialRay {
  origin: Vec3;
  direction: Vec3;
}

/** Plane equation: dot(normal, point) + constant = 0. */
export interface SpatialPlane {
  normal: Vec3;
  constant: number;
}

export interface ProjectedPoint {
  clientX: number;
  clientY: number;
  ndcDepth: number;
  rayDepth: number;
  visible: boolean;
}

export interface ProjectedBranchPoint {
  materialDistance: number;
  worldPoint: Vec3;
  screenDistancePx: number;
  rayDepth: number;
}

export type HitCandidateKind = "base" | "bend" | "branch" | "organ";

export interface HitCandidate {
  kind: HitCandidateKind;
  /** 0 selected handle, 1 selected plant, 2 other plant. */
  priorityTier: 0 | 1 | 2;
  plantId: string;
  branchId: string;
  organId?: string;
  materialDistance: number;
  worldPoint: Vec3;
  screenDistancePx: number;
  rayDepth: number;
  stableId: string;
  /** Visible surface grip for Aim only; pruning still uses materialDistance. */
  aimPoint?: Vec3;
}

export type RankedHitCandidate = Pick<
  HitCandidate,
  "priorityTier" | "screenDistancePx" | "rayDepth" | "stableId"
>;

export interface KenzanIntersection {
  point: Vec3;
  clampedPoint: Vec3;
  valid: boolean;
}

export interface CameraOrbitSnapshot {
  target: Vec3;
  position: Vec3;
  up: Vec3;
  theta: number;
  phi: number;
  radius: number;
}

export interface StudioCameraPose {
  position: Vec3;
  target: Vec3;
  up: Vec3;
}

export interface GraphUpdateHints {
  /** Hints are optional. Signatures still protect correctness if omitted. */
  dirtyBranchIds?: ReadonlySet<string>;
  dirtyOrganIds?: ReadonlySet<string>;
}

export interface ThreeStudioOptions {
  maxPixelRatio?: number;
  debugHitTargets?: boolean;
  onViewChange?: (view: StudioView) => void;
  /** Comparison override. Absent uses the accepted pinnate draw. */
  pinnateDraw?: PinnateDraw;
  /** Comparison override for foliage-fan leaves. Absent uses the appearance profile. */
  fanLeafDraw?: FanLeafDraw;
}

type BranchVisual = {
  mesh: THREE.Mesh<THREE.BufferGeometry, THREE.MeshStandardMaterial>;
  hit: THREE.Mesh<THREE.BufferGeometry, THREE.MeshBasicMaterial>;
  selection: THREE.Line<THREE.BufferGeometry, THREE.LineBasicMaterial>;
  doomed: THREE.Mesh<THREE.BufferGeometry, THREE.MeshStandardMaterial>;
  geometrySignature: string;
  mainSignature: string;
};

type OrganVisual = {
  group: THREE.Group;
  hit: THREE.Mesh<THREE.SphereGeometry, THREE.MeshBasicMaterial>;
  bodyMaterials: THREE.MeshStandardMaterial[];
};

type PlantVisual = {
  graph: PlantGraph;
  group: THREE.Group;
  branches: Map<string, BranchVisual>;
  organs: Map<string, OrganVisual>;
  pending: boolean;
};

type HandleVisual = {
  group: THREE.Group;
  hit: THREE.Mesh<THREE.BufferGeometry, THREE.MeshBasicMaterial>;
};

const KENZAN_Y = 0.55;
const KENZAN_RADIUS = 1.22;
const EPSILON = 1e-8;
const CAMERA_RADIUS_MIN = 5.7;
const CAMERA_RADIUS_MAX = 15.5;
const CAMERA_PHI_MIN = 0.002;
const CAMERA_PHI_MAX = 1.52;

const CANONICAL_CAMERA: Record<CanonicalView, { position: Vec3; target: Vec3; up: Vec3 }> = {
  front: {
    position: { x: 0, y: 3.7, z: 15 },
    target: { x: 0, y: 2.55, z: 0 },
    up: { x: 0, y: 1, z: 0 },
  },
  "three-quarter": {
    position: { x: 9.72, y: 6.42, z: 11.1 },
    target: { x: 0, y: 2.4, z: 0 },
    up: { x: 0, y: 1, z: 0 },
  },
  above: {
    position: { x: 0, y: 15.4, z: 0.03 },
    target: { x: 0, y: 1.85, z: 0 },
    up: { x: 0, y: 0, z: -1 },
  },
};

function branchGeometrySignature(branch: Branch) {
  const points = branch.points
    .map((point) => `${point.x.toPrecision(12)},${point.y.toPrecision(12)},${point.z.toPrecision(12)}`)
    .join(";");
  return [
    branch.active ? 1 : 0,
    branch.radius.toPrecision(8),
    branch.activeLength.toPrecision(12),
    branch.referenceNormal.x.toPrecision(10),
    branch.referenceNormal.y.toPrecision(10),
    branch.referenceNormal.z.toPrecision(10),
    points,
  ].join("|");
}

function invisibleHitMaterial(debug: boolean, color = 0x4a8ab7) {
  return new THREE.MeshBasicMaterial({
    color,
    transparent: true,
    opacity: debug ? 0.12 : 0,
    depthWrite: false,
    depthTest: debug,
    colorWrite: debug,
    side: THREE.DoubleSide,
  });
}

function setOpacity(material: THREE.MeshStandardMaterial, opacity: number) {
  material.transparent = opacity < 0.999;
  material.opacity = opacity;
  material.depthWrite = opacity >= 0.999;
}

function candidateComparator(left: RankedHitCandidate, right: RankedHitCandidate) {
  return left.priorityTier - right.priorityTier
    || left.screenDistancePx - right.screenDistancePx
    || left.rayDepth - right.rayDepth
    || left.stableId.localeCompare(right.stableId);
}

export const compareHitCandidates = candidateComparator;

export class ThreeStudio {
  public readonly canvas: HTMLCanvasElement;

  private readonly scene = new THREE.Scene();
  private readonly camera = new THREE.PerspectiveCamera(STUDIO_VERTICAL_FOV, 1, 0.1, 80);
  private readonly renderer: THREE.WebGLRenderer;
  private readonly raycaster = new THREE.Raycaster();
  private readonly botanicalRoot = new THREE.Group();
  private readonly pendingRoot = new THREE.Group();
  private readonly plants = new Map<string, PlantVisual>();
  private readonly cameraTarget = new THREE.Vector3();
  private readonly kenzanGlow: THREE.Mesh<THREE.TorusGeometry, THREE.MeshBasicMaterial>;
  private readonly baseHandle: HandleVisual;
  private readonly bendHandle: HandleVisual;
  private readonly touchCue: THREE.Group;
  private readonly cutCollar: THREE.Mesh<THREE.TorusGeometry, THREE.MeshBasicMaterial>;
  private readonly options: Required<Pick<ThreeStudioOptions, "maxPixelRatio" | "debugHitTargets">>
    & Pick<ThreeStudioOptions, "onViewChange" | "pinnateDraw" | "fanLeafDraw">;

  private pendingPlant: PlantVisual | null = null;
  private pendingValidity: boolean | null = null;
  private selection: PlantSelection | null = null;
  private shapeAffordances: ShapeAffordanceState = {
    visible: false,
    bendVariant: "bead",
    transactionActive: false,
    touchCueDistance: null,
    showSelection: true,
  };
  private cutPreview: CutPreviewPresentation | null = null;
  private fixedBendDistance: number | null = null;
  private view: StudioView = "front";
  private resizeObserver: ResizeObserver | null = null;
  private renderFrame: number | null = null;
  private disposed = false;

  constructor(canvas: HTMLCanvasElement, options: ThreeStudioOptions = {}) {
    this.canvas = canvas;
    this.options = {
      maxPixelRatio: options.maxPixelRatio ?? 1.8,
      debugHitTargets: options.debugHitTargets ?? false,
      onViewChange: options.onViewChange,
      pinnateDraw: options.pinnateDraw,
      fanLeafDraw: options.fanLeafDraw,
    };
    this.canvas.style.touchAction = "none";

    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      alpha: false,
      powerPreference: "high-performance",
    });
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.04;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    this.scene.add(this.botanicalRoot, this.pendingRoot);
    const studioParts = this.buildStudio();
    this.kenzanGlow = studioParts.kenzanGlow;
    this.baseHandle = this.buildBaseHandle();
    this.bendHandle = this.buildBendHandle();
    this.touchCue = this.buildTouchCue();
    this.cutCollar = this.buildCutCollar();
    this.scene.add(
      this.baseHandle.group,
      this.bendHandle.group,
      this.touchCue,
      this.cutCollar,
    );

    this.setCanonicalView("front", false);
    this.resize();
    if (typeof ResizeObserver !== "undefined") {
      this.resizeObserver = new ResizeObserver(() => this.resize());
      this.resizeObserver.observe(canvas);
    }
    this.requestRender();
  }

  private buildStudio() {
    this.scene.background = new THREE.Color(0xeee9dd);
    this.scene.fog = new THREE.Fog(0xeee9dd, 13, 27);

    this.scene.add(new THREE.HemisphereLight(0xfffaec, 0x657064, 2.15));
    const key = new THREE.DirectionalLight(0xfff3d8, 3.15);
    key.position.set(-5, 10, 7);
    key.castShadow = true;
    key.shadow.mapSize.set(1024, 1024);
    key.shadow.camera.left = -7;
    key.shadow.camera.right = 7;
    key.shadow.camera.top = 9;
    key.shadow.camera.bottom = -3;
    this.scene.add(key);

    const fill = new THREE.DirectionalLight(0xcddce0, 0.72);
    fill.position.set(6, 4, -5);
    this.scene.add(fill);

    const floor = new THREE.Mesh(
      new THREE.CircleGeometry(20, 96),
      new THREE.MeshStandardMaterial({ color: 0xe3dccf, roughness: 1 }),
    );
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = -0.02;
    floor.receiveShadow = true;
    this.scene.add(floor);

    const vessel = new THREE.Mesh(
      createVesselGeometry(),
      new THREE.MeshPhysicalMaterial({ color: 0xbcb09b, roughness: 0.38, clearcoat: 0.65 }),
    );
    vessel.castShadow = true;
    vessel.receiveShadow = true;
    this.scene.add(vessel);

    const water = new THREE.Mesh(
      new THREE.CircleGeometry(2.345, 72),
      new THREE.MeshPhysicalMaterial({
        color: 0x497d82,
        opacity: 0.82,
        transparent: true,
        depthWrite: false,
        roughness: 0.16,
        clearcoat: 1,
      }),
    );
    water.rotation.x = -Math.PI / 2;
    water.position.y = 0.46;
    this.scene.add(water);

    const rim = new THREE.Mesh(
      new THREE.TorusGeometry(2.48, 0.035, 10, 72),
      new THREE.MeshStandardMaterial({ color: 0xd2c7b3, roughness: 0.35 }),
    );
    rim.rotation.x = Math.PI / 2;
    rim.position.y = 0.635;
    this.scene.add(rim);

    const kenzan = new THREE.Mesh(
      new THREE.CylinderGeometry(1.34, 1.34, 0.36, 64),
      new THREE.MeshStandardMaterial({ color: 0x4c4943, roughness: 0.44, metalness: 0.56 }),
    );
    // Extend down to the basin floor while retaining the original top at 0.55.
    kenzan.position.y = 0.37;
    this.scene.add(kenzan);

    const pinCoordinates: Array<[number, number]> = [];
    for (let x = -1.12; x <= 1.1201; x += 0.16) {
      for (let z = -1.12; z <= 1.1201; z += 0.16) {
        if (Math.hypot(x, z) <= KENZAN_RADIUS) pinCoordinates.push([x, z]);
      }
    }
    const pins = new THREE.InstancedMesh(
      new THREE.CylinderGeometry(0.012, 0.018, 0.25, 5),
      new THREE.MeshStandardMaterial({ color: 0xa9a197, metalness: 0.76, roughness: 0.28 }),
      pinCoordinates.length,
    );
    const pinMatrix = new THREE.Matrix4();
    pinCoordinates.forEach(([x, z], index) => {
      pinMatrix.makeTranslation(x, 0.62, z);
      pins.setMatrixAt(index, pinMatrix);
    });
    pins.instanceMatrix.needsUpdate = true;
    this.scene.add(pins);

    const front = new THREE.Mesh(
      new THREE.ConeGeometry(0.11, 0.24, 3),
      new THREE.MeshStandardMaterial({ color: 0x9e5844, roughness: 0.8 }),
    );
    front.rotation.x = Math.PI / 2;
    front.position.set(0, 0.48, 2.57);
    this.scene.add(front);

    const kenzanGlow = new THREE.Mesh(
      new THREE.TorusGeometry(1.43, 0.035, 8, 64),
      new THREE.MeshBasicMaterial({
        color: 0xc47a4c,
        opacity: 0.86,
        transparent: true,
        depthTest: false,
      }),
    );
    kenzanGlow.rotation.x = Math.PI / 2;
    kenzanGlow.position.y = KENZAN_Y + 0.03;
    kenzanGlow.visible = false;
    this.scene.add(kenzanGlow);
    return { kenzanGlow };
  }

  private buildBaseHandle(): HandleVisual {
    const group = new THREE.Group();
    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(0.31, 0.028, 8, 48),
      new THREE.MeshBasicMaterial({ color: 0xc47a49, depthTest: false, transparent: true, opacity: 0.9 }),
    );
    ring.rotation.x = Math.PI / 2;
    ring.renderOrder = 8;
    const hit = new THREE.Mesh(
      new THREE.CylinderGeometry(0.4, 0.4, 0.18, 32),
      invisibleHitMaterial(this.options.debugHitTargets, 0x3a87bc),
    );
    hit.userData.handleKind = "base";
    group.add(ring, hit);
    group.visible = false;
    return { group, hit };
  }

  private buildBendHandle(): HandleVisual {
    const group = new THREE.Group();
    const bead = new THREE.Mesh(
      new THREE.SphereGeometry(0.105, 16, 12),
      new THREE.MeshBasicMaterial({ color: 0xf5efdf, depthTest: false }),
    );
    const halo = new THREE.Mesh(
      new THREE.TorusGeometry(0.18, 0.018, 7, 40),
      new THREE.MeshBasicMaterial({ color: 0x7d6a54, depthTest: false, transparent: true, opacity: 0.78 }),
    );
    const hit = new THREE.Mesh(
      new THREE.SphereGeometry(0.3, 14, 10),
      invisibleHitMaterial(this.options.debugHitTargets, 0xc08f3d),
    );
    hit.userData.handleKind = "bend";
    group.add(bead, halo, hit);
    group.visible = false;
    group.renderOrder = 9;
    return { group, hit };
  }

  private buildTouchCue() {
    const group = new THREE.Group();
    const core = new THREE.Mesh(
      new THREE.SphereGeometry(0.07, 14, 10),
      new THREE.MeshBasicMaterial({
        color: 0xf4ead4,
        transparent: true,
        opacity: 0.78,
        depthTest: false,
      }),
    );
    const halo = new THREE.Mesh(
      new THREE.RingGeometry(0.13, 0.19, 32),
      new THREE.MeshBasicMaterial({
        color: 0x88745d,
        transparent: true,
        opacity: 0.46,
        depthTest: false,
        side: THREE.DoubleSide,
      }),
    );
    group.add(core, halo);
    group.visible = false;
    group.renderOrder = 10;
    return group;
  }

  private buildCutCollar() {
    const collar = new THREE.Mesh(
      new THREE.TorusGeometry(0.16, 0.025, 8, 36),
      new THREE.MeshBasicMaterial({ color: 0xa76a0a, depthTest: false }),
    );
    collar.visible = false;
    collar.renderOrder = 11;
    // A pale under-ring keeps the cut station legible without hue recognition.
    const underRing = new THREE.Mesh(
      new THREE.TorusGeometry(0.16, 0.045, 8, 36),
      new THREE.MeshBasicMaterial({ color: 0xfff9e9, depthTest: false }),
    );
    underRing.renderOrder = 10;
    collar.add(underRing);
    return collar;
  }

  private createBranchVisual(graph: PlantGraph, branch: Branch, pending: boolean): BranchVisual {
    const appearance = getMaterialAppearance(graph.generatorVersion);
    const material = new THREE.MeshStandardMaterial({
      color: appearance.branchColors[branch.kind],
      vertexColors: true,
      roughness: appearance.stemRoughness,
      transparent: pending,
      opacity: pending ? 0.44 : 1,
      depthWrite: !pending,
    });
    const mesh = new THREE.Mesh(new THREE.BufferGeometry(), material);
    mesh.castShadow = !pending;
    mesh.receiveShadow = !pending;
    mesh.userData = { plantId: graph.id, branchId: branch.id };

    const hitRadius = Math.max(
      branch.radius * 2.8,
      branch.kind === "trunk" ? 0.22 : 0.16,
    );
    const hit = new THREE.Mesh(
      new THREE.BufferGeometry(),
      invisibleHitMaterial(this.options.debugHitTargets),
    );
    hit.userData = { plantId: graph.id, branchId: branch.id, targetKind: "branch" };
    updateTubeGeometry(hit.geometry, branch.points, hitRadius, branch.referenceNormal);

    const selection = new THREE.Line(
      new THREE.BufferGeometry(),
      new THREE.LineBasicMaterial({
        color: 0xf1bd7e,
        opacity: 0.76,
        transparent: true,
        depthTest: false,
      }),
    );
    selection.visible = false;
    selection.renderOrder = 7;

    const doomed = new THREE.Mesh(
      new THREE.BufferGeometry(),
      new THREE.MeshStandardMaterial({
        color: appearance.branchColors[branch.kind],
        vertexColors: true,
        roughness: appearance.stemRoughness,
        transparent: true,
        opacity: 0.15,
        depthWrite: false,
      }),
    );
    doomed.visible = false;
    doomed.renderOrder = 3;

    return { mesh, hit, selection, doomed, geometrySignature: "", mainSignature: "" };
  }

  private createOrganVisual(graph: PlantGraph, organ: Organ, pending: boolean): OrganVisual {
    const appearance = getMaterialAppearance(graph.generatorVersion);
    const group = new THREE.Group();
    const seed = botanicalSeed(organ.id, graph.seed);
    const bodyMaterials: THREE.MeshStandardMaterial[] = [];
    const bodyMaterial = (color: number, roughness = 0.76, vertexColors = false) => {
      const material = new THREE.MeshStandardMaterial({
        color,
        roughness,
        vertexColors,
        transparent: pending,
        opacity: pending ? 0.44 : 1,
        depthWrite: !pending,
        side: THREE.DoubleSide,
      });
      bodyMaterials.push(material);
      return material;
    };

    let hitRadius: number;
    if (organ.kind === "leaf") {
      const draw: LeafDrawOptions = {
        pinnate: this.options.pinnateDraw,
        fanLeaf: graph.generatorVersion === "foliage-fan-v1"
          ? (this.options.fanLeafDraw ?? appearance.leaf.profile)
          : undefined,
      };
      const leaf = new THREE.Mesh(
        createLeafGeometry(seed, appearance.leaf.form, draw),
        bodyMaterial(appearance.leaf.color, appearance.leaf.roughness, true),
      );
      leaf.castShadow = !pending;
      const vein = new THREE.Mesh(createLeafVeinGeometry(seed, appearance.leaf.form, draw), bodyMaterial(appearance.leaf.veinColor, 0.8, true));
      group.add(leaf, vein);
      hitRadius = appearance.leaf.hitRadius;
    } else if (organ.kind === "bloom") {
      const bloom = appearance.bloom;
      const bellPalette = bloom.form === "bell" && bloom.collarColor !== undefined
        ? { petal: bloom.color, collar: bloom.collarColor } : undefined;
      const petalMaterial = bodyMaterial(bellPalette ? 0xffffff : bloom.color, bloom.roughness, true);
      if (bloom.form === "bell") {
        // One shell. Its mouth follows local +Y, the supporting tangent.
        // Cupped, open-face, and tufted blooms keep the radial path below.
        const bell = new THREE.Mesh(createBellGeometry(seed, bellPalette), petalMaterial);
        bell.castShadow = !pending;
        group.add(bell);
      } else {
        const profile = bloomSurfaceProfile(bloom.form);
        if (bloom.form === "tufted") {
          // One instanced tuft, still owned by this organ and its supporting branch.
          const petals = new THREE.InstancedMesh(
            createBloomPetalGeometry(seed, bloom.form),
            petalMaterial,
            profile.petalCount,
          );
          const petalMatrix = new THREE.Matrix4();
          const petalQuaternion = new THREE.Quaternion();
          const tiltQuaternion = new THREE.Quaternion();
          for (let index = 0; index < profile.petalCount; index += 1) {
            const pose = tuftInstancePose(seed, index, profile.petalCount, bloom.tuftScatter);
            petalQuaternion.setFromAxisAngle(new THREE.Vector3(0, 0, 1), pose.azimuth);
            tiltQuaternion.setFromAxisAngle(new THREE.Vector3(1, 0, 0), pose.tilt);
            petalQuaternion.multiply(tiltQuaternion);
            petalMatrix.compose(
              new THREE.Vector3(),
              petalQuaternion,
              new THREE.Vector3(pose.scale, pose.scale, pose.scale),
            );
            petals.setMatrixAt(index, petalMatrix);
          }
          petals.instanceMatrix.needsUpdate = true;
          petals.castShadow = !pending;
          group.add(petals);
        } else {
          for (let index = 0; index < profile.petalCount; index += 1) {
            const angle = (index / profile.petalCount) * Math.PI * 2;
            const petal = new THREE.Mesh(
              createBloomPetalGeometry(botanicalSeed(`${organ.id}:petal-${index}`, seed), bloom.form),
              petalMaterial,
            );
            petal.rotation.z = angle;
            petal.castShadow = !pending;
            group.add(petal);
          }
        }
        group.add(new THREE.Mesh(createCalyxGeometry(seed, bloom.form), bodyMaterial(0x57734d, 0.82, true)));
        const center = new THREE.Mesh(
          new THREE.SphereGeometry(profile.centerRadius, 12, 8),
          bodyMaterial(profile.centerColor, 0.78),
        );
        center.scale.z = profile.centerScaleZ;
        center.position.z = profile.centerZ;
        group.add(center);
        // One instanced mesh adds a quiet ring of anthers, owned by this bloom.
        const anthers = new THREE.InstancedMesh(
          new THREE.SphereGeometry(profile.antherRadius, 6, 4), bodyMaterial(0xe0bd72, 0.8), profile.antherCount,
        );
        const antherMatrix = new THREE.Matrix4();
        for (let index = 0; index < profile.antherCount; index += 1) {
          const angle = (index / profile.antherCount) * Math.PI * 2;
          antherMatrix.makeTranslation(
            Math.cos(angle) * profile.antherRing,
            Math.sin(angle) * profile.antherRing,
            profile.antherZ,
          );
          anthers.setMatrixAt(index, antherMatrix);
        }
        anthers.instanceMatrix.needsUpdate = true;
        group.add(anthers);
      }
      hitRadius = bloom.hitRadius;
    } else if (organ.kind === "berry") {
      const berry = appearance.berry;
      if (!berry) throw new Error(`Missing berry appearance: ${graph.generatorVersion}`);
      const fruit = new THREE.Mesh(
        createBerryGeometry(seed, berry.radius),
        bodyMaterial(berry.color, berry.roughness, true),
      );
      fruit.position.y = berry.centerY;
      fruit.castShadow = !pending;
      group.add(fruit);
      hitRadius = berry.hitRadius;
    } else {
      const bud = new THREE.Mesh(
        new THREE.SphereGeometry(0.16, 13, 9),
        bodyMaterial(0xa64f59, 0.76),
      );
      bud.scale.set(0.85, 1.3, 0.85);
      bud.position.y = 0.05;
      bud.castShadow = !pending;
      group.add(bud);
      hitRadius = 0.28;
    }

    const hit = new THREE.Mesh(
      new THREE.SphereGeometry(hitRadius, 10, 8),
      invisibleHitMaterial(this.options.debugHitTargets, 0xa96ab3),
    );
    if (organ.kind === "leaf") hit.position.y = appearance.leaf.hitCenterY;
    else if (organ.kind === "bloom" && appearance.bloom.hitCenterY) {
      hit.position.y = appearance.bloom.hitCenterY;
    } else if (organ.kind === "berry" && appearance.berry) {
      hit.position.y = appearance.berry.centerY;
    }
    hit.userData = {
      plantId: graph.id,
      branchId: organ.branchId,
      organId: organ.id,
      targetKind: "organ",
    };
    group.add(hit);
    return { group, hit, bodyMaterials };
  }

  private createPlantVisual(graph: PlantGraph, pending: boolean) {
    const visual: PlantVisual = {
      graph,
      group: new THREE.Group(),
      branches: new Map(),
      organs: new Map(),
      pending,
    };
    visual.group.name = pending ? `pending:${graph.id}` : `plant:${graph.id}`;
    (pending ? this.pendingRoot : this.botanicalRoot).add(visual.group);
    this.syncPlantVisual(visual);
    return visual;
  }

  private previewForPlant(plantId: string) {
    return this.cutPreview?.plantId === plantId ? this.cutPreview.plan : null;
  }

  private syncPlantVisual(visual: PlantVisual, _hints: GraphUpdateHints = {}) {
    const { graph, pending } = visual;
    const plan = pending ? null : this.previewForPlant(graph.id);
    const removedBranches = new Set(plan?.removedBranchIds ?? []);
    const removedOrgans = new Set(plan?.removedOrganIds ?? []);

    for (const [branchId, branch] of graph.branches) {
      let branchVisual = visual.branches.get(branchId);
      if (!branchVisual) {
        branchVisual = this.createBranchVisual(graph, branch, pending);
        visual.branches.set(branchId, branchVisual);
        visual.group.add(
          branchVisual.mesh,
          branchVisual.hit,
          branchVisual.selection,
          branchVisual.doomed,
        );
      }

      const active = branch.active && branch.points.length >= 2;
      branchVisual.mesh.visible = active;
      branchVisual.hit.visible = active && !pending;
      branchVisual.selection.visible = false;
      branchVisual.doomed.visible = false;
      if (!active) continue;

      const geometrySignature = branchGeometrySignature(branch);
      if (geometrySignature !== branchVisual.geometrySignature) {
        const hitRadius = Math.max(
          branch.radius * 2.8,
          branch.kind === "trunk" ? 0.22 : 0.16,
        );
        updateTubeGeometry(branchVisual.hit.geometry, branch.points, hitRadius, branch.referenceNormal);
        updateLineGeometry(branchVisual.selection.geometry, branch.points);
        branchVisual.geometrySignature = geometrySignature;
      }

      const isCutBranch = Boolean(plan && plan.branchId === branch.id);
      const mainSignature = `${geometrySignature}|${isCutBranch ? plan!.distance.toPrecision(12) : "full"}`;
      if (mainSignature !== branchVisual.mainSignature) {
        if (isCutBranch) {
          const split = splitBranchAtMaterialDistance(branch, plan!.distance);
          updateTubeGeometry(
            branchVisual.mesh.geometry,
            split.proximal,
            branch.radius,
            branch.referenceNormal,
            10, true,
          );
          if (split.distal.length >= 2) {
            updateTubeGeometry(
              branchVisual.doomed.geometry,
              split.distal,
              branch.radius,
              branch.referenceNormal,
              10, true,
            );
          }
        } else {
          updateTubeGeometry(
            branchVisual.mesh.geometry,
            branch.points,
            branch.radius,
            branch.referenceNormal,
            10, true,
          );
        }
        branchVisual.mainSignature = mainSignature;
      }

      if (pending) {
        const opacity = this.pendingValidity === false ? 0.25 : 0.45;
        setOpacity(branchVisual.mesh.material, opacity);
        branchVisual.mesh.material.emissive.setHex(this.pendingValidity === false ? 0x3a1210 : 0x102116);
      } else {
        const doomed = removedBranches.has(branch.id);
        setOpacity(branchVisual.mesh.material, doomed ? 0.14 : 1);
        branchVisual.mesh.castShadow = !doomed;
        const selected = this.selection?.plantId === graph.id && this.selection.branchId === branch.id;
        branchVisual.mesh.material.emissive.setHex(selected ? 0x171009 : 0x000000);
        branchVisual.doomed.visible = isCutBranch && plan!.distance < branch.activeLength - EPSILON;
      }
    }

    for (const [branchId, branchVisual] of [...visual.branches]) {
      if (graph.branches.has(branchId)) continue;
      visual.group.remove(branchVisual.mesh, branchVisual.hit, branchVisual.selection, branchVisual.doomed);
      disposeObject(branchVisual.mesh);
      disposeObject(branchVisual.hit);
      disposeObject(branchVisual.selection);
      disposeObject(branchVisual.doomed);
      visual.branches.delete(branchId);
    }

    for (const [organId, organ] of graph.organs) {
      let organVisual = visual.organs.get(organId);
      if (!organVisual) {
        organVisual = this.createOrganVisual(graph, organ, pending);
        visual.organs.set(organId, organVisual);
        visual.group.add(organVisual.group);
      }

      const branch = graph.branches.get(organ.branchId);
      const active = Boolean(organ.active && branch?.active);
      organVisual.group.visible = active;
      organVisual.hit.visible = active && !pending;
      if (!active || !branch) continue;

      const frame = sampleMaterialFrame(branch, Math.min(organ.distance, branch.activeLength));
      organVisual.group.position.copy(toThree(frame.position));
      const tangent = toThree(frame.tangent).normalize();
      const normal = toThree(frame.normal).normalize();
      const binormal = toThree(frame.binormal).normalize();
      const basis = new THREE.Matrix4().makeBasis(binormal, tangent, normal);
      organVisual.group.quaternion.setFromRotationMatrix(basis);
      organVisual.group.rotateY(organ.spin);
      organVisual.group.scale.setScalar(organ.scale);

      const opacity = pending
        ? this.pendingValidity === false ? 0.25 : 0.45
        : removedOrgans.has(organ.id) ? 0.14 : 1;
      const organDoomed = !pending && removedOrgans.has(organ.id);
      for (const material of organVisual.bodyMaterials) {
        setOpacity(material, opacity);
        material.emissive.setHex(
          pending && this.pendingValidity === false ? 0x351112
            : pending ? 0x0e1f15
              : 0x000000,
        );
      }
      organVisual.group.traverse((object) => {
        if (object instanceof THREE.Mesh && object !== organVisual.hit) {
          object.castShadow = !pending && !organDoomed;
        }
      });
    }

    for (const [organId, organVisual] of [...visual.organs]) {
      if (graph.organs.has(organId)) continue;
      visual.group.remove(organVisual.group);
      disposeObject(organVisual.group);
      visual.organs.delete(organId);
    }

    this.updateAffordances();
    this.updateCutCollar();
    this.requestRender();
  }

  upsertGraph(graph: PlantGraph, hints: GraphUpdateHints = {}) {
    let visual = this.plants.get(graph.id);
    if (!visual) {
      visual = this.createPlantVisual(graph, false);
      this.plants.set(graph.id, visual);
    } else {
      visual.graph = graph;
      this.syncPlantVisual(visual, hints);
    }
    this.updateAffordances();
    this.requestRender();
    return visual.group;
  }

  setGraphs(graphs: Iterable<PlantGraph>) {
    const retained = new Set<string>();
    for (const graph of graphs) {
      retained.add(graph.id);
      this.upsertGraph(graph);
    }
    for (const plantId of [...this.plants.keys()]) {
      if (!retained.has(plantId)) this.removeGraph(plantId);
    }
  }

  setVerticalFieldOfView(degrees: number) {
    if (!Number.isFinite(degrees) || degrees <= 1 || degrees >= 179) return;
    if (this.camera.fov === degrees) return;
    this.camera.fov = degrees;
    this.camera.updateProjectionMatrix();
    this.requestRender();
  }

  getVerticalFieldOfView() {
    return this.camera.fov;
  }

  /** Comparison passes 1 so neither arrangement is fit or rescaled to its pane. */
  setBotanicalWorldScale(scale: number) {
    if (!Number.isFinite(scale) || scale <= 0) return;
    this.botanicalRoot.scale.setScalar(scale);
    this.requestRender();
  }

  getBotanicalWorldScale() {
    return this.botanicalRoot.scale.x;
  }

  removeGraph(plantId: string) {
    const visual = this.plants.get(plantId);
    if (!visual) return;
    this.botanicalRoot.remove(visual.group);
    disposeObject(visual.group);
    this.plants.delete(plantId);
    if (this.selection?.plantId === plantId) this.selection = null;
    if (this.cutPreview?.plantId === plantId) this.cutPreview = null;
    this.updateAffordances();
    this.updateCutCollar();
    this.requestRender();
  }

  clearGraphs() {
    for (const plantId of [...this.plants.keys()]) this.removeGraph(plantId);
  }

  setPendingGraph(graph: PlantGraph | null, presentation: PendingPresentation = { valid: null }) {
    this.pendingValidity = presentation.valid;
    if (!graph) {
      if (this.pendingPlant) {
        this.pendingRoot.remove(this.pendingPlant.group);
        disposeObject(this.pendingPlant.group);
      }
      this.pendingPlant = null;
      this.kenzanGlow.visible = false;
      this.requestRender();
      return;
    }

    if (!this.pendingPlant || this.pendingPlant.graph.id !== graph.id) {
      if (this.pendingPlant) {
        this.pendingRoot.remove(this.pendingPlant.group);
        disposeObject(this.pendingPlant.group);
      }
      this.pendingPlant = this.createPlantVisual(graph, true);
    } else {
      this.pendingPlant.graph = graph;
      this.syncPlantVisual(this.pendingPlant);
    }
    this.pendingPlant.group.visible = presentation.visible ?? true;
    this.kenzanGlow.visible = presentation.visible ?? true;
    this.kenzanGlow.material.color.setHex(
      presentation.valid === true ? 0x73906d
        : presentation.valid === false ? 0xb85f4e
          : 0xc47a4c,
    );
    this.requestRender();
  }

  setInsertionFeedback(active: boolean, valid: boolean | null = null) {
    this.pendingValidity = valid;
    this.kenzanGlow.visible = active;
    this.kenzanGlow.material.color.setHex(
      valid === true ? 0x73906d : valid === false ? 0xb85f4e : 0xc47a4c,
    );
    if (this.pendingPlant) this.syncPlantVisual(this.pendingPlant);
    this.requestRender();
  }

  setSelection(selection: PlantSelection | null) {
    this.selection = selection;
    for (const visual of this.plants.values()) this.syncPlantVisual(visual);
    this.updateAffordances();
  }

  getSelection() {
    return this.selection ? { ...this.selection } : null;
  }

  setShapeAffordances(state: ShapeAffordanceState) {
    this.shapeAffordances = {
      ...state,
      touchCueDistance: state.touchCueDistance ?? null,
      showSelection: state.showSelection ?? true,
    };
    this.updateAffordances();
    this.requestRender();
  }

  private selectedBranch() {
    if (!this.selection) return null;
    const plant = this.plants.get(this.selection.plantId);
    const branch = plant?.graph.branches.get(this.selection.branchId);
    return plant && branch?.active ? { plant, branch } : null;
  }

  private updateAffordances() {
    for (const plant of this.plants.values()) {
      for (const branch of plant.branches.values()) branch.selection.visible = false;
    }
    this.baseHandle.group.visible = false;
    this.bendHandle.group.visible = false;
    this.touchCue.visible = false;
    this.fixedBendDistance = null;

    const selected = this.selectedBranch();
    if (!selected || !this.shapeAffordances.visible) return;
    const branchVisual = selected.plant.branches.get(selected.branch.id);
    if (branchVisual && this.shapeAffordances.showSelection !== false) {
      branchVisual.selection.visible = true;
    }

    if (!this.shapeAffordances.transactionActive) {
      const root = selected.plant.graph.branches.get(selected.plant.graph.rootBranchId);
      if (root?.active) {
        this.baseHandle.group.position.copy(toThree(root.points[0]));
        this.baseHandle.group.visible = true;
      }
      if (this.shapeAffordances.bendVariant === "bead") {
        const requested = this.shapeAffordances.beadStationDistance;
        this.fixedBendDistance = requested === undefined
          ? bendStationAtFraction(selected.branch, 0.54)
          : requested === null
            ? null
            : legalBendStation(selected.branch, requested);
        if (this.fixedBendDistance != null) {
          const sample = sampleBranch(selected.branch, this.fixedBendDistance);
          this.bendHandle.group.position.copy(toThree(sample.position));
          this.bendHandle.group.quaternion.copy(this.camera.quaternion);
          this.bendHandle.group.visible = true;
        }
      }
    }

    const touchDistance = this.shapeAffordances.touchCueDistance;
    if (touchDistance != null && this.shapeAffordances.bendVariant === "touch") {
      const legalDistance = legalBendStation(selected.branch, touchDistance);
      if (legalDistance != null) {
        const sample = sampleBranch(selected.branch, legalDistance);
        this.touchCue.position.copy(toThree(sample.position));
        this.touchCue.quaternion.copy(this.camera.quaternion);
        this.touchCue.visible = true;
      }
    }
  }

  setCutPreview(preview: CutPreviewPresentation | null) {
    const priorPlantId = this.cutPreview?.plantId;
    this.cutPreview = preview;
    const affected = new Set([priorPlantId, preview?.plantId].filter(Boolean) as string[]);
    for (const plantId of affected) {
      const visual = this.plants.get(plantId);
      if (visual) this.syncPlantVisual(visual);
    }
    this.updateCutCollar();
    this.requestRender();
  }

  private updateCutCollar() {
    this.cutCollar.visible = false;
    if (!this.cutPreview) return;
    const visual = this.plants.get(this.cutPreview.plantId);
    const branch = visual?.graph.branches.get(this.cutPreview.plan.branchId);
    if (!branch?.active) return;
    const sample = sampleBranch(branch, this.cutPreview.plan.distance);
    this.cutCollar.position.copy(toThree(sample.position));
    this.cutCollar.quaternion.setFromUnitVectors(
      new THREE.Vector3(0, 0, 1),
      toThree(sample.tangent).normalize(),
    );
    this.cutCollar.visible = true;
  }

  getView() {
    return this.view;
  }

  setCanonicalView(view: CanonicalView, announce = true) {
    const pose = CANONICAL_CAMERA[view];
    this.camera.position.copy(toThree(pose.position));
    this.cameraTarget.copy(toThree(pose.target));
    this.camera.up.copy(toThree(pose.up));
    this.camera.lookAt(this.cameraTarget);
    this.camera.updateMatrixWorld(true);
    this.view = view;
    this.updateAffordances();
    if (announce) this.options.onViewChange?.(view);
    this.requestRender();
  }

  captureCameraOrbit(): CameraOrbitSnapshot {
    const delta = this.camera.position.clone().sub(this.cameraTarget);
    const spherical = new THREE.Spherical().setFromVector3(delta);
    return {
      target: toVec3(this.cameraTarget),
      position: toVec3(this.camera.position),
      up: toVec3(this.camera.up),
      theta: spherical.theta,
      phi: spherical.phi,
      radius: spherical.radius,
    };
  }

  getCameraPose(): StudioCameraPose {
    return {
      position: toVec3(this.camera.position),
      target: toVec3(this.cameraTarget),
      up: toVec3(this.camera.up),
    };
  }

  applyCameraPose(
    pose: StudioCameraPose,
    view: StudioView = "orbit",
    announce = true,
  ) {
    this.camera.position.copy(toThree(pose.position));
    this.cameraTarget.copy(toThree(pose.target));
    this.camera.up.copy(toThree(pose.up)).normalize();
    this.camera.lookAt(this.cameraTarget);
    this.camera.updateMatrixWorld(true);
    this.view = view;
    this.updateAffordances();
    if (announce) this.options.onViewChange?.(view);
    this.requestRender();
  }

  setCameraPose(
    pose: StudioCameraPose,
    view: StudioView = "orbit",
    announce = true,
  ) {
    this.applyCameraPose(pose, view, announce);
  }

  /** Exact snapshot application for coordinator-owned camera previews/rollback. */
  applyCameraSnapshot(
    snapshot: CameraOrbitSnapshot,
    view: StudioView = "orbit",
    announce = true,
  ) {
    this.applyCameraPose(snapshot, view, announce);
  }

  applyInspectOrbit(
    snapshot: CameraOrbitSnapshot,
    deltaClientX: number,
    deltaClientY: number,
  ) {
    const spherical = new THREE.Spherical(
      snapshot.radius,
      THREE.MathUtils.clamp(snapshot.phi + deltaClientY * 0.0025, CAMERA_PHI_MIN, CAMERA_PHI_MAX),
      snapshot.theta - deltaClientX * 0.006,
    );
    this.cameraTarget.copy(toThree(snapshot.target));
    this.camera.up.set(0, 1, 0);
    this.camera.position.copy(this.cameraTarget).add(new THREE.Vector3().setFromSpherical(spherical));
    this.camera.lookAt(this.cameraTarget);
    this.camera.updateMatrixWorld(true);
    this.view = "orbit";
    this.updateAffordances();
    this.options.onViewChange?.("orbit");
    this.requestRender();
  }

  applyInspectDolly(snapshot: CameraOrbitSnapshot, distanceScale: number) {
    const radius = THREE.MathUtils.clamp(
      snapshot.radius * distanceScale,
      CAMERA_RADIUS_MIN,
      CAMERA_RADIUS_MAX,
    );
    const direction = toThree(snapshot.position).sub(toThree(snapshot.target));
    if (direction.lengthSq() <= EPSILON) direction.set(0, 0, 1);
    direction.normalize();
    this.cameraTarget.copy(toThree(snapshot.target));
    this.camera.up.copy(toThree(snapshot.up));
    this.camera.position.copy(this.cameraTarget).addScaledVector(direction, radius);
    this.camera.lookAt(this.cameraTarget);
    this.camera.updateMatrixWorld(true);
    this.view = "orbit";
    this.updateAffordances();
    this.options.onViewChange?.("orbit");
    this.requestRender();
  }

  rayFromClient(clientX: number, clientY: number): SpatialRay {
    this.setRaycaster(clientX, clientY);
    return {
      origin: toVec3(this.raycaster.ray.origin),
      direction: toVec3(this.raycaster.ray.direction),
    };
  }

  cameraFacingPlaneThrough(point: Vec3): SpatialPlane {
    const normal = this.camera.getWorldDirection(new THREE.Vector3()).normalize();
    const plane = new THREE.Plane().setFromNormalAndCoplanarPoint(normal, toThree(point));
    return { normal: toVec3(plane.normal), constant: plane.constant };
  }

  kenzanPlane(): SpatialPlane {
    return { normal: { x: 0, y: 1, z: 0 }, constant: -KENZAN_Y };
  }

  intersectClientPlane(clientX: number, clientY: number, plane: SpatialPlane): Vec3 | null {
    this.setRaycaster(clientX, clientY);
    const threePlane = new THREE.Plane(toThree(plane.normal).normalize(), plane.constant);
    const intersection = this.raycaster.ray.intersectPlane(threePlane, new THREE.Vector3());
    return intersection ? toVec3(intersection) : null;
  }

  intersectKenzanPlane(clientX: number, clientY: number): KenzanIntersection | null {
    const point = this.intersectClientPlane(clientX, clientY, this.kenzanPlane());
    if (!point) return null;
    const radialLength = Math.hypot(point.x, point.z);
    const scale = radialLength > KENZAN_RADIUS ? KENZAN_RADIUS / radialLength : 1;
    return {
      point,
      clampedPoint: { x: point.x * scale, y: KENZAN_Y, z: point.z * scale },
      valid: radialLength <= KENZAN_RADIUS,
    };
  }

  getCameraAxes() {
    this.camera.updateMatrixWorld(true);
    const right = new THREE.Vector3().setFromMatrixColumn(this.camera.matrixWorld, 0).normalize();
    const up = new THREE.Vector3().setFromMatrixColumn(this.camera.matrixWorld, 1).normalize();
    const forward = this.camera.getWorldDirection(new THREE.Vector3()).normalize();
    return { right: toVec3(right), up: toVec3(up), forward: toVec3(forward) };
  }

  projectPoint(point: Vec3): ProjectedPoint {
    const rect = this.canvas.getBoundingClientRect();
    const projected = toThree(point).project(this.camera);
    const ray = this.rayFromClient(
      rect.left + (projected.x * 0.5 + 0.5) * rect.width,
      rect.top + (-projected.y * 0.5 + 0.5) * rect.height,
    );
    const delta = toThree(point).sub(toThree(ray.origin));
    return {
      clientX: rect.left + (projected.x * 0.5 + 0.5) * rect.width,
      clientY: rect.top + (-projected.y * 0.5 + 0.5) * rect.height,
      ndcDepth: projected.z,
      rayDepth: delta.dot(toThree(ray.direction)),
      visible: projected.z >= -1 && projected.z <= 1,
    };
  }

  closestProjectedPointOnBranch(
    plantId: string,
    branchId: string,
    clientX: number,
    clientY: number,
  ): ProjectedBranchPoint | null {
    const branch = this.plants.get(plantId)?.graph.branches.get(branchId);
    return branch ? this.closestProjectedOnBranch(branch, clientX, clientY) : null;
  }

  private closestProjectedOnBranch(
    branch: Branch,
    clientX: number,
    clientY: number,
  ): ProjectedBranchPoint {
    const rect = this.canvas.getBoundingClientRect();
    const touch = new THREE.Vector2(clientX - rect.left, clientY - rect.top);
    const pointerRay = this.rayFromClient(clientX, clientY);
    let best: ProjectedBranchPoint | null = null;
    let cursor = 0;

    for (let index = 0; index < branch.points.length - 1; index += 1) {
      const startProjection = this.projectPoint(branch.points[index]);
      const endProjection = this.projectPoint(branch.points[index + 1]);
      const start = new THREE.Vector2(
        startProjection.clientX - rect.left,
        startProjection.clientY - rect.top,
      );
      const end = new THREE.Vector2(
        endProjection.clientX - rect.left,
        endProjection.clientY - rect.top,
      );
      const segment = end.clone().sub(start);
      const t = segment.lengthSq() <= EPSILON
        ? 0
        : THREE.MathUtils.clamp(touch.clone().sub(start).dot(segment) / segment.lengthSq(), 0, 1);
      const screenPoint = start.clone().addScaledVector(segment, t);
      const worldPoint = toThree(branch.points[index]).lerp(toThree(branch.points[index + 1]), t);
      const rayDepth = worldPoint.clone().sub(toThree(pointerRay.origin)).dot(toThree(pointerRay.direction));
      const candidate: ProjectedBranchPoint = {
        materialDistance: cursor + branch.restLengths[index] * t,
        worldPoint: toVec3(worldPoint),
        screenDistancePx: screenPoint.distanceTo(touch),
        rayDepth,
      };
      if (!best || candidate.screenDistancePx < best.screenDistancePx) best = candidate;
      cursor += branch.restLengths[index];
    }

    return best ?? {
      materialDistance: 0,
      worldPoint: { ...branch.points[0] },
      screenDistancePx: Number.POSITIVE_INFINITY,
      rayDepth: Number.POSITIVE_INFINITY,
    };
  }

  collectHitCandidates(clientX: number, clientY: number): HitCandidate[] {
    this.setRaycaster(clientX, clientY);
    const acquisitionRay = this.raycaster.ray.clone();
    const targets: THREE.Object3D[] = [];
    if (this.baseHandle.group.visible) targets.push(this.baseHandle.hit);
    if (this.bendHandle.group.visible) targets.push(this.bendHandle.hit);
    for (const plant of this.plants.values()) {
      for (const branch of plant.graph.branches.values()) {
        if (branch.active) targets.push(plant.branches.get(branch.id)!.hit);
      }
      for (const organ of plant.graph.organs.values()) {
        const branch = plant.graph.branches.get(organ.branchId);
        if (organ.active && branch?.active) targets.push(plant.organs.get(organ.id)!.hit);
      }
    }

    const candidates = new Map<string, HitCandidate>();
    const intersections = this.raycaster.intersectObjects(targets, false);
    for (const intersection of intersections) {
      const data = intersection.object.userData as {
        handleKind?: "base" | "bend";
        targetKind?: "branch" | "organ";
        plantId?: string;
        branchId?: string;
        organId?: string;
      };

      if (data.handleKind) {
        const selected = this.selectedBranch();
        if (!selected) continue;
        const group = data.handleKind === "base" ? this.baseHandle.group : this.bendHandle.group;
        const projected = this.projectPoint(toVec3(group.position));
        const stableId = `${selected.plant.graph.id}:handle-${data.handleKind}`;
        const pointerDepth = group.position.clone()
          .sub(acquisitionRay.origin)
          .dot(acquisitionRay.direction);
        const candidate: HitCandidate = {
          kind: data.handleKind,
          priorityTier: 0,
          plantId: selected.plant.graph.id,
          branchId: selected.branch.id,
          materialDistance: data.handleKind === "bend" ? this.fixedBendDistance ?? 0 : 0,
          worldPoint: toVec3(group.position),
          screenDistancePx: Math.hypot(projected.clientX - clientX, projected.clientY - clientY),
          rayDepth: pointerDepth,
          stableId,
        };
        const prior = candidates.get(stableId);
        if (!prior || candidate.rayDepth < prior.rayDepth) candidates.set(stableId, candidate);
        continue;
      }

      if (!data.plantId || !data.branchId || !data.targetKind) continue;
      const plant = this.plants.get(data.plantId);
      const branch = plant?.graph.branches.get(data.branchId);
      if (!plant || !branch?.active) continue;
      const selectedPlant = this.selection?.plantId === plant.graph.id;
      const priorityTier: 1 | 2 = selectedPlant ? 1 : 2;

      if (data.targetKind === "organ" && data.organId) {
        const organ = plant.graph.organs.get(data.organId);
        if (!organ?.active) continue;
        if (candidates.has(organ.id)) continue;
        const visual = plant.organs.get(organ.id)!;
        const position = toVec3(visual.group.position);
        const projected = this.projectPoint(position);
        const stableId = organ.id;
        const pointerDepth = toThree(position)
          .sub(acquisitionRay.origin)
          .dot(acquisitionRay.direction);
        // The enlarged proxy admits near misses. A press on the actual blade or
        // petals has zero distance to projected material, even when its graph
        // attachment lies behind a stem. Keep that attachment as the acquired
        // graph/prune station; Aim can also freeze the actual surface grip.
        // Projection helpers also use this raycaster, so restore the pointer ray.
        this.raycaster.ray.copy(acquisitionRay);
        const surfaces = visual.group.visible
          ? this.raycaster.intersectObjects(
            visual.group.children.filter((child) => child !== visual.hit && child.visible),
            false,
          )
          : [];
        const surface = surfaces.reduce<THREE.Intersection | undefined>(
          (nearest, hit) => !nearest || hit.distance < nearest.distance ? hit : nearest,
          undefined,
        );
        const candidate: HitCandidate = {
          kind: "organ",
          priorityTier,
          plantId: plant.graph.id,
          branchId: branch.id,
          organId: organ.id,
          materialDistance: organ.distance,
          worldPoint: position,
          aimPoint: surface ? toVec3(surface.point) : undefined,
          screenDistancePx: surface ? 0 : Math.hypot(projected.clientX - clientX, projected.clientY - clientY),
          rayDepth: surface ? surface.distance : pointerDepth,
          stableId,
        };
        const prior = candidates.get(stableId);
        if (!prior || candidate.rayDepth < prior.rayDepth) candidates.set(stableId, candidate);
      } else {
        const stableId = branch.id;
        if (candidates.has(stableId)) continue;
        const projected = this.closestProjectedOnBranch(branch, clientX, clientY);
        const visual = plant.branches.get(branch.id)!;
        // Branches receive the same visible-material distance as organs. An
        // actual foreground stem must beat a leaf behind it, even if the press
        // is slightly beside that stem's projected centerline.
        this.raycaster.ray.copy(acquisitionRay);
        const surfaces = this.raycaster.intersectObjects(
          [visual.mesh, visual.doomed].filter((mesh) => mesh.visible),
          false,
        );
        const surface = surfaces.reduce<THREE.Intersection | undefined>(
          (nearest, hit) => !nearest || hit.distance < nearest.distance ? hit : nearest,
          undefined,
        );
        const candidate: HitCandidate = {
          kind: "branch",
          priorityTier,
          plantId: plant.graph.id,
          branchId: branch.id,
          materialDistance: projected.materialDistance,
          worldPoint: projected.worldPoint,
          screenDistancePx: surface ? 0 : projected.screenDistancePx,
          rayDepth: surface ? surface.distance : projected.rayDepth,
          stableId,
        };
        const prior = candidates.get(stableId);
        if (!prior || candidate.rayDepth < prior.rayDepth) candidates.set(stableId, candidate);
      }
    }

    return [...candidates.values()].sort(candidateComparator);
  }

  private setRaycaster(clientX: number, clientY: number) {
    const rect = this.canvas.getBoundingClientRect();
    const width = Math.max(1, rect.width);
    const height = Math.max(1, rect.height);
    const pointer = new THREE.Vector2(
      ((clientX - rect.left) / width) * 2 - 1,
      -((clientY - rect.top) / height) * 2 + 1,
    );
    this.camera.updateMatrixWorld(true);
    this.scene.updateMatrixWorld(true);
    this.raycaster.setFromCamera(pointer, this.camera);
  }

  private resize() {
    if (this.disposed) return;
    const rect = this.canvas.getBoundingClientRect();
    const width = Math.max(1, Math.round(rect.width || this.canvas.clientWidth || 1));
    const height = Math.max(1, Math.round(rect.height || this.canvas.clientHeight || 1));
    const pixelRatio = Math.min(window.devicePixelRatio || 1, this.options.maxPixelRatio);
    this.renderer.setPixelRatio(pixelRatio);
    this.renderer.setSize(width, height, false);
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.requestRender();
  }

  requestRender() {
    if (this.disposed || this.renderFrame != null) return;
    this.renderFrame = requestAnimationFrame(() => {
      this.renderFrame = null;
      this.renderNow();
    });
  }

  /** Small actual-view JPEG; thumbnail failure never prevents keeping the graph. */
  captureThumbnail(): string | null {
    const selection = this.getSelection();
    try {
      this.setSelection(null);
      this.renderNow();
      const thumbnail = document.createElement("canvas");
      thumbnail.width = 360; thumbnail.height = 270;
      const context = thumbnail.getContext("2d");
      if (!context || !this.canvas.width || !this.canvas.height) return null;
      context.fillStyle = "#e8e3d7"; context.fillRect(0, 0, 360, 270);
      const scale = Math.min(360 / this.canvas.width, 270 / this.canvas.height);
      const width = this.canvas.width * scale, height = this.canvas.height * scale;
      context.drawImage(this.canvas, (360 - width) / 2, (270 - height) / 2, width, height);
      const data = thumbnail.toDataURL("image/jpeg", 0.78);
      return data.length <= 80_000 ? data : null;
    } catch { return null; }
    finally { this.setSelection(selection); }
  }

  getRendererStats() {
    this.renderNow();
    const { render, memory } = this.renderer.info;
    return { calls: render.calls, triangles: render.triangles, lines: render.lines,
      geometries: memory.geometries, textures: memory.textures, programs: this.renderer.info.programs?.length ?? 0,
      drawingBuffer: { width: this.canvas.width, height: this.canvas.height },
      pixelRatio: this.renderer.getPixelRatio(),
      pixelRatioCap: this.options.maxPixelRatio,
      note: "Draw calls, triangles, geometries, textures and programs are resource counts from one render. They are not FPS, frame time, or phone-performance measurements." };
  }

  renderNow() {
    if (this.disposed) return;
    if (this.bendHandle.group.visible) this.bendHandle.group.quaternion.copy(this.camera.quaternion);
    if (this.touchCue.visible) this.touchCue.quaternion.copy(this.camera.quaternion);
    this.renderer.render(this.scene, this.camera);
  }

  getPresentationInventory() {
    let branchVisualCount = 0;
    let organVisualCount = 0;
    for (const plant of this.plants.values()) {
      branchVisualCount += plant.branches.size;
      organVisualCount += plant.organs.size;
    }
    return {
      plantIds: [...this.plants.keys()].sort(),
      pendingPlantId: this.pendingPlant?.graph.id ?? null,
      pendingBranchVisualCount: this.pendingPlant?.branches.size ?? 0,
      pendingOrganVisualCount: this.pendingPlant?.organs.size ?? 0,
      branchVisualCount,
      organVisualCount,
    };
  }

  getRenderInventory() {
    const inventory: Array<{
      scope: "committed" | "pending";
      plantId: string;
      branchIds: string[];
      organIds: string[];
    }> = [];
    for (const plant of this.plants.values()) {
      inventory.push({
        scope: "committed",
        plantId: plant.graph.id,
        branchIds: [...plant.graph.branches.values()]
          .filter((branch) => branch.active && plant.branches.has(branch.id))
          .map((branch) => branch.id)
          .sort(),
        organIds: [...plant.graph.organs.values()]
          .filter((organ) => organ.active && plant.organs.has(organ.id))
          .map((organ) => organ.id)
          .sort(),
      });
    }
    if (this.pendingPlant) {
      inventory.push({
        scope: "pending",
        plantId: this.pendingPlant.graph.id,
        branchIds: [...this.pendingPlant.graph.branches.values()]
          .filter((branch) => branch.active && this.pendingPlant!.branches.has(branch.id))
          .map((branch) => branch.id)
          .sort(),
        organIds: [...this.pendingPlant.graph.organs.values()]
          .filter((organ) => organ.active && this.pendingPlant!.organs.has(organ.id))
          .map((organ) => organ.id)
          .sort(),
      });
    }
    return inventory.sort((left, right) =>
      left.scope.localeCompare(right.scope) || left.plantId.localeCompare(right.plantId));
  }

  /** Development-only hook used to verify the graph survives WebGL loss. */
  debugForceContextLoss() {
    const supported = Boolean(this.renderer.extensions.get("WEBGL_lose_context"));
    if (!supported) return false;
    this.renderer.forceContextLoss();
    return true;
  }

  debugForceContextRestore() {
    const supported = Boolean(this.renderer.extensions.get("WEBGL_lose_context"));
    if (!supported) return false;
    this.renderer.forceContextRestore();
    this.requestRender();
    return true;
  }

  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    if (this.renderFrame != null) cancelAnimationFrame(this.renderFrame);
    this.renderFrame = null;
    this.resizeObserver?.disconnect();
    this.resizeObserver = null;
    disposeObject(this.scene);
    this.renderer.dispose();
    this.plants.clear();
    this.pendingPlant = null;
  }
}
