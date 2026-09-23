import type { MaterialDefinition } from "../core/index.ts";
import { getMaterialDefinitions } from "../core/index.ts";
import type { Vec3 } from "../core/index.ts";
import { KENZAN_BASE } from "./materialInsertion.ts";

/**
 * Frozen workbench fixture-profile contract.
 *
 * Integrator owns gardenUI.ts / tray HTML. Import these exports instead of
 * cycling `getMaterialDefinitions()` for mixed comparison scenes.
 *
 * This is developer comparison tooling. It does not change working/Garden
 * serialization, insertion ordinals, or material registration.
 */

export const WORKBENCH_SEEDS = [8278, 9255, 10232] as const;
export const WORKBENCH_COUNTS = [1, 2, 6, 12] as const;
export type WorkbenchCount = (typeof WORKBENCH_COUNTS)[number];

/** Suggested / registered tray IDs. Profiles name these explicitly; they do not invent materials. */
export const FLOWERING_BRANCH_MATERIAL_ID = "flowering-branch";
export const LEAFY_SHOOT_MATERIAL_ID = "leafy-shoot";
export const BARE_BRANCH_MATERIAL_ID = "bare-branch";
export const SINGLE_FLOWER_MATERIAL_ID = "single-flower";
export const REED_MATERIAL_ID = "reed";
export const FLOWER_VOLUME_MATERIAL_ID = "flower-volume";
export const ARCHING_TRAILER_MATERIAL_ID = "arching-trailer";
export const FOLIAGE_FAN_MATERIAL_ID = "foliage-fan";
export const BLOSSOM_SPRAY_MATERIAL_ID = "blossom-spray";
export const NODDING_FLOWER_MATERIAL_ID = "nodding-flower";
export const BERRY_TWIG_MATERIAL_ID = "berry-twig";

export const REFERENCE_MATERIAL_IDS = [
  FLOWERING_BRANCH_MATERIAL_ID,
  LEAFY_SHOOT_MATERIAL_ID,
] as const;

/** Legacy picker value. Resolves to `reference-pair`, never to the live catalog. */
export const MIXED_FIXTURE_ALIAS = "mixed";

export type WorkbenchFixtureProfileId =
  | "reference-pair"
  | "references-plus-bare"
  | "references-plus-single-flower"
  | "all-four"
  | "references-plus-reed"
  | "references-plus-flower-volume"
  | "references-plus-arching-trailer"
  | "round3-three"
  | "round3-palette"
  | "references-plus-foliage-fan"
  | "references-plus-blossom-spray"
  | "blossom-compare"
  | "references-plus-nodding-flower"
  | "round4-candidates"
  | "round4-palette"
  | "references-plus-berry-twig"
  | "all-registered-materials";

export interface WorkbenchFixtureProfile {
  readonly id: WorkbenchFixtureProfileId;
  readonly label: string;
  readonly kind: "stable" | "dynamic";
  /**
   * Explicit ordered cycle list, or `"catalog"` for the clearly labeled
   * dynamic profile. Stable profiles never read the live catalog order.
   */
  readonly materialIds: readonly string[] | "catalog";
  readonly notes: string;
}

export const WORKBENCH_FIXTURE_PROFILES: readonly WorkbenchFixtureProfile[] = Object.freeze([
  Object.freeze({
    id: "reference-pair",
    label: "Reference pair (flowering + leafy)",
    kind: "stable",
    materialIds: REFERENCE_MATERIAL_IDS,
    notes: "Stable comparison baseline. Registering another material must not change these graphs.",
  }),
  Object.freeze({
    id: "references-plus-bare",
    label: "References plus bare-branch",
    kind: "stable",
    materialIds: [...REFERENCE_MATERIAL_IDS, BARE_BRANCH_MATERIAL_ID],
    notes: "Flowering → leafy → bare-branch. Requires the bare-branch material to be registered.",
  }),
  Object.freeze({
    id: "references-plus-single-flower",
    label: "References plus single-flower",
    kind: "stable",
    materialIds: [...REFERENCE_MATERIAL_IDS, SINGLE_FLOWER_MATERIAL_ID],
    notes: "Flowering → leafy → single-flower. Requires the single-flower material to be registered.",
  }),
  Object.freeze({
    id: "all-four",
    label: "All four (flowering → leafy → bare → single-flower)",
    kind: "stable",
    materialIds: [
      FLOWERING_BRANCH_MATERIAL_ID,
      LEAFY_SHOOT_MATERIAL_ID,
      BARE_BRANCH_MATERIAL_ID,
      SINGLE_FLOWER_MATERIAL_ID,
    ],
    notes: "Six cuttings are 2+2+1+1 in cycle order, not two of each. Twelve cuttings are three of each.",
  }),
  Object.freeze({
    id: "references-plus-reed",
    label: "References plus reed",
    kind: "stable",
    materialIds: [...REFERENCE_MATERIAL_IDS, REED_MATERIAL_ID],
    notes: "Flowering → leafy → reed. Does not change reference-pair or all-four.",
  }),
  Object.freeze({
    id: "references-plus-flower-volume",
    label: "References plus flower volume",
    kind: "stable",
    materialIds: [...REFERENCE_MATERIAL_IDS, FLOWER_VOLUME_MATERIAL_ID],
    notes: "Flowering → leafy → flower-volume. Does not change reference-pair or all-four.",
  }),
  Object.freeze({
    id: "references-plus-arching-trailer",
    label: "References plus arching trailer",
    kind: "stable",
    materialIds: [...REFERENCE_MATERIAL_IDS, ARCHING_TRAILER_MATERIAL_ID],
    notes: "Flowering → leafy → arching-trailer. Does not change reference-pair or all-four.",
  }),
  Object.freeze({
    id: "round3-three",
    label: "Round 3 three (reed → flower volume → arching trailer)",
    kind: "stable",
    materialIds: [REED_MATERIAL_ID, FLOWER_VOLUME_MATERIAL_ID, ARCHING_TRAILER_MATERIAL_ID],
    notes: "The three Round 3 cuttings only. Six cuttings are two of each. Twelve are four of each.",
  }),
  Object.freeze({
    id: "round3-palette",
    label: "Round 3 palette (established four, then reed → flower volume → arching trailer)",
    kind: "stable",
    materialIds: [
      FLOWERING_BRANCH_MATERIAL_ID,
      LEAFY_SHOOT_MATERIAL_ID,
      BARE_BRANCH_MATERIAL_ID,
      SINGLE_FLOWER_MATERIAL_ID,
      REED_MATERIAL_ID,
      FLOWER_VOLUME_MATERIAL_ID,
      ARCHING_TRAILER_MATERIAL_ID,
    ],
    notes: "Explicit seven-material list, not the live catalog and not all-four. Six cuttings omit the trailer. Twelve cuttings are not equal copies.",
  }),
  Object.freeze({
    id: "references-plus-foliage-fan",
    label: "References plus foliage fan",
    kind: "stable",
    materialIds: [...REFERENCE_MATERIAL_IDS, FOLIAGE_FAN_MATERIAL_ID],
    notes: "Flowering → leafy → foliage-fan. Does not change reference-pair, mixed, all-four, round3-three, or round3-palette.",
  }),
  Object.freeze({
    id: "references-plus-blossom-spray",
    label: "References plus blossom spray",
    kind: "stable",
    materialIds: [...REFERENCE_MATERIAL_IDS, BLOSSOM_SPRAY_MATERIAL_ID],
    notes: "Flowering → leafy → blossom-spray. Does not change reference-pair, mixed, all-four, round3-three, or round3-palette.",
  }),
  Object.freeze({
    id: "blossom-compare",
    label: "Blossom compare (flowering branch → flower volume → blossom spray)",
    kind: "stable",
    materialIds: [FLOWERING_BRANCH_MATERIAL_ID, FLOWER_VOLUME_MATERIAL_ID, BLOSSOM_SPRAY_MATERIAL_ID],
    notes: "Flowering branch, packed flower volume, and blossom spray. Does not change reference-pair, all-four, round3-three, or round3-palette.",
  }),
  Object.freeze({
    id: "references-plus-nodding-flower",
    label: "References plus nodding flower",
    kind: "stable",
    materialIds: [...REFERENCE_MATERIAL_IDS, NODDING_FLOWER_MATERIAL_ID],
    notes: "Flowering → leafy → nodding-flower. Does not change reference-pair, all-four, or the Round 3 profiles.",
  }),
  Object.freeze({
    id: "round4-candidates",
    label: "Round 4 candidates (foliage fan → blossom spray → nodding flower)",
    kind: "stable",
    materialIds: [FOLIAGE_FAN_MATERIAL_ID, BLOSSOM_SPRAY_MATERIAL_ID, NODDING_FLOWER_MATERIAL_ID],
    notes: "The three accepted Round 4 cuttings only, in lane order. Six cuttings are two of each. Twelve are four of each.",
  }),
  Object.freeze({
    id: "round4-palette",
    label: "Round 4 palette (established seven, then foliage fan → blossom spray → nodding flower)",
    kind: "stable",
    materialIds: [
      FLOWERING_BRANCH_MATERIAL_ID,
      LEAFY_SHOOT_MATERIAL_ID,
      BARE_BRANCH_MATERIAL_ID,
      SINGLE_FLOWER_MATERIAL_ID,
      REED_MATERIAL_ID,
      FLOWER_VOLUME_MATERIAL_ID,
      ARCHING_TRAILER_MATERIAL_ID,
      FOLIAGE_FAN_MATERIAL_ID,
      BLOSSOM_SPRAY_MATERIAL_ID,
      NODDING_FLOWER_MATERIAL_ID,
    ],
    notes: "Explicit ten-material list, not the live catalog and not round3-palette. Six cuttings omit the trailer and the three Round 4 cuttings. Twelve cuttings are two flowering, two leafy, and one of each remaining material.",
  }),
  Object.freeze({
    id: "references-plus-berry-twig",
    label: "References plus berry twig",
    kind: "stable",
    materialIds: [...REFERENCE_MATERIAL_IDS, BERRY_TWIG_MATERIAL_ID],
    notes: "Flowering → leafy → berry-twig. Does not change reference-pair, mixed, all-four, round3-three, round3-palette, round4-candidates, or round4-palette.",
  }),
  Object.freeze({
    id: "all-registered-materials",
    label: "All registered materials (dynamic)",
    kind: "dynamic",
    materialIds: "catalog",
    notes: "Not a stable comparison scene. Cycles whatever the live catalog returns. Label reports as dynamic.",
  }),
]);

export function getWorkbenchFixtureProfile(id: string): WorkbenchFixtureProfile | null {
  const canonical = id === MIXED_FIXTURE_ALIAS ? "reference-pair" : id;
  return WORKBENCH_FIXTURE_PROFILES.find((profile) => profile.id === canonical) ?? null;
}

export interface WorkbenchCuttingPlan {
  readonly index: number;
  readonly plantId: string;
  readonly seed: number;
  readonly materialId: string;
  readonly base: Vec3;
  readonly generatorVersion?: string;
}

export interface WorkbenchSequenceComposition {
  readonly materialSequence: readonly string[];
  readonly assignedMaterialIds: readonly string[];
  readonly countsByMaterialId: Readonly<Record<string, number>>;
  readonly balancedEqualCopies: boolean;
  readonly warnings: readonly string[];
}

export interface ResolvedWorkbenchFixture {
  readonly fixtureId: string;
  readonly profileId: string;
  readonly kind: "stable-profile" | "dynamic-profile" | "single-material";
  readonly materialSequence: readonly string[];
  readonly dynamic: boolean;
  readonly missingMaterialIds: readonly string[];
  readonly notes: string;
}

export interface WorkbenchFixtureOption {
  readonly id: string;
  readonly label: string;
  readonly kind: ResolvedWorkbenchFixture["kind"];
  readonly materialIds: readonly string[];
  readonly available: boolean;
  readonly missingMaterialIds: readonly string[];
  readonly notes: string;
}

export function isWorkbenchCount(count: number): count is WorkbenchCount {
  return (WORKBENCH_COUNTS as readonly number[]).includes(count);
}

export function workbenchCuttingSeed(startSeed: number, index: number): number {
  return (startSeed + 977 * index) >>> 0;
}

export function workbenchCuttingBase(index: number): Vec3 {
  const angle = index * 2.399963;
  const radius = Math.min(0.86, Math.sqrt(index) * 0.28);
  return { x: Math.sin(angle) * radius, y: KENZAN_BASE.y, z: Math.cos(angle) * radius };
}

export function workbenchPlantId(index: number): string {
  return `plant-${index + 1}`;
}

export function planWorkbenchCuttings(
  materialSequence: readonly string[],
  seed: number,
  count: number,
): WorkbenchCuttingPlan[] {
  if (!materialSequence.length) throw new Error("Fixture material sequence is empty.");
  return Array.from({ length: count }, (_, index) => ({
    index,
    plantId: workbenchPlantId(index),
    seed: workbenchCuttingSeed(seed, index),
    materialId: materialSequence[index % materialSequence.length]!,
    base: workbenchCuttingBase(index),
  }));
}

export function describeMaterialSequenceComposition(
  materialSequence: readonly string[],
  count: number,
): WorkbenchSequenceComposition {
  const assignedMaterialIds = planWorkbenchCuttings(materialSequence, 0, count).map((cutting) => cutting.materialId);
  const countsByMaterialId: Record<string, number> = {};
  for (const materialId of assignedMaterialIds) countsByMaterialId[materialId] = (countsByMaterialId[materialId] ?? 0) + 1;
  const copies = Object.values(countsByMaterialId);
  const balancedEqualCopies = copies.length > 0 && copies.every((value) => value === copies[0]);
  const warnings: string[] = [];
  if (materialSequence.length === 4 && count === 6) {
    warnings.push("A six-cutting four-material cycle is 2+2+1+1 in sequence order, not two of each.");
  } else if (!balancedEqualCopies && materialSequence.length > 1) {
    warnings.push("This count does not give equal copies of each listed material.");
  }
  const omitted = materialSequence.filter((materialId) => (countsByMaterialId[materialId] ?? 0) === 0);
  if (omitted.length > 0) {
    warnings.push(`This count omits ${omitted.join(", ")} because the cycle is longer than the cutting count.`);
  }
  return { materialSequence, assignedMaterialIds, countsByMaterialId, balancedEqualCopies, warnings };
}

export function resolveWorkbenchFixture(
  fixtureId: string,
  catalog: readonly MaterialDefinition[] = getMaterialDefinitions(),
): ResolvedWorkbenchFixture {
  const profile = getWorkbenchFixtureProfile(fixtureId);
  if (profile) {
    const materialSequence = profile.materialIds === "catalog"
      ? catalog.map((material) => material.materialId)
      : [...profile.materialIds];
    const missingMaterialIds = materialSequence.filter(
      (materialId) => !catalog.some((material) => material.materialId === materialId),
    );
    return {
      fixtureId,
      profileId: profile.id,
      kind: profile.kind === "dynamic" ? "dynamic-profile" : "stable-profile",
      materialSequence,
      dynamic: profile.kind === "dynamic",
      missingMaterialIds,
      notes: profile.notes,
    };
  }
  if (catalog.some((material) => material.materialId === fixtureId)) {
    return {
      fixtureId,
      profileId: fixtureId,
      kind: "single-material",
      materialSequence: [fixtureId],
      dynamic: false,
      missingMaterialIds: [],
      notes: "Repeats this one registered material.",
    };
  }
  return {
    fixtureId,
    profileId: fixtureId,
    kind: "single-material",
    materialSequence: [fixtureId],
    dynamic: false,
    missingMaterialIds: [fixtureId],
    notes: "Unknown fixture material or profile.",
  };
}

/**
 * Options the workbench modal can render. Single registered materials first,
 * then named profiles. Unavailable candidate profiles stay listed so the
 * integrator can disable them rather than invent a catalog-cycling mixed scene.
 */
export function listWorkbenchFixtureOptions(
  catalog: readonly MaterialDefinition[] = getMaterialDefinitions(),
): WorkbenchFixtureOption[] {
  const singles: WorkbenchFixtureOption[] = catalog.map((material) => ({
    id: material.materialId,
    label: material.materialId.replaceAll("-", " "),
    kind: "single-material",
    materialIds: [material.materialId],
    available: true,
    missingMaterialIds: [],
    notes: "Repeats this one registered material.",
  }));
  const profiles: WorkbenchFixtureOption[] = WORKBENCH_FIXTURE_PROFILES.map((profile) => {
    const resolved = resolveWorkbenchFixture(profile.id, catalog);
    return {
      id: profile.id,
      label: profile.label,
      kind: resolved.kind,
      materialIds: resolved.materialSequence,
      available: resolved.missingMaterialIds.length === 0 && resolved.materialSequence.length > 0,
      missingMaterialIds: resolved.missingMaterialIds,
      notes: profile.notes,
    };
  });
  return [...singles, ...profiles];
}
