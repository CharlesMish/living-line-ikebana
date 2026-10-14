import type { BranchKind } from "../core/types.ts";
import type { MaterialAppearance } from "./materialAppearance.ts";

/** Scene presentation, never generator or organ identity. Every instance of a
 * material family in one bowl shares its chosen tone, including new cuttings. */
export interface TonePatch {
  branches?: Partial<Record<BranchKind, number>>;
  leaf?: number;
  vein?: number;
  bloom?: number;
  bud?: number;
  berry?: number;
}
interface Tone { id: string; label: string; patch: TonePatch }
const natural: Tone = { id: "natural", label: "Natural", patch: {} };
const tone = (id: string, label: string, patch: TonePatch): Tone => ({ id, label, patch });
const wood = (trunk: number, lateral: number, twig: number) => ({ trunk, lateral, twig });
export const BOTANICAL_FAMILIES = [
  { id: "flowering-branch", label: "Flowering branch", versions: ["one-branch-v1"], tones: [natural,
    tone("porcelain", "Porcelain blossom", { bloom: 0xe8ded3, bud: 0xb7999c, branches: wood(0x594539, 0x695043, 0x785d48) }),
    tone("rose", "Deep rose", { bloom: 0xc46e87, bud: 0x934052, branches: wood(0x473b35, 0x554439, 0x655043) })] },
  { id: "single-flower", label: "Single flower", versions: ["single-flower-v1"], more: true, tones: [natural,
    tone("rose", "Warm rose", { bloom: 0xd8949c }), tone("lilac", "Soft lilac", { bloom: 0xb79cce })] },
  { id: "violet-sprig", label: "Violet sprig", versions: ["violet-sprig-v1"], tones: [natural,
    tone("lavender", "Pale lavender", { bloom: 0xc1a6df }), tone("amethyst", "Amethyst", { bloom: 0x8561b1 })] },
  { id: "indigo-spire", label: "Indigo spire", versions: ["indigo-spire-v1"], tones: [natural,
    tone("blue", "Blue dusk", { bloom: 0x657dba }), tone("lilac", "Silver lilac", { bloom: 0xafa0c9 })] },
  { id: "starry-pincushion", label: "Starry pincushion", versions: ["starry-pincushion-v1"], tones: [natural,
    tone("plum", "Muted plum", { bloom: 0xbb8fa9 }), tone("green", "Pale green", { bloom: 0xd1dfb6 })] },
  { id: "compact-flower", label: "Compact flower", versions: ["compact-flower-v1"], tones: [natural,
    tone("ivory", "Warm ivory", { bloom: 0xe7d8b7 }), tone("plum", "Muted plum", { bloom: 0x98708e })] },
  { id: "flower-volume", label: "Flower volume", versions: ["flower-volume-v1"], more: true, tones: [natural,
    tone("peach", "Dusty peach", { bloom: 0xd6a089 }), tone("plum", "Deep plum", { bloom: 0x8e587a })] },
  { id: "blossom-spray", label: "Blossom spray", versions: ["blossom-spray-v1", "blossom-spray-v2"], tones: [natural,
    tone("butter", "Butter cream", { bloom: 0xe8d898 }), tone("mauve", "Pale mauve", { bloom: 0xc3a5cb })] },
  { id: "nodding-flower", label: "Nodding flower", versions: ["nodding-flower-v1", "nodding-flower-v2"], tones: [natural,
    tone("violet", "Blue violet", { bloom: 0x8c7abd }), tone("pearl", "Pearl lilac", { bloom: 0xd4c9dc })] },
  { id: "berry-twig", label: "Berry twig", versions: ["berry-twig-v1"], tones: [natural,
    tone("rust", "Rust berries", { berry: 0xc86d39, branches: wood(0x735641, 0x82634b, 0x82634b) }),
    tone("wine", "Dark wine", { berry: 0x7c354e, branches: wood(0x594338, 0x6a5141, 0x6a5141) })] },
  { id: "bare-branch", label: "Bare branch", versions: ["bare-branch-v1"], more: true, tones: [natural,
    tone("walnut", "Warm walnut", { branches: wood(0x604535, 0x715240, 0x80614c) }),
    tone("silver", "Weathered silver", { branches: wood(0x79786b, 0x888577, 0x95907f) })] },
  { id: "leafy-shoot", label: "Leafy shoot", versions: ["leafy-shoot-v1"], more: true, tones: [natural,
    tone("olive", "Olive", { leaf: 0x718047, vein: 0xa2ad6f }), tone("deep-green", "Deep green", { leaf: 0x345b47, vein: 0x749264 })] },
  { id: "foliage-fan", label: "Foliage fan", versions: ["foliage-fan-v1"], tones: [natural,
    tone("olive", "Warm olive", { leaf: 0x747d43, vein: 0xbcc787 }), tone("forest", "Forest", { leaf: 0x315843, vein: 0x9bb889 })] },
  { id: "fern-frond", label: "Fern frond", versions: ["fern-frond-v1", "fern-frond-v2"], tones: [natural,
    tone("emerald", "Deep emerald", { leaf: 0x4f8961, vein: 0xa3cba0 }), tone("lime", "Young lime", { leaf: 0x94af5a, vein: 0xd7e6a2 })] },
  { id: "lobed-leaf", label: "Lobed-leaf branch", versions: ["lobed-leaf-v1"], tones: [natural,
    tone("ochre", "Autumn ochre", { leaf: 0xc09539, vein: 0xddb765 }), tone("russet", "Autumn russet", { leaf: 0xa85239, vein: 0xcc8a56 })] },
  { id: "broad-blade", label: "Broad leaf", versions: ["broad-blade-v1"], tones: [natural,
    tone("deep-green", "Deep green", { leaf: 0x355c43, vein: 0x6d8956 }), tone("olive", "Soft olive", { leaf: 0x63784a, vein: 0x93a76c })] },
] as const;
export type BotanicalFamilyId = typeof BOTANICAL_FAMILIES[number]["id"];
export type BotanicalTones = Partial<Record<BotanicalFamilyId, string>>;
export type BotanicalAppearance = MaterialAppearance & { readonly budColor: number };

/** Unknown keys/presets are refused. Natural is represented by absence so old
 * scenes remain byte-shape compatible and resetting does not add empty fields. */
export function validateBotanicalTones(value: unknown): BotanicalTones | undefined {
  if (value === undefined) return undefined;
  if (!value || typeof value !== "object" || Array.isArray(value)
    || ![Object.prototype, null].includes(Object.getPrototypeOf(value))) throw new Error("This botanical tone setting cannot be opened.");
  const checked: BotanicalTones = {};
  for (const [key, preset] of Object.entries(value)) {
    const family = BOTANICAL_FAMILIES.find(item => item.id === key);
    if (!family || typeof preset !== "string" || !family.tones.some(item => item.id === preset)) throw new Error("This botanical tone setting cannot be opened.");
    if (preset !== "natural") checked[family.id] = preset;
  }
  return Object.keys(checked).length ? checked : undefined;
}

export function botanicalFamily(generatorVersion: string) {
  return BOTANICAL_FAMILIES.find(family => (family.versions as readonly string[]).includes(generatorVersion));
}
export function botanicalTonePatch(generatorVersion: string, choices?: BotanicalTones): TonePatch {
  const family = botanicalFamily(generatorVersion);
  const preset = family && choices?.[family.id];
  return family?.tones.find(item => item.id === preset)?.patch ?? natural.patch;
}
export function resolveBotanicalAppearance(generatorVersion: string, base: MaterialAppearance, choices?: BotanicalTones): BotanicalAppearance {
  const patch = botanicalTonePatch(generatorVersion, choices);
  return {
    ...base,
    branchColors: patch.branches ? { ...base.branchColors, ...patch.branches } : base.branchColors,
    leaf: patch.leaf === undefined && patch.vein === undefined ? base.leaf : { ...base.leaf, color: patch.leaf ?? base.leaf.color, veinColor: patch.vein ?? base.leaf.veinColor },
    bloom: patch.bloom === undefined ? base.bloom : { ...base.bloom, color: patch.bloom },
    ...(base.berry ? { berry: patch.berry === undefined ? base.berry : { ...base.berry, color: patch.berry } } : {}),
    budColor: patch.bud ?? 0xa64f59,
  };
}
