import { createArchingTrailer, ARCHING_TRAILER_VERSION } from "./archingTrailer.ts";
import { createBlossomSpray, BLOSSOM_SPRAY_VERSION } from "./blossomSpray.ts";
import { createFoliageFan, FOLIAGE_FAN_VERSION } from "./foliageFan.ts";
import { createNoddingFlower, NODDING_FLOWER_VERSION } from "./noddingFlower.ts";
import { createBareBranch, BARE_BRANCH_VERSION } from "./bareBranch.ts";
import { createFlowerVolume, FLOWER_VOLUME_VERSION } from "./flowerVolume.ts";
import { createFloweringBranch, successfulSeatIdentity } from "./generator.ts";
import { createLeafyShoot, LEAFY_SHOOT_VERSION } from "./leafyShoot.ts";
import { createReed, REED_VERSION } from "./reed.ts";
import { createSingleFlower, SINGLE_FLOWER_VERSION } from "./singleFlower.ts";
import type { Vec3 } from "./math.ts";
import { GENERATOR_VERSION, type PlantGraph } from "./types.ts";

export type PlantGenerator = (id: string, seed: number, base: Vec3) => PlantGraph;

/** A durable generator contract that can be referenced by persisted graphs. */
export interface GeneratorDefinition {
  readonly generatorVersion: string;
  readonly generate: PlantGenerator;
}

/** A stable tray/catalog identity that deliberately stays outside PlantGraph. */
export interface MaterialDefinition {
  readonly materialId: string;
  readonly generator: GeneratorDefinition;
}

export type MaterialInsertionPreparation =
  | {
      readonly ok: true;
      readonly material: MaterialDefinition;
      readonly ordinal: number;
      readonly plantId: string;
      readonly seed: number;
      readonly graph: PlantGraph;
    }
  | {
      readonly ok: false;
      readonly reason:
        | "unknown-material"
        | "unsupported-generator-version"
        | "generator-version-mismatch";
      readonly materialId: string;
    };

const oneBranchV1: GeneratorDefinition = Object.freeze({
  generatorVersion: GENERATOR_VERSION,
  // Preserve the existing generator as the implementation authority for this
  // material and its golden fixture.
  generate: createFloweringBranch,
});

const leafyShootV1: GeneratorDefinition = Object.freeze({
  generatorVersion: LEAFY_SHOOT_VERSION,
  generate: createLeafyShoot,
});

const bareBranchV1: GeneratorDefinition = Object.freeze({
  generatorVersion: BARE_BRANCH_VERSION,
  generate: createBareBranch,
});

const singleFlowerV1: GeneratorDefinition = Object.freeze({
  generatorVersion: SINGLE_FLOWER_VERSION,
  generate: createSingleFlower,
});

const reedV1: GeneratorDefinition = Object.freeze({
  generatorVersion: REED_VERSION,
  generate: createReed,
});

const flowerVolumeV1: GeneratorDefinition = Object.freeze({
  generatorVersion: FLOWER_VOLUME_VERSION,
  generate: createFlowerVolume,
});

const archingTrailerV1: GeneratorDefinition = Object.freeze({
  generatorVersion: ARCHING_TRAILER_VERSION,
  generate: createArchingTrailer,
});

const foliageFanV1: GeneratorDefinition = Object.freeze({
  generatorVersion: FOLIAGE_FAN_VERSION,
  generate: createFoliageFan,
});

const blossomSprayV1: GeneratorDefinition = Object.freeze({
  generatorVersion: BLOSSOM_SPRAY_VERSION,
  generate: createBlossomSpray,
});

const noddingFlowerV1: GeneratorDefinition = Object.freeze({
  generatorVersion: NODDING_FLOWER_VERSION,
  generate: createNoddingFlower,
});

// Keep both registries private and immutable. Adding a persistent generator is
// an additive source change here; adding a tray material points it at one of
// those durable generator definitions.
const generatorRegistry: readonly GeneratorDefinition[] = Object.freeze([
  oneBranchV1,
  leafyShootV1,
  bareBranchV1,
  singleFlowerV1,
  reedV1,
  flowerVolumeV1,
  archingTrailerV1,
  foliageFanV1,
  blossomSprayV1,
  noddingFlowerV1,
]);

/**
 * Established catalog, then the accepted Round 4 cuttings in lane order.
 * The first seven IDs stay in their previous order. Named profiles
 * `reference-pair`, `all-four`, `round3-three`, and `round3-palette` do not
 * read this list. `round4-palette` is an explicit copy of this order.
 */
const materialCatalog: readonly MaterialDefinition[] = Object.freeze([
  Object.freeze({ materialId: "flowering-branch", generator: oneBranchV1 }),
  Object.freeze({ materialId: "leafy-shoot", generator: leafyShootV1 }),
  Object.freeze({ materialId: "bare-branch", generator: bareBranchV1 }),
  Object.freeze({ materialId: "single-flower", generator: singleFlowerV1 }),
  Object.freeze({ materialId: "reed", generator: reedV1 }),
  Object.freeze({ materialId: "flower-volume", generator: flowerVolumeV1 }),
  Object.freeze({ materialId: "arching-trailer", generator: archingTrailerV1 }),
  Object.freeze({ materialId: "foliage-fan", generator: foliageFanV1 }),
  Object.freeze({ materialId: "blossom-spray", generator: blossomSprayV1 }),
  Object.freeze({ materialId: "nodding-flower", generator: noddingFlowerV1 }),
]);

export function getGeneratorDefinition(generatorVersion: string): GeneratorDefinition | null {
  return generatorRegistry.find((definition) => definition.generatorVersion === generatorVersion) ?? null;
}

export function isSupportedGeneratorVersion(generatorVersion: string): boolean {
  return getGeneratorDefinition(generatorVersion) !== null;
}

export function getMaterialDefinitions(): readonly MaterialDefinition[] { return materialCatalog; }

export function getMaterialDefinition(materialId: string): MaterialDefinition | null {
  return materialCatalog.find((definition) => definition.materialId === materialId) ?? null;
}

/**
 * Creates the one reserved graph that both pointer and keyboard insertion
 * paths use. Material identity remains only in this transient preparation
 * result; the graph persists its generatorVersion, never a materialId.
 */
export function prepareMaterialInsertion(
  materialId: string,
  ordinal: number,
  base: Vec3,
): MaterialInsertionPreparation {
  const material = getMaterialDefinition(materialId);
  if (!material) return { ok: false, reason: "unknown-material", materialId };
  if (!isSupportedGeneratorVersion(material.generator.generatorVersion)) {
    return { ok: false, reason: "unsupported-generator-version", materialId };
  }

  const identity = successfulSeatIdentity(ordinal);
  const graph = material.generator.generate(identity.id, identity.seed, base);
  if (graph.generatorVersion !== material.generator.generatorVersion) {
    return { ok: false, reason: "generator-version-mismatch", materialId };
  }

  return {
    ok: true,
    material,
    ordinal,
    plantId: identity.id,
    seed: identity.seed,
    graph,
  };
}
